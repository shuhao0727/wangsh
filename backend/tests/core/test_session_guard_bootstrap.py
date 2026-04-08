import asyncio

from starlette.requests import Request

import app.core.session_guard as session_guard


def test_verify_request_session_bootstraps_from_token_nonce(monkeypatch):
    captured = {}

    async def fake_get_user_session(_user_id):
        return None

    async def fake_set_user_session(user_id, data):
        captured["user_id"] = user_id
        captured["data"] = data
        return True

    monkeypatch.setattr(session_guard, "get_user_session", fake_get_user_session)
    monkeypatch.setattr(session_guard, "set_user_session", fake_set_user_session)

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v2/pythonlab/optimize/code",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
        }
    )

    ok = asyncio.run(session_guard.verify_request_session(7, {"sn": "nonce-123"}, request))

    assert ok is True
    assert captured["user_id"] == 7
    assert captured["data"]["nonce"] == "nonce-123"
