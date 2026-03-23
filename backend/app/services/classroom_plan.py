"""课堂计划 Service 层"""

import logging
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.classroom import ClassroomActivity, ClassroomPlan, ClassroomPlanItem
from app.services import classroom as activity_svc

logger = logging.getLogger(__name__)


async def create_plan(db: AsyncSession, title: str, activity_ids: List[int], user_id: int) -> ClassroomPlan:
    plan = ClassroomPlan(title=title, status="draft", created_by=user_id)
    db.add(plan)
    await db.flush()  # get plan.id
    for i, aid in enumerate(activity_ids):
        item = ClassroomPlanItem(plan_id=plan.id, activity_id=aid, order_index=i, status="pending")
        db.add(item)
    await db.commit()
    return await _get_plan(db, plan.id)


async def update_plan(db: AsyncSession, plan_id: int, title: Optional[str], activity_ids: Optional[List[int]]) -> ClassroomPlan:
    plan = await _get_plan(db, plan_id)
    if plan.status == "active":
        raise ValueError("进行中的计划不可编辑")
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


async def delete_plan(db: AsyncSession, plan_id: int):
    plan = await _get_plan(db, plan_id)
    if plan.status == "active":
        raise ValueError("进行中的计划不可删除")
    await db.delete(plan)
    await db.commit()


async def list_plans(db: AsyncSession, *, skip: int = 0, limit: int = 20) -> tuple:
    count_q = select(func.count(ClassroomPlan.id))
    total = (await db.execute(count_q)).scalar() or 0
    q = select(ClassroomPlan).options(selectinload(ClassroomPlan.items).selectinload(ClassroomPlanItem.activity)).order_by(ClassroomPlan.id.desc()).offset(skip).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return rows, total


async def get_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    return await _get_plan(db, plan_id)


async def start_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    """启动计划（不自动开始第一题，等老师手动点下一题）"""
    plan = await _get_plan(db, plan_id)
    if plan.status != "draft":
        raise ValueError("只有草稿状态的计划可以启动")
    plan.status = "active"
    await db.commit()
    return await _get_plan(db, plan.id)


async def next_item(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    """开始计划中的下一题"""
    plan = await _get_plan(db, plan_id)
    if plan.status != "active":
        raise ValueError("计划未在进行中")

    items = sorted(plan.items, key=lambda x: x.order_index)
    if not items:
        raise ValueError("计划中没有题目")

    # 结束当前进行中的活动
    current = next((it for it in items if it.status == "active"), None)
    if current:
        try:
            await activity_svc.end_activity(
                db, current.activity_id,
                analysis_agent_id=current.activity.analysis_agent_id,
                analysis_prompt=current.activity.analysis_prompt,
            )
        except Exception:
            pass
        current.status = "ended"
        await db.flush()

    # 找下一个 pending 的题目
    pending = next((it for it in items if it.status == "pending"), None)
    if not pending:
        # 全部结束，结束计划
        plan.status = "ended"
        plan.current_item_id = None
        await db.commit()
        return await _get_plan(db, plan.id)

    # 开始下一题的活动（根据活动状态选择 start 或 restart）
    act = pending.activity
    try:
        if act and act.status == "ended":
            await activity_svc.restart_activity(db, pending.activity_id)
        else:
            await activity_svc.start_activity(db, pending.activity_id)
    except Exception as e:
        logger.warning("next_item: 启动活动 %s 失败: %s", pending.activity_id, e)
    pending.status = "active"
    plan.current_item_id = pending.id
    await db.commit()
    return await _get_plan(db, plan.id)


async def reset_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    """重置已结束的计划回草稿状态（所有 items 重置为 pending）"""
    plan = await _get_plan(db, plan_id)
    if plan.status != "ended":
        raise ValueError("只能重置已结束的计划")
    plan.status = "draft"
    plan.current_item_id = None
    for item in plan.items:
        item.status = "pending"
    await db.commit()
    return await _get_plan(db, plan.id)


async def start_item(db: AsyncSession, plan_id: int, item_id: int) -> ClassroomPlan:
    """单独开始计划中某个 item（先结束当前 active item）"""
    plan = await _get_plan(db, plan_id)
    if plan.status != "active":
        raise ValueError("计划未在进行中")
    items = {it.id: it for it in plan.items}
    target = items.get(item_id)
    if not target:
        raise ValueError("item 不存在")
    if target.status == "active":
        raise ValueError("该题目已在进行中")
    # 结束当前 active item
    current = next((it for it in plan.items if it.status == "active"), None)
    if current:
        try:
            await activity_svc.end_activity(
                db, current.activity_id,
                analysis_agent_id=current.activity.analysis_agent_id,
                analysis_prompt=current.activity.analysis_prompt,
            )
        except Exception as e:
            logger.warning("start_item: 结束活动 %s 失败: %s", current.activity_id, e)
        current.status = "ended"
        await db.flush()
    # 开始目标 item（根据活动状态选择 start 或 restart）
    try:
        if target.activity and target.activity.status == "ended":
            await activity_svc.restart_activity(db, target.activity_id)
        else:
            await activity_svc.start_activity(db, target.activity_id)
    except Exception as e:
        logger.warning("start_item: 启动活动 %s 失败: %s", target.activity_id, e)
    target.status = "active"
    plan.current_item_id = target.id
    await db.commit()
    return await _get_plan(db, plan.id)


async def end_item(db: AsyncSession, plan_id: int, item_id: int) -> ClassroomPlan:
    """单独结束计划中某个 item"""
    plan = await _get_plan(db, plan_id)
    if plan.status != "active":
        raise ValueError("计划未在进行中")
    items = {it.id: it for it in plan.items}
    target = items.get(item_id)
    if not target:
        raise ValueError("item 不存在")
    if target.status != "active":
        raise ValueError("该题目未在进行中")
    try:
        await activity_svc.end_activity(
            db, target.activity_id,
            analysis_agent_id=target.activity.analysis_agent_id,
            analysis_prompt=target.activity.analysis_prompt,
        )
    except Exception:
        pass
    target.status = "ended"
    if plan.current_item_id == target.id:
        plan.current_item_id = None
    await db.commit()
    return await _get_plan(db, plan.id)


async def end_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    """强制结束计划"""
    plan = await _get_plan(db, plan_id)
    if plan.status == "ended":
        raise ValueError("计划已结束")
    # 结束当前进行中的活动
    for item in plan.items:
        if item.status == "active":
            try:
                await activity_svc.end_activity(
                    db, item.activity_id,
                    analysis_agent_id=item.activity.analysis_agent_id,
                    analysis_prompt=item.activity.analysis_prompt,
                )
            except Exception:
                pass
            item.status = "ended"
    plan.status = "ended"
    plan.current_item_id = None
    await db.commit()
    return await _get_plan(db, plan.id)


# ── 学生端 ──

async def get_active_plan(db: AsyncSession) -> Optional[ClassroomPlan]:
    """获取当前进行中的计划（用于学生端展示）"""
    q = select(ClassroomPlan).where(ClassroomPlan.status == "active").options(
        selectinload(ClassroomPlan.items).selectinload(ClassroomPlanItem.activity)
    ).order_by(ClassroomPlan.id.desc()).limit(1)
    result = await db.execute(q)
    return result.scalar_one_or_none()


async def _get_plan(db: AsyncSession, plan_id: int) -> ClassroomPlan:
    q = select(ClassroomPlan).where(ClassroomPlan.id == plan_id).options(
        selectinload(ClassroomPlan.items).selectinload(ClassroomPlanItem.activity)
    )
    result = await db.execute(q)
    plan = result.scalar_one_or_none()
    if not plan:
        raise ValueError(f"计划 {plan_id} 不存在")
    return plan
