"""
兼容层：统一指向 app.core.celery_app
旧代码通过 `from app.celery_app import celery` 引用，
新代码通过 `from app.core.celery_app import celery_app` 引用。
两者指向同一个 Celery 实例。
"""

from app.core.celery_app import celery_app

# 兼容旧代码的变量名
celery = celery_app
