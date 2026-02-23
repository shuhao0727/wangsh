from celery import Celery

from app.core.config import settings


celery = Celery(
    "wangsh",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    accept_content=settings.CELERY_ACCEPT_CONTENT,
    timezone=settings.TIMEZONE,
    enable_utc=False,
    task_routes={
        "app.tasks.typst_compile.compile_typst_note": {"queue": "typst"},
    },
    imports=("app.tasks.typst_compile", "app.tasks.pythonlab"),
)
