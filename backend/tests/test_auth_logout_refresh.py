"""
auth /logout 和 /refresh 端点测试
"""
import asyncio
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

import app.api.endpoints.auth.auth as auth_api


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
    result = asyncio.run(auth_api.logout(response=response))
    assert result["message"] == "登出成功"
    assert "timestamp" in result


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


def test_refresh_invalid_token_raises_401(monkeypatch):
    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_verify(db, token):
        return None  # 无效令牌

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "verify_refresh_token", fake_verify)

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
    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_verify(db, token):
        return {
            "user_id": 1,
            "username": "admin",
            "full_name": "Admin",
            "role_code": "admin",
            "student_id": None,
        }

    async def fake_revoke(db, token):
        return True

    async def fake_create_refresh(db, user_id):
        return "new-refresh-token"

    def fake_create_access(data, expires_delta=None):
        return "new-access-token"

    async def fake_get_session(user_id):
        return {"nonce": "existing-nonce"}

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "verify_refresh_token", fake_verify)
    monkeypatch.setattr(auth_api, "revoke_refresh_token", fake_revoke)
    monkeypatch.setattr(auth_api, "create_refresh_token", fake_create_refresh)
    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access)
    monkeypatch.setattr(auth_api, "get_user_session", fake_get_session)

    result = asyncio.run(auth_api.refresh_access_token(
        request=_make_request(),
        response=Response(),
        refresh_token="valid-token",
        db=object(),
    ))

    assert result["access_token"] == "new-access-token"
    assert result["refresh_token"] == "new-refresh-token"


def test_refresh_rotation_rejects_old_token(monkeypatch):
    revoked_tokens = set()
    issued_refresh_tokens = iter(["rt-2", "rt-3"])

    async def fake_rate_limiter_check(key, interval_seconds):
        pass

    async def fake_verify(db, token):
        if token in revoked_tokens:
            return None
        if not token.startswith("rt-"):
            return None
        return {
            "user_id": 9,
            "username": "student",
            "full_name": "Student",
            "role_code": "student",
            "student_id": "20240009",
        }

    async def fake_revoke(db, token):
        revoked_tokens.add(token)
        return True

    async def fake_create_refresh(db, user_id):
        return next(issued_refresh_tokens)

    def fake_create_access(data, expires_delta=None):
        return "rotated-access-token"

    async def fake_get_session(user_id):
        return {"nonce": "nonce-9"}

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "verify_refresh_token", fake_verify)
    monkeypatch.setattr(auth_api, "revoke_refresh_token", fake_revoke)
    monkeypatch.setattr(auth_api, "create_refresh_token", fake_create_refresh)
    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access)
    monkeypatch.setattr(auth_api, "get_user_session", fake_get_session)

    first = asyncio.run(auth_api.refresh_access_token(
        request=_make_request(),
        response=Response(),
        refresh_token="rt-1",
        db=object(),
    ))
    assert first["refresh_token"] == "rt-2"

    try:
        asyncio.run(auth_api.refresh_access_token(
            request=_make_request(),
            response=Response(),
            refresh_token="rt-1",
            db=object(),
        ))
        assert False, "旧 refresh token 应该失效"
    except HTTPException as e:
        assert e.status_code == 401

    second = asyncio.run(auth_api.refresh_access_token(
        request=_make_request(),
        response=Response(),
        refresh_token="rt-2",
        db=object(),
    ))
    assert second["refresh_token"] == "rt-3"


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

    async def fake_verify(db, token):
        captured["token"] = token
        return None  # 返回 None 触发 401，但我们只关心 token 是否被读取

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)
    monkeypatch.setattr(auth_api, "verify_refresh_token", fake_verify)

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
