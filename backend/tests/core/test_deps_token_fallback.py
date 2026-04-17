import asyncio

from starlette.requests import Request

import app.core.deps as deps


def test_get_current_user_fallback_to_cookie_token(monkeypatch):
    calls = []

    async def fake_auth_get_current_user(token, _db):
        calls.append(token)
        if token == "cookiegood":
            return {"id": 1, "role_code": "super_admin"}
        return None

    async def fake_verify_request_session_detail(_user_id, _payload, _request):
        return {"ok": True, "reason": "ok"}

    def fake_verify_token(_token):
        return {"sn": "ok"}

    monkeypatch.setattr(deps, "auth_get_current_user", fake_auth_get_current_user)
    monkeypatch.setattr(deps, "verify_request_session_detail", fake_verify_request_session_detail)
    monkeypatch.setattr(deps, "verify_token", fake_verify_token)

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v2/pythonlab/optimize/code",
            "headers": [(b"cookie", b"ws_access_token=cookiegood")],
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
        }
    )
    user = asyncio.run(deps.get_current_user(token="staleheader", db=object(), request=request))

    assert user["id"] == 1
    assert calls == ["staleheader", "cookiegood"]


def test_get_current_user_reports_replaced_login(monkeypatch):
    async def fake_auth_get_current_user(_token, _db):
        return {"id": 1, "role_code": "student"}

    async def fake_verify_request_session_detail(_user_id, _payload, _request):
        return {"ok": False, "reason": "replaced_by_new_login"}

    def fake_verify_token(_token):
        return {"sn": "stale"}

    monkeypatch.setattr(deps, "auth_get_current_user", fake_auth_get_current_user)
    monkeypatch.setattr(deps, "verify_request_session_detail", fake_verify_request_session_detail)
    monkeypatch.setattr(deps, "verify_token", fake_verify_token)

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/auth/me",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
        }
    )

    try:
        asyncio.run(deps.get_current_user(token="staletoken", db=object(), request=request))
        raise AssertionError("expected HTTPException")
    except deps.HTTPException as exc:
        assert exc.status_code == 401
        assert exc.detail == "账号已在其他地方登录，请重新登录"
