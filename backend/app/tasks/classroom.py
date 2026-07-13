"""课堂互动后台任务。"""

from app.core.celery_app import celery_app
from app.db.database import AsyncSessionLocal
from app.tasks._async_runner import run as run_async


async def _analyze_ended_activity(
    activity_id: int,
    *,
    allow_running_retry: bool = False,
) -> None:
    from app.services.classroom import _run_auto_analysis_for_ended_activity

    async with AsyncSessionLocal() as db:
        await _run_auto_analysis_for_ended_activity(
            db,
            activity_id,
            allow_running_retry=allow_running_retry,
        )


@celery_app.task(
    bind=True,
    name="app.tasks.classroom.analyze_ended_classroom_activity",
    autoretry_for=(Exception,),
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=60,
)
def analyze_ended_classroom_activity(self, activity_id: int) -> None:
    run_async(
        _analyze_ended_activity(
            activity_id,
            allow_running_retry=self.request.retries > 0,
        )
    )
