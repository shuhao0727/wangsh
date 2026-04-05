"""课堂互动 - 学生端 API"""

import asyncio
import json
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import get_current_user
from app.schemas.user_info import UserInfo
from app.schemas.classroom import ResponseSubmit
from app.services import classroom as svc
from app.services.classroom import calc_remaining

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/active")
async def get_active_activities(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    activities = await svc.get_active_activities(db)
    user_id = current_user.get("id")
    result = []
    for a in activities:
        my_resp = await svc.get_user_response(db, a.id, user_id)
        result.append(_to_student_view(a, my_resp))
    return result


@router.get("/stream")
async def student_stream(
    current_user: UserInfo = Depends(get_current_user),
):
    sub_id = str(uuid.uuid4())

    async def gen():
        q = await svc.subscribe("student", sub_id)
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
            await svc.unsubscribe("student", sub_id)

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
    current_user: UserInfo = Depends(get_current_user),
):
    try:
        activity = await svc.get_activity(db, activity_id)
        my_resp = await svc.get_user_response(db, activity_id, current_user.get("id"))
        view = _to_student_view(activity, my_resp)
        if activity.status == "ended":
            view["correct_answer"] = activity.correct_answer
            view["stats"] = await svc.get_statistics(db, activity_id)
        return view
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{activity_id}/respond")
async def submit_response(
    activity_id: int,
    data: ResponseSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    try:
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
    current_user: UserInfo = Depends(get_current_user),
):
    try:
        activity = await svc.get_activity(db, activity_id)
        if activity.status != "ended":
            raise HTTPException(status_code=400, detail="活动尚未结束")
        my_resp = await svc.get_user_response(db, activity_id, current_user.get("id"))
        stats = await svc.get_statistics(db, activity_id)
        return {
            "id": activity.id,
            "activity_type": activity.activity_type,
            "title": activity.title,
            "options": activity.options,
            "correct_answer": activity.correct_answer,
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
        "options": activity.options,
        "allow_multiple": activity.allow_multiple,
        "time_limit": activity.time_limit,
        "status": activity.status,
        "started_at": activity.started_at.isoformat() if activity.started_at else None,
        "remaining_seconds": calc_remaining(activity),
        "my_answer": my_resp.answer if my_resp else None,
    }
