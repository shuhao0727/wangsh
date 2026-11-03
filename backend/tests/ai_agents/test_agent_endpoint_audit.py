"""智能体出站端点分类的离线回归。

覆盖与 assert_agent_outbound_endpoint 同源的判定：白名单、本机 Ollama、
内网/元数据拒绝、协议非法。全部使用字面 IP 与合成白名单，不做真实 DNS 或网络请求。
"""

import asyncio

from app.core.config import settings
from app.services.agents.endpoint_security import (
    classify_agent_endpoint,
    reset_trusted_endpoint_cache,
)


def _classify(url: str) -> tuple[str, str]:
    return asyncio.run(classify_agent_endpoint(url))


def test_metadata_endpoint_is_blocked():
    verdict, _reason = _classify("http://169.254.169.254/latest/meta-data")
    assert verdict == "blocked"


def test_loopback_non_ollama_port_is_blocked():
    verdict, _reason = _classify("http://127.0.0.1:8080/v1/chat/completions")
    assert verdict == "blocked"


def test_loopback_ollama_port_is_allowed():
    verdict, reason = _classify("http://127.0.0.1:11434/v1")
    assert verdict == "allowed"
    assert "Ollama" in reason


def test_non_http_scheme_is_invalid():
    verdict, _reason = _classify("ftp://example.com/v1")
    assert verdict == "invalid"


def test_whitelisted_internal_endpoint(monkeypatch):
    monkeypatch.setattr(
        settings,
        "AGENT_TRUSTED_INTERNAL_ENDPOINTS",
        "http://docker-api-1:5001/v1",
    )
    reset_trusted_endpoint_cache()
    try:
        verdict, reason = _classify("http://docker-api-1:5001/v1/chat/completions")
        assert verdict == "whitelisted"
        assert "白名单" in reason
    finally:
        reset_trusted_endpoint_cache()
