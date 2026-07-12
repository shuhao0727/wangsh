import asyncio

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

import app.api.endpoints.auth.auth as auth_api


def test_refresh_token_bootstraps_nonce_when_session_missing(monkeypatch):
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

    async def fake_rate_limiter_check(_key, interval_seconds):
        assert interval_seconds == 5

    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate_refresh_token, raising=False)
    monkeypatch.setattr(auth_api, "get_user_session", fake_get_user_session)
    monkeypatch.setattr(auth_api, "rotate_user_session", fake_rotate_user_session)
    monkeypatch.setattr(auth_api, "extract_client_ip", fake_extract_client_ip)
    monkeypatch.setattr(auth_api, "create_access_token", fake_create_access_token)
    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

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

    class FakeDB:
        commit_count = 0

        async def commit(self):
            self.commit_count += 1

        async def rollback(self):
            pass

    db = FakeDB()
    result = asyncio.run(
        auth_api.refresh_access_token(
            request=request,
            response=response,
            refresh_token="old-rt",
            db=db,
        )
    )

    assert result["access_token"] == "new-at"
    assert result["refresh_token"] == "new-rt"
    assert captured["token_data"]["sn"] == "fresh-nonce"
    assert captured["keep_ip"] == "127.0.0.1"
    assert captured["commit"] is False
    assert db.commit_count == 1


def test_refresh_token_returns_503_when_session_nonce_cannot_be_written(monkeypatch):
    async def fake_rotate_refresh_token(_db, _token, *, commit=True):
        return {
            "user_id": 11,
            "role_code": "super_admin",
            "username": "admin",
            "student_id": None,
            "full_name": "Admin",
            "refresh_token": "new-rt",
        }

    async def fake_get_user_session(_user_id):
        return None

    async def fake_rotate_user_session(_user_id, keep_ip=None):
        raise RuntimeError("无法写入服务端会话")

    async def fake_rate_limiter_check(_key, interval_seconds):
        assert interval_seconds == 5

    monkeypatch.setattr(auth_api, "rotate_refresh_token", fake_rotate_refresh_token, raising=False)
    monkeypatch.setattr(auth_api, "get_user_session", fake_get_user_session)
    monkeypatch.setattr(auth_api, "rotate_user_session", fake_rotate_user_session)
    monkeypatch.setattr(auth_api.rate_limiter, "check", fake_rate_limiter_check)

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

    class FakeDB:
        rollback_count = 0

        async def rollback(self):
            self.rollback_count += 1

    db = FakeDB()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            auth_api.refresh_access_token(
                request=request,
                response=response,
                refresh_token="old-rt",
                db=db,
            )
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "无法建立登录会话，请重新登录"
    assert db.rollback_count == 1
