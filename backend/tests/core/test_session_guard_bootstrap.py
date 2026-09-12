import asyncio

from starlette.requests import Request

import app.core.session_guard as session_guard


def _patch_durable_family(monkeypatch, *, active=True):
    """持久权威链路替身：默认会话有效；单测只关注 Redis nonce 部分。"""

    async def fake_verify_access_family(_user_id, _payload, db=None):
        return active

    monkeypatch.setattr(session_guard, "verify_access_family", fake_verify_access_family)


def test_verify_request_session_rejects_missing_server_session(monkeypatch):
    writes = []

    async def fake_get_user_session(_user_id):
        return None

    async def fake_set_user_session(user_id, data):
        writes.append((user_id, data))
        return True

    monkeypatch.setattr(session_guard, "get_user_session", fake_get_user_session)
    monkeypatch.setattr(session_guard, "set_user_session", fake_set_user_session)
    _patch_durable_family(monkeypatch)

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

    assert ok is False
    assert detail == {"ok": False, "reason": "expired_or_missing"}
    assert writes == []


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
    _patch_durable_family(monkeypatch)

    detail = asyncio.run(session_guard.verify_request_session_detail(7, {"sn": "old-nonce"}, None))

    assert detail == {"ok": False, "reason": "replaced_by_new_login"}


def test_verify_request_session_detail_durable_replaced_login(monkeypatch):
    """持久权威拒绝时，若状态仍 active 但 nonce 已轮换，应报“被新登录替换”。"""

    async def fake_verify_access_family(_user_id, _payload, db=None):
        return False

    class FakeState:
        active = True
        nonce = "fresh-nonce"

    async def fake_durable_state(_user_id, db=None):
        return FakeState()

    monkeypatch.setattr(session_guard, "verify_access_family", fake_verify_access_family)
    monkeypatch.setattr(session_guard, "_durable_session_state", fake_durable_state)

    detail = asyncio.run(session_guard.verify_request_session_detail(7, {"sn": "old-nonce"}, None))
    assert detail == {"ok": False, "reason": "replaced_by_new_login"}


def test_verify_request_session_detail_durable_revoked_keeps_generic(monkeypatch):
    """主动登出/撤销（状态 inactive）不误报成异地登录。"""

    async def fake_verify_access_family(_user_id, _payload, db=None):
        return False

    class FakeState:
        active = False
        nonce = "old-nonce"

    async def fake_durable_state(_user_id, db=None):
        return FakeState()

    monkeypatch.setattr(session_guard, "verify_access_family", fake_verify_access_family)
    monkeypatch.setattr(session_guard, "_durable_session_state", fake_durable_state)

    detail = asyncio.run(session_guard.verify_request_session_detail(7, {"sn": "old-nonce"}, None))
    assert detail == {"ok": False, "reason": "family_revoked"}


def test_rotate_user_session_fails_when_server_session_cannot_be_written(monkeypatch):
    async def fake_set_user_session(_user_id, _data):
        return False

    monkeypatch.setattr(session_guard, "set_user_session", fake_set_user_session)

    try:
        asyncio.run(session_guard.rotate_user_session(7, keep_ip="127.0.0.1"))
        assert False, "服务端会话写入失败时不应返回可签发的 nonce"
    except RuntimeError as exc:
        assert "会话" in str(exc)
