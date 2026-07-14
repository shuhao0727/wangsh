"""课堂活动超时认领与幂等结束。"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity


EndActivity = Callable[[AsyncSession, int], Awaitable[ClassroomActivity]]


async def auto_end_overdue_activities(
    db: AsyncSession,
    *,
    end_activity: EndActivity,
) -> None:
    """用跳锁逐条认领超时活动，避免多进程重复结束。"""
    now = datetime.now(timezone.utc)
    activity_ids = (
        await db.execute(
            select(ClassroomActivity.id).where(
                ClassroomActivity.status == "active",
                ClassroomActivity.time_limit > 0,
                ClassroomActivity.started_at.is_not(None),
                func.extract("epoch", now - ClassroomActivity.started_at)
                >= ClassroomActivity.time_limit,
            )
        )
    ).scalars().all()

    for activity_id in activity_ids:
        activity = (
            await db.execute(
                select(ClassroomActivity)
                .where(ClassroomActivity.id == activity_id)
                .with_for_update(skip_locked=True)
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()
        if activity is None or not activity_is_overdue(activity, now=now):
            await db.rollback()
            continue
        await end_activity(db, activity_id)


async def ensure_activity_not_overdue(
    db: AsyncSession,
    activity: ClassroomActivity,
    *,
    end_activity: EndActivity,
) -> bool:
    if not activity_is_overdue(activity):
        return False
    await end_activity(db, activity.id)
    return True


def activity_is_overdue(
    activity: ClassroomActivity,
    *,
    now: datetime | None = None,
) -> bool:
    if activity.status != "active":
        return False
    if activity.time_limit <= 0 or not activity.started_at:
        return False
    current_time = now or datetime.now(timezone.utc)
    elapsed = (current_time - activity.started_at).total_seconds()
    return elapsed >= activity.time_limit
