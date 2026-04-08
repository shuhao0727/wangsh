import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

import app.api.pythonlab.flow as flow_api


class FakeDbResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeOptimizeDb:
    def __init__(self, execute_value=None):
        self.added = []
        self.execute_value = execute_value
        self.commit_count = 0
        self.refresh_count = 0

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, value):
        self.refresh_count += 1
        if getattr(value, "id", None) is None:
            value.id = 101
        if not getattr(value, "rollback_id", None):
            value.rollback_id = str(uuid4())

    async def execute(self, _query):
        return FakeDbResult(self.execute_value)


def test_get_prompt_template_returns_empty_when_file_is_missing(monkeypatch, tmp_path):
    template_path = tmp_path / "flowchart_to_python.txt"
    monkeypatch.setattr(flow_api, "PROMPT_TEMPLATE_PATH", template_path)

    result = asyncio.run(flow_api.get_prompt_template(current_user={"id": 1}))

    assert result == {"content": ""}


def test_save_prompt_template_writes_file_and_get_reads_back(monkeypatch, tmp_path):
    template_path = tmp_path / "nested" / "flowchart_to_python.txt"
    monkeypatch.setattr(flow_api, "PROMPT_TEMPLATE_PATH", template_path)

    save_result = asyncio.run(
        flow_api.save_prompt_template({"content": "print('from template')\n"}, current_user={"id": 1})
    )
    get_result = asyncio.run(flow_api.get_prompt_template(current_user={"id": 1}))

    assert save_result == {"success": True}
    assert template_path.read_text(encoding="utf-8") == "print('from template')\n"
    assert get_result == {"content": "print('from template')\n"}


def test_optimize_code_rejects_when_agent_config_missing(monkeypatch):
    async def fake_get_agent_config(_db):
        return None, None, None

    monkeypatch.setattr(flow_api, "_get_agent_config", fake_get_agent_config)

    try:
        asyncio.run(flow_api.optimize_code({"code": "print('x')\n"}, current_user={"id": 1}, db=FakeOptimizeDb()))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 503
        assert "AI Agent not configured" in str(exc.detail)


def test_optimize_code_returns_normalized_code_and_log_info(monkeypatch, tmp_path):
    async def fake_get_agent_config(_db):
        return "https://agent.example.com", "secret-key", "gpt-test"

    async def fake_chat_completion(messages, api_url=None, api_key=None, model=None):
        assert api_url == "https://agent.example.com"
        assert api_key == "secret-key"
        assert model == "gpt-test"
        assert messages[1]["content"] == "x = 1\nprint(x)\n"
        return {"success": True, "message": "```python\nx = 1\nprint(x)\n```"}

    optimize_prompt_path = tmp_path / "optimize_code.txt"
    optimize_prompt_path.write_text("system optimize prompt", encoding="utf-8")
    monkeypatch.setattr(flow_api, "_get_agent_config", fake_get_agent_config)
    monkeypatch.setattr(flow_api.code_generator_client, "chat_completion", fake_chat_completion)
    monkeypatch.setattr(flow_api, "OPTIMIZE_CODE_TEMPLATE_PATH", optimize_prompt_path)

    db = FakeOptimizeDb()
    result = asyncio.run(
        flow_api.optimize_code({"code": "x = 1\nprint(x)\n"}, current_user={"id": 8}, db=db)
    )

    assert result["optimized_code"] == "x = 1\nprint(x)"
    assert result["log_id"] == 101
    assert result["rollback_id"]
    assert db.commit_count == 1
    assert db.refresh_count == 1
    assert len(db.added) == 1
    assert db.added[0].user_id == 8
    assert db.added[0].type == "code"
    assert db.added[0].status == "pending"


def test_apply_optimization_marks_log_as_applied():
    log_entry = SimpleNamespace(id=5, status="pending")
    db = FakeOptimizeDb(execute_value=log_entry)

    result = asyncio.run(flow_api.apply_optimization(5, current_user={"id": 2}, db=db))

    assert result == {"success": True}
    assert log_entry.status == "applied"
    assert db.commit_count == 1


def test_rollback_optimization_returns_json_for_flow_logs():
    log_entry = SimpleNamespace(
        id=9,
        type="flow",
        original_content=json.dumps({"nodes": [{"id": "n1"}], "edges": []}),
    )
    db = FakeOptimizeDb(execute_value=log_entry)

    result = asyncio.run(flow_api.rollback_optimization(9, current_user={"id": 2}, db=db))

    assert result == {"original_content": {"nodes": [{"id": "n1"}], "edges": []}, "type": "flow"}


def test_rollback_optimization_returns_404_when_log_missing():
    db = FakeOptimizeDb(execute_value=None)

    try:
        asyncio.run(flow_api.rollback_optimization(404, current_user={"id": 2}, db=db))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 404
        assert "Log not found" in str(exc.detail)
