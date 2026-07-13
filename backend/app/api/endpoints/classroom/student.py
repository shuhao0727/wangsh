"""课堂互动 - 学生端 API"""

import asyncio
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_student
from app.schemas.user_info import UserInfo
from app.schemas.classroom import ResponseSubmit
from app.services import classroom as svc
from app.services.classroom import calc_remaining, normalize_class_name

from loguru import logger
router = APIRouter()


def _student_safe_stats(stats: dict) -> dict:
    """学生端统计只保留判定结果，不暴露任何标准答案字段。"""
    safe_stats = dict(stats)
    safe_stats["blank_slot_stats"] = [
        {key: value for key, value in slot.items() if key != "correct_answer"}
        for slot in (stats.get("blank_slot_stats") or [])
    ]
    return safe_stats


def _assert_student_activity_access(activity, current_user: UserInfo) -> None:
    """学生与活动必须具有完全相同的非空班级。"""
    student_class = normalize_class_name(current_user.get("class_name"))
    activity_class = normalize_class_name(activity.class_name)
    if not student_class or not activity_class or student_class != activity_class:
        raise HTTPException(status_code=403, detail="无权访问其他班级的课堂活动")


def _student_stream_channel(current_user: UserInfo) -> str:
    class_name = normalize_class_name(current_user.get("class_name"))
    if not class_name:
        raise HTTPException(status_code=403, detail="学生尚未分配班级")
    return f"student_{class_name}"


@router.get("/active")
async def get_active_activities(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_student),
):
    class_name = normalize_class_name(current_user.get("class_name"))
    activities = await svc.get_active_activities(db, class_name=class_name)
    user_id = current_user.get("id")
    result = []
    for a in activities:
        my_resp = await svc.get_user_response(db, a.id, user_id)
        result.append(_to_student_view(a, my_resp))
    return result


@router.get("/stream")
async def student_stream(
    current_user: UserInfo = Depends(require_student),
):
    sub_id = str(uuid.uuid4())
    channel = _student_stream_channel(current_user)

    async def gen():
        q = await svc.subscribe(channel, sub_id)
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ":keepalive\n\n"
                except asyncio.CancelledError:
                    break
        finally:
            await svc.unsubscribe(channel, sub_id)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/{activity_id}")
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_student),
):
    try:
        activity = await svc.get_activity(db, activity_id)
        _assert_student_activity_access(activity, current_user)
        my_resp = await svc.get_user_response(db, activity_id, current_user.get("id"))
        view = _to_student_view(activity, my_resp)
        if activity.status == "ended":
            view["stats"] = _student_safe_stats(
                await svc.get_statistics(
                    db,
                    activity_id,
                    include_correct_answers=False,
                )
            )
        return view
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{activity_id}/respond")
async def submit_response(
    activity_id: int,
    data: ResponseSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_student),
):
    try:
        activity = await svc.get_activity(db, activity_id)
        _assert_student_activity_access(activity, current_user)
        resp = await svc.submit_response(db, activity_id, current_user.get("id"), data.answer)
        return {
            "id": resp.id,
            "answer": resp.answer,
            "is_correct": resp.is_correct,
            "submitted_at": resp.submitted_at.isoformat() if resp.submitted_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{activity_id}/result")
async def get_result(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_student),
):
    try:
        activity = await svc.get_activity(db, activity_id)
        _assert_student_activity_access(activity, current_user)
        if activity.status != "ended":
            raise HTTPException(status_code=400, detail="活动尚未结束")
        my_resp = await svc.get_user_response(db, activity_id, current_user.get("id"))
        stats = _student_safe_stats(
            await svc.get_statistics(
                db,
                activity_id,
                include_correct_answers=False,
            )
        )
        return {
            "id": activity.id,
            "activity_type": activity.activity_type,
            "title": activity.title,
            "options": activity.options,
            "allow_multiple": activity.allow_multiple,
            "my_answer": my_resp.answer if my_resp else None,
            "is_correct": my_resp.is_correct if my_resp else None,
            "stats": stats,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


def _to_student_view(activity, my_resp=None) -> dict:
    return {
        "id": activity.id,
        "activity_type": activity.activity_type,
        "title": activity.title,
        "class_name": normalize_class_name(activity.class_name),
        "description": activity.description,
        "options": activity.options,
        "allow_multiple": activity.allow_multiple,
        "time_limit": activity.time_limit,
        "status": activity.status,
        "started_at": activity.started_at.isoformat() if activity.started_at else None,
        "remaining_seconds": calc_remaining(activity),
        "my_answer": my_resp.answer if my_resp else None,
    }
