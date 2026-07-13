"""课堂计划的权限与班级范围规则。"""

from typing import Callable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity, ClassroomPlan
from app.services.classroom import normalize_class_name


class ClassroomPlanPermissionError(ValueError):
    """课堂计划对象级权限校验失败。"""


async def load_and_validate_activities(
    db: AsyncSession,
    activity_ids: List[int],
    *,
    owner_id: Optional[int],
    is_global_manager: bool,
    validate_scope: Optional[Callable[[List[ClassroomActivity]], str]] = None,
) -> List[ClassroomActivity]:
    """锁定活动并验证存在性、归属和班级范围。"""
    unique_ids = list(dict.fromkeys(activity_ids))
    if len(unique_ids) != len(activity_ids):
        raise ValueError("课堂计划不能重复引用同一活动")
    result = await db.execute(
        select(ClassroomActivity)
        .where(ClassroomActivity.id.in_(unique_ids))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    activities = result.scalars().all()
    by_id = {activity.id: activity for activity in activities}
    missing_ids = [activity_id for activity_id in unique_ids if activity_id not in by_id]
    if missing_ids:
        raise ValueError(f"活动不存在：{missing_ids}")
    ordered = [by_id[activity_id] for activity_id in activity_ids]
    if owner_id is not None and not is_global_manager:
        if any(activity.created_by != owner_id for activity in ordered):
            raise ClassroomPlanPermissionError("无权使用他人创建的课堂活动")
    (validate_scope or validate_activity_class_scope)(ordered)
    return ordered


def validate_activity_class_scope(activities: List[ClassroomActivity]) -> str:
    """确保计划内活动都有班级且严格属于同一班级。"""
    class_names: set[str] = set()
    for activity in activities:
        class_name = normalize_class_name(activity.class_name)
        if not class_name:
            raise ValueError("课堂计划中的活动必须设置班级")
        if activity.class_name != class_name:
            activity.class_name = class_name
        class_names.add(class_name)
    if len(class_names) != 1:
        raise ValueError("课堂计划中的活动必须属于同一班级")
    return next(iter(class_names))


def validate_plan_class_scope(plan: ClassroomPlan) -> str:
    """从计划条目收集活动并复用班级一致性校验。"""
    activities = []
    for item in plan.items:
        if item.activity is None:
            raise ValueError("课堂计划引用的活动不存在")
        activities.append(item.activity)
    if not activities:
        raise ValueError("计划中没有题目")
    return validate_activity_class_scope(activities)


def assert_plan_manageable(
    plan: ClassroomPlan,
    owner_id: Optional[int],
    is_global_manager: bool,
) -> None:
    """普通教师只能管理自己创建且仅包含自己活动的计划。"""
    if is_global_manager:
        return
    if owner_id is None:
        raise ClassroomPlanPermissionError("课堂计划操作缺少操作者身份")
    owns_all_activities = all(
        item.activity is not None and item.activity.created_by == owner_id
        for item in plan.items
    )
    if plan.created_by != owner_id or not owns_all_activities:
        raise ClassroomPlanPermissionError("无权操作他人创建的课堂计划")
