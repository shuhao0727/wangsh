import asyncio
from types import SimpleNamespace

import pytest

import app.services.classroom as svc


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
    db = _FakeDB(execute_results=[_FakeResult(value=SimpleNamespace(id=99))])

    with pytest.raises(ValueError, match="已提交过答案"):
        asyncio.run(svc.submit_response(db, activity_id=11, user_id=1001, answer="A"))

    assert db.execute_count == 1
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


def test_end_activity_requires_active_status(monkeypatch):
    activity = SimpleNamespace(status="ended")

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(svc, "_get_activity", fake_get_activity)
    db = _FakeDB()

    with pytest.raises(ValueError, match="只能结束进行中的活动"):
        asyncio.run(svc.end_activity(db, activity_id=2))

    assert db.commit_count == 0


def test_bulk_delete_skips_active_activities():
    act_active = SimpleNamespace(id=1, status="active")
    act_draft = SimpleNamespace(id=2, status="draft")
    act_ended = SimpleNamespace(id=3, status="ended")
    db = _FakeDB(execute_results=[_FakeResult(values=[act_active, act_draft, act_ended])])

    result = asyncio.run(svc.bulk_delete_activities(db, [1, 2, 3]))

    assert result == {"deleted": [2, 3], "skipped": [1]}
    assert db.deleted == [act_draft, act_ended]
    assert db.commit_count == 1
