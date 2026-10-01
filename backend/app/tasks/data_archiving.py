"""数据归档定时任务"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.core.celery_app import celery_app
from app.db.database import AsyncSessionLocal
from app.tasks._async_runner import run as run_async

logger = logging.getLogger(__name__)


async def _archive_old_conversations_async(days: int) -> dict:
    """归档指定天数前的对话记录（异步实现）

    Args:
        days: 归档 N 天前的对话，默认 90 天

    Returns:
        归档结果统计
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                text(
                    "UPDATE znt_conversations "
                    "SET is_archived = TRUE, archived_at = NOW() "
                    "WHERE created_at < :cutoff "
                    "AND is_archived = FALSE"
                ),
                {"cutoff": cutoff}
            )
            await db.commit()

            archived_count = result.rowcount
            logger.info(f"已归档 {archived_count} 条对话记录（{days} 天前）")
            return {"archived_count": archived_count, "cutoff_days": days}
        except Exception as e:
            await db.rollback()
            logger.error(f"归档对话记录失败: {e}")
            raise


async def _archive_old_analyses_async(days: int) -> dict:
    """归档指定天数前的分析记录（异步实现）

    Args:
        days: 归档 N 天前的分析，默认 180 天

    Returns:
        归档结果统计
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    async with AsyncSessionLocal() as db:
        try:
            total_archived = 0

            # 需要归档的分析表
            tables = ['task_analyses', 'hot_question_analyses', 'student_chain_analyses']

            for table in tables:
                result = await db.execute(
                    text(
                        f"UPDATE {table} "
                        f"SET is_archived = TRUE, archived_at = NOW() "
                        f"WHERE created_at < :cutoff "
                        f"AND is_archived = FALSE"
                    ),
                    {"cutoff": cutoff}
                )
                total_archived += result.rowcount

            await db.commit()

            logger.info(f"已归档 {total_archived} 条分析记录（{days} 天前）")
            return {"archived_count": total_archived, "cutoff_days": days}
        except Exception as e:
            await db.rollback()
            logger.error(f"归档分析记录失败: {e}")
            raise


@celery_app.task(
    bind=True,
    name="app.tasks.data_archiving.archive_old_conversations",
    autoretry_for=(Exception,),
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=60,
)
def archive_old_conversations(self, days: int = 90) -> dict:
    """归档指定天数前的对话记录

    Args:
        days: 归档 N 天前的对话，默认 90 天

    Returns:
        归档结果统计
    """
    return run_async(_archive_old_conversations_async(days))


@celery_app.task(
    bind=True,
    name="app.tasks.data_archiving.archive_old_analyses",
    autoretry_for=(Exception,),
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=60,
)
def archive_old_analyses(self, days: int = 180) -> dict:
    """归档指定天数前的分析记录

    Args:
        days: 归档 N 天前的分析，默认 180 天

    Returns:
        归档结果统计
    """
    return run_async(_archive_old_analyses_async(days))
