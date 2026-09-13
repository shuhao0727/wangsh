"""
auth /logout 和 /refresh 端点测试
"""
import asyncio
import json
from types import SimpleNamespace
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

import app.api.endpoints.auth.auth as auth_api
from app.core.config import settings
from app.core import session_guard
from app.services import auth as auth_service

# 新持久权威合同中的有效 nonce（22 位 [A-Za-z0-9_-]）。
NONCE_22 = "abcdefghijklmnopqrstuv"


class _SmartResult:
    """回答新持久权威链路的合成查询：ready gate、会话状态与 legacy subject。"""

    def __init__(self, user_id=7, nonce="current-nonce"):
        self._user_id = user_id
        self._nonce = nonce

    def scalar(self):
        return True  # auth_authority.ready

    def scalar_one_or_none(self):
        # 同一合成行同时回答 User / RefreshToken / AuthSessionState 查询。
        return SimpleNamespace(
            id=self._user_id, user_id=self._user_id,
            is_active=True, is_deleted=False,
            role_code="admin", username="admin", full_name="Admin",
            student_id=None, class_name=None, study_year=None,
            active=True, nonce=self._nonce, ip="127.0.0.1",
            ip_expires_at=None, is_revoked=False,
            expires_at=None,
        )

    def scalars(self):
        return self

    def all(self):
        return []


class _EndpointDB:
    def __init__(self, user_id=7, nonce="current-nonce"):
        self._user_id = user_id
        self._nonce = nonce
        self.commit_count = 0
        self.rollback_count = 0
        self.updates = 0

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        self.rollback_count += 1

    async def flush(self):
        pass

    def add(self, value):
        pass

    def get_bind(self):
        # 合成替身按 SQLite 方言处理，跳过 PostgreSQL 专属 advisory lock。
        return SimpleNamespace(dialect=SimpleNamespace(name="sqlite"))

    async def scalar(self, _query):
        return True  # auth_authority.ready

    async def execute(self, query):
        if "UPDATE" in str(query):
            self.updates += 1
        return _SmartResult(self._user_id, self._nonce)


def _patch_strict_session(monkeypatch, get_session):
    """注入合成缓存：内存会话 + 与真实一致的 strict JSON 读取。"""

    class RawSessionClient:
        async def get(self, key):
            assert key.startswith("auth:session:uid:")
            value = await get_session(int(key.rsplit(":", 1)[1]))
            return None if value is None else json.dumps(value).encode()

    class _MemoryCache:
        def __init__(self):
            self.data = {}
            self._get_session = get_session

        async def get_client(self):
            return RawSessionClient()

        async def set(self, key, value, *, expire_seconds=None):
            self.data[key] = value
            return True

        async def get(self, key):
            value = await self._get_session(int(key.rsplit(":", 1)[1]))
            return None if value is None else json.dumps(value).encode()

    cache_obj = _MemoryCache()
    monkeypatch.setattr(session_guard, "cache", cache_obj)
    # Exercise the actual strict reader, including JSON decoding.
    return cache_obj

def _make_request(cookies=None, ip="127.0.0.1"):
    headers = []
    if cookies:
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        headers = [(b"cookie", cookie_str.encode())]
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/refresh",
        "headers": headers,
        "client": (ip, 12345),
        "query_string": b"",
    })


def test_logout_clears_cookies():
    response = Response()
    result = asyncio.run(
        auth_api.logout(
            request=_make_request(),
            response=response,
            db=object(),
        )
    )
    assert result["message"] == "登出成功"
    assert "timestamp" in result


def test_logout_locks_user_and_revokes_refresh_tokens_in_one_transaction(monkeypatch):
    token = auth_api.create_access_token({"sub": "admin", "sn": "current-nonce"})
    captured = {}
    events = []

    class _DB(_EndpointDB):
        async def execute(self, _query):
            return _SmartResult()

        async def commit(self):
            events.append("commit")
            await super().commit()

    async def fake_lock_user_for_login(db, user_id):
        events.append("lock-user")
        captured["locked_user_id"] = user_id
        return True

    async def fake_get_session(user_id):
        return {"nonce": "current-nonce"}

    async def fake_revoke_all(db, user_id, *, commit=True):
        events.append("revoke-refresh")
        captured["revoked_user_id"] = user_id
        captured["revoke_commit"] = commit
        return True

    monkeypatch.setattr(auth_api, "lock_user_for_login", fake_lock_user_for_login)
    _patch_strict_session(monkeypatch, fake_get_session)
    # revoke_durable_session 在函数内部从 app.services.auth 导入，需在该模块 patch。
    monkeypatch.setattr(auth_service, "revoke_all_user_refresh_tokens", fake_revoke_all)

    db = _DB()
    result = asyncio.run(
        auth_api.logout(
            request=_make_request(
                cookies={settings.ACCESS_TOKEN_COOKIE_NAME: token}
            ),
            response=Response(),
            db=db,
        )
    )

    # 新持久权威合同：登出在单一事务内撤销持久会话与全部 refresh，
    # 不再有独立的 Redis nonce 轮换步骤。
    assert result["message"] == "登出成功"
    assert captured == {
        "locked_user_id": 7,
        "revoked_user_id": 7,
        "revoke_commit": False,
    }
    assert db.commit_count == 1
    assert events == [
        "lock-user",
        "revoke-refresh",
        "commit",
    ]


def test_refresh_no_token_raises_401(monkeypatch):
    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

    try:
        asyncio.run(auth_api.refresh_access_token(
            request=_make_request(),
            response=Response(),
            refresh_token=None,
            db=object(),
        ))
        assert False, "应该抛出 401"
    except HTTPException as e:
        assert e.status_code == 401
        assert "刷新令牌" in e.detail


def test_login_uses_atomic_refresh_token_issue(monkeypatch):
    captured = {}

    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_authenticate(db, username, password):
        return {
            "id": 7,
            "username": "teacher",
            "full_name": "Teacher",
            "role_code": "teacher",
            "student_id": "T007",
        }

    async def fake_publish_committed_login(
        db,
        user_id,
        refresh_token,
        request,
        *,
        preserve_cache_ttl=False,
    ):
        assert db.commit_count == 1
        assert user_id == 7
        assert refresh_token == "atomic-refresh-token"
        assert preserve_cache_ttl is False
        return "login-nonce", "127.0.0.1"

    async def fake_lock_user_for_login(db, user_id):
        captured["locked_user_id"] = user_id
        return True

    async def fake_issue_login_refresh_token(
        db,
        user_id,
        *,
        user_locked=False,
        commit=True,
    ):
        captured["user_id"] = user_id
        captured["user_locked"] = user_locked
        captured["commit"] = commit
        return "atomic-refresh-token"

    async def fail_legacy_revoke(*args, **kwargs):
        raise AssertionError("login must not revoke refresh tokens in a separate transaction")

    async def fail_legacy_create(*args, **kwargs):
        raise AssertionError("login must not create refresh tokens in a separate transaction")

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "authenticate_user_auto", fake_authenticate)
    monkeypatch.setattr(
        auth_api,
        "_publish_committed_login",
        fake_publish_committed_login,
    )
    monkeypatch.setattr(
        auth_api,
        "lock_user_for_login",
        fake_lock_user_for_login,
        raising=False,
    )
    monkeypatch.setattr(
        auth_api,
        "issue_login_refresh_token",
        fake_issue_login_refresh_token,
        raising=False,
    )
    monkeypatch.setattr(auth_api, "revoke_all_user_refresh_tokens", fail_legacy_revoke)
    monkeypatch.setattr(
        auth_api,
        "create_refresh_token",
        fail_legacy_create,
        raising=False,
    )
    monkeypatch.setattr(
        auth_api,
        "create_access_token",
        lambda data, expires_delta=None: "atomic-access-token",
    )

    result = asyncio.run(
        auth_api.login_for_access_token(
            response=Response(),
            request=_make_request(),
            username="teacher",
            password="T007",
            db=_EndpointDB(),
        )
    )

    assert captured == {
        "locked_user_id": 7,
        "user_id": 7,
        "user_locked": True,
        "commit": False,
    }
    assert result["refresh_token"] == "atomic-refresh-token"


def test_refresh_invalid_token_raises_401(monkeypatch):
    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_rotate(db, token, *, commit=True):
        return None  # 无效令牌

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate)

    try:
        asyncio.run(auth_api.refresh_access_token(
            request=_make_request(),
            response=Response(),
            refresh_token="bad-token",
            db=object(),
        ))
        assert False, "应该抛出 401"
    except HTTPException as e:
        assert e.status_code == 401


def test_refresh_success(monkeypatch):
    captured = {}

    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_rotate(db, token, *, commit=True):
        captured["commit"] = commit
        return {
            "user_id": 1,
            "username": "admin",
            "full_name": "Admin",
            "role_code": "admin",
            "student_id": None,
            "refresh_token": "new-refresh-token",
        }

    def fake_create_access(data, expires_delta=None):
        return "new-access-token"

    async def fake_get_session(user_id):
        # 新契约：缓存中的 nonce 必须符合 family 格式（22 位）。
        return {"nonce": NONCE_22}

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate, raising=False)

    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access)
    _patch_strict_session(monkeypatch, fake_get_session)

    db = _EndpointDB(user_id=1, nonce=NONCE_22)
    result = asyncio.run(auth_api.refresh_access_token(
        request=_make_request(),
        response=Response(),
        refresh_token="valid-token",
        db=db,
    ))

    assert result["access_token"] == "new-access-token"
    assert result["refresh_token"] == "new-refresh-token"
    assert captured["commit"] is False
    assert db.commit_count == 1


def test_refresh_rotation_rejects_old_token(monkeypatch):
    revoked_tokens = set()
    issued_refresh_tokens = iter(["rt-2", "rt-3"])

    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_rotate(db, token, *, commit=True):
        assert commit is False
        if token in revoked_tokens:
            return None
        if not token.startswith("rt-"):
            return None
        revoked_tokens.add(token)
        return {
            "user_id": 9,
            "username": "student",
            "full_name": "Student",
            "role_code": "student",
            "student_id": "20240009",
            "refresh_token": next(issued_refresh_tokens),
        }

    def fake_create_access(data, expires_delta=None):
        return "rotated-access-token"

    async def fake_get_session(user_id):
        return {"nonce": NONCE_22}

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate)
    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access)
    _patch_strict_session(monkeypatch, fake_get_session)

    first_db = _EndpointDB(user_id=9, nonce=NONCE_22)
    first = asyncio.run(auth_api.refresh_access_token(
        request=_make_request(),
        response=Response(),
        refresh_token="rt-1",
        db=first_db,
    ))
    assert first["refresh_token"] == "rt-2"
    assert first_db.commit_count == 1

    try:
        asyncio.run(auth_api.refresh_access_token(
            request=_make_request(),
            response=Response(),
            refresh_token="rt-1",
            db=_EndpointDB(user_id=9, nonce=NONCE_22),
        ))
        assert False, "旧 refresh token 应该失效"
    except HTTPException as e:
        assert e.status_code == 401

    second_db = _EndpointDB(user_id=9, nonce=NONCE_22)
    second = asyncio.run(auth_api.refresh_access_token(
        request=_make_request(),
        response=Response(),
        refresh_token="rt-2",
        db=second_db,
    ))
    assert second["refresh_token"] == "rt-3"
    assert second_db.commit_count == 1


def test_refresh_rate_limited(monkeypatch):
    async def fake_rate_limiter_check(key, interval_seconds):
        raise HTTPException(status_code=429, detail="请求过于频繁")

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

    try:
        asyncio.run(auth_api.refresh_access_token(
            request=_make_request(),
            response=Response(),
            refresh_token="any",
            db=object(),
        ))
        assert False, "应该抛出 429"
    except HTTPException as e:
        assert e.status_code == 429


def test_refresh_reads_token_from_cookie(monkeypatch):
    """refresh_token 可以从 cookie 中读取"""
    captured = {}

    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_rotate(db, token, *, commit=True):
        captured["token"] = token
        return None  # 返回 None 触发 401，但我们只关心 token 是否被读取

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate)

    try:
        asyncio.run(auth_api.refresh_access_token(
            request=_make_request(cookies={"refresh_token": "cookie-rt"}),
            response=Response(),
            refresh_token=None,
            db=object(),
        ))
    except HTTPException:
        pass

    assert captured.get("token") == "cookie-rt"


def test_logout_revokes_tokens_rotates_session_and_deletes_cookies(monkeypatch):
    captured = {}
    token = auth_api.create_access_token({"sub": "admin", "sn": "current-nonce"})

    class _DB(_EndpointDB):
        pass

    async def fake_lock_user_for_login(_db, user_id):
        assert user_id == 7
        return True

    async def fake_revoke_all(_db, user_id, *, commit=True):
        assert commit is False
        captured["revoked_user_id"] = user_id
        return True

    async def fake_get_session(user_id):
        assert user_id == 7
        return {"nonce": "current-nonce"}

    monkeypatch.setattr(auth_api, "lock_user_for_login", fake_lock_user_for_login)
    monkeypatch.setattr(auth_service, "revoke_all_user_refresh_tokens", fake_revoke_all)
    _patch_strict_session(monkeypatch, fake_get_session)

    response = Response()
    asyncio.run(
        auth_api.logout(
            request=_make_request(
                cookies={settings.ACCESS_TOKEN_COOKIE_NAME: token}
            ),
            response=response,
            db=_DB(),
        )
    )

    # 新持久权威合同：撤销在单一 DB 事务内完成，没有独立的 Redis 轮换。
    assert captured == {"revoked_user_id": 7}
    set_cookie_headers = response.headers.getlist("set-cookie")
    assert any(settings.ACCESS_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)
    assert any(settings.REFRESH_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)


def test_logout_with_replaced_session_only_clears_current_client_cookies(monkeypatch):
    captured = {}
    token = auth_api.create_access_token({"sub": "admin", "sn": "stale-nonce"})

    class _DB(_EndpointDB):
        pass

    async def fake_lock_user_for_login(_db, user_id):
        assert user_id == 7
        return True

    async def fake_get_session(user_id):
        assert user_id == 7
        return {"nonce": "current-nonce"}

    async def fake_revoke_all(_db, user_id, *, commit=True):
        captured["revoked_user_id"] = user_id
        return True

    monkeypatch.setattr(auth_api, "lock_user_for_login", fake_lock_user_for_login)
    _patch_strict_session(monkeypatch, fake_get_session)
    monkeypatch.setattr(auth_service, "revoke_all_user_refresh_tokens", fake_revoke_all)

    response = Response()
    result = asyncio.run(
        auth_api.logout(
            request=_make_request(
                cookies={settings.ACCESS_TOKEN_COOKIE_NAME: token}
            ),
            response=response,
            db=_DB(),
        )
    )

    assert result["message"] == "登出成功"
    assert captured == {}
    set_cookie_headers = response.headers.getlist("set-cookie")
    assert any(settings.ACCESS_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)
    assert any(settings.REFRESH_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)


def test_logout_still_clears_cookies_when_session_rotation_fails(monkeypatch):
    token = auth_api.create_access_token({"sub": "admin", "sn": "current-nonce"})

    class _Result:
        def scalar_one_or_none(self):
            return SimpleNamespace(id=7)

    class _DB(_EndpointDB):
        async def execute(self, _query):
            return _Result()

    async def fake_lock_user_for_login(_db, user_id):
        assert user_id == 7
        return True

    async def fake_revoke_all(_db, _user_id, *, commit=True):
        assert commit is False
        return True

    async def fake_get_session(_user_id):
        return {"nonce": "current-nonce"}

    monkeypatch.setattr(auth_api, "lock_user_for_login", fake_lock_user_for_login)
    monkeypatch.setattr(auth_service, "revoke_all_user_refresh_tokens", fake_revoke_all)
    _patch_strict_session(monkeypatch, fake_get_session)

    response = Response()
    result = asyncio.run(
        auth_api.logout(
            request=_make_request(
                cookies={settings.ACCESS_TOKEN_COOKIE_NAME: token}
            ),
            response=response,
            db=_DB(),
        )
    )

    assert response.status_code == 503
    assert result["revocation_status"] == "incomplete"
    assert result["message"] == "服务端会话撤销未完成，客户端 Cookie 已清理，请稍后重试"
    set_cookie_headers = response.headers.getlist("set-cookie")
    assert any(settings.ACCESS_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)
    assert any(settings.REFRESH_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)


def test_logout_returns_success_and_clears_cookies_when_database_fails():
    token = auth_api.create_access_token({"sub": "admin"})

    class _FailingDB:
        rollback_count = 0

        async def execute(self, _query):
            raise RuntimeError("database unavailable")

        async def rollback(self):
            self.rollback_count += 1

    db = _FailingDB()
    response = Response()
    result = asyncio.run(
        auth_api.logout(
            request=_make_request(
                cookies={settings.ACCESS_TOKEN_COOKIE_NAME: token}
            ),
            response=response,
            db=db,
        )
    )

    assert response.status_code == 503
    assert result["revocation_status"] == "incomplete"
    assert result["message"] == "服务端会话撤销未完成，客户端 Cookie 已清理，请稍后重试"
    assert db.rollback_count == 1
    set_cookie_headers = response.headers.getlist("set-cookie")
    assert any(settings.ACCESS_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)
    assert any(settings.REFRESH_TOKEN_COOKIE_NAME in value for value in set_cookie_headers)
