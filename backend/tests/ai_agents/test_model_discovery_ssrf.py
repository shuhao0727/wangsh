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

from app.core.config import settings
from app.schemas.agents import AIServiceProvider, ModelDiscoveryRequest
from app.services.agents.endpoint_security import (
    EndpointNotAllowedError,
    _assert_safe_endpoint,
    _assert_safe_endpoint_async,
    matches_trusted_endpoint,
    parse_trusted_endpoints,
    reset_trusted_endpoint_cache,
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


# ==================== 受信内部端点白名单（AGENT_TRUSTED_INTERNAL_ENDPOINTS） ====================

WHITELIST = "http://docker-api-1:5001/v1"


@pytest.fixture
def trusted_whitelist(monkeypatch):
    """配置一条生产同款白名单：http://docker-api-1:5001/v1。"""
    monkeypatch.setattr(settings, "AGENT_TRUSTED_INTERNAL_ENDPOINTS", WHITELIST)
    reset_trusted_endpoint_cache()
    yield
    reset_trusted_endpoint_cache()


@pytest.fixture
def no_dns(monkeypatch):
    """任何 DNS 解析都会直接失败：用于证明放行路径没有走 DNS。"""

    def boom(*args, **kwargs):
        raise AssertionError("命中白名单时不应发生 DNS 解析")

    monkeypatch.setattr("socket.getaddrinfo", boom)
    monkeypatch.setattr("asyncio.base_events.BaseEventLoop.getaddrinfo", boom)


def test_whitelist_hit_short_circuits_without_dns(trusted_whitelist, no_dns):
    # 同步 + 异步都必须短路放行，且完全不触发 getaddrinfo
    _assert_safe_endpoint(f"{WHITELIST}/chat-messages", allow_trusted_internal=True)

    async def check():
        await _assert_safe_endpoint_async(
            f"{WHITELIST}/chat-messages", allow_trusted_internal=True
        )

    asyncio.run(check())


def test_whitelist_hit_requires_explicit_flag(trusted_whitelist):
    # 白名单已配置，但调用方没传 allow_trusted_internal → 仍按原规则拒绝（内网）
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint(f"{WHITELIST}/chat-messages")


def test_whitelist_empty_keeps_rejecting_internal(monkeypatch):
    monkeypatch.setattr(settings, "AGENT_TRUSTED_INTERNAL_ENDPOINTS", "")
    reset_trusted_endpoint_cache()
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint(f"{WHITELIST}/chat-messages", allow_trusted_internal=True)


def test_whitelist_same_host_different_port_rejected():
    entries = parse_trusted_endpoints(WHITELIST)
    assert matches_trusted_endpoint("http://docker-api-1:5001/v1/chat", entries) is True
    for url in (
        "http://docker-api-1:5002/v1/chat",
        "http://docker-api-1/v1/chat",  # 未写端口 = 80，不等于 5001
        "https://docker-api-1:5001/v1/chat",  # scheme 不符
    ):
        assert matches_trusted_endpoint(url, entries) is False, url


def test_whitelist_path_prefix_boundary():
    entries = parse_trusted_endpoints(WHITELIST)
    # 边界内放行
    assert matches_trusted_endpoint("http://docker-api-1:5001/v1", entries) is True
    assert matches_trusted_endpoint("http://docker-api-1:5001/v1/", entries) is True
    assert matches_trusted_endpoint("http://docker-api-1:5001/v1/chat-messages", entries) is True
    # 非 / 边界、点段逃逸、编码点段全部不算命中
    for url in (
        "http://docker-api-1:5001/v1x/chat",
        "http://docker-api-1:5001/v10/chat",
        "http://docker-api-1:5001/v1-admin",
        "http://docker-api-1:5001/v1/../../admin",
        "http://docker-api-1:5001/v1/%2e%2e/admin",
        "http://docker-api-1:5001/",
    ):
        assert matches_trusted_endpoint(url, entries) is False, url


def test_whitelist_rejects_lookalike_hosts():
    entries = parse_trusted_endpoints(WHITELIST)
    for url in (
        "http://evil-docker-api-1:5001/v1/chat",
        "http://docker-api-1.evil:5001/v1/chat",
        "http://xdocker-api-1:5001/v1/chat",
    ):
        assert matches_trusted_endpoint(url, entries) is False, url
    # host 大小写不敏感：大写写法应当命中
    assert matches_trusted_endpoint("http://DOCKER-API-1:5001/v1/chat", entries) is True


def test_whitelist_unlisted_private_ip_still_rejected(trusted_whitelist):
    # 回归保护（最重要）：白名单只放行被点名的四元组，其他内网目标继续全拒
    entries = parse_trusted_endpoints(WHITELIST)
    assert matches_trusted_endpoint("http://172.18.0.2:5001/v1", entries) is False
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint("http://172.18.0.2:5001/v1", allow_trusted_internal=True)


def test_whitelist_metadata_endpoint_still_rejected(trusted_whitelist):
    entries = parse_trusted_endpoints(WHITELIST)
    assert matches_trusted_endpoint("http://169.254.169.254/latest/meta-data", entries) is False
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint(
            "http://169.254.169.254/latest/meta-data", allow_trusted_internal=True
        )

    async def check():
        with pytest.raises(EndpointNotAllowedError):
            await _assert_safe_endpoint_async(
                "http://169.254.169.254/latest/meta-data", allow_trusted_internal=True
            )

    asyncio.run(check())


def test_whitelist_mapped_ipv6_internal_still_rejected(trusted_whitelist):
    with pytest.raises(EndpointNotAllowedError):
        _assert_safe_endpoint(
            "http://[::ffff:172.18.0.2]:5001/v1", allow_trusted_internal=True
        )


@pytest.mark.parametrize(
    "bad_entry",
    [
        "http://*.example.com:5001/v1",              # 通配
        "http://docker-api-1:5001/*",                # 通配路径
        "http://10.0.0.0/8",                         # CIDR 且无端口
        "http://docker-api-1/v1",                    # 漏写端口
        "http://user:pw@docker-api-1:5001/v1",       # userinfo
        "http://docker-api-1:5001/v1?x=1",           # query
        "http://docker-api-1:5001/v1#frag",          # fragment
        "ftp://docker-api-1:5001/v1",                # scheme 非法
        "docker-api-1:5001/v1",                      # 无 scheme
        "http://docker-api-1:99999/v1",              # 端口越界
    ],
)
def test_whitelist_parse_fail_fast(bad_entry):
    with pytest.raises(ValueError):
        parse_trusted_endpoints(bad_entry)


def test_whitelist_parse_multiple_and_empty():
    assert parse_trusted_endpoints("") == ()
    assert parse_trusted_endpoints("   ") == ()
    entries = parse_trusted_endpoints(
        "http://docker-api-1:5001/v1 , https://internal.local:8443/api/, "
        "http://docker-api-1:5001/v1 "
    )
    assert len(entries) == 2  # 去重
    assert entries[1].describe() == "https://internal.local:8443/api"  # 尾斜杠归一


def test_whitelist_config_fail_fast_on_use(monkeypatch):
    # 部署配置写错时，第一次使用即抛 ValueError（不会带病放行）
    monkeypatch.setattr(
        settings, "AGENT_TRUSTED_INTERNAL_ENDPOINTS", "http://docker-api-1/v1"
    )
    reset_trusted_endpoint_cache()
    try:
        with pytest.raises(ValueError):
            _assert_safe_endpoint(
                "http://docker-api-1:5001/v1", allow_trusted_internal=True
            )
    finally:
        reset_trusted_endpoint_cache()


def test_settings_fail_fast_at_startup_on_invalid_whitelist():
    # 真正意义上的启动期校验：Settings 构造即失败，服务不会带着错误白名单起来
    from pydantic import ValidationError

    from app.core.config import Settings

    for bad in ("http://docker-api-1/v1", "http://*.x:5001/v1", "http://10.0.0.0/8"):
        with pytest.raises(ValidationError):
            Settings(AGENT_TRUSTED_INTERNAL_ENDPOINTS=bad)
    # 合法值可正常构造
    assert Settings(
        AGENT_TRUSTED_INTERNAL_ENDPOINTS="http://docker-api-1:5001/v1"
    ).AGENT_TRUSTED_INTERNAL_ENDPOINTS == "http://docker-api-1:5001/v1"
    # 空值 = 不启用
    assert Settings(AGENT_TRUSTED_INTERNAL_ENDPOINTS="").AGENT_TRUSTED_INTERNAL_ENDPOINTS == ""


# ---------- 评分链路接入 ----------

def test_safe_model_url_allows_whitelisted_internal(trusted_whitelist, no_dns):
    from app.services import ai_partner_evaluation as evaluation

    provider = SimpleNamespace(chat_url=lambda: "http://docker-api-1:5001/v1/chat-messages")
    assert asyncio.run(evaluation._safe_model_url(provider)) == (
        "http://docker-api-1:5001/v1/chat-messages"
    )


def test_safe_model_url_rejects_unlisted_internal(trusted_whitelist):
    from app.services import ai_partner_evaluation as evaluation

    provider = SimpleNamespace(chat_url=lambda: "http://172.18.0.2:5001/v1/chat-messages")
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(evaluation._safe_model_url(provider))
    assert excinfo.value.status_code == 503


def test_model_response_maps_redirect_to_502(monkeypatch):
    import httpx as httpx_mod
    from app.services import ai_partner_evaluation as evaluation

    def handler(request):
        return httpx_mod.Response(307, headers={"location": "http://new-host/v1/chat-messages"})

    transport = httpx_mod.MockTransport(handler)
    original = httpx_mod.AsyncClient
    # 只替换传输层，保留 follow_redirects=False 的客户端语义
    monkeypatch.setattr(
        evaluation.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=transport, **kwargs),
    )

    async def check():
        provider = SimpleNamespace(build_headers=lambda: {})
        with pytest.raises(HTTPException) as excinfo:
            await evaluation._model_response(
                provider, "http://8.8.8.8/v1/chat-messages", {}
            )
        return excinfo.value

    exc = asyncio.run(check())
    assert exc.status_code == 502
    assert "重定向" in exc.detail
