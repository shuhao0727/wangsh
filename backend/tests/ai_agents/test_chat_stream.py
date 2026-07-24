import asyncio
from types import SimpleNamespace

import httpx

import app.services.agents.chat_stream as chat_stream
from app.core.config import settings
from app.services.agents.providers.anthropic_provider import AnthropicProvider
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.openai_provider import OpenAIProvider
from app.services.agents.providers.registry import get_provider


class _FakeProvider:
    is_openrouter = False

    def build_headers(self):
        return {}

    def chat_url(self):
        return "https://api.openai.com/v1/chat/completions"

    def build_stream_payload(self, messages, model):
        return {"model": model, "messages": messages, "stream": True}

    def is_stream_done(self, line: str) -> bool:
        return line.strip() == "data: [DONE]"

    def parse_stream_line(self, line: str):
        return None


class _FakeResponse:
    status_code = 200

    async def aiter_lines(self):
        yield "data: [DONE]"

    async def aread(self):
        return b""


class _FakeStreamContext:
    def __init__(self, response):
        self.response = response

    async def __aenter__(self):
        return self.response

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeClient:
    def stream(self, method, url, headers=None, json=None):
        return _FakeStreamContext(_FakeResponse())


class _SlowTextProvider(_FakeProvider):
    def parse_stream_line(self, line: str):
        if line == "data: first":
            return "第一段"
        if line == "data: second":
            return "第二段"
        return None


class _SlowProgressResponse:
    status_code = 200

    async def aiter_lines(self):
        yield "data: first"
        await asyncio.sleep(0.03)
        yield "data: second"
        yield "data: [DONE]"

    async def aread(self):
        return b""


class _SlowProgressClient:
    def stream(self, method, url, headers=None, json=None):
        return _FakeStreamContext(_SlowProgressResponse())


class _IncompleteResponse:
    status_code = 200

    async def aiter_lines(self):
        yield "data: first"

    async def aread(self):
        return b""


class _ReadTimeoutResponse:
    status_code = 200

    async def aiter_lines(self):
        yield "data: first"
        raise httpx.ReadTimeout("idle")

    async def aread(self):
        return b""


class _FinishReasonResponse:
    status_code = 200

    async def aiter_lines(self):
        yield 'data: {"choices":[{"delta":{"content":"完成"},"finish_reason":"stop"}]}'

    async def aread(self):
        return b""


class _LengthFinishResponse:
    status_code = 200

    async def aiter_lines(self):
        yield 'data: {"choices":[{"delta":{"content":"未完内容"},"finish_reason":"length"}]}'

    async def aread(self):
        return b""


class _ContentFilterResponse:
    status_code = 200

    async def aiter_lines(self):
        yield 'data: {"choices":[{"delta":{"content":"部分内容"},"finish_reason":"content_filter"}]}'

    async def aread(self):
        return b""


class _AnthropicLengthFinishResponse:
    status_code = 200

    async def aiter_lines(self):
        yield 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"未完内容"}}'
        yield 'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}'
        yield 'data: {"type":"message_stop"}'

    async def aread(self):
        return b""


class _AnthropicContextLimitResponse:
    status_code = 200

    async def aiter_lines(self):
        yield 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"部分内容"}}'
        yield 'data: {"type":"message_delta","delta":{"stop_reason":"model_context_window_exceeded"}}'
        yield 'data: {"type":"message_stop"}'

    async def aread(self):
        return b""


class _DifyIncompleteResponse:
    status_code = 200

    async def aiter_bytes(self):
        yield 'event: message\ndata: {"answer":"未完成"}\n\n'.encode("utf-8")


class _SingleResponseClient:
    def __init__(self, response):
        self.response = response

    def stream(self, method, url, headers=None, json=None):
        return _FakeStreamContext(self.response)


def _configure_chat(monkeypatch, provider, response):
    async def fake_get_agent(_db, _agent_id):
        return SimpleNamespace(
            agent_type="openai",
            model_name="gpt-4o-mini",
            system_prompt="",
        )

    monkeypatch.setattr(chat_stream, "get_agent", fake_get_agent)
    monkeypatch.setattr(chat_stream, "resolve_credentials", lambda _agent: ("https://api.openai.com/v1", "sk-test"))
    monkeypatch.setattr(chat_stream, "get_provider", lambda *_args, **_kwargs: provider)
    monkeypatch.setattr(
        chat_stream,
        "build_messages",
        lambda _agent, message, _history: [{"role": "user", "content": message}],
    )
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: _SingleResponseClient(response))
    monkeypatch.setattr(chat_stream.breaker, "is_open", lambda _provider_name: False)
    monkeypatch.setattr(chat_stream.breaker, "record_success", lambda _provider_name: None)
    monkeypatch.setattr(chat_stream.breaker, "record_failure", lambda _provider_name: None)


async def _collect_chat_events():
    chunks = []
    async for chunk in chat_stream.stream_agent_chat(
        db=object(),
        agent_id=1,
        message="请生成较长回答",
        user="tester",
        inputs={},
    ):
        chunks.append(chunk.decode("utf-8"))
    return "".join(chunks)


def test_stream_chat_emits_message_end_even_when_upstream_has_no_text(monkeypatch):
    async def fake_get_agent(_db, _agent_id):
        return SimpleNamespace(
            agent_type="openai",
            model_name="gpt-4o-mini",
            system_prompt="",
        )

    monkeypatch.setattr(chat_stream, "get_agent", fake_get_agent)
    monkeypatch.setattr(chat_stream, "resolve_credentials", lambda _agent: ("https://api.openai.com/v1", "sk-test"))
    monkeypatch.setattr(chat_stream, "get_provider", lambda *_args, **_kwargs: _FakeProvider())
    monkeypatch.setattr(
        chat_stream,
        "build_messages",
        lambda _agent, message, _history: [{"role": "user", "content": message}],
    )
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: _FakeClient())

    calls = {"success": [], "failure": []}
    monkeypatch.setattr(chat_stream.breaker, "is_open", lambda _provider_name: False)
    monkeypatch.setattr(chat_stream.breaker, "record_success", lambda provider_name: calls["success"].append(provider_name))
    monkeypatch.setattr(chat_stream.breaker, "record_failure", lambda provider_name: calls["failure"].append(provider_name))

    async def collect_events():
        chunks = []
        async for chunk in chat_stream.stream_agent_chat(
            db=object(),
            agent_id=1,
            message="你好",
            user="tester",
            inputs={},
        ):
            chunks.append(chunk.decode("utf-8"))
        return "".join(chunks)

    output = asyncio.run(collect_events())

    assert "event: message_end" in output
    assert "\"answer\": \"\"" in output
    assert "event: error" not in output
    assert calls["success"] == ["_FakeProvider:agent:1"]
    assert calls["failure"] == []


def test_stream_chat_does_not_cut_off_a_long_stream_that_keeps_progressing(monkeypatch):
    async def fake_get_agent(_db, _agent_id):
        return SimpleNamespace(
            agent_type="openai",
            model_name="gpt-4o-mini",
            system_prompt="",
        )

    monkeypatch.setattr(chat_stream, "get_agent", fake_get_agent)
    monkeypatch.setattr(chat_stream, "resolve_credentials", lambda _agent: ("https://api.openai.com/v1", "sk-test"))
    monkeypatch.setattr(chat_stream, "get_provider", lambda *_args, **_kwargs: _SlowTextProvider())
    monkeypatch.setattr(
        chat_stream,
        "build_messages",
        lambda _agent, message, _history: [{"role": "user", "content": message}],
    )
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: _SlowProgressClient())
    monkeypatch.setattr(chat_stream.breaker, "is_open", lambda _provider_name: False)
    monkeypatch.setattr(chat_stream.breaker, "record_success", lambda _provider_name: None)
    monkeypatch.setattr(chat_stream.breaker, "record_failure", lambda _provider_name: None)

    async def collect_events():
        chunks = []
        async for chunk in chat_stream.stream_agent_chat(
            db=object(),
            agent_id=1,
            message="请生成较长回答",
            user="tester",
            inputs={},
        ):
            chunks.append(chunk.decode("utf-8"))
        return "".join(chunks)

    output = asyncio.run(collect_events())

    assert "\"answer\": \"第一段\"" in output
    assert "\"answer\": \"第二段\"" in output
    assert "\"answer\": \"第一段第二段\"" in output
    assert "event: message_end" in output
    assert "event: error" not in output


def test_stream_chat_reports_incomplete_eof_instead_of_marking_success(monkeypatch):
    _configure_chat(monkeypatch, _SlowTextProvider(), _IncompleteResponse())

    output = asyncio.run(_collect_chat_events())

    assert "\"answer\": \"第一段\"" in output
    assert "\"error\": \"stream_incomplete\"" in output
    assert "event: message_end" not in output


def test_stream_chat_reports_idle_timeout_after_partial_output(monkeypatch):
    _configure_chat(monkeypatch, _SlowTextProvider(), _ReadTimeoutResponse())

    output = asyncio.run(_collect_chat_events())

    assert "\"answer\": \"第一段\"" in output
    assert "\"error\": \"stream_timeout\"" in output
    assert "event: message_end" not in output


def test_openai_finish_reason_completes_stream_without_done_sentinel(monkeypatch):
    provider = OpenAIProvider("https://api.openai.com/v1", "sk-test")
    _configure_chat(monkeypatch, provider, _FinishReasonResponse())

    output = asyncio.run(_collect_chat_events())

    assert "\"answer\": \"完成\"" in output
    assert "event: message_end" in output
    assert "event: error" not in output


def test_openai_length_finish_reason_reports_output_limit_with_partial_text(monkeypatch):
    provider = OpenAIProvider("https://api.openai.com/v1", "sk-test")
    _configure_chat(monkeypatch, provider, _LengthFinishResponse())

    output = asyncio.run(_collect_chat_events())

    assert "\"answer\": \"未完内容\"" in output
    assert "\"error\": \"output_limit_reached\"" in output
    assert "\"finish_reason\": \"length\"" in output
    assert "event: message_end" not in output


def test_openai_content_filter_is_not_reported_as_success(monkeypatch):
    provider = OpenAIProvider("https://api.openai.com/v1", "sk-test")
    _configure_chat(monkeypatch, provider, _ContentFilterResponse())

    output = asyncio.run(_collect_chat_events())

    assert "\"answer\": \"部分内容\"" in output
    assert "\"error\": \"provider_rejected_output\"" in output
    assert "\"finish_reason\": \"content_filter\"" in output
    assert "event: message_end" not in output


def test_anthropic_length_stop_reason_reports_output_limit_with_partial_text(monkeypatch):
    provider = AnthropicProvider("https://api.deepseek.com/anthropic", "sk-test")
    _configure_chat(monkeypatch, provider, _AnthropicLengthFinishResponse())

    output = asyncio.run(_collect_chat_events())

    assert "\"answer\": \"未完内容\"" in output
    assert "\"error\": \"output_limit_reached\"" in output
    assert "\"finish_reason\": \"max_tokens\"" in output
    assert "event: message_end" not in output


def test_anthropic_context_limit_is_not_reported_as_success(monkeypatch):
    provider = AnthropicProvider("https://api.deepseek.com/anthropic", "sk-test")
    _configure_chat(monkeypatch, provider, _AnthropicContextLimitResponse())

    output = asyncio.run(_collect_chat_events())

    assert "\"answer\": \"部分内容\"" in output
    assert "\"error\": \"context_limit_reached\"" in output
    assert "\"finish_reason\": \"model_context_window_exceeded\"" in output
    assert "event: message_end" not in output


def test_deepseek_anthropic_endpoint_uses_anthropic_provider():
    provider = get_provider(
        "deepseek",
        "https://api.deepseek.com/anthropic",
        "sk-test",
    )

    assert isinstance(provider, AnthropicProvider)
    assert provider.chat_url() == "https://api.deepseek.com/anthropic/v1/messages"


def test_stream_chat_converts_agent_lookup_failure_to_sse_error(monkeypatch):
    async def fail_get_agent(_db, _agent_id):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(chat_stream, "get_agent", fail_get_agent)

    output = asyncio.run(_collect_chat_events())

    assert "\"error\": \"stream_failed\"" in output
    assert "读取智能体配置失败" in output


def test_stream_chat_converts_setup_failure_to_sse_error(monkeypatch):
    async def fake_get_agent(_db, _agent_id):
        return SimpleNamespace(
            is_active=True,
            agent_type="openai",
            model_name="gpt-4o-mini",
            system_prompt="",
        )

    def fail_resolve_credentials(_agent):
        raise RuntimeError("broken provider setup")

    monkeypatch.setattr(chat_stream, "get_agent", fake_get_agent)
    monkeypatch.setattr(chat_stream, "resolve_credentials", fail_resolve_credentials)

    output = asyncio.run(_collect_chat_events())

    assert "\"error\": \"stream_setup_failed\"" in output
    assert "event: error" in output


def test_dify_does_not_retry_after_partial_output(monkeypatch):
    first_chunk = b'event: message\ndata: {"answer":"A"}\n\n'

    class _PartialDifyResponse:
        status_code = 200

        async def aiter_bytes(self):
            yield first_chunk
            raise httpx.ReadTimeout("idle")

    class _UnexpectedSecondResponse:
        status_code = 200

        async def aiter_bytes(self):
            yield b'event: message\ndata: {"answer":"A+B"}\n\n'

    class _DifyClient:
        def __init__(self):
            self.calls = 0

        def stream(self, method, url, headers=None, json=None):
            self.calls += 1
            response = _PartialDifyResponse() if self.calls == 1 else _UnexpectedSecondResponse()
            return _FakeStreamContext(response)

    client = _DifyClient()
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: client)
    provider = DifyProvider("https://dify.example", "app-key")

    async def collect_events():
        chunks = []
        async for chunk in chat_stream._stream_dify(
            provider,
            [{"role": "user", "content": "你好"}],
            "",
            "tester",
            {},
        ):
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8")

    output = asyncio.run(collect_events())

    assert client.calls == 1
    assert output.count('"answer":"A"') == 1
    assert "\"error\": \"dify_stream_interrupted\"" in output
    assert "A+B" not in output


def test_stream_chat_rejects_inactive_agent_before_provider_call(monkeypatch):
    async def fake_get_agent(_db, _agent_id):
        return SimpleNamespace(
            is_active=False,
            agent_type="openai",
            model_name="gpt-4o-mini",
            system_prompt="",
        )

    provider_called = False

    def fail_get_provider(*_args, **_kwargs):
        nonlocal provider_called
        provider_called = True
        raise AssertionError("inactive agents must not call a provider")

    monkeypatch.setattr(chat_stream, "get_agent", fake_get_agent)
    monkeypatch.setattr(chat_stream, "get_provider", fail_get_provider)

    output = asyncio.run(_collect_chat_events())

    assert "\"error\": \"agent_inactive\"" in output
    assert provider_called is False


def test_dify_clean_eof_without_terminal_event_is_reported(monkeypatch):
    class _DifyClient:
        def stream(self, method, url, headers=None, json=None):
            return _FakeStreamContext(_DifyIncompleteResponse())

    monkeypatch.setattr(chat_stream, "get_http_client", lambda: _DifyClient())
    provider = DifyProvider("https://dify.example/v1", "app-key")

    calls = {"success": [], "failure": []}
    monkeypatch.setattr(chat_stream.breaker, "record_success", lambda key: calls["success"].append(key))
    monkeypatch.setattr(chat_stream.breaker, "record_failure", lambda key: calls["failure"].append(key))

    async def collect_events():
        chunks = []
        async for chunk in chat_stream._stream_dify(
            provider,
            [{"role": "user", "content": "你好"}],
            "",
            "tester",
            {},
            circuit_key="DifyProvider:agent:7",
        ):
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8")

    output = asyncio.run(collect_events())

    assert "\"error\": \"dify_stream_incomplete\"" in output
    assert calls["success"] == []
    assert calls["failure"] == ["DifyProvider:agent:7"]


def test_dify_terminal_event_split_across_chunks_completes(monkeypatch):
    class _DifyCompleteResponse:
        status_code = 200

        async def aiter_bytes(self):
            yield b'data: {"event":"message","answer":"A"}\n\n'
            yield b'data: {"event":"message_'
            yield b'end"}\n\n'

    class _DifyClient:
        def stream(self, method, url, headers=None, json=None):
            return _FakeStreamContext(_DifyCompleteResponse())

    monkeypatch.setattr(chat_stream, "get_http_client", lambda: _DifyClient())
    provider = DifyProvider("https://dify.example/v1", "app-key")

    calls = {"success": [], "failure": []}
    monkeypatch.setattr(chat_stream.breaker, "record_success", lambda key: calls["success"].append(key))
    monkeypatch.setattr(chat_stream.breaker, "record_failure", lambda key: calls["failure"].append(key))

    async def collect_events_with_breaker():
        chunks = []
        async for chunk in chat_stream._stream_dify(
            provider,
            [{"role": "user", "content": "你好"}],
            "",
            "tester",
            {},
            circuit_key="DifyProvider:agent:7",
        ):
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8")

    output = asyncio.run(collect_events_with_breaker())

    assert '"event":"message_end"' in output
    assert "event: error" not in output
    assert calls["success"] == ["DifyProvider:agent:7"]
    assert calls["failure"] == []


def test_dify_endpoint_with_chat_messages_path_is_not_duplicated():
    provider = DifyProvider("https://dify.example/v1/chat-messages", "app-key")

    assert provider.candidate_urls() == ["https://dify.example/v1/chat-messages"]


def test_anthropic_payload_uses_configured_output_limit(monkeypatch):
    monkeypatch.setattr(settings, "AI_AGENT_MAX_OUTPUT_TOKENS", 8192, raising=False)
    provider = AnthropicProvider("https://api.deepseek.com/anthropic", "sk-test")

    payload = provider.build_stream_payload(
        [{"role": "user", "content": "请继续"}],
        "deepseek-v4-flash",
    )

    assert payload["max_tokens"] == 8192
