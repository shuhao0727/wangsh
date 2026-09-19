"""分析端点凭据解析回归测试。

背景：`analysis.py` 拆分出 `analysis_helpers/analysis_streams/analysis_prompts` 时，
`task_analysis` 与 `save_task_analysis` 两个处理器调用了 `resolve_credentials`，却**没有**
把它导入本模块。此前这两个端点没有任何测试覆盖，因此这个 `NameError` 一直未被发现——
只要查到智能体就会在运行期抛 `NameError: name 'resolve_credentials' is not defined`。

这里刻意**不 monkeypatch** `resolve_credentials`：必须让真正的实现参与解析，才能证明它
确实被绑定到了 `analysis` 模块上；如果哪天有人把它删掉，这些测试会立刻失败。
"""

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

from app.api.endpoints.agents.ai_agents import analysis as analysis_api
from app.schemas.agents import TaskAnalysisRequest, TaskAnalysisSaveRequest
from app.services.agents.providers.common import resolve_credentials


class _AgentResult:
    def __init__(self, agent):
        self._agent = agent

    def scalar_one_or_none(self):
        return self._agent


class _FakeDb:
    """最小可用的假会话：只满足两个分析处理器实际调用到的方法。"""

    def __init__(self, agent):
        self.agent = agent
        self.queried_agent_ids = []
        self.added = []
        self.commit_count = 0
        self.refresh_count = 0

    async def execute(self, statement):
        params = statement.compile().params
        self.queried_agent_ids.extend(
            value
            for value in params.values()
            if isinstance(value, int) and not isinstance(value, bool)
        )
        return _AgentResult(self.agent)

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, row):
        self.refresh_count += 1


def _agent():
    """凭据解析需要 api_endpoint / agent_type / api_key_encrypted / api_key 四个属性。"""
    return SimpleNamespace(
        id=7,
        api_endpoint="https://api.example.com/v1/",
        agent_type="openai",
        model_name="gpt-4o",
        api_key_encrypted=None,
        api_key="sk-test",
    )


def _capture_analyze_task_sheet(monkeypatch, captured):
    async def fake_analyze_task_sheet(db, **kwargs):
        captured.update(kwargs)
        return {"ok": True}

    monkeypatch.setattr(analysis_api, "analyze_task_sheet", fake_analyze_task_sheet)


def test_resolve_credentials_is_bound_on_the_analysis_module():
    """直接守卫本模块的属性：拆分时回导的名字必须仍然可用。"""
    assert analysis_api.resolve_credentials is resolve_credentials


def test_task_analysis_resolves_credentials_before_calling_the_model(monkeypatch):
    captured = {}
    _capture_analyze_task_sheet(monkeypatch, captured)
    body = TaskAnalysisRequest(task_sheet="课堂任务", agent_id=7)

    result = asyncio.run(
        analysis_api.task_analysis(body, current_user={"id": 3}, db=_FakeDb(_agent()))
    )

    assert result == {"ok": True}
    # 尾斜杠被 resolve_credentials 规范化掉，说明真实实现参与了调用
    assert captured["api_endpoint"] == "https://api.example.com/v1"
    assert captured["api_key"] == "sk-test"
    assert captured["agent_type"] == "openai"
    assert captured["agent_model"] == "gpt-4o"


def test_task_analysis_without_an_agent_passes_empty_credentials(monkeypatch):
    """查不到智能体时不得报错，凭据留空交给下游降级。"""
    captured = {}
    _capture_analyze_task_sheet(monkeypatch, captured)
    body = TaskAnalysisRequest(task_sheet="课堂任务", agent_id=7)

    asyncio.run(
        analysis_api.task_analysis(body, current_user={"id": 3}, db=_FakeDb(None))
    )

    assert captured["api_endpoint"] == ""
    assert captured["api_key"] == ""


def test_save_task_analysis_resolves_credentials_before_calling_the_model(monkeypatch):
    captured = {}
    _capture_analyze_task_sheet(monkeypatch, captured)
    body = TaskAnalysisSaveRequest(title="课堂分析", task_sheet="课堂任务", agent_id=7)
    db = _FakeDb(_agent())

    asyncio.run(
        analysis_api.save_task_analysis(body, current_user={"id": 3}, db=db)
    )

    assert captured["api_endpoint"] == "https://api.example.com/v1"
    assert captured["api_key"] == "sk-test"
    assert captured["agent_type"] == "openai"
    assert captured["agent_model"] == "gpt-4o"
    # 热分析走 HotQuestionAnalysis 分支，同时留一条 legacy 快照
    assert len(db.added) == 2
    assert db.commit_count == 1
    assert db.refresh_count == 2


def test_save_task_analysis_uses_analysis_agent_id_when_present(monkeypatch):
    """analysis_agent_id 优先于 agent_id 作为 LLM 凭据来源。"""
    captured = {}
    _capture_analyze_task_sheet(monkeypatch, captured)
    db = _FakeDb(_agent())
    body = TaskAnalysisSaveRequest(
        title="课堂分析",
        task_sheet="课堂任务",
        agent_id=7,
        analysis_agent_id=99,
        start_at=datetime(2026, 9, 19, 1, 0, tzinfo=timezone.utc),
        end_at=datetime(2026, 9, 19, 2, 0, tzinfo=timezone.utc),
    )

    asyncio.run(analysis_api.save_task_analysis(body, current_user={"id": 3}, db=db))

    assert db.queried_agent_ids == [99]
    assert captured["agent_id"] == 7  # 数据来源仍是 agent_id
    assert captured["api_key"] == "sk-test"


def test_analysis_module_keeps_its_split_reexport_surface():
    """拆分前定义在本模块的名字必须继续可访问（模块 docstring 声明的 re-export 契约）。"""
    for name in (
        "_sse",
        "_analysis_window",
        "_serialize_teacher_marks",
        "_task_analysis_payload",
        "_find_legacy_task_analysis",
        "_resolve_prompt_text",
        "_agent_public_payload",
        "_resolve_analysis_agent_credentials",
        "_compact_teacher_questions",
        "_prepare_hot_deep_analysis_input",
        "_prepare_chain_deep_analysis_input",
        "_hot_deep_analysis_has_content",
        "_chain_deep_analysis_has_content",
        "_hot_list_item",
        "_chain_list_item",
        "_trend_top_themes",
        "save_hot_question_analysis_stream",
        "save_student_chain_analysis_stream",
        "save_task_analysis_stream",
        "list_prompt_templates",
        "create_prompt_template",
        "update_prompt_template",
        "delete_prompt_template",
        "router",
    ):
        assert hasattr(analysis_api, name), f"analysis 模块丢失了回导名字：{name}"
