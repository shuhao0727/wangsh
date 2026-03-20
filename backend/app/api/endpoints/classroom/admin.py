"""课堂互动 - 管理端 API"""

import asyncio
import json
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_admin
from app.schemas.user_info import UserInfo
from app.schemas.classroom import ActivityCreate, ActivityUpdate, ActivityEndRequest, ActivityResponse, ActivityStats
from app.services import classroom as svc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/")
async def create_activity(
    data: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
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
    current_user: UserInfo = Depends(require_admin),
):
    try:
        activity = await svc.update_activity(db, activity_id, data.dict(exclude_unset=True))
        return _to_response(activity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        await svc.delete_activity(db, activity_id)
        return {"message": "已删除"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def list_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    rows, total = await svc.list_activities(db, skip=skip, limit=limit, status=status)
    items = [_to_response(a) for a in rows]
    return {"items": items, "total": total, "page": skip // limit + 1, "page_size": limit}


@router.get("/{activity_id}")
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        activity = await svc.get_activity(db, activity_id)
        stats = await svc.get_statistics(db, activity_id)
        activity._response_count = stats["total_responses"]
        resp = _to_response(activity)
        resp["stats"] = stats
        return resp
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{activity_id}/start")
async def start_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        activity = await svc.start_activity(db, activity_id)
        return _to_response(activity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{activity_id}/end")
async def end_activity(
    activity_id: int,
    req: ActivityEndRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
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
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return await svc.get_statistics(db, activity_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stream")
async def admin_stream(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    user_id = current_user.get("id")
    channel = f"admin_{user_id}"
    sub_id = str(uuid.uuid4())

    async def gen():
        q = svc.subscribe(channel, sub_id)
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
            svc.unsubscribe(channel, sub_id)

    return StreamingResponse(gen(), media_type="text/event-stream")


def _to_response(activity) -> dict:
    from app.services.classroom import calc_remaining
    resp_count = getattr(activity, "_response_count", 0)
    return {
        "id": activity.id,
        "activity_type": activity.activity_type,
        "title": activity.title,
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
