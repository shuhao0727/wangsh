"""课堂计划 API - 管理端 + 学生端"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_staff, require_student
from app.schemas.user_info import UserInfo
from app.services import classroom_plan as svc
from app.services import classroom as activity_svc
from app.services.classroom import normalize_class_name
from app.models.classroom import ClassroomPlanItem

router = APIRouter()


# ── Schemas ──

class PlanCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    activity_ids: List[int] = Field(..., min_length=1)


class PlanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    activity_ids: Optional[List[int]] = None


def _is_global_manager(current_user: UserInfo) -> bool:
    return current_user.get("role_code") in {"admin", "super_admin"}


async def _assert_can_manage_plan(
    db: AsyncSession,
    plan_id: int,
    current_user: UserInfo,
):
    plan = await svc.get_plan(db, plan_id)
    if _is_global_manager(current_user):
        return plan
    user_id = current_user.get("id")
    owns_all_activities = all(
        item.activity is not None and item.activity.created_by == user_id
        for item in plan.items
    )
    if plan.created_by != user_id or not owns_all_activities:
        raise HTTPException(status_code=403, detail="无权操作他人创建的课堂计划")
    return plan


async def _assert_activities_manageable(
    db: AsyncSession,
    activity_ids: List[int],
    current_user: UserInfo,
) -> None:
    is_global_manager = _is_global_manager(current_user)
    user_id = current_user.get("id")
    class_names: set[str] = set()
    for activity_id in activity_ids:
        try:
            activity = await activity_svc._get_activity(db, activity_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not is_global_manager and activity.created_by != user_id:
            raise HTTPException(status_code=403, detail="无权使用他人创建的课堂活动")
        class_name = normalize_class_name(activity.class_name)
        if not class_name:
            raise HTTPException(status_code=400, detail="课堂计划中的活动必须设置班级")
        class_names.add(class_name)
    if len(class_names) != 1:
        raise HTTPException(status_code=400, detail="课堂计划中的活动必须属于同一班级")


def _assert_plan_class_scope(plan) -> None:
    class_names: set[str] = set()
    for item in plan.items:
        activity = item.activity
        class_name = normalize_class_name(getattr(activity, "class_name", None))
        if not class_name:
            raise HTTPException(status_code=400, detail="课堂计划中的活动必须设置班级")
        class_names.add(class_name)
    if len(class_names) != 1:
        raise HTTPException(status_code=400, detail="课堂计划中的活动必须属于同一班级")


def _format_item(
    item: ClassroomPlanItem,
    *,
    include_correct_answer: bool = True,
) -> dict:
    act = item.activity
    activity = None
    if act:
        activity = {
            "id": act.id,
            "title": act.title,
            "activity_type": act.activity_type,
            "time_limit": act.time_limit,
            "status": act.status,
            "options": act.options,
            "allow_multiple": act.allow_multiple,
        }
        if include_correct_answer:
            activity["correct_answer"] = act.correct_answer
    return {
        "id": item.id,
        "activity_id": item.activity_id,
        "order_index": item.order_index,
        "status": item.status,
        "activity": activity,
    }


def _format_plan(plan, *, include_correct_answer: bool = True) -> dict:
    return {
        "id": plan.id,
        "title": plan.title,
        "status": plan.status,
        "current_item_id": plan.current_item_id,
        "created_by": plan.created_by,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "items": [
            _format_item(it, include_correct_answer=include_correct_answer)
            for it in sorted(plan.items, key=lambda x: x.order_index)
        ],
    }


# ── 管理端 ──

@router.post("/admin")
async def create_plan(
    data: PlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_activities_manageable(db, data.activity_ids, current_user)
        plan = await svc.create_plan(
            db,
            data.title,
            data.activity_ids,
            current_user.get("id"),
            is_global_manager=_is_global_manager(current_user),
        )
        return _format_plan(plan)
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/{plan_id}")
async def update_plan(
    plan_id: int,
    data: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        if data.activity_ids is not None:
            await _assert_activities_manageable(db, data.activity_ids, current_user)
        plan = await svc.update_plan(
            db,
            plan_id,
            data.title,
            data.activity_ids,
            owner_id=current_user.get("id"),
            is_global_manager=_is_global_manager(current_user),
        )
        return _format_plan(plan)
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/admin/{plan_id}")
async def delete_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        await svc.delete_plan(
            db,
            plan_id,
            owner_id=current_user.get("id"),
            is_global_manager=_is_global_manager(current_user),
        )
        return {"message": "已删除"}
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/admin")
async def list_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    owner_id = None if _is_global_manager(current_user) else current_user.get("id")
    plans, total = await svc.list_plans(db, skip=skip, limit=limit, owner_id=owner_id)
    return {"items": [_format_plan(p) for p in plans], "total": total}


@router.get("/admin/{plan_id}")
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        return _format_plan(await svc.get_plan(db, plan_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/admin/{plan_id}/start")
async def start_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        plan = await _assert_can_manage_plan(db, plan_id, current_user)
        _assert_plan_class_scope(plan)
        return _format_plan(
            await svc.start_plan(
                db,
                plan_id,
                owner_id=current_user.get("id"),
                is_global_manager=_is_global_manager(current_user),
            )
        )
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/reset")
async def reset_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        return _format_plan(
            await svc.reset_plan(
                db,
                plan_id,
                owner_id=current_user.get("id"),
                is_global_manager=_is_global_manager(current_user),
            )
        )
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/next")
async def next_item(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        return _format_plan(
            await svc.next_item(
                db,
                plan_id,
                owner_id=current_user.get("id"),
                is_global_manager=_is_global_manager(current_user),
            )
        )
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/end")
async def end_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        return _format_plan(
            await svc.end_plan(
                db,
                plan_id,
                owner_id=current_user.get("id"),
                is_global_manager=_is_global_manager(current_user),
            )
        )
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/items/{item_id}/start")
async def start_item(
    plan_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        return _format_plan(
            await svc.start_item(
                db,
                plan_id,
                item_id,
                owner_id=current_user.get("id"),
                is_global_manager=_is_global_manager(current_user),
            )
        )
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/{plan_id}/items/{item_id}/end")
async def end_item(
    plan_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_staff),
):
    try:
        await _assert_can_manage_plan(db, plan_id, current_user)
        return _format_plan(
            await svc.end_item(
                db,
                plan_id,
                item_id,
                owner_id=current_user.get("id"),
                is_global_manager=_is_global_manager(current_user),
            )
        )
    except svc.ClassroomPlanPermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 学生端 ──

@router.get("/active-plan")
async def get_active_plan(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_student),
):
    """获取当前进行中的计划（学生端轮询）"""
    plan = await svc.get_active_plan(db, class_name=current_user.get("class_name"))
    if not plan:
        return None
    return _format_plan(plan, include_correct_answer=False)
