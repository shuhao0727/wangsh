"""
模型发现 SSRF 防护测试。

覆盖：
- guard 对环回/私网/链路本地（含云元数据 169.254.169.254）/保留/组播/未指定地址全拦截
- 全部解析地址逐一校验（任一落内网即拒绝；合法公网 IPv6-only 不被误判）
- OLLAMA 服务商显式放行本机 11434，其他 provider/端口仍全部拦截
- discover_models 对 SSRF 端点 re-raise EndpointNotAllowedError（API 层映射 400，
  而不是吞成 success=False + 200）
- /discover/{agent_id} 端点把 ValueError 映射为 HTTP 400
"""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.agents import AIServiceProvider, ModelDiscoveryRequest
from app.services.agents.endpoint_security import (
    EndpointNotAllowedError,
    _assert_safe_endpoint,
    _assert_safe_endpoint_async,
)
from app.services.agents.model_discovery import ModelDiscoveryService

service = ModelDiscoveryService()


# ---------- guard：全拦截（9 攻击面） ----------

def test_guard_rejects_loopback_and_localhost():
    for url in (
        "http://localhost:11434",
        "http://127.0.0.1:11434",
        "http://[::1]:11434",
        "http://127.0.0.1:8080",
    ):
        with pytest.raises(EndpointNotAllowedError):
            _assert_safe_endpoint(url)


def test_guard_rejects_private_link_local_and_metadata():
    for url in (
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://172.31.255.254",
        "http://192.168.1.1",
        "http://169.254.169.254/latest/meta-data",  # 云元数据
        "http://[fe80::1]",
        "http://[fc00::1]",
        "http://0.0.0.0",
        "http://[::]",
        "http://[::ffff:127.0.0.1]",  # IPv4-mapped 环回
        "http://[::ffff:10.0.0.1]",  # IPv4-mapped 私网
        "http://[::ffff:169.254.169.254]",  # IPv4-mapped 元数据
    ):
        with pytest.raises(EndpointNotAllowedError):
            _assert_safe_endpoint(url)


def test_guard_rejects_non_http_scheme_and_missing_host():
    for url in ("file:///etc/passwd", "ftp://8.8.8.8", "http:///path", "http://:11434"):
        with pytest.raises(EndpointNotAllowedError):
            _assert_safe_endpoint(url)


def test_guard_rejects_unresolvable_host():
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint("http://nonexistent-host-xyz-12345.invalid")


# ---------- guard：公网地址放行 ----------

def test_guard_allows_public_addresses():
    # 字面公网 IP（含公网 IPv6）不触发 DNS，直接通过
    for url in ("http://8.8.8.8/v1", "https://1.1.1.1", "http://[2001:4860:4860::8888]"):
        _assert_safe_endpoint(url)


# ---------- OLLAMA 本机显式放行 ----------

def test_guard_allows_local_ollama_when_flag_set():
    _assert_safe_endpoint("http://localhost:11434", allow_local_ollama=True)
    _assert_safe_endpoint("http://127.0.0.1:11434", allow_local_ollama=True)
    _assert_safe_endpoint("http://[::1]:11434", allow_local_ollama=True)


def test_guard_local_ollama_allow_is_scoped_to_port_11434():
    # 端口不对不放行
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint("http://localhost:8080", allow_local_ollama=True)
    # 无端口不放行（不是明确的 11434）
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint("http://localhost", allow_local_ollama=True)


def test_detect_provider_allows_local_ollama():
    result = service.detect_provider_from_url("http://localhost:11434")
    assert result.provider == AIServiceProvider.OLLAMA


def test_detect_provider_still_rejects_localhost_for_other_providers():
    # 命中 Dify 模式（/v1/chat/completions）而非 OLLAMA 模式 → 拦截
    with pytest.raises(EndpointNotAllowedError):
        service.detect_provider_from_url("http://localhost:8080/v1/chat/completions")
    # 纯本机端点无 OLLAMA 特征 → 拦截
    with pytest.raises(EndpointNotAllowedError):
        service.detect_provider_from_url("http://127.0.0.1:9999")


def test_normalize_allows_local_ollama_only_for_ollama_provider():
    assert service.normalize_api_endpoint(
        "http://localhost:11434", AIServiceProvider.OLLAMA
    ) == "http://localhost:11434"
    with pytest.raises(EndpointNotAllowedError):
        service.normalize_api_endpoint(
            "http://localhost:11434", AIServiceProvider.OPENAI
        )


# ---------- 异步 guard 与同步语义一致 ----------

def test_guard_async_matches_sync():
    async def check():
        # 公网通过
        await _assert_safe_endpoint_async("http://8.8.8.8/v1")
        await _assert_safe_endpoint_async("http://[2001:4860:4860::8888]")
        # OLLAMA 放行
        await _assert_safe_endpoint_async("http://localhost:11434", allow_local_ollama=True)
        # 拦截
        with pytest.raises(EndpointNotAllowedError):
            await _assert_safe_endpoint_async("http://169.254.169.254/latest/meta-data")
        with pytest.raises(EndpointNotAllowedError):
            await _assert_safe_endpoint_async("http://localhost:11434")

    asyncio.run(check())


# ---------- discover_models：SSRF 传播为异常（API 层 400），不再吞成 success=False ----------

def test_discover_rejects_ssrf_when_auto_detecting():
    with pytest.raises(EndpointNotAllowedError):
        asyncio.run(service.discover_models(ModelDiscoveryRequest(
            api_endpoint="http://192.168.1.5/v1",
            api_key="k",
        )))


def test_discover_rejects_ssrf_when_provider_specified():
    with pytest.raises(EndpointNotAllowedError):
        asyncio.run(service.discover_models(ModelDiscoveryRequest(
            api_endpoint="http://169.254.169.254/latest/meta-data",
            api_key="k",
            provider=AIServiceProvider.OPENAI,
        )))


def test_discover_allows_local_ollama(monkeypatch):
    async def fake_ollama(config):
        return []

    monkeypatch.setattr(service, "discover_models_ollama", fake_ollama)
    resp = asyncio.run(service.discover_models(ModelDiscoveryRequest(
        api_endpoint="http://localhost:11434",
        api_key="k",
        provider=AIServiceProvider.OLLAMA,
    )))
    assert resp.success is True


def test_discover_localhost_non_ollama_provider_is_rejected():
    # 用户显式指定非 OLLAMA 服务商指向本机 11434 → 仍拦截（放行仅限 OLLAMA）
    with pytest.raises(EndpointNotAllowedError):
        asyncio.run(service.discover_models(ModelDiscoveryRequest(
            api_endpoint="http://localhost:11434",
            api_key="k",
            provider=AIServiceProvider.OPENAI,
        )))


# ---------- /discover/{agent_id}：ValueError → 400 ----------

def test_discover_by_agent_maps_ssrf_valueerror_to_400(monkeypatch):
    import app.api.endpoints.agents.model_discovery as model_discovery_api

    async def fake_get_agent(db, agent_id):
        return SimpleNamespace(
            api_endpoint="http://169.254.169.254/latest/meta-data",
            api_key_encrypted="enc",
            api_key="k",
        )

    async def fake_discover(request):
        raise ValueError("禁止访问内网/环回/保留地址端点")

    monkeypatch.setattr("app.services.agents.get_agent", fake_get_agent)
    monkeypatch.setattr(
        "app.utils.agent_secrets.try_decrypt_api_key",
        lambda _enc: None,
    )
    monkeypatch.setattr(model_discovery_api, "discover_models_service", fake_discover)

    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(model_discovery_api.discover_models_by_agent(7, db=object()))
    assert excinfo.value.status_code == 400
