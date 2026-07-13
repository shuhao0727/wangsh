"""课堂 Celery 任务配置回归测试。"""

from app.core.celery_app import celery_app


def test_classroom_analysis_task_uses_default_worker_queue():
    routes = celery_app.conf.task_routes

    assert routes["app.tasks.classroom.analyze_ended_classroom_activity"] == {
        "queue": "celery"
    }
