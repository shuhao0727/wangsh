import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.services.classroom as svc
from app.api.endpoints.classroom import admin as admin_api
from app.models.classroom import ClassroomActivity


class _FakeResult:
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
    def __init__(self, execute_results=None):
        self._execute_results = list(execute_results or [])
        self.execute_count = 0
        self.commit_count = 0
        self.refresh_count = 0
        self.added = []
        self.deleted = []

    async def execute(self, _stmt):
        if self.execute_count >= len(self._execute_results):
            raise AssertionError("unexpected db.execute call")
        result = self._execute_results[self.execute_count]
        self.execute_count += 1
        return result

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _obj):
        self.refresh_count += 1


def test_submit_response_rejects_when_activity_not_active(monkeypatch):
    activity = SimpleNamespace(status="draft", time_limit=60, started_at=None)

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(svc, "_get_activity", fake_get_activity)
    db = _FakeDB()

    with pytest.raises(ValueError, match="活动未在进行中"):
        asyncio.run(svc.submit_response(db, activity_id=11, user_id=1001, answer="A"))

    assert db.execute_count == 0
    assert db.commit_count == 0


def test_submit_response_rejects_duplicate_answer(monkeypatch):
    activity = SimpleNamespace(
        status="active",
        time_limit=60,
        started_at=None,
        correct_answer="A",
        allow_multiple=False,
        created_by=88,
    )

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(svc, "_get_activity", fake_get_activity)
    db = _FakeDB(
        execute_results=[
            _FakeResult(value=activity),
            _FakeResult(value=SimpleNamespace(id=99)),
        ]
    )

    with pytest.raises(ValueError, match="已提交过答案"):
        asyncio.run(svc.submit_response(db, activity_id=11, user_id=1001, answer="A"))

    assert db.execute_count == 2
    assert db.commit_count == 0
    assert db.added == []


def test_start_activity_requires_draft_status(monkeypatch):
    activity = SimpleNamespace(status="active")

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(svc, "_get_activity", fake_get_activity)
    db = _FakeDB()

    with pytest.raises(ValueError, match="只能开始草稿状态的活动"):
        asyncio.run(svc.start_activity(db, activity_id=1))

    assert db.execute_count == 0
    assert db.commit_count == 0


@pytest.mark.parametrize("class_name", [None, " \t "])
@pytest.mark.parametrize(
    ("endpoint", "status"),
    [(admin_api.start_activity, "draft"), (admin_api.restart_activity, "ended")],
)
def test_empty_locked_class_rejects_activation_without_writes(
    monkeypatch, endpoint, status, class_name
):
    target = ClassroomActivity(
        id=1, created_by=88, title="课堂练习", activity_type="vote",
        class_name=class_name, status=status, time_limit=60,
    )
    other = ClassroomActivity(
        id=2, created_by=88, title="进行中的练习", activity_type="vote",
        class_name="甲班", status="active", time_limit=60,
    )
    earlier_snapshot = SimpleNamespace(status=status, created_by=88, class_name="甲班")
    lock_order = []
    events = []

    async def get_activity(_db, activity_id):
        return earlier_snapshot if activity_id == target.id else other

    async def lock_owner(_db, owner_id):
        lock_order.append(("owner", owner_id))

    async def get_locked_activity(_db, activity_id):
        lock_order.append(("activity", activity_id))
        return target if activity_id == target.id else other

    async def record_publish(channel, event):
        events.append((channel, event))

    monkeypatch.setattr(svc, "_get_activity", get_activity)
    monkeypatch.setattr(svc, "_lock_activity_owner", lock_owner)
    monkeypatch.setattr(svc, "_get_activity_for_update", get_locked_activity)
    async def record_analysis(activity_id):
        events.append(("analysis", activity_id))

    monkeypatch.setattr(svc, "publish", record_publish)
    monkeypatch.setattr(svc, "_enqueue_auto_analysis", record_analysis)
    db = _FakeDB([_FakeResult(values=[other]), _FakeResult()])

    with pytest.raises(HTTPException) as error:
        asyncio.run(endpoint(target.id, db, {"id": 88, "role_code": "teacher"}))

    assert error.value.status_code == 400
    assert "班级" in error.value.detail
    assert lock_order == [("owner", 88), ("activity", 1)]
    assert target.status == status
    assert other.status == "active"
    assert db.execute_count == 0  # No activity lookup or answer deletion after the locks.
    assert db.commit_count == 0
    assert events == []


def test_edit_draft_rejects_activity_started_since_the_initial_read(monkeypatch):
    draft = SimpleNamespace(status="draft", class_name="甲班")
    active = SimpleNamespace(status="active", class_name="甲班")

    async def get_activity(_db, _activity_id):
        return draft

    async def get_locked_activity(_db, _activity_id):
        return active

    monkeypatch.setattr(svc, "_get_activity", get_activity)
    monkeypatch.setattr(svc, "_get_activity_for_update", get_locked_activity)
    db = _FakeDB()

    with pytest.raises(ValueError, match="草稿状态"):
        asyncio.run(svc.update_activity(db, 1, {"class_name": "乙班"}))

    assert active.class_name == "甲班"
    assert db.commit_count == 0


def test_duplicate_activity_reserves_space_for_copy_suffix(monkeypatch):
    original = ClassroomActivity(
        id=1, title="课" * 200, status="ended", class_name=None,
        activity_type="vote", time_limit=0,
    )

    async def get_activity(_db, _activity_id):
        return original

    monkeypatch.setattr(svc, "_get_activity", get_activity)
    copy = asyncio.run(svc.duplicate_activity(_FakeDB(), original.id, 88))

    assert copy.title == "课" * 196 + "（副本）"
    assert copy.status == "draft"
    assert copy.time_limit == 0
    assert original.title == "课" * 200


def test_end_activity_requires_active_status(monkeypatch):
    activity = SimpleNamespace(status="ended")

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(svc, "_get_activity", fake_get_activity)
    db = _FakeDB()

    with pytest.raises(ValueError, match="只能结束进行中的活动"):
        asyncio.run(svc.end_activity(db, activity_id=2))

    assert db.commit_count == 0
