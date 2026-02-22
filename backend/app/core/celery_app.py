"""
Celery 异步任务简化配置
"""

from celery import Celery
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
  include=["app.tasks.typst_compile", "app.tasks.pythonlab"],
)
