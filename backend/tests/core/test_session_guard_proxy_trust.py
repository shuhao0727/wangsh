"""S7 治理回归：转发头只在 socket peer 属于可信代理网段时才被采纳。

故障模式（治理前）：AUTH_TRUST_X_FORWARDED_FOR=True 时任何直连来源都可伪造
X-Forwarded-For，从而篡改 IP 绑定与同 IP 会话替换判断。
"""
import asyncio

from starlette.requests import Request

import app.core.session_guard as session_guard


def _make_request(peer="10.0.0.5", headers=None):
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "client": (peer, 12345),
        "query_string": b"",
    })


def test_forwarded_header_ignored_when_peer_untrusted(monkeypatch):
    """直连来源不在可信网段：伪造转发头一律不采纳，回退真实 peer。"""
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUST_X_FORWARDED_FOR", True)
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUSTED_PROXY_CIDRS", "10.1.0.0/16")
    request = _make_request(
        peer="10.0.0.5",
        headers={"X-Forwarded-For": "6.6.6.6", "X-Real-IP": "7.7.7.7"},
    )
    assert session_guard.extract_client_ip(request) == "10.0.0.5"


def test_forwarded_header_accepted_from_trusted_proxy(monkeypatch):
    """socket peer 在可信网段：按优先级采用转发头第一个合法 IP。"""
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUST_X_FORWARDED_FOR", True)
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUSTED_PROXY_CIDRS", "10.1.0.0/16,127.0.0.1/32")
    request = _make_request(
        peer="10.1.0.9",
        headers={"X-Forwarded-For": "6.6.6.6, 10.1.0.1"},
    )
    assert session_guard.extract_client_ip(request) == "6.6.6.6"


def test_empty_cidrs_are_fail_closed(monkeypatch):
    """未配置可信网段（含仅空白）：即使开关打开也忽略所有转发头。"""
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUST_X_FORWARDED_FOR", True)
    for value in ("", "  ", ","):
        monkeypatch.setattr(session_guard.settings, "AUTH_TRUSTED_PROXY_CIDRS", value)
        request = _make_request(
            peer="10.0.0.5",
            headers={"X-Forwarded-For": "6.6.6.6"},
        )
        assert session_guard.extract_client_ip(request) == "10.0.0.5"


def test_trust_switch_off_ignores_headers_regardless_of_cidrs(monkeypatch):
    """开关关闭时行为与治理前一致：直接回退 peer，不看网段配置。"""
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUST_X_FORWARDED_FOR", False)
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUSTED_PROXY_CIDRS", "0.0.0.0/0")
    request = _make_request(
        peer="10.0.0.5",
        headers={"X-Forwarded-For": "6.6.6.6"},
    )
    assert session_guard.extract_client_ip(request) == "10.0.0.5"


def test_invalid_peer_still_falls_back_safely(monkeypatch):
    """peer 缺失或非法时不被任何转发头劫持。"""
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUST_X_FORWARDED_FOR", True)
    monkeypatch.setattr(session_guard.settings, "AUTH_TRUSTED_PROXY_CIDRS", "0.0.0.0/0")
    request = Request({
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [(b"x-forwarded-for", b"6.6.6.6")],
        "client": None,
        "query_string": b"",
    })
    assert session_guard.extract_client_ip(request) == "0.0.0.0"
