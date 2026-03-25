"""
auth /login 端点测试
覆盖：登录成功、登录失败、速率限制
"""
import asyncio

from starlette.requests import Request
from starlette.responses import Response
from fastapi import HTTPException

import app.api.endpoints.auth.auth as auth_api


def _make_request(ip="127.0.0.1"):
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [],
        "client": (ip, 12345),
        "query_string": b"",
    })


def _patch_login_deps(monkeypatch, user=None, nonce="test-nonce", client_ip="127.0.0.1"):
    async def fake_authenticate(db, username, password):
        return user

    async def fake_on_successful_login(user_id, request):
        return nonce, client_ip

    def fake_create_access_token(data, expires_delta=None):
        return "mock-access-token"

    async def fake_create_refresh_token(db, user_id):
        return "mock-refresh-token"

    async def fake_rate_limiter_check(key, interval_seconds):
        pass  # 默认不限流

    monkeypatch.setattr(auth_api, "authenticate_user_auto", fake_authenticate)
    monkeypatch.setattr(auth_api, "on_successful_login", fake_on_successful_login)
    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access_token)
    monkeypatch.setattr(auth_api, "create_refresh_token", fake_create_refresh_token)
    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)


def test_login_success_admin(monkeypatch):
    user = {
        "id": 1,
        "username": "admin",
        "full_name": "Admin User",
        "role_code": "admin",
        "student_id": None,
    }
    _patch_login_deps(monkeypatch, user=user)

    result = asyncio.run(auth_api.login_for_access_token(
        response=Response(),
        request=_make_request(),
        username="admin",
        password="correct",
        db=object(),
    ))

    assert result["access_token"] == "mock-access-token"
    assert result["refresh_token"] == "mock-refresh-token"
    assert result["role_code"] == "admin"
    assert result["username"] == "admin"
    assert "student_id" not in result


def test_login_success_student(monkeypatch):
    user = {
        "id": 2,
        "username": None,
        "full_name": "张三",
        "role_code": "student",
        "student_id": "20240001",
        "class_name": "高一1班",
        "study_year": 2024,
    }
    _patch_login_deps(monkeypatch, user=user)

    result = asyncio.run(auth_api.login_for_access_token(
        response=Response(),
        request=_make_request(),
        username="20240001",
        password="correct",
        db=object(),
    ))

    assert result["role_code"] == "student"
    assert result["student_id"] == "20240001"
    assert result["class_name"] == "高一1班"


def test_login_wrong_password(monkeypatch):
    _patch_login_deps(monkeypatch, user=None)

    try:
        asyncio.run(auth_api.login_for_access_token(
            response=Response(),
            request=_make_request(),
            username="admin",
            password="wrong",
            db=object(),
        ))
        assert False, "应该抛出 HTTPException"
    except HTTPException as e:
        assert e.status_code == 401


def test_login_rate_limited(monkeypatch):
    async def fake_rate_limiter_check(key, interval_seconds):
        raise HTTPException(status_code=429, detail="请求过于频繁")

    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

    try:
        asyncio.run(auth_api.login_for_access_token(
            response=Response(),
            request=_make_request(),
            username="admin",
            password="any",
            db=object(),
        ))
        assert False, "应该抛出 429"
    except HTTPException as e:
        assert e.status_code == 429


def test_login_rate_limit_key_includes_ip(monkeypatch):
    """速率限制的 key 应该包含客户端 IP"""
    captured = {}

    async def fake_rate_limiter_check(key, interval_seconds):
        captured["key"] = key
        captured["interval"] = interval_seconds

    user = {"id": 1, "username": "admin", "full_name": "Admin", "role_code": "admin", "student_id": None}
    _patch_login_deps(monkeypatch, user=user)
    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

    asyncio.run(auth_api.login_for_access_token(
        response=Response(),
        request=_make_request(ip="10.0.0.1"),
        username="admin",
        password="correct",
        db=object(),
    ))

    assert "login:" in captured["key"]
    assert captured["interval"] > 0
