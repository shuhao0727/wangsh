"""课堂互动 - 管理端 API"""

import asyncio
import json
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_staff
from app.schemas.user_info import UserInfo
from app.schemas.classroom import ActivityCreate, ActivityUpdate, ActivityEndRequest, ActivityResponse, ActivityStats
from app.services import classroom as svc
from app.services.classroom import normalize_class_name

from loguru import logger
router = APIRouter()


def _is_global_manager(current_user: UserInfo) -> bool:
    return current_user.get("role_code") in {"admin", "super_admin"}


def _admin_stream_channel(current_user: UserInfo) -> str:
    if _is_global_manager(current_user):
        return "admin_global"
    return f"admin_{current_user.get('id')}"


async def _assert_can_manage_activity(
    db: AsyncSession,
    activity_id: int,
    current_user: UserInfo,
) -> None:
    """教师仅可管理自己的活动，管理员角色可全局管理。"""
    activity = await svc._get_activity(db, activity_id)
    if not _is_global_manager(current_user) and activity.created_by != current_user.get("id"):
        raise HTTPException(status_code=403, detail="无权操作他人创建的活动")


@router.get("/stream")
async def admin_stream(
    current_user: UserInfo = Depends(require_staff),
):
    channel = _admin_stream_channel(current_user)
    sub_id = str(uuid.uuid4())

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


@router.post("/")
async def create_activity(
    data: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        activity = await svc.create_activity(db, data.dict(), current_user.get("id"))
        return _to_response(activity)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{activity_id}")
async def update_activity(
    activity_id: int,
    data: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        # 教师不应能修改他人创建的活动草稿
        await _assert_can_manage_activity(db, activity_id, current_user)
        activity = await svc.update_activity(db, activity_id, data.dict(exclude_unset=True))
        return _to_response(activity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_activity(db, activity_id, current_user)
        await svc.delete_activity(db, activity_id)
        return {"message": "已删除"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{activity_id}/duplicate")
async def duplicate_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    """复制活动为新草稿"""
    try:
        await _assert_can_manage_activity(db, activity_id, current_user)
        activity = await svc.duplicate_activity(db, activity_id, current_user.get("id"))
        return _to_response(activity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{activity_id}/restart")
async def restart_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    """重新开始已结束的活动"""
    try:
        await _assert_can_manage_activity(db, activity_id, current_user)
        activity = await svc.restart_activity(db, activity_id)
        return _to_response(activity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bulk-delete")
async def bulk_delete_activities(
    ids: List[int] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    """批量删除活动（只删除 draft 状态）

    权限校验：批量中只要有一个不属于当前教师创建（且非超管），
    即拒绝整批删除并返回越权的活动 ID，避免部分删除导致的不一致。
    不存在的 ID 一并视为非法，整批拒绝。
    """
    if not ids:
        raise HTTPException(status_code=400, detail="请提供要删除的活动 ID 列表")

    # 管理员角色放行整批；普通教师逐条校验 created_by
    if not _is_global_manager(current_user):
        forbidden: List[int] = []
        for aid in ids:
            try:
                activity = await svc._get_activity(db, aid)
            except ValueError:
                # 批量中存在不合法（不存在）的 ID，整批拒绝
                raise HTTPException(status_code=400, detail=f"批量中存在不存在的活动 ID：{aid}")
            if activity.created_by != current_user.get("id"):
                forbidden.append(aid)
        if forbidden:
            raise HTTPException(
                status_code=403,
                detail=f"无权删除他人创建的活动，越权 ID：{forbidden}",
            )

    result = await svc.bulk_delete_activities(db, ids)
    await svc.publish("admin_global", {"type": "activity_changed", "action": "bulk_delete"})
    return result


@router.get("/")
async def list_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    owner_id = None if _is_global_manager(current_user) else current_user.get("id")
    rows, rc_map, total = await svc.list_activities(
        db,
        skip=skip,
        limit=limit,
        status=status,
        owner_id=owner_id,
    )
    items = [_to_response(a, response_count=rc_map.get(a.id, 0)) for a in rows]
    return {"items": items, "total": total, "page": skip // limit + 1, "page_size": limit}


@router.get("/{activity_id}")
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_activity(db, activity_id, current_user)
        activity = await svc.get_activity(db, activity_id)
        stats = await svc.get_statistics(db, activity_id)
        resp = _to_response(activity, response_count=stats["total_responses"])
        resp["stats"] = stats
        return resp
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{activity_id}/start")
async def start_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_activity(db, activity_id, current_user)
        activity = await svc.start_activity(db, activity_id)
        return _to_response(activity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{activity_id}/end")
async def end_activity(
    activity_id: int,
    req: ActivityEndRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_activity(db, activity_id, current_user)
        activity = await svc.end_activity(
            db,
            activity_id,
            analysis_agent_id=(req.analysis_agent_id if req else None),
            analysis_prompt=(req.analysis_prompt if req else None),
        )
        return _to_response(activity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{activity_id}/statistics")
async def get_statistics(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_activity(db, activity_id, current_user)
        return await svc.get_statistics(db, activity_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


def _to_response(activity, response_count: int = 0) -> dict:
    from app.services.classroom import calc_remaining
    resp_count = response_count
    return {
        "id": activity.id,
        "activity_type": activity.activity_type,
        "title": activity.title,
        "class_name": normalize_class_name(activity.class_name),
        "description": activity.description,
        "options": activity.options,
        "correct_answer": activity.correct_answer,
        "allow_multiple": activity.allow_multiple,
        "time_limit": activity.time_limit,
        "status": activity.status,
        "started_at": activity.started_at.isoformat() if activity.started_at else None,
        "ended_at": activity.ended_at.isoformat() if activity.ended_at else None,
        "created_by": activity.created_by,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
        "response_count": resp_count,
        "remaining_seconds": calc_remaining(activity),
        "analysis_agent_id": activity.analysis_agent_id,
        "analysis_prompt": activity.analysis_prompt,
        "analysis_status": activity.analysis_status,
        "analysis_result": activity.analysis_result,
        "analysis_context": activity.analysis_context,
        "analysis_error": activity.analysis_error,
        "analysis_updated_at": activity.analysis_updated_at.isoformat() if activity.analysis_updated_at else None,
    }
