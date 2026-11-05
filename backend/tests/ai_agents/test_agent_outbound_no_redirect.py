"""A-2：智能体出站不跟随重定向，3xx 按失败处理且不回显响应体。

上游首个请求返回 302 指向云元数据地址；断言没有第二个请求、结果为失败、文案不含响应体。
全部出站走 httpx.MockTransport，DNS 固定为替身结果；不向任何真实地址发请求。
"""

import ipaddress
from types import SimpleNamespace

import httpx
import pytest

import app.services.agents.ai_agent as ai_agent
import app.services.agents.chat_blocking as chat_blocking
import app.services.agents.chat_stream as chat_stream
from app.core.config import settings
from app.schemas.agents import AgentTestRequest
from app.services.agents import chat_common, endpoint_security
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.openai_provider import OpenAIProvider

METADATA_URL = "http://169.254.169.254/latest/meta-data/"
SECRET_BODY = "SECRET-REDIRECT-BODY"
PUBLIC_IP = ipaddress.ip_address("93.184.216.34")  # DNS 替身结果：一个公网地址，不会真的被连接


@pytest.fixture(autouse=True)
def fake_dns(monkeypatch):
    async def fake_resolve(host):
        try:
            return [ipaddress.ip_address(host)]
        except ValueError:
            return [PUBLIC_IP]

    monkeypatch.setattr(settings, "AGENT_TRUSTED_INTERNAL_ENDPOINTS", "")
    endpoint_security.reset_trusted_endpoint_cache()
    monkeypatch.setattr(endpoint_security, "_resolve_host_addresses_async", fake_resolve)
    yield
    endpoint_security.reset_trusted_endpoint_cache()


def _redirect_transport():
    """首个请求一律 302 到元数据地址；若被跟随，元数据请求会被记录并返回可识别的"内网"内容。"""
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.host == "169.254.169.254":
            return httpx.Response(200, text="INTERNAL-METADATA")
        return httpx.Response(302, headers={"location": METADATA_URL}, text=SECRET_BODY)

    return httpx.MockTransport(handler), requests


def _patch_async_client(monkeypatch, transport):
    """自建 AsyncClient 的路径：只替换传输层，保留调用方传入的 follow_redirects 等参数。"""
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kwargs: real_client(transport=transport, **kwargs)
    )


def _shared_client(transport):
    """模拟 core/http_client 的共享客户端：默认跟随重定向，验证调用处按请求关闭。"""
    return httpx.AsyncClient(transport=transport, follow_redirects=True)


def _assert_single_request(requests):
    assert len(requests) == 1, [str(r.url) for r in requests]
    assert all(r.url.host != "169.254.169.254" for r in requests)


class _FakeLease:
    def __init__(self, *_args, **_kwargs):
        self.held = False

    async def acquire(self):
        self.held = True

    def is_held(self):
        return self.held

    async def release(self):
        self.held = False

    async def wait_lost(self):
        return False


async def _collect(stream):
    return b"".join([chunk async for chunk in stream]).decode("utf-8")


async def test_stream_chat_does_not_follow_redirect(monkeypatch):
    transport, requests = _redirect_transport()
    client = _shared_client(transport)
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: client)
    prepared = chat_stream.PreparedAgentStream(
        provider=OpenAIProvider("https://relay.example.test/v1", "synthetic-key"),
        circuit_key="no-redirect:stream",
        chat_messages=[{"role": "user", "content": "hi"}],
        model="synthetic-model",
    )

    output = await _collect(chat_stream.stream_agent_chat(None, 1, "hi", prepared=prepared))
    await client.aclose()

    _assert_single_request(requests)
    assert "event: error" in output
    assert "provider_status_302" in output
    assert "已拒绝跟随" in output
    assert SECRET_BODY not in output and "INTERNAL-METADATA" not in output


async def test_dify_stream_does_not_follow_redirect(monkeypatch):
    transport, requests = _redirect_transport()
    client = _shared_client(transport)
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: client)
    monkeypatch.setattr(chat_stream, "DifyConcurrencyLease", _FakeLease)
    prepared = chat_stream.PreparedAgentStream(
        provider=DifyProvider("https://dify.example.test/v1", "synthetic-key"),
        circuit_key="no-redirect:dify-stream",
        chat_messages=[{"role": "user", "content": "hi"}],
        model="",
    )

    output = await _collect(chat_stream.stream_agent_chat(None, 1, "hi", prepared=prepared))
    await client.aclose()

    _assert_single_request(requests)
    assert "event: error" in output
    assert "HTTP 302" in output and "已拒绝跟随" in output
    assert SECRET_BODY not in output and "INTERNAL-METADATA" not in output


def _blocking_context(monkeypatch, provider, circuit_key):
    async def context(*_args, **_kwargs):
        return chat_common.PreparedChatContext(
            agent=SimpleNamespace(id=1),
            provider=provider,
            circuit_key=circuit_key,
            chat_messages=[{"role": "user", "content": "hi"}],
            model="synthetic-model",
            api_endpoint=provider.api_endpoint,
            api_key="synthetic-key",
        )

    monkeypatch.setattr(chat_blocking, "prepare_chat_context", context)


async def test_blocking_chat_does_not_follow_redirect(monkeypatch):
    transport, requests = _redirect_transport()
    _patch_async_client(monkeypatch, transport)
    _blocking_context(
        monkeypatch,
        OpenAIProvider("https://relay.example.test/v1", "synthetic-key"),
        "no-redirect:blocking",
    )

    with pytest.raises(ValueError) as exc:
        await chat_blocking.run_agent_chat_blocking(object(), agent_id=1, message="hi")

    _assert_single_request(requests)
    message = str(exc.value)
    assert message.startswith("provider_status_302")
    assert "已拒绝跟随" in message
    assert SECRET_BODY not in message and "INTERNAL-METADATA" not in message


@pytest.mark.parametrize(
    ("api_endpoint", "expected_urls"),
    [
        ("https://dify.example.test/v1", ["https://dify.example.test/v1/chat-messages"]),
        # base 不带 /v1 时有两个候选：遇 3xx 换下一个候选（同主机、已校验），仍不跟随 Location
        (
            "https://dify.example.test",
            ["https://dify.example.test/v1/chat-messages", "https://dify.example.test/chat-messages"],
        ),
    ],
)
async def test_blocking_dify_does_not_follow_redirect(monkeypatch, api_endpoint, expected_urls):
    transport, requests = _redirect_transport()
    _patch_async_client(monkeypatch, transport)
    _blocking_context(
        monkeypatch,
        DifyProvider(api_endpoint, "synthetic-key"),
        "no-redirect:blocking-dify",
    )

    with pytest.raises(ValueError) as exc:
        await chat_blocking.run_agent_chat_blocking(object(), agent_id=1, message="hi")

    assert [str(r.url) for r in requests] == expected_urls
    message = str(exc.value)
    assert "status_302" in message and "已拒绝跟随" in message
    assert SECRET_BODY not in message and "INTERNAL-METADATA" not in message


def _install_agent(monkeypatch, *, api_endpoint, agent_type):
    agent = SimpleNamespace(
        id=1,
        name="合成智能体",
        agent_type=agent_type,
        api_endpoint=api_endpoint,
        api_key_encrypted=None,
        api_key="synthetic-key",
        model_name="synthetic-model",
        is_active=True,
    )

    async def fake_get_agent(_db, _agent_id, use_cache=True):
        return agent

    monkeypatch.setattr(ai_agent, "get_agent", fake_get_agent)


@pytest.mark.parametrize(
    ("agent_type", "api_endpoint"),
    [("general", "https://relay.example.test/v1"), ("dify", "https://dify.example.test/v1")],
)
async def test_agent_connection_test_does_not_follow_redirect(monkeypatch, agent_type, api_endpoint):
    transport, requests = _redirect_transport()
    _patch_async_client(monkeypatch, transport)
    _install_agent(monkeypatch, api_endpoint=api_endpoint, agent_type=agent_type)

    result = await ai_agent.test_agent(object(), AgentTestRequest(agent_id=1, test_message="你好"))

    _assert_single_request(requests)
    assert result.success is False
    assert "HTTP 302" in result.message and "已拒绝跟随" in result.message
    assert SECRET_BODY not in result.message and "INTERNAL-METADATA" not in result.message
