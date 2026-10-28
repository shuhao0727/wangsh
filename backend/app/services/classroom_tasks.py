"""课堂活动结束后自动分析的入队与失败标记。

从 ``classroom.py`` 抽出：这三个函数是「同步 service」与「Celery 异步任务」
之间的适配层，不承载任何课堂业务规则。单独成文件后，classroom.py 只保留
业务编排，任务投递细节集中在这里。

依赖以参数传入，而不是在模块间互相 import，避免 classroom ←→ tasks 的环。
"""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.classroom_analysis import (
    mark_analysis_enqueue_failed,
    run_auto_analysis_for_ended_activity as _execute_auto_analysis,
)


async def run_auto_analysis_for_ended_activity(
    db: AsyncSession,
    activity_id: int,
    *,
    allow_running_retry: bool,
    get_activity_for_update,
    get_statistics,
    list_candidate_agents,
) -> None:
    await _execute_auto_analysis(
        db,
        activity_id,
        allow_running_retry=allow_running_retry,
        get_activity_for_update=get_activity_for_update,
        get_statistics=get_statistics,
        list_candidate_agents=list_candidate_agents,
    )


async def enqueue_auto_analysis(activity_id: int) -> None:
    """投递分析任务。失败重试退避固定为 0/1/3 秒。

    apply_async 是同步阻塞调用，用 to_thread 避免在事件循环里做网络 IO。
    """
    from app.tasks.classroom import analyze_ended_classroom_activity

    await asyncio.to_thread(
        analyze_ended_classroom_activity.apply_async,
        args=[activity_id],
        retry=True,
        retry_policy={
            "max_retries": 3,
            "interval_start": 0,
            "interval_step": 1,
            "interval_max": 3,
        },
    )


async def mark_enqueue_failed(
    db: AsyncSession,
    activity_id: int,
    error: Exception,
    *,
    get_activity_for_update,
) -> None:
    await mark_analysis_enqueue_failed(
        db,
        activity_id,
        error,
        get_activity_for_update=get_activity_for_update,
    )
