"""课堂计划的权限与班级范围规则。"""

from typing import Callable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity, ClassroomPlan
from app.services.classroom import normalize_class_name


class ClassroomPlanPermissionError(ValueError):
    """课堂计划对象级权限校验失败。"""


def _activity_label(activity: ClassroomActivity) -> str:
    """生成可直接展示给教师的活动标识。"""
    activity_id = getattr(activity, "id", None)
    title = str(getattr(activity, "title", "") or "").strip()
    if activity_id is not None and title:
        return f"活动 {activity_id}「{title}」"
    if activity_id is not None:
        return f"活动 {activity_id}"
    if title:
        return f"活动「{title}」"
    return "未命名活动"


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
    if not activities:
        raise ValueError("计划中没有题目")

    missing_class = []
    activities_by_class: dict[str, list[ClassroomActivity]] = {}
    for activity in activities:
        class_name = normalize_class_name(activity.class_name)
        if not class_name:
            missing_class.append(activity)
            continue
        if activity.class_name != class_name:
            activity.class_name = class_name
        activities_by_class.setdefault(class_name, []).append(activity)

    if missing_class:
        labels = "、".join(_activity_label(activity) for activity in missing_class)
        raise ValueError(
            f"{labels}未设置班级，无法用于课堂计划；"
            "若为已结束的历史活动，请复制活动，在副本中补充班级后重新加入计划"
        )

    if len(activities_by_class) != 1:
        class_details = "；".join(
            f"{class_name}（{'、'.join(_activity_label(activity) for activity in grouped)}）"
            for class_name, grouped in activities_by_class.items()
        )
        raise ValueError(f"课堂计划中的活动必须属于同一班级，当前班级不一致：{class_details}")
    return next(iter(activities_by_class))


def validate_plan_class_scope(plan: ClassroomPlan) -> str:
    """从计划条目收集活动并复用班级一致性校验。"""
    activities = []
    missing_activity_ids = []
    for item in plan.items:
        if item.activity is None:
            missing_activity_ids.append(getattr(item, "activity_id", None))
            continue
        activities.append(item.activity)
    if missing_activity_ids:
        labels = "、".join(
            f"活动 {activity_id}" if activity_id is not None else "未知活动"
            for activity_id in missing_activity_ids
        )
        raise ValueError(f"课堂计划引用的活动不存在：{labels}")
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
