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
    detail = asyncio.run(session_guard.verify_request_session_detail(7, {"sn": "nonce-123"}, request))

    assert ok is True
    assert detail == {"ok": True, "reason": "ok"}
    assert captured["user_id"] == 7
    assert captured["data"]["nonce"] == "nonce-123"


def test_on_successful_login_always_rotates_same_user_session(monkeypatch):
    writes = []

    async def fake_get_ip_binding(_ip):
        return None

    async def fake_set_user_session(user_id, data):
        writes.append((user_id, data))
        return True

    async def fake_set_ip_binding(_ip, _data):
        return True

    monkeypatch.setattr(session_guard.settings, "AUTH_USER_UNIQUE_PER_IP", False)
    monkeypatch.setattr(session_guard.settings, "AUTH_IP_UNIQUE_PER_USER", False)
    monkeypatch.setattr(session_guard, "get_ip_binding", fake_get_ip_binding)
    monkeypatch.setattr(session_guard, "set_user_session", fake_set_user_session)
    monkeypatch.setattr(session_guard, "set_ip_binding", fake_set_ip_binding)

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/login",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
        }
    )

    first_nonce, first_ip = asyncio.run(session_guard.on_successful_login(7, request))
    second_nonce, second_ip = asyncio.run(session_guard.on_successful_login(7, request))

    assert first_ip == "127.0.0.1"
    assert second_ip == "127.0.0.1"
    assert first_nonce != second_nonce
    assert [user_id for user_id, _data in writes] == [7, 7]
    assert writes[0][1]["nonce"] == first_nonce
    assert writes[1][1]["nonce"] == second_nonce


def test_verify_request_session_detail_reports_replaced_login(monkeypatch):
    async def fake_get_user_session(_user_id):
        return {"nonce": "fresh-nonce", "ip": "127.0.0.1"}

    monkeypatch.setattr(session_guard, "get_user_session", fake_get_user_session)

    detail = asyncio.run(session_guard.verify_request_session_detail(7, {"sn": "old-nonce"}, None))

    assert detail == {"ok": False, "reason": "replaced_by_new_login"}
