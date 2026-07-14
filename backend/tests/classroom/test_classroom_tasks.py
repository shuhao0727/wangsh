"""课堂 Celery 任务配置回归测试。"""

from types import SimpleNamespace

from app.core.celery_app import celery_app
from app.tasks.classroom import (
    _request_allows_running_retry,
    analyze_ended_classroom_activity,
)


def test_classroom_analysis_task_uses_default_worker_queue():
    routes = celery_app.conf.task_routes

    assert routes["app.tasks.classroom.analyze_ended_classroom_activity"] == {
        "queue": "celery"
    }


def test_classroom_analysis_task_requeues_when_worker_is_lost():
    assert analyze_ended_classroom_activity.acks_late is True
    assert analyze_ended_classroom_activity.reject_on_worker_lost is True


def test_redelivered_task_can_reclaim_running_analysis():
    request = SimpleNamespace(
        retries=0,
        delivery_info={"redelivered": True},
    )

    assert _request_allows_running_retry(request) is True


def test_first_delivery_does_not_reclaim_running_analysis():
    request = SimpleNamespace(
        retries=0,
        delivery_info={"redelivered": False},
    )

    assert _request_allows_running_retry(request) is False
