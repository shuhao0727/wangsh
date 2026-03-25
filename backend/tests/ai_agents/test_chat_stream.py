import asyncio
from types import SimpleNamespace

import app.services.agents.chat_stream as chat_stream


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
    assert calls["success"] == ["_FakeProvider"]
    assert calls["failure"] == []
