"""A-1：测试连接校验的是实际要请求的完整地址，而不是拼接前的相对路径。

全部出站走 httpx.MockTransport，DNS 固定为替身结果；不向任何真实地址发请求。
"""

import ipaddress
from types import SimpleNamespace

import httpx
import pytest

import app.services.agents.ai_agent as ai_agent
from app.core.config import settings
from app.schemas.agents import AgentTestRequest
from app.services.agents import endpoint_security

PUBLIC_IP = ipaddress.ip_address("93.184.216.34")  # DNS 替身结果：一个公网地址，不会真的被连接


@pytest.fixture
def checked_urls(monkeypatch):
    """固定 DNS、清空白名单，并记录交给出站硬校验的每个地址（仍执行真实校验）。"""

    async def fake_resolve(host):
        try:
            return [ipaddress.ip_address(host)]
        except ValueError:
            return [PUBLIC_IP]

    monkeypatch.setattr(settings, "AGENT_TRUSTED_INTERNAL_ENDPOINTS", "")
    endpoint_security.reset_trusted_endpoint_cache()
    monkeypatch.setattr(endpoint_security, "_resolve_host_addresses_async", fake_resolve)

    real_assert = endpoint_security.assert_agent_outbound_endpoint
    urls = []

    async def recording_assert(url):
        urls.append(url)
        await real_assert(url)

    monkeypatch.setattr(endpoint_security, "assert_agent_outbound_endpoint", recording_assert)
    yield urls
    endpoint_security.reset_trusted_endpoint_cache()


def _install_transport(monkeypatch, handler):
    """所有 httpx.AsyncClient 改走 MockTransport，保留调用方传入的 follow_redirects 等参数。"""
    real_client = httpx.AsyncClient
    requests = []

    def recording(request):
        requests.append(request)
        return handler(request)

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(recording), **kwargs),
    )
    return requests


def _install_agent(monkeypatch, *, api_endpoint, agent_type="general", model_name="synthetic-model"):
    agent = SimpleNamespace(
        id=1,
        name="合成智能体",
        agent_type=agent_type,
        api_endpoint=api_endpoint,
        api_key_encrypted=None,
        api_key="synthetic-key",
        model_name=model_name,
        is_active=True,
    )

    async def fake_get_agent(_db, _agent_id, use_cache=True):
        return agent

    monkeypatch.setattr(ai_agent, "get_agent", fake_get_agent)
    return agent


def _request():
    return AgentTestRequest(agent_id=1, test_message="你好")


@pytest.mark.parametrize(
    ("api_endpoint", "models_url"),
    [
        ("https://relay.example.test/v1", "https://relay.example.test/v1/models"),
        ("https://openrouter.ai.example.test/api/v1", "https://openrouter.ai.example.test/api/v1/models"),
        ("https://ark.cn-beijing.volces.com.example.test/api/v3", "https://ark.cn-beijing.volces.com.example.test/api/v3/models"),
    ],
    ids=["general", "openrouter", "volcengine"],
)
async def test_general_agent_validates_full_models_url_and_succeeds(
    monkeypatch, checked_urls, api_endpoint, models_url
):
    def handler(request):
        if request.method == "GET":
            return httpx.Response(200, json={"data": [{"id": "m1"}, {"id": "m2"}]})
        return httpx.Response(200, json={"choices": []})

    requests = _install_transport(monkeypatch, handler)
    _install_agent(monkeypatch, api_endpoint=api_endpoint)

    result = await ai_agent.test_agent(object(), _request())

    assert result.success is True, result.message
    assert "发现模型: 2 个" in result.message
    assert checked_urls == [models_url]
    assert not any(url.startswith("/") for url in checked_urls)
    assert str(requests[0].url) == models_url


async def test_dify_agent_validates_api_endpoint(monkeypatch, checked_urls):
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=b"data: {}\n\n")

    requests = _install_transport(monkeypatch, handler)
    _install_agent(monkeypatch, api_endpoint="https://dify.example.test/v1", agent_type="dify")

    result = await ai_agent.test_agent(object(), _request())

    assert result.success is True, result.message
    assert checked_urls == ["https://dify.example.test/v1"]
    assert [str(r.url) for r in requests] == ["https://dify.example.test/v1/chat-messages"]


@pytest.mark.parametrize("api_endpoint", ["http://10.0.0.5/v1", "http://169.254.169.254/v1"])
async def test_private_endpoint_is_still_rejected_without_request(monkeypatch, checked_urls, api_endpoint):
    def handler(request):
        raise AssertionError(f"被拒绝的端点不得出站: {request.url}")

    requests = _install_transport(monkeypatch, handler)
    _install_agent(monkeypatch, api_endpoint=api_endpoint)

    result = await ai_agent.test_agent(object(), _request())

    assert result.success is False
    assert "禁止访问内网/环回/保留地址端点" in result.message
    assert checked_urls == [f"{api_endpoint}/models"]
    assert requests == []
