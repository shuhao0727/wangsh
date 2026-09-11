"""
auth /refresh 端点测试（新持久权威合同）

旧「Redis 缺失即新建 nonce」的 bootstrap 行为已被持久会话权威取代：
- 持久 state 缺失/未激活时 refresh 被 401 拒绝；
- 缓存缺失时沿用持久 state 的 nonce，仅修正请求 IP，不再新造会话；
- 发布阶段的 Redis 轮换只出现在 commit 之后。
"""
import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

import app.api.endpoints.auth.auth as auth_api
from app.core import session_guard
from app.services import auth as auth_service

# 新契约中的有效 nonce（22 位 [A-Za-z0-9_-]）。
NONCE_22 = "abcdefghijklmnopqrstuv"


class _StateResult:
    """回答持久权威链路查询的合成结果（User / AuthSessionState）。"""

    def __init__(self, state):
        self._state = state

    def scalar(self):
        return True  # auth_authority.ready

    def scalar_one_or_none(self):
        return self._state

    def scalars(self):
        return self

    def all(self):
        return []


class _FakeDB:
    """合成会话：持久 state 可变，支持 commit/rollback/UPDATE 计数。"""

    def __init__(self, user_id, nonce, ip="127.0.0.1", ip_expires_at=None):
        self.state = SimpleNamespace(
            id=user_id, user_id=user_id,
            is_active=True, is_deleted=False,
            role_code="super_admin", username="admin", full_name="Admin",
            student_id=None, class_name=None, study_year=None,
            active=True, nonce=nonce, ip=ip, ip_expires_at=ip_expires_at,
            is_revoked=False, expires_at=None,
        )
        self.commit_count = 0
        self.rollback_count = 0

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        self.rollback_count += 1

    async def flush(self):
        pass

    def add(self, value):
        pass

    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name="sqlite"))

    async def scalar(self, _query):
        return True

    async def execute(self, query):
        return _StateResult(self.state)


def _patch_cache(monkeypatch, get_session):
    """注入合成缓存，真实走 strict JSON 读取路径。"""

    class RawSessionClient:
        async def get(self, key):
            assert key.startswith("auth:session:uid:")
            value = await get_session(int(key.rsplit(":", 1)[1]))
            return None if value is None else json.dumps(value).encode()

    class _Cache:
        async def get_client(self):
            return RawSessionClient()

        async def set(self, key, value, *, expire_seconds=None):
            return True

    monkeypatch.setattr(session_guard, "cache", _Cache())


def _make_request(ip="127.0.0.1"):
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/refresh",
        "headers": [],
        "client": (ip, 12345),
        "query_string": b"",
    })


def test_refresh_cache_loss_keeps_durable_nonce(monkeypatch):
    """缓存缺失时沿用持久 state 的 nonce，不新建会话、只修正请求 IP。"""
    captured = {}

    async def fake_rotate_refresh_token(_db, _token, *, commit=True):
        captured["commit"] = commit
        return {
            "user_id": 11,
            "role_code": "super_admin",
            "username": "admin",
            "student_id": None,
            "full_name": "Admin",
            "refresh_token": "new-rt",
        }

    async def fake_get_session(_user_id):
        return None  # 模拟 cache-loss

    async def fake_rotate_user_session(_user_id, keep_ip=None, nonce=None):
        captured["keep_ip"] = keep_ip
        captured["nonce"] = nonce
        return {"nonce": nonce}

    def fake_extract_client_ip(_request):
        return "10.0.0.7"

    def fake_create_access_token(data, expires_delta=None):
        captured["token_data"] = data
        return "new-at"

    async def fake_rate_limiter_check(_key, interval_seconds):
        assert interval_seconds == 5

    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate_refresh_token, raising=False)
    _patch_cache(monkeypatch, fake_get_session)
    monkeypatch.setattr(auth_api, "rotate_user_session", fake_rotate_user_session)
    monkeypatch.setattr(auth_api, "extract_client_ip", fake_extract_client_ip)
    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access_token)
    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

    db = _FakeDB(user_id=11, nonce=NONCE_22)
    result = asyncio.run(
        auth_api.refresh_access_token(
            request=_make_request(),
            response=Response(),
            refresh_token="old-rt",
            db=db,
        )
    )

    assert result["access_token"] == "new-at"
    assert result["refresh_token"] == "new-rt"
    assert captured["token_data"]["sn"] == NONCE_22
    # 缓存缺失不新建会话：发布仍以持久 state 的 nonce 与请求 IP 为准。
    assert captured["nonce"] == NONCE_22
    assert captured["keep_ip"] == "10.0.0.7"
    assert captured["commit"] is False
    assert db.commit_count == 1
    assert db.state.ip == "10.0.0.7"


def test_refresh_returns_503_when_redis_session_cannot_be_read(monkeypatch):
    async def fake_rotate_refresh_token(_db, _token, *, commit=True):
        return {
            "user_id": 11,
            "role_code": "super_admin",
            "username": "admin",
            "student_id": None,
            "full_name": "Admin",
            "refresh_token": "new-rt",
        }

    async def fake_get_session_strict(_user_id):
        raise RuntimeError("redis unavailable")

    async def fake_rate_limiter_check(_key, interval_seconds):
        assert interval_seconds == 5

    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate_refresh_token, raising=False)
    monkeypatch.setattr(auth_api, "get_user_session_strict", fake_get_session_strict)
    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

    db = _FakeDB(user_id=11, nonce=NONCE_22)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            auth_api.refresh_access_token(
                request=_make_request(),
                response=Response(),
                refresh_token="old-rt",
                db=db,
            )
        )

    # 新合同：Redis 读取故障上报 503 而非伪造新会话。
    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "无法核验刷新会话，请稍后重试"
    assert db.rollback_count == 1
