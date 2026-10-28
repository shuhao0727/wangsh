"""任务分析取材 SQL 的 LIMIT 回归测试。

学生提问 content 是 TEXT，历史实现无 LIMIT，会把整个时间窗内的全部提问
读进内存，再 "\n".join 复制一份。这里固定两处分析入口（流式与非流式）
都带 LIMIT，且按 created_at DESC 只保留最近的记录。
"""

import asyncio
from datetime import datetime, timezone

from app.services.agents import agent_analysis


class _RecordingResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self

    def all(self):
        return self._rows


class _RecordingDb:
    def __init__(self, rows=None):
        self._rows = rows or []
        self.calls = []

    async def execute(self, stmt, params=None):
        self.calls.append((str(stmt), params or {}))
        return _RecordingResult(self._rows)


_WINDOW = dict(
    start_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
    end_at=datetime(2026, 5, 2, tzinfo=timezone.utc),
)


def _run_stream(db):
    """把流式分析跑到第一个 partial_result 就停，避免触发 LLM 调用。"""

    async def _inner():
        events = []
        async for event in agent_analysis.stream_task_sheet_analysis(
            db, agent_id=1, task_sheet="任务单", **_WINDOW,
        ):
            events.append(event)
            if event.get("event") == "partial_result":
                break
        return events

    return asyncio.run(_inner())


def test_stream_analysis_question_sql_has_limit_and_desc_order():
    db = _RecordingDb()

    _run_stream(db)

    sql, params = db.calls[0]
    assert "LIMIT" in sql.upper()
    assert "ORDER BY C.CREATED_AT DESC" in sql.upper()
    assert params["row_limit"] == agent_analysis.MAX_ANALYSIS_QUESTIONS


def test_stream_analysis_passes_row_limit_as_bound_parameter():
    db = _RecordingDb()

    _run_stream(db)

    _, params = db.calls[0]
    assert params["row_limit"] == 5000


def test_stream_analysis_reports_truncated_count():
    """只取到 2 条时，进度事件应如实反映 2 条。"""
    db = _RecordingDb([
        {"content": "晚", "created_at": datetime(2026, 5, 1, 12, tzinfo=timezone.utc)},
        {"content": "早", "created_at": datetime(2026, 5, 1, 9, tzinfo=timezone.utc)},
    ])

    events = _run_stream(db)

    partial = next(e for e in events if e.get("event") == "partial_result")
    assert partial["result"]["question_count"] == 2


def test_non_stream_analysis_also_uses_limit(monkeypatch):
    """非流式 analyze_task_sheet 使用同一套 LIMIT 语义。"""
    captured = {}

    class _Db:
        async def execute(self, stmt, params=None):
            captured["sql"] = str(stmt)
            captured["params"] = params or {}
            return _RecordingResult([])

    async def _fake_llm(*_args, **_kwargs):
        raise AssertionError("空数据不应触发 LLM 调用")

    monkeypatch.setattr(agent_analysis, "_call_llm_analysis", _fake_llm)

    asyncio.run(agent_analysis.analyze_task_sheet(
        _Db(), agent_id=1, task_sheet="任务单",
        api_endpoint="http://x", api_key="k", agent_type="t", agent_model="m",
        **_WINDOW,
    ))

    assert "LIMIT" in captured["sql"].upper()
    assert captured["params"]["row_limit"] == agent_analysis.MAX_ANALYSIS_QUESTIONS
