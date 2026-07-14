"""课堂活动 Service 层状态与并发回归测试。"""

import asyncio
from types import SimpleNamespace

import pytest
from loguru import logger
from sqlalchemy.exc import IntegrityError

from app.services import classroom as classroom_svc


class _ScalarResult:
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values or []

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._values


class _FakeDB:
    def __init__(self, *, execute_results=None, commit_error=None):
        self.execute_results = list(execute_results or [])
        self.commit_error = commit_error
        self.deleted = []
        self.added = []
        self.commit_count = 0
        self.rollback_count = 0

    async def execute(self, _statement):
        if self.execute_results:
            return self.execute_results.pop(0)
        return _ScalarResult()

    def add(self, value):
        self.added.append(value)

    async def delete(self, value):
        self.deleted.append(value)

    async def commit(self):
        self.commit_count += 1
        if self.commit_error is not None:
            raise self.commit_error

    async def rollback(self):
        self.rollback_count += 1

    async def refresh(self, _value):
        return None

    async def flush(self):
        return None


@pytest.mark.parametrize("operation", ["update", "delete"])
def test_ended_activity_cannot_be_edited_or_deleted(monkeypatch, operation):
    activity = SimpleNamespace(id=1, status="ended")

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(classroom_svc, "_get_activity", fake_get_activity)
    db = _FakeDB()

    with pytest.raises(ValueError, match="草稿状态"):
        if operation == "update":
            asyncio.run(classroom_svc.update_activity(db, 1, {"title": "新标题"}))
        else:
            asyncio.run(classroom_svc.delete_activity(db, 1))

    assert db.commit_count == 0
    assert db.deleted == []


def test_bulk_delete_only_deletes_draft_activities():
    draft = SimpleNamespace(id=1, status="draft")
    ended = SimpleNamespace(id=2, status="ended")
    active = SimpleNamespace(id=3, status="active")
    db = _FakeDB(execute_results=[_ScalarResult(values=[draft, ended, active])])

    result = asyncio.run(classroom_svc.bulk_delete_activities(db, [1, 2, 3]))

    assert result == {"deleted": [1], "skipped": [2, 3]}
    assert db.deleted == [draft]
    assert db.commit_count == 1


def test_duplicate_response_integrity_error_rolls_back_to_business_error(monkeypatch):
    activity = SimpleNamespace(
        id=1,
        status="active",
        time_limit=0,
        started_at=None,
        correct_answer=None,
        allow_multiple=False,
        created_by=10,
    )

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(classroom_svc, "_get_activity", fake_get_activity)
    db = _FakeDB(
        execute_results=[
            _ScalarResult(value=activity),
            _ScalarResult(value=None),
        ],
        commit_error=IntegrityError("insert", {}, Exception("duplicate")),
    )

    with pytest.raises(ValueError, match="已提交过答案"):
        asyncio.run(classroom_svc.submit_response(db, 1, 100, "A"))

    assert db.rollback_count == 1


def test_restart_activity_ends_other_active_activity_for_same_owner(monkeypatch):
    target = SimpleNamespace(
        id=1,
        status="ended",
        created_by=10,
        activity_type="vote",
        started_at=None,
        ended_at=object(),
        analysis_status="not_applicable",
        analysis_result=None,
        analysis_context={"old": True},
        analysis_error=None,
        analysis_updated_at=object(),
        class_name="高一(1)班",
    )
    other_active = SimpleNamespace(
        id=2,
        status="active",
        created_by=10,
        class_name="高一(1)班",
    )
    ended_ids = []

    async def fake_get_activity(_db, _activity_id):
        return target

    async def fake_lock_owner(_db, _user_id):
        return None

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return target

    async def fake_end_activity(_db, activity_id, **_kwargs):
        ended_ids.append(activity_id)
        other_active.status = "ended"
        return other_active

    async def fake_dispatch(_db, _events):
        return None

    monkeypatch.setattr(classroom_svc, "_get_activity", fake_get_activity)
    monkeypatch.setattr(classroom_svc, "_lock_activity_owner", fake_lock_owner)
    monkeypatch.setattr(classroom_svc, "_get_activity_for_update", fake_get_for_update)
    monkeypatch.setattr(classroom_svc, "end_activity", fake_end_activity)
    monkeypatch.setattr(classroom_svc, "dispatch_activity_events", fake_dispatch)
    db = _FakeDB(execute_results=[_ScalarResult(values=[other_active])])

    result = asyncio.run(classroom_svc.restart_activity(db, 1))

    assert ended_ids == [2]
    assert result.status == "active"
    assert result.analysis_context is None
    assert result.analysis_updated_at is None
    assert db.commit_count == 1


def test_dispatch_publishes_all_events_before_enqueuing_analysis(monkeypatch):
    calls = []

    async def fake_publish(channel, payload):
        calls.append(("publish", channel, payload["type"], payload["activity_id"]))

    async def fake_enqueue(activity_id):
        calls.append(("enqueue", activity_id))

    monkeypatch.setattr(classroom_svc, "publish", fake_publish)
    monkeypatch.setattr(classroom_svc, "_enqueue_auto_analysis", fake_enqueue)

    events = [
        {
            "type": "activity_ended",
            "activity_id": 1,
            "created_by": 10,
            "class_name": "高一(1)班",
        },
        {
            "type": "activity_started",
            "activity_id": 2,
            "created_by": 10,
            "class_name": "高一(1)班",
        },
    ]

    asyncio.run(classroom_svc.dispatch_activity_events(None, events))

    assert calls[-1] == ("enqueue", 1)
    assert all(call[0] == "publish" for call in calls[:-1])
    assert len(calls[:-1]) == 6


def test_dispatch_records_enqueue_failure_for_manual_recovery(monkeypatch):
    activity = SimpleNamespace(
        id=1,
        status="ended",
        activity_type="fill_blank",
        analysis_status="pending",
        analysis_result=None,
        analysis_context=None,
        analysis_error=None,
        analysis_updated_at=None,
    )

    async def fake_publish(_channel, _payload):
        return None

    async def fake_enqueue(_activity_id):
        raise RuntimeError("broker unavailable")

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return activity

    monkeypatch.setattr(classroom_svc, "publish", fake_publish)
    monkeypatch.setattr(classroom_svc, "_enqueue_auto_analysis", fake_enqueue)
    monkeypatch.setattr(
        classroom_svc,
        "_get_activity_for_update",
        fake_get_for_update,
    )
    db = _FakeDB()

    asyncio.run(
        classroom_svc.dispatch_activity_events(
            db,
            [
                {
                    "type": "activity_ended",
                    "activity_id": 1,
                    "created_by": 10,
                    "class_name": "高一(1)班",
                }
            ],
        )
    )

    assert activity.analysis_status == "failed"
    assert "broker unavailable" in activity.analysis_error
    assert activity.analysis_updated_at is not None
    assert db.commit_count == 1


def test_enqueue_failure_does_not_overwrite_analysis_already_running(monkeypatch):
    activity = SimpleNamespace(
        id=1,
        status="ended",
        activity_type="fill_blank",
        analysis_status="running",
        analysis_result=None,
        analysis_context=None,
        analysis_error=None,
        analysis_updated_at=object(),
    )

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return activity

    monkeypatch.setattr(
        classroom_svc,
        "_get_activity_for_update",
        fake_get_for_update,
    )
    db = _FakeDB()

    asyncio.run(
        classroom_svc._mark_analysis_enqueue_failed(
            db,
            1,
            RuntimeError("publisher confirm lost"),
        )
    )

    assert activity.analysis_status == "running"
    assert activity.analysis_error is None
    assert db.commit_count == 1


def test_enqueue_failure_compensation_error_does_not_break_ended_response(monkeypatch):
    async def fake_publish(_channel, _payload):
        return None

    async def fake_enqueue(_activity_id):
        raise RuntimeError("broker unavailable")

    async def fake_mark_failed(_db, _activity_id, _error):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(classroom_svc, "publish", fake_publish)
    monkeypatch.setattr(classroom_svc, "_enqueue_auto_analysis", fake_enqueue)
    monkeypatch.setattr(
        classroom_svc,
        "_mark_analysis_enqueue_failed",
        fake_mark_failed,
    )
    db = _FakeDB()

    asyncio.run(
        classroom_svc.dispatch_activity_events(
            db,
            [
                {
                    "type": "activity_ended",
                    "activity_id": 1,
                    "created_by": 10,
                    "class_name": "高一(1)班",
                }
            ],
        )
    )

    assert db.rollback_count == 1


def test_manual_analysis_can_reclaim_failed_status(monkeypatch):
    activity = SimpleNamespace(
        id=1,
        activity_type="fill_blank",
        status="ended",
        analysis_agent_id=None,
        analysis_status="failed",
        analysis_result=None,
        analysis_context={},
        analysis_error="broker unavailable",
    )
    calls = []

    async def fake_get_activity(_db, _activity_id):
        return activity

    async def fake_run(_db, activity_id, *, allow_running_retry=False):
        calls.append((activity_id, allow_running_retry))

    monkeypatch.setattr(classroom_svc, "_get_activity", fake_get_activity)
    monkeypatch.setattr(
        classroom_svc,
        "_run_auto_analysis_for_ended_activity",
        fake_run,
    )
    db = _FakeDB()

    asyncio.run(classroom_svc.analyze_fill_blank_stats(db, 1, agent_id=7))

    assert calls == [(1, True)]


def test_auto_end_ignores_activity_already_ended_by_another_worker(monkeypatch):
    ended = SimpleNamespace(
        id=1,
        status="ended",
        time_limit=60,
        started_at=None,
    )

    async def fail_end_activity(*_args, **_kwargs):
        raise AssertionError("already-ended activity must not be ended again")

    monkeypatch.setattr(classroom_svc, "end_activity", fail_end_activity)
    db = _FakeDB(
        execute_results=[
            _ScalarResult(values=[1]),
            _ScalarResult(value=ended),
        ]
    )

    asyncio.run(classroom_svc._auto_end_overdue_activities(db))

    assert db.rollback_count == 1


def test_enqueue_uses_broker_publish_retries(monkeypatch):
    from app.tasks.classroom import analyze_ended_classroom_activity

    calls = []

    def fake_apply_async(*, args, retry, retry_policy):
        calls.append((args, retry, retry_policy))

    monkeypatch.setattr(
        analyze_ended_classroom_activity,
        "apply_async",
        fake_apply_async,
    )

    asyncio.run(classroom_svc._enqueue_auto_analysis(9))

    assert calls == [
        (
            [9],
            True,
            {
                "max_retries": 3,
                "interval_start": 0,
                "interval_step": 1,
                "interval_max": 3,
            },
        )
    ]


@pytest.mark.parametrize("terminal_status", ["running", "success", "failed", "skipped"])
def test_auto_analysis_is_idempotent_for_terminal_status(monkeypatch, terminal_status):
    activity = SimpleNamespace(
        id=1,
        activity_type="fill_blank",
        status="ended",
        analysis_status=terminal_status,
    )

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return activity

    async def fail_if_called(*_args, **_kwargs):
        raise AssertionError("terminal analysis must not run again")

    monkeypatch.setattr(classroom_svc, "_get_activity_for_update", fake_get_for_update)
    monkeypatch.setattr(classroom_svc, "get_statistics", fail_if_called)

    asyncio.run(classroom_svc._run_auto_analysis_for_ended_activity(_FakeDB(), 1))


def test_auto_analysis_retry_can_reclaim_running_status(monkeypatch):
    activity = SimpleNamespace(
        id=1,
        title="重试测试",
        activity_type="fill_blank",
        status="ended",
        ended_at=object(),
        analysis_status="running",
        analysis_result=None,
        analysis_context=None,
        analysis_error=None,
        analysis_updated_at=None,
    )

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return activity

    async def fake_statistics(_db, _activity_id):
        return {
            "total_responses": 0,
            "correct_rate": None,
            "blank_slot_stats": [],
            "top_wrong_answers": [],
        }

    monkeypatch.setattr(classroom_svc, "_get_activity_for_update", fake_get_for_update)
    monkeypatch.setattr(classroom_svc, "get_statistics", fake_statistics)
    db = _FakeDB()

    asyncio.run(
        classroom_svc._run_auto_analysis_for_ended_activity(
            db,
            1,
            allow_running_retry=True,
        )
    )

    assert activity.analysis_status == "skipped"
    assert db.commit_count == 1


def test_auto_analysis_retry_can_reclaim_failed_status(monkeypatch):
    activity = SimpleNamespace(
        id=1,
        title="失败重试测试",
        activity_type="fill_blank",
        status="ended",
        ended_at=object(),
        analysis_status="failed",
        analysis_result=None,
        analysis_context=None,
        analysis_error="temporary provider failure",
        analysis_updated_at=None,
    )

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return activity

    async def fake_statistics(_db, _activity_id):
        return {
            "total_responses": 0,
            "correct_rate": None,
            "blank_slot_stats": [],
            "top_wrong_answers": [],
        }

    monkeypatch.setattr(classroom_svc, "_get_activity_for_update", fake_get_for_update)
    monkeypatch.setattr(classroom_svc, "get_statistics", fake_statistics)
    db = _FakeDB()

    asyncio.run(
        classroom_svc._run_auto_analysis_for_ended_activity(
            db,
            1,
            allow_running_retry=True,
        )
    )

    assert activity.analysis_status == "skipped"
    assert activity.analysis_error is None
    assert db.commit_count == 1


def test_auto_analysis_all_provider_failures_raise_for_celery_retry(monkeypatch):
    ended_at = object()
    activity = SimpleNamespace(
        id=1,
        title="提供商失败测试",
        activity_type="fill_blank",
        status="ended",
        ended_at=ended_at,
        analysis_agent_id=7,
        analysis_prompt=None,
        analysis_status="pending",
        analysis_result=None,
        analysis_context=None,
        analysis_error=None,
        analysis_updated_at=None,
    )

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return activity

    async def fake_statistics(_db, _activity_id):
        return {
            "total_responses": 1,
            "correct_rate": 0.0,
            "blank_slot_stats": [
                {
                    "slot_index": 1,
                    "correct_answer": "TCP",
                    "correct_rate": 0.0,
                    "total_count": 1,
                    "top_wrong_answers": [{"answer": "UDP", "count": 1}],
                }
            ],
            "top_wrong_answers": [{"answer": "UDP", "count": 1}],
        }

    async def fake_candidate_agents(_db, preferred_id=None):
        return [preferred_id or 7]

    async def fake_chat(_db, **_kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(classroom_svc, "_get_activity_for_update", fake_get_for_update)
    monkeypatch.setattr(classroom_svc, "get_statistics", fake_statistics)
    monkeypatch.setattr(classroom_svc, "_list_candidate_agents", fake_candidate_agents)

    from app.services.agents import chat_blocking

    monkeypatch.setattr(chat_blocking, "run_agent_chat_blocking", fake_chat)
    db = _FakeDB()
    messages = []
    sink_id = logger.add(messages.append, format="{message}")

    try:
        with pytest.raises(
            classroom_svc.ClassroomAnalysisRetryableError,
            match="provider unavailable",
        ):
            asyncio.run(classroom_svc._run_auto_analysis_for_ended_activity(db, 1))
    finally:
        logger.remove(sink_id)

    assert activity.analysis_status == "failed"
    assert "provider unavailable" in activity.analysis_error
    assert db.rollback_count == 1
    assert db.commit_count == 2
    rendered = "\n".join(messages)
    assert "agent#7" in rendered
    assert "activity_id=1" in rendered


def test_auto_analysis_does_not_overwrite_restarted_activity(monkeypatch):
    ended_at = object()
    activity = SimpleNamespace(
        id=1,
        title="旧轮次分析",
        activity_type="fill_blank",
        status="ended",
        ended_at=ended_at,
        analysis_agent_id=7,
        analysis_prompt=None,
        analysis_status="pending",
        analysis_result=None,
        analysis_context=None,
        analysis_error=None,
        analysis_updated_at=None,
    )

    async def fake_get_for_update(_db, _activity_id, **_kwargs):
        return activity

    async def fake_statistics(_db, _activity_id):
        return {
            "total_responses": 1,
            "correct_rate": 0.0,
            "blank_slot_stats": [
                {
                    "slot_index": 1,
                    "correct_answer": "TCP",
                    "correct_rate": 0.0,
                    "total_count": 1,
                    "top_wrong_answers": [{"answer": "UDP", "count": 1}],
                }
            ],
            "top_wrong_answers": [{"answer": "UDP", "count": 1}],
        }

    async def fake_candidate_agents(_db, preferred_id=None):
        return [preferred_id or 7]

    async def fake_chat(_db, **_kwargs):
        # 模拟 AI 请求期间教师重启了活动。
        activity.status = "active"
        activity.ended_at = None
        activity.analysis_status = "pending"
        return "旧轮次分析结果"

    monkeypatch.setattr(classroom_svc, "_get_activity_for_update", fake_get_for_update)
    monkeypatch.setattr(classroom_svc, "get_statistics", fake_statistics)
    monkeypatch.setattr(classroom_svc, "_list_candidate_agents", fake_candidate_agents)

    from app.services.agents import chat_blocking

    monkeypatch.setattr(chat_blocking, "run_agent_chat_blocking", fake_chat)
    db = _FakeDB()

    asyncio.run(classroom_svc._run_auto_analysis_for_ended_activity(db, 1))

    assert activity.status == "active"
    assert activity.analysis_status == "pending"
    assert activity.analysis_result is None
