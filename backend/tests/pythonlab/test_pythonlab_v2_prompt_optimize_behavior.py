import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from app.api.pythonlab.flow.exceptions import (
    AIAgentNotConfiguredError,
    SizeLimitError,
    ValidationError,
    NotFoundError,
)

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
    import app.api.pythonlab.flow.api as flow_api_module
    template_path = tmp_path / "flowchart_to_python.txt"
    monkeypatch.setattr(flow_api_module, "PROMPT_TEMPLATE_PATH", template_path)

    result = asyncio.run(flow_api.get_prompt_template(current_user={"id": 1}))

    assert result == {"content": ""}


def test_save_prompt_template_writes_file_and_get_reads_back(monkeypatch, tmp_path):
    import app.api.pythonlab.flow.api as flow_api_module
    template_path = tmp_path / "nested" / "flowchart_to_python.txt"
    monkeypatch.setattr(flow_api_module, "PROMPT_TEMPLATE_PATH", template_path)

    save_result = asyncio.run(
        flow_api.save_prompt_template({"content": "print('from template')\n"}, current_user={"id": 1})
    )
    get_result = asyncio.run(flow_api.get_prompt_template(current_user={"id": 1}))

    assert save_result == {"success": True}
    assert template_path.read_text(encoding="utf-8") == "print('from template')\n"
    assert get_result == {"content": "print('from template')\n"}


def test_save_prompt_template_rejects_large_content(monkeypatch, tmp_path):
    """测试 save_prompt_template 拒绝过大的内容"""
    import app.api.pythonlab.flow.api as flow_api_module
    template_path = tmp_path / "flowchart_to_python.txt"
    monkeypatch.setattr(flow_api_module, "PROMPT_TEMPLATE_PATH", template_path)

    # 创建超过 1MB 的内容
    large_content = "x" * (1024 * 1024 + 1)  # 1MB + 1 byte

    try:
        asyncio.run(flow_api.save_prompt_template(
            {"content": large_content},
            current_user={"id": 1, "is_admin": True}
        ))
        raise AssertionError("expected SizeLimitError")
    except SizeLimitError as exc:
        assert exc.status_code == 413
        assert "模板内容过大" in str(exc.detail)


def test_optimize_code_rejects_when_agent_config_missing(monkeypatch):
    async def fake_get_agent_config(_db):
        return None, None, None

    monkeypatch.setattr(flow_api, "_get_agent_config", fake_get_agent_config)

    try:
        asyncio.run(flow_api.optimize_code({"code": "print('x')\n"}, current_user={"id": 1}, db=FakeOptimizeDb()))
        raise AssertionError("expected AIAgentNotConfiguredError")
    except AIAgentNotConfiguredError as exc:
        assert exc.status_code == 502
        assert "AI Agent not configured" in str(exc.detail)


def test_optimize_code_returns_normalized_code_and_log_info(monkeypatch, tmp_path):
    import app.api.pythonlab.flow.ai_service as optimization_module
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
    monkeypatch.setattr(optimization_module, "_get_agent_config", fake_get_agent_config)
    monkeypatch.setattr(flow_api.code_generator_client, "chat_completion", fake_chat_completion)
    monkeypatch.setattr(optimization_module, "OPTIMIZE_CODE_TEMPLATE_PATH", optimize_prompt_path)

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
        raise AssertionError("expected NotFoundError")
    except NotFoundError as exc:
        assert exc.status_code == 404
        assert "Log not found" in str(exc.detail)


def test_ai_chat_validates_messages_parameter(monkeypatch):
    """测试 ai_chat 验证 messages 参数"""
    # 创建模拟的数据库返回配置
    class FakeFeatureFlag:
        def __init__(self):
            self.key = "ai_agent_config"
            self.value = {
                "api_url": "https://test.com",
                "api_key": "secret",
                "model": "gpt-4"
            }

    class FakeDbWithConfig:
        def __init__(self):
            self.execute_value = FakeFeatureFlag()
            self.commit_count = 0

        async def execute(self, query):
            return FakeDbResult(self.execute_value)

        async def commit(self):
            self.commit_count += 1

    # 模拟 chat_completion 返回成功
    async def fake_chat_completion(messages, api_url=None, api_key=None, model=None):
        return {"success": True, "message": "test response"}

    monkeypatch.setattr(flow_api.code_generator_client, "chat_completion", fake_chat_completion)

    # 测试有效的 messages 参数
    result = asyncio.run(flow_api.ai_chat(
        {"messages": [{"role": "user", "content": "Hello"}]},
        current_user={"id": 1, "is_admin": True},
        db=FakeDbWithConfig()
    ))
    # ai_chat_internal 返回 {"message": result["message"]}
    assert result == {"message": "test response"}

    # 测试无效的 messages 参数（不是列表）
    try:
        asyncio.run(flow_api.ai_chat(
            {"messages": "not a list"},
            current_user={"id": 1, "is_admin": True},
            db=FakeOptimizeDb()
        ))
        raise AssertionError("expected ValidationError")
    except ValidationError as exc:
        assert exc.status_code == 400
        assert "messages must be a list" in str(exc.detail)

    # 测试缺少 messages 参数
    try:
        asyncio.run(flow_api.ai_chat(
            {},
            current_user={"id": 1, "is_admin": True},
            db=FakeOptimizeDb()
        ))
        raise AssertionError("expected ValidationError")
    except ValidationError as exc:
        assert exc.status_code == 400
        assert "messages must be a list" in str(exc.detail)


def test_generate_code_from_flow_validates_payload(monkeypatch):
    """测试 generate_code_from_flow 验证 payload 参数"""
    import app.api.pythonlab.flow.api as flow_api_module

    async def fake_generate_code_from_flow_internal(flow_data, db):
        return {"code": "generated code"}

    monkeypatch.setattr(flow_api_module, "generate_code_from_flow_internal", fake_generate_code_from_flow_internal)

    # 测试有效的 flow_data 参数
    result = asyncio.run(flow_api.generate_code_from_flow(
        {"flow": {"nodes": [], "edges": []}},
        current_user={"id": 1, "is_admin": True},
        db=FakeOptimizeDb()
    ))
    assert result == {"code": "generated code"}

    # 测试缺少 flow 参数
    try:
        asyncio.run(flow_api.generate_code_from_flow(
            {},
            current_user={"id": 1, "is_admin": True},
            db=FakeOptimizeDb()
        ))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "flow 必须为 JSON 对象" in str(exc.detail)

    # 测试 flow 参数不是字典
    try:
        asyncio.run(flow_api.generate_code_from_flow(
            {"flow": "not a dict"},
            current_user={"id": 1, "is_admin": True},
            db=FakeOptimizeDb()
        ))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "flow 必须为 JSON 对象" in str(exc.detail)


def test_test_agent_connection_calls_internal_function(monkeypatch):
    """测试 test_agent_connection 调用内部函数"""
    import app.api.pythonlab.flow.api as flow_api_module
    call_args = []

    async def fake_test_agent_connection_internal(api_url, api_key, model):
        call_args.append((api_url, api_key, model))
        return {"connected": True, "model": "test-model"}

    monkeypatch.setattr(flow_api_module, "test_agent_connection_internal", fake_test_agent_connection_internal)

    result = asyncio.run(flow_api.test_agent_connection(
        {"api_url": "https://test.com", "api_key": "secret", "model": "gpt-4"},
        current_user={"id": 1, "is_admin": True}
    ))

    assert result == {"connected": True, "model": "test-model"}
    assert call_args == [("https://test.com", "secret", "gpt-4")]


def test_test_agent_connection_validates_input():
    """测试 test_agent_connection 的输入验证"""
    # 测试无效的 URL
    try:
        asyncio.run(flow_api.test_agent_connection(
            {"api_url": "not-a-url", "api_key": "secret", "model": "gpt-4"},
            current_user={"id": 1, "is_admin": True}
        ))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "api_url must be a valid HTTP/HTTPS URL" in str(exc.detail)

    # 测试 URL 过长
    long_url = "https://" + "a" * 500 + ".com"
    try:
        asyncio.run(flow_api.test_agent_connection(
            {"api_url": long_url, "api_key": "secret", "model": "gpt-4"},
            current_user={"id": 1, "is_admin": True}
        ))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "api_url too long" in str(exc.detail)

    # 测试 API key 过长
    long_key = "k" * 1001
    try:
        asyncio.run(flow_api.test_agent_connection(
            {"api_url": "https://test.com", "api_key": long_key, "model": "gpt-4"},
            current_user={"id": 1, "is_admin": True}
        ))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "api_key too long" in str(exc.detail)

    # 测试 model 名称过长
    long_model = "m" * 101
    try:
        asyncio.run(flow_api.test_agent_connection(
            {"api_url": "https://test.com", "api_key": "secret", "model": long_model},
            current_user={"id": 1, "is_admin": True}
        ))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "model name too long" in str(exc.detail)
