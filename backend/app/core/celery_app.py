"""
Celery 异步任务简化配置
"""

from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# 创建 Celery 应用实例
celery_app = Celery(
    "wangsh",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# 基础 Celery 配置
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    include=["app.tasks.typst_compile", "app.tasks.pythonlab", "app.tasks.informatics_sync"],
    beat_schedule={
        # 每 5 分钟清理孤儿容器（无对应 Redis 会话的 Docker 容器）
        "pythonlab-cleanup-orphans": {
            "task": "app.tasks.pythonlab.cleanup_orphans",
            "schedule": int(getattr(settings, "PYTHONLAB_ORPHAN_CLEANUP_INTERVAL_SECONDS", 300) or 300),
        },
        # 每 2 分钟清理过期/僵尸会话
        "pythonlab-cleanup-stale-sessions": {
            "task": "app.tasks.pythonlab.cleanup_stale_sessions",
            "schedule": 120.0,
        },
    },
)
