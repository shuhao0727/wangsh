import asyncio
from types import SimpleNamespace

from fastapi import HTTPException

import app.api.pythonlab.flow as flow_api


class FakeDbResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeFeatureDb:
    def __init__(self, config_value=None):
        self.config_entry = None if config_value is None else SimpleNamespace(value=config_value)

    async def execute(self, _query):
        return FakeDbResult(self.config_entry)


def test_ai_chat_rejects_non_list_messages():
    try:
        asyncio.run(flow_api.ai_chat({"messages": "hello"}, current_user={"id": 1}, db=FakeFeatureDb()))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "messages must be a list" in str(exc.detail)


def test_ai_chat_uses_db_config_and_returns_message(monkeypatch):
    async def fake_chat_completion(messages, api_url=None, api_key=None, model=None):
        assert messages == [{"role": "user", "content": "hi"}]
        assert api_url == "https://agent.example.com"
        assert api_key == "secret-key"
        assert model == "gpt-test"
        return {"success": True, "message": "pong"}

    monkeypatch.setattr(flow_api.code_generator_client, "chat_completion", fake_chat_completion)
    db = FakeFeatureDb(
        {
            "api_url": "https://agent.example.com",
            "api_key": "secret-key",
            "model": "gpt-test",
        }
    )

    result = asyncio.run(
        flow_api.ai_chat({"messages": [{"role": "user", "content": "hi"}]}, current_user={"id": 1}, db=db)
    )

    assert result == {"message": "pong"}


def test_generate_code_from_flow_rejects_non_object_flow():
    try:
        asyncio.run(flow_api.generate_code_from_flow({"flow": []}, current_user={"id": 1}, db=FakeFeatureDb()))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "flow 必须为 JSON 对象" in str(exc.detail)


def test_generate_code_from_flow_passes_prompt_template_and_returns_code(monkeypatch, tmp_path):
    prompt_path = tmp_path / "flowchart_to_python.txt"
    prompt_path.write_text("flow prompt body", encoding="utf-8")

    async def fake_generate_code(flow_json, api_url=None, api_key=None, prompt_template=None, model=None):
        assert flow_json == {"nodes": [{"id": "n1"}], "edges": []}
        assert api_url == "https://agent.example.com"
        assert api_key == "secret-key"
        assert prompt_template == "flow prompt body"
        assert model == "gpt-test"
        return {"success": True, "python_code": "print('generated')\n"}

    monkeypatch.setattr(flow_api, "PROMPT_TEMPLATE_PATH", prompt_path)
    monkeypatch.setattr(flow_api.code_generator_client, "generate_code", fake_generate_code)
    db = FakeFeatureDb(
        {
            "api_url": "https://agent.example.com",
            "api_key": "secret-key",
            "model": "gpt-test",
        }
    )

    result = asyncio.run(
        flow_api.generate_code_from_flow(
            {"flow": {"nodes": [{"id": "n1"}], "edges": []}},
            current_user={"id": 1},
            db=db,
        )
    )

    assert result == {"code": "print('generated')\n"}


def test_test_agent_connection_maps_success_response(monkeypatch):
    async def fake_chat_completion(messages, api_url=None, api_key=None, model=None):
        assert messages == [{"role": "user", "content": "Hello, are you online?"}]
        assert api_url == "https://agent.example.com"
        assert api_key == "secret-key"
        assert model == "gpt-test"
        return {"success": True, "message": "online"}

    monkeypatch.setattr(flow_api.code_generator_client, "chat_completion", fake_chat_completion)

    result = asyncio.run(
        flow_api.test_agent_connection(
            {"api_url": "https://agent.example.com", "api_key": "secret-key", "model": "gpt-test"}
        )
    )

    assert result["success"] is True
    assert "Connection Successful" in result["python_code"]
    assert "online" in result["python_code"]


def test_test_agent_connection_maps_failure_response(monkeypatch):
    async def fake_chat_completion(messages, api_url=None, api_key=None, model=None):
        return {"success": False, "error": "unauthorized", "message": ""}

    monkeypatch.setattr(flow_api.code_generator_client, "chat_completion", fake_chat_completion)

    result = asyncio.run(
        flow_api.test_agent_connection(
            {"api_url": "https://agent.example.com", "api_key": "bad-key", "model": "gpt-test"}
        )
    )

    assert result == {"success": False, "error": "unauthorized", "python_code": ""}
