"""课堂计划 Service 层"""

from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.classroom import ClassroomActivity, ClassroomPlan, ClassroomPlanItem
from app.models.core.user import User
from app.services import classroom as activity_svc
from app.services.classroom_plan_rules import (
    ClassroomPlanPermissionError,
    assert_plan_manageable as _assert_plan_manageable,
    load_and_validate_activities as _load_and_validate_activities_impl,
    validate_activity_class_scope as _validate_activity_class_scope,
    validate_plan_class_scope as _validate_plan_class_scope,
)


async def _load_and_validate_activities(
    db: AsyncSession,
    activity_ids: List[int],
    *,
    owner_id: Optional[int],
    is_global_manager: bool,
) -> List[ClassroomActivity]:
    """兼容入口：保留原模块 monkeypatch 和调用路径。"""
    return await _load_and_validate_activities_impl(
        db,
        activity_ids,
        owner_id=owner_id,
        is_global_manager=is_global_manager,
        validate_scope=_validate_activity_class_scope,
    )


async def create_plan(
    db: AsyncSession,
    title: str,
    activity_ids: List[int],
    user_id: int,
    *,
    is_global_manager: bool = False,
) -> ClassroomPlan:
    await _load_and_validate_activities(
        db,
        activity_ids,
        owner_id=user_id,
        is_global_manager=is_global_manager,
    )
    plan = ClassroomPlan(title=title, status="draft", created_by=user_id)
    db.add(plan)
    await db.flush()  # get plan.id
    for i, aid in enumerate(activity_ids):
        item = ClassroomPlanItem(plan_id=plan.id, activity_id=aid, order_index=i, status="pending")
        db.add(item)
    await db.commit()
    return await _get_plan(db, plan.id)


async def update_plan(
    db: AsyncSession,
    plan_id: int,
    title: Optional[str],
    activity_ids: Optional[List[int]],
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
) -> ClassroomPlan:
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status != "draft":
        if plan.status == "active":
            raise ValueError("进行中的计划不可编辑")
        raise ValueError("只有草稿状态的计划可以编辑")
    if activity_ids is not None:
        await _load_and_validate_activities(
            db,
            activity_ids,
            owner_id=owner_id,
            is_global_manager=is_global_manager,
        )
    if title is not None:
        plan.title = title
    if activity_ids is not None:
        # 删除旧 items，重建
        for item in list(plan.items):
            await db.delete(item)
        await db.flush()
        for i, aid in enumerate(activity_ids):
            item = ClassroomPlanItem(plan_id=plan.id, activity_id=aid, order_index=i, status="pending")
            db.add(item)
    await db.commit()
    return await _get_plan(db, plan.id)


async def delete_plan(
    db: AsyncSession,
    plan_id: int,
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
):
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status != "draft":
        if plan.status == "active":
            raise ValueError("进行中的计划不可删除")
        raise ValueError("只有草稿状态的计划可以删除")
    await db.delete(plan)
    await db.commit()


async def list_plans(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 20,
    owner_id: Optional[int] = None,
) -> tuple:
    count_q = select(func.count(ClassroomPlan.id))
    q = select(ClassroomPlan)
    if owner_id is not None:
        owner_scope = (
            (ClassroomPlan.created_by == owner_id)
            & ~ClassroomPlan.items.any(
                ClassroomPlanItem.activity.has(ClassroomActivity.created_by != owner_id)
            )
        )
        count_q = count_q.where(owner_scope)
        q = q.where(owner_scope)
    total = (await db.execute(count_q)).scalar() or 0
    q = q.options(
        selectinload(ClassroomPlan.items).selectinload(ClassroomPlanItem.activity)
    ).order_by(ClassroomPlan.id.desc()).offset(skip).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return rows, total


async def get_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    return await _get_plan(db, plan_id)


async def start_plan(
    db: AsyncSession,
    plan_id: int,
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
) -> ClassroomPlan:
    """启动计划（不自动开始第一题，等老师手动点下一题）"""
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status != "draft":
        raise ValueError("只有草稿状态的计划可以启动")
    _validate_plan_class_scope(plan)
    plan.status = "active"
    await db.commit()
    return await _get_plan(db, plan.id)


async def next_item(
    db: AsyncSession,
    plan_id: int,
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
) -> ClassroomPlan:
    """开始计划中的下一题"""
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status != "active":
        raise ValueError("计划未在进行中")
    _validate_plan_class_scope(plan)
    deferred_events: list[dict] = []

    items = sorted(plan.items, key=lambda x: x.order_index)
    if not items:
        raise ValueError("计划中没有题目")

    # 结束当前进行中的活动
    current = next((it for it in items if it.status == "active"), None)
    try:
        if current:
            await activity_svc.end_activity(
                db,
                current.activity_id,
                analysis_agent_id=current.activity.analysis_agent_id,
                analysis_prompt=current.activity.analysis_prompt,
                commit=False,
                deferred_events=deferred_events,
            )
            current.status = "ended"
            await db.flush()

        # 找下一个 pending 的题目
        pending = next((it for it in items if it.status == "pending"), None)
        if not pending:
            # 全部结束，结束计划
            plan.status = "ended"
            plan.current_item_id = None
            await db.commit()
        else:
            # 开始下一题的活动（根据活动状态选择 start 或 restart）
            act = pending.activity
            if act and act.status == "ended":
                await activity_svc.restart_activity(
                    db,
                    pending.activity_id,
                    commit=False,
                    deferred_events=deferred_events,
                )
            else:
                await activity_svc.start_activity(
                    db,
                    pending.activity_id,
                    commit=False,
                    deferred_events=deferred_events,
                )
            pending.status = "active"
            plan.current_item_id = pending.id
            await db.commit()
    except BaseException:
        await db.rollback()
        raise

    await activity_svc.dispatch_activity_events(db, deferred_events)
    return await _get_plan(db, plan.id)


async def reset_plan(
    db: AsyncSession,
    plan_id: int,
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
) -> ClassroomPlan:
    """重置已结束的计划回草稿状态（所有 items 重置为 pending）"""
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status != "ended":
        raise ValueError("只能重置已结束的计划")
    plan.status = "draft"
    plan.current_item_id = None
    for item in plan.items:
        item.status = "pending"
    await db.commit()
    return await _get_plan(db, plan.id)


async def start_item(
    db: AsyncSession,
    plan_id: int,
    item_id: int,
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
) -> ClassroomPlan:
    """单独开始计划中某个 item（先结束当前 active item）"""
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status != "active":
        raise ValueError("计划未在进行中")
    _validate_plan_class_scope(plan)
    items = {it.id: it for it in plan.items}
    target = items.get(item_id)
    if not target:
        raise ValueError("item 不存在")
    if target.status == "active":
        raise ValueError("该题目已在进行中")
    deferred_events: list[dict] = []
    # 结束当前 active item
    current = next((it for it in plan.items if it.status == "active"), None)
    try:
        if current:
            await activity_svc.end_activity(
                db,
                current.activity_id,
                analysis_agent_id=current.activity.analysis_agent_id,
                analysis_prompt=current.activity.analysis_prompt,
                commit=False,
                deferred_events=deferred_events,
            )
            current.status = "ended"
            await db.flush()
        # 开始目标 item（根据活动状态选择 start 或 restart）
        if target.activity and target.activity.status == "ended":
            await activity_svc.restart_activity(
                db,
                target.activity_id,
                commit=False,
                deferred_events=deferred_events,
            )
        else:
            await activity_svc.start_activity(
                db,
                target.activity_id,
                commit=False,
                deferred_events=deferred_events,
            )
        target.status = "active"
        plan.current_item_id = target.id
        await db.commit()
    except BaseException:
        await db.rollback()
        raise
    await activity_svc.dispatch_activity_events(db, deferred_events)
    return await _get_plan(db, plan.id)


async def end_item(
    db: AsyncSession,
    plan_id: int,
    item_id: int,
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
) -> ClassroomPlan:
    """单独结束计划中某个 item"""
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status != "active":
        raise ValueError("计划未在进行中")
    items = {it.id: it for it in plan.items}
    target = items.get(item_id)
    if not target:
        raise ValueError("item 不存在")
    if target.status != "active":
        raise ValueError("该题目未在进行中")
    deferred_events: list[dict] = []
    try:
        await activity_svc.end_activity(
            db,
            target.activity_id,
            analysis_agent_id=target.activity.analysis_agent_id,
            analysis_prompt=target.activity.analysis_prompt,
            commit=False,
            deferred_events=deferred_events,
        )
        target.status = "ended"
        if plan.current_item_id == target.id:
            plan.current_item_id = None
        await db.commit()
    except BaseException:
        await db.rollback()
        raise
    await activity_svc.dispatch_activity_events(db, deferred_events)
    return await _get_plan(db, plan.id)


async def end_plan(
    db: AsyncSession,
    plan_id: int,
    *,
    owner_id: Optional[int],
    is_global_manager: bool = False,
) -> ClassroomPlan:
    """强制结束计划"""
    plan = await _get_locked_plan(db, plan_id)
    _assert_plan_manageable(plan, owner_id, is_global_manager)
    if plan.status == "ended":
        raise ValueError("计划已结束")
    deferred_events: list[dict] = []
    # 结束当前进行中的活动
    try:
        for item in plan.items:
            if item.status == "active":
                await activity_svc.end_activity(
                    db,
                    item.activity_id,
                    analysis_agent_id=item.activity.analysis_agent_id,
                    analysis_prompt=item.activity.analysis_prompt,
                    commit=False,
                    deferred_events=deferred_events,
                )
                item.status = "ended"
        plan.status = "ended"
        plan.current_item_id = None
        await db.commit()
    except BaseException:
        await db.rollback()
        raise
    await activity_svc.dispatch_activity_events(db, deferred_events)
    return await _get_plan(db, plan.id)


# ── 学生端 ──

async def get_active_plan(
    db: AsyncSession,
    class_name: Optional[str] = None,
) -> Optional[ClassroomPlan]:
    """返回所有活动都严格属于学生班级的最新进行中计划。"""
    class_name = activity_svc.normalize_class_name(class_name)
    if not class_name:
        return None
    q = select(ClassroomPlan).where(ClassroomPlan.status == "active").options(
        selectinload(ClassroomPlan.items).selectinload(ClassroomPlanItem.activity)
    ).order_by(ClassroomPlan.id.desc())
    result = await db.execute(q)
    for plan in result.scalars().all():
        activities = [item.activity for item in plan.items if item.activity is not None]
        if activities and len(activities) == len(plan.items) and all(
            activity_svc.normalize_class_name(activity.class_name) == class_name
            for activity in activities
        ):
            return plan
    return None


async def _get_locked_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    """锁定计划、items 和活动，并刷新已加载活动，避免校验后被并发改班。"""
    plan = await _get_plan(db, plan_id)
    locked_plan = (
        await db.execute(
            select(ClassroomPlan)
            .where(ClassroomPlan.id == plan_id)
            .options(
                selectinload(ClassroomPlan.items).selectinload(
                    ClassroomPlanItem.activity
                )
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if locked_plan is not None:
        plan = locked_plan

    item_ids = [item.id for item in plan.items]
    if item_ids:
        await db.execute(
            select(ClassroomPlanItem)
            .where(ClassroomPlanItem.id.in_(item_ids))
            .options(selectinload(ClassroomPlanItem.activity))
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    owner_ids = {
        owner_id
        for owner_id in [
            getattr(plan, "created_by", None),
            *[
                getattr(item.activity, "created_by", None)
                for item in plan.items
                if item.activity is not None
            ],
        ]
        if owner_id is not None
    }
    if owner_ids:
        await db.execute(
            select(User.id)
            .where(User.id.in_(sorted(owner_ids)))
            .order_by(User.id.asc())
            .with_for_update()
        )

    activity_ids = [item.activity_id for item in plan.items]
    if activity_ids:
        await db.execute(
            select(ClassroomActivity)
            .where(ClassroomActivity.id.in_(activity_ids))
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    return plan


async def _get_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    q = select(ClassroomPlan).where(ClassroomPlan.id == plan_id).options(
        selectinload(ClassroomPlan.items).selectinload(ClassroomPlanItem.activity)
    )
    result = await db.execute(q)
    plan = result.scalar_one_or_none()
    if not plan:
        raise ValueError(f"计划 {plan_id} 不存在")
    return plan
