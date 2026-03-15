import asyncio

from starlette.requests import Request
from starlette.responses import Response

import app.api.endpoints.auth.auth as auth_api


def test_refresh_token_bootstraps_nonce_when_session_missing(monkeypatch):
    captured = {}

    async def fake_verify_refresh_token(_db, _token):
        return {
            "user_id": 11,
            "role_code": "super_admin",
            "username": "admin",
            "student_id": None,
            "full_name": "Admin",
        }

    async def fake_revoke_refresh_token(_db, _token):
        return True

    async def fake_create_refresh_token(_db, _user_id):
        return "new-rt"

    async def fake_get_user_session(_user_id):
        return None

    async def fake_rotate_user_session(_user_id, keep_ip=None):
        captured["keep_ip"] = keep_ip
        return {"nonce": "fresh-nonce"}

    def fake_extract_client_ip(_request):
        return "127.0.0.1"

    def fake_create_access_token(data, expires_delta=None):
        captured["token_data"] = data
        return "new-at"

    monkeypatch.setattr(auth_api, "verify_refresh_token", fake_verify_refresh_token)
    monkeypatch.setattr(auth_api, "revoke_refresh_token", fake_revoke_refresh_token)
    monkeypatch.setattr(auth_api, "create_refresh_token", fake_create_refresh_token)
    monkeypatch.setattr(auth_api, "get_user_session", fake_get_user_session)
    monkeypatch.setattr(auth_api, "rotate_user_session", fake_rotate_user_session)
    monkeypatch.setattr(auth_api, "extract_client_ip", fake_extract_client_ip)
    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access_token)

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/refresh",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
        }
    )
    response = Response()

    result = asyncio.run(
        auth_api.refresh_access_token(
            request=request,
            response=response,
            refresh_token="old-rt",
            db=object(),
        )
    )

    assert result["access_token"] == "new-at"
    assert result["refresh_token"] == "new-rt"
    assert captured["token_data"]["sn"] == "fresh-nonce"
    assert captured["keep_ip"] == "127.0.0.1"
