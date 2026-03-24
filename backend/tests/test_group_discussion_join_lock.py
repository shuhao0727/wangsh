import asyncio
from datetime import date
from types import SimpleNamespace

from fastapi import HTTPException

import app.services.agents.group_discussion as gd
import app.api.endpoints.agents.ai_agents.group_discussion as gd_api
from app.schemas.agents import GroupDiscussionJoinRequest


class _FakeCache:
    def __init__(self, *, locked=None, ttl=None):
        self.locked = locked
        self.ttl_value = ttl
        self.set_calls = []

    async def get(self, _key):
        return self.locked

    async def ttl(self, _key):
        return self.ttl_value

    async def set(self, key, value, expire_seconds=None, nx=False):
        self.set_calls.append(
            {
                "key": key,
                "value": value,
                "expire_seconds": expire_seconds,
                "nx": nx,
            }
        )
        return True


def test_enforce_join_lock_only_checks_and_does_not_write_cache(monkeypatch):
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_REDIS_ENABLED", True, raising=False)
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_JOIN_LOCK_SECONDS", 180, raising=False)
    fake_cache = _FakeCache(locked=None, ttl=None)
    monkeypatch.setattr(gd, "cache", fake_cache)

    lock_seconds = asyncio.run(
        gd.enforce_join_lock(user_id=1, requested_group_no="1", user_role="student")
    )

    assert lock_seconds == 180
    assert fake_cache.set_calls == []


def test_set_join_lock_writes_cache_for_student(monkeypatch):
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_REDIS_ENABLED", True, raising=False)
    monkeypatch.setattr(gd.settings, "GROUP_DISCUSSION_JOIN_LOCK_SECONDS", 180, raising=False)
    fake_cache = _FakeCache()
    monkeypatch.setattr(gd, "cache", fake_cache)

    asyncio.run(gd.set_join_lock(user_id=7, requested_group_no="3", user_role="student"))

    assert len(fake_cache.set_calls) == 1
    call = fake_cache.set_calls[0]
    assert ":join_lock:" in call["key"]
    assert call["value"] == {"group_no": "3"}
    assert call["expire_seconds"] == 180
    assert call["nx"] is True


def test_join_endpoint_does_not_set_lock_when_join_failed(monkeypatch):
    called = {"set_lock": False}

    async def fake_enforce_join_lock(*, user_id, requested_group_no, user_role):
        return 180

    async def fake_get_or_create_today_session(*args, **kwargs):
        raise HTTPException(status_code=422, detail="组号格式不正确（仅允许数字）")

    async def fake_set_join_lock(*, user_id, requested_group_no, user_role):
        called["set_lock"] = True

    async def fake_enforce_visibility(_db, _user):
        return None

    monkeypatch.setattr(gd_api, "enforce_join_lock", fake_enforce_join_lock)
    monkeypatch.setattr(gd_api, "get_or_create_today_session", fake_get_or_create_today_session)
    monkeypatch.setattr(gd_api, "set_join_lock", fake_set_join_lock)
    monkeypatch.setattr(gd_api, "_enforce_frontend_visibility", fake_enforce_visibility)

    payload = GroupDiscussionJoinRequest(group_no="1", class_name="高一(1)班")
    user = {"id": 301, "role_code": "student", "full_name": "张三", "class_name": "高一(1)班"}

    try:
        asyncio.run(gd_api.join_group_discussion(payload=payload, db=object(), current_user=user))
        assert False, "should raise HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 422

    assert called["set_lock"] is False


def test_join_endpoint_sets_lock_after_success(monkeypatch):
    called = {"set_lock": False, "group_no": None}

    async def fake_enforce_join_lock(*, user_id, requested_group_no, user_role):
        return 180

    async def fake_set_join_lock(*, user_id, requested_group_no, user_role):
        called["set_lock"] = True
        called["group_no"] = requested_group_no

    async def fake_enforce_visibility(_db, _user):
        return None

    async def fake_get_or_create_today_session(*args, **kwargs):
        return SimpleNamespace(
            id=55,
            session_date=date.today(),
            class_name="高一(1)班",
            group_no="8",
            group_name="测试组",
        )

    monkeypatch.setattr(gd_api, "enforce_join_lock", fake_enforce_join_lock)
    monkeypatch.setattr(gd_api, "set_join_lock", fake_set_join_lock)
    monkeypatch.setattr(gd_api, "_enforce_frontend_visibility", fake_enforce_visibility)
    monkeypatch.setattr(gd_api, "get_or_create_today_session", fake_get_or_create_today_session)

    payload = GroupDiscussionJoinRequest(group_no="8", class_name="高一(1)班", group_name="测试组")
    user = {"id": 301, "role_code": "student", "full_name": "张三", "class_name": "高一(1)班"}

    resp = asyncio.run(gd_api.join_group_discussion(payload=payload, db=object(), current_user=user))

    assert resp.session_id == 55
    assert called["set_lock"] is True
    assert called["group_no"] == "8"
