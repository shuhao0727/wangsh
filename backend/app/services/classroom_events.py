"""课堂活动提交后的事件发布与后台任务投递。"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession


PublishEvent = Callable[[str, dict[str, Any]], Awaitable[None]]
EnqueueAnalysis = Callable[[int], Awaitable[None]]
MarkEnqueueFailed = Callable[
    [AsyncSession, int, Exception],
    Awaitable[None],
]


async def dispatch_activity_events(
    db: AsyncSession,
    events: Sequence[dict[str, Any]],
    *,
    publish_event: PublishEvent,
    enqueue_analysis: EnqueueAnalysis,
    mark_enqueue_failed: MarkEnqueueFailed,
) -> None:
    """先发布全部状态事件，再投递去重后的结束分析任务。"""
    ended_activity_ids: list[int] = []
    for event in events:
        activity_id = event["activity_id"]
        event_type = event["type"]
        class_name = event.get("class_name")
        student_channel = (
            f"student_{class_name}"
            if class_name
            else f"student_unassigned_activity_{activity_id}"
        )
        payload = {"type": event_type, "activity_id": activity_id}
        await publish_event(student_channel, payload)
        await publish_event(f"admin_{event['created_by']}", payload)
        await publish_event("admin_global", payload)
        if event_type == "activity_ended":
            ended_activity_ids.append(activity_id)

    for activity_id in dict.fromkeys(ended_activity_ids):
        try:
            await enqueue_analysis(activity_id)
        except Exception as exc:
            logger.exception(
                "课堂活动自动分析任务入队失败: activity_id={}",
                activity_id,
            )
            try:
                await mark_enqueue_failed(db, activity_id, exc)
            except Exception:
                await db.rollback()
                logger.exception(
                    "课堂活动分析入队失败状态写入失败: activity_id={}",
                    activity_id,
                )
