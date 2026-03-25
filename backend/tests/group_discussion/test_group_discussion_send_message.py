import asyncio
from types import SimpleNamespace

from fastapi import HTTPException

import app.services.agents.group_discussion as gd


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDB:
    def __init__(self, execute_values):
        self._execute_values = list(execute_values)
        self.execute_count = 0
        self.commit_count = 0
        self.refresh_count = 0
        self.added = []

    async def execute(self, _stmt):
        if self.execute_count >= len(self._execute_values):
            raise AssertionError("unexpected db.execute call")
        value = self._execute_values[self.execute_count]
        self.execute_count += 1
        return _FakeResult(value)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, obj):
        self.refresh_count += 1
        if getattr(obj, "id", None) is None:
            obj.id = 100 + self.refresh_count


class _FakeCache:
    def __init__(self, *, rate_set_result: bool, ttl_seconds):
        self.rate_set_result = rate_set_result
        self.ttl_seconds = ttl_seconds
        self.set_calls = []
        self.publish_calls = []

    async def set(self, key, value, expire_seconds=None, nx=False):
        self.set_calls.append(
            {
                "key": key,
                "value": value,
                "expire_seconds": expire_seconds,
                "nx": nx,
            }
        )
        if ":rate:" in key and nx:
            return self.rate_set_result
        return True

    async def ttl(self, _key):
        return self.ttl_seconds

    async def publish(self, channel, message):
        self.publish_calls.append((channel, message))
        return True

    async def increment(self, _key, amount=1):
        return amount

    async def exists(self, _key):
        raise AssertionError("cache.exists should not be called")


def _patch_settings(monkeypatch):
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_REDIS_ENABLED", True, raising=False)
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_RATE_LIMIT_SECONDS", 2, raising=False)
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_METRICS_ENABLED", False, raising=False)
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_LAST_ID_TTL", 60, raising=False)
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_LAST_AT_TTL", 60, raising=False)


def test_send_message_uses_atomic_redis_nx_rate_lock(monkeypatch):
    _patch_settings(monkeypatch)
    fake_cache = _FakeCache(rate_set_result=True, ttl_seconds=None)
    monkeypatch.setattr(gd, "cache", fake_cache)

    session = SimpleNamespace(last_message_at=None, message_count=0)
    member = SimpleNamespace(muted_until=None)
    db = _FakeDB([session, member])

    msg = asyncio.run(
        gd.send_message(
            db,
            session_id=11,
            student_user={"id": 7, "username": "stu-7"},
            content="hello",
        )
    )

    assert msg.id == 101
    assert db.execute_count == 2
    assert db.commit_count == 1
    assert session.message_count == 1

    rate_call = fake_cache.set_calls[0]
    assert ":rate:" in rate_call["key"]
    assert rate_call["nx"] is True
    assert rate_call["expire_seconds"] == 2
    assert len(fake_cache.publish_calls) == 1


def test_send_message_blocks_when_atomic_lock_not_acquired(monkeypatch):
    _patch_settings(monkeypatch)
    fake_cache = _FakeCache(rate_set_result=False, ttl_seconds=3)
    monkeypatch.setattr(gd, "cache", fake_cache)

    session = SimpleNamespace(last_message_at=None, message_count=0)
    member = SimpleNamespace(muted_until=None)
    db = _FakeDB([session, member])

    try:
        asyncio.run(
            gd.send_message(
                db,
                session_id=22,
                student_user={"id": 8, "username": "stu-8"},
                content="hello",
            )
        )
        assert False, "should raise HTTPException(429)"
    except HTTPException as exc:
        assert exc.status_code == 429
        assert "3秒后可再发送" in str(exc.detail)

    assert db.execute_count == 2
    assert db.commit_count == 0
    assert len(fake_cache.publish_calls) == 0

    rate_call = fake_cache.set_calls[0]
    assert ":rate:" in rate_call["key"]
    assert rate_call["nx"] is True
