"""课堂计划 API - 管理端 + 学生端"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.user_info import UserInfo
from app.services import classroom_plan as svc
from app.models.classroom import ClassroomPlanItem

router = APIRouter()


# ── Schemas ──

class PlanCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    activity_ids: List[int] = Field(..., min_length=1)


class PlanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    activity_ids: Optional[List[int]] = None


def _format_item(item: ClassroomPlanItem) -> dict:
    act = item.activity
    return {
        "id": item.id,
        "activity_id": item.activity_id,
        "order_index": item.order_index,
        "status": item.status,
        "activity": {
            "id": act.id,
            "title": act.title,
            "activity_type": act.activity_type,
            "time_limit": act.time_limit,
            "status": act.status,
            "options": act.options,
            "correct_answer": act.correct_answer,
            "allow_multiple": act.allow_multiple,
        } if act else None,
    }


def _format_plan(plan) -> dict:
    return {
        "id": plan.id,
        "title": plan.title,
        "status": plan.status,
        "current_item_id": plan.current_item_id,
        "created_by": plan.created_by,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "items": [_format_item(it) for it in sorted(plan.items, key=lambda x: x.order_index)],
    }


# ── 管理端 ──

@router.post("/admin")
async def create_plan(
    data: PlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        plan = await svc.create_plan(db, data.title, data.activity_ids, current_user.get("id"))
        return _format_plan(plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/{plan_id}")
async def update_plan(
    plan_id: int,
    data: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        plan = await svc.update_plan(db, plan_id, data.title, data.activity_ids)
        return _format_plan(plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/admin/{plan_id}")
async def delete_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        await svc.delete_plan(db, plan_id)
        return {"message": "已删除"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/admin")
async def list_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    plans, total = await svc.list_plans(db, skip=skip, limit=limit)
    return {"items": [_format_plan(p) for p in plans], "total": total}


@router.get("/admin/{plan_id}")
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return _format_plan(await svc.get_plan(db, plan_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/admin/{plan_id}/start")
async def start_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return _format_plan(await svc.start_plan(db, plan_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/reset")
async def reset_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return _format_plan(await svc.reset_plan(db, plan_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/next")
async def next_item(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return _format_plan(await svc.next_item(db, plan_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/end")
async def end_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return _format_plan(await svc.end_plan(db, plan_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/items/{item_id}/start")
async def start_item(
    plan_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return _format_plan(await svc.start_item(db, plan_id, item_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/items/{item_id}/end")
async def end_item(
    plan_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    try:
        return _format_plan(await svc.end_item(db, plan_id, item_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 学生端 ──

@router.get("/active-plan")
async def get_active_plan(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """获取当前进行中的计划（学生端轮询）"""
    plan = await svc.get_active_plan(db)
    if not plan:
        return None
    return _format_plan(plan)
