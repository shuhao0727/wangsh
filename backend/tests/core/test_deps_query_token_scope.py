"""安全审计 S-3：query token 鉴权收窄。

- 通用 HTTP 路径（get_access_token / get_current_user）不再接受 `?token=`，
  token 只能来自 Authorization header 或 cookie。
- 仅 SSE 场景（get_access_token_sse / get_current_user_sse）放行 query token，
  因为 EventSource 无法自定义 header。
"""
import asyncio

from starlette.requests import Request
from fastapi.testclient import TestClient

import app.core.deps as deps
from main import app


def _make_request(query_string: str = "", cookies: str = "") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/classroom/stream",
            "headers": [(b"cookie", cookies.encode())] if cookies else [],
            "client": ("127.0.0.1", 12345),
            "query_string": query_string.encode(),
        }
    )


def test_get_access_token_ignores_query_token():
    """通用 token 解析必须忽略 query token：无 header/cookie 时返回 None。"""
    request = _make_request(query_string="token=querygood")
    token = asyncio.run(deps.get_access_token(request=request, token=None))
    assert token is None


def test_get_access_token_ignores_query_token_when_cookie_present():
    """通用 token 解析仍接受 cookie，但忽略 query token。"""
    request = _make_request(
        query_string="token=querygood",
        cookies="ws_access_token=cookiegood",
    )
    token = asyncio.run(deps.get_access_token(request=request, token=None))
    assert token == "cookiegood"


def test_get_access_token_sse_accepts_query_token():
    """SSE 专用 token 解析放行 query token。"""
    request = _make_request(query_string="token=querygood")
    token = asyncio.run(deps.get_access_token_sse(request=request, token=None))
    assert token == "querygood"


def test_get_current_user_sse_authenticates_via_query_token(monkeypatch):
    """SSE 场景：携带 query token 仍可完成鉴权（返回与 get_current_user 同型的 UserInfo）。"""
    calls = []

    async def fake_auth_get_current_user(token, _db):
        calls.append(token)
        if token == "querygood":
            return {"id": 7, "role_code": "student"}
        return None

    async def fake_verify_request_session_detail(_user_id, _payload, _request, db=None):
        return {"ok": True, "reason": "ok"}

    def fake_verify_token(_token):
        return {"sn": "ok"}

    monkeypatch.setattr(deps, "auth_get_current_user", fake_auth_get_current_user)
    monkeypatch.setattr(deps, "verify_request_session_detail", fake_verify_request_session_detail)
    monkeypatch.setattr(deps, "verify_token", fake_verify_token)

    request = _make_request(query_string="token=querygood")

    async def pipeline():
        token = await deps.get_access_token_sse(request=request, token=None)
        assert token == "querygood"
        return await deps.get_current_user_sse(token=token, db=object(), request=request)

    user = asyncio.run(pipeline())
    assert user["id"] == 7
    assert user["role_code"] == "student"
    assert calls == ["querygood"]


def test_generic_http_endpoint_rejects_query_token(monkeypatch):
    """普通 HTTP 端点：即使 query token 可解析出用户，也必须 401。

    若回归放开 query token，本测试将走到 auth_get_current_user("querygood")
    并返回 200，从而暴露回归。
    """
    async def fake_auth_get_current_user(token, _db):
        if token == "querygood":
            return {"id": 3, "role_code": "student"}
        return None

    async def fake_verify_request_session_detail(_user_id, _payload, _request, db=None):
        return {"ok": True, "reason": "ok"}

    def fake_verify_token(_token):
        return {"sn": "ok"}

    monkeypatch.setattr(deps, "auth_get_current_user", fake_auth_get_current_user)
    monkeypatch.setattr(deps, "verify_request_session_detail", fake_verify_request_session_detail)
    monkeypatch.setattr(deps, "verify_token", fake_verify_token)

    client = TestClient(app)
    response = client.get("/api/v1/auth/me", params={"token": "querygood"})
    assert response.status_code == 401
