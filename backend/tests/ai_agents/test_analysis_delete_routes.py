import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.api.endpoints.agents.ai_agents import analysis as analysis_api
from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis, TaskAnalysis


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _FakeDb:
    def __init__(self, rows_by_model):
        self.rows_by_model = rows_by_model
        self.queried_models = []
        self.deleted = []
        self.commit_count = 0

    async def execute(self, statement):
        model = statement.column_descriptions[0]["entity"]
        self.queried_models.append(model)
        return _RowsResult(self.rows_by_model.get(model, []))

    async def delete(self, row):
        self.deleted.append(row)

    async def commit(self):
        self.commit_count += 1


def _analysis_fields():
    return {
        "id": 17,
        "title": "主键碰撞分析",
        "task_sheet": "课堂任务",
        "agent_id": 7,
        "class_name": "一班",
        "start_at": datetime(2026, 7, 13, 1, 0, tzinfo=timezone.utc),
        "end_at": datetime(2026, 7, 13, 2, 0, tzinfo=timezone.utc),
        "result": {"analysis_version": "hot_v2", "batch": "same-save"},
        "created_by": 3,
        "created_at": datetime(2026, 7, 13, 2, 1, tzinfo=timezone.utc),
    }


def test_legacy_get_does_not_guess_a_typed_table_from_integer_id():
    fields = _analysis_fields()
    hot = HotQuestionAnalysis(**fields)
    chain = StudentChainAnalysis(**{**fields, "result": {"analysis_version": "chain_v2"}})
    db = _FakeDb(
        {
            TaskAnalysis: [],
            HotQuestionAnalysis: [hot],
            StudentChainAnalysis: [chain],
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(analysis_api.get_task_analysis(17, current_user={"id": 3}, db=db))

    assert exc_info.value.status_code == 404
    assert db.queried_models == [TaskAnalysis]


def test_legacy_delete_does_not_guess_a_typed_table_from_integer_id():
    fields = _analysis_fields()
    hot = HotQuestionAnalysis(**fields)
    chain = StudentChainAnalysis(**{**fields, "result": {"analysis_version": "chain_v2"}})
    db = _FakeDb(
        {
            TaskAnalysis: [],
            HotQuestionAnalysis: [hot],
            StudentChainAnalysis: [chain],
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(analysis_api.delete_task_analysis(17, current_user={"id": 3}, db=db))

    assert exc_info.value.status_code == 404
    assert db.queried_models == [TaskAnalysis]
    assert db.deleted == []
    assert db.commit_count == 0


def test_legacy_delete_only_deletes_the_legacy_row():
    fields = _analysis_fields()
    legacy = TaskAnalysis(**fields)
    hot_sibling = HotQuestionAnalysis(**fields)
    db = _FakeDb(
        {
            TaskAnalysis: [legacy],
            HotQuestionAnalysis: [hot_sibling],
            StudentChainAnalysis: [],
        }
    )

    result = asyncio.run(
        analysis_api.delete_task_analysis(17, current_user={"id": 3}, db=db)
    )

    assert result == {"ok": True}
    assert db.queried_models == [TaskAnalysis]
    assert db.deleted == [legacy]
    assert db.commit_count == 1


@pytest.mark.parametrize(
    ("delete_func", "typed_model", "other_typed_model"),
    [
        (
            analysis_api.delete_hot_analysis,
            HotQuestionAnalysis,
            StudentChainAnalysis,
        ),
        (
            analysis_api.delete_chain_analysis,
            StudentChainAnalysis,
            HotQuestionAnalysis,
        ),
    ],
)
def test_typed_delete_cleans_only_the_unique_legacy_snapshot_sibling(
    delete_func,
    typed_model,
    other_typed_model,
):
    fields = _analysis_fields()
    typed_row = typed_model(**fields)
    legacy_sibling = TaskAnalysis(**fields)
    colliding_other_type = other_typed_model(
        **{
            **fields,
            "title": "相同整数 ID 的另一类型记录",
            "result": {"analysis_version": "other"},
        }
    )
    db = _FakeDb(
        {
            typed_model: [typed_row],
            TaskAnalysis: [legacy_sibling],
            other_typed_model: [colliding_other_type],
        }
    )

    result = asyncio.run(delete_func(17, current_user={"id": 3}, db=db))

    assert result == {"message": "已删除"}
    assert db.queried_models == [typed_model, TaskAnalysis]
    assert db.deleted == [typed_row, legacy_sibling]
    assert colliding_other_type not in db.deleted
    assert db.commit_count == 1
