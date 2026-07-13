import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.api.endpoints.agents.ai_agents.analysis import (
    _delete_compatible_siblings,
)
from app.models.agents import (
    HotQuestionAnalysis,
    StudentChainAnalysis,
    TaskAnalysis,
)


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _FakeDb:
    def __init__(self, result_sets):
        self._result_sets = iter(result_sets)
        self.deleted = []

    async def execute(self, _statement):
        return _RowsResult(next(self._result_sets))

    async def delete(self, row):
        self.deleted.append(row)


def _business_fields():
    return {
        "title": "同参数重复分析",
        "task_sheet": "分析课堂问题",
        "agent_id": 7,
        "class_name": "一班",
        "start_at": datetime(2026, 7, 13, 1, 0, tzinfo=timezone.utc),
        "end_at": datetime(2026, 7, 13, 2, 0, tzinfo=timezone.utc),
        "created_by": 3,
    }


def test_delete_compatible_siblings_only_deletes_the_same_batch():
    fields = _business_fields()
    first_created_at = datetime(2026, 7, 13, 2, 1, tzinfo=timezone.utc)
    second_created_at = first_created_at + timedelta(minutes=5)
    kept = TaskAnalysis(
        **fields,
        result={"analysis_version": "hot_v2", "batch": "first"},
        created_at=first_created_at,
    )
    first_sibling = HotQuestionAnalysis(
        **fields,
        result={"analysis_version": "hot_v2", "batch": "first"},
        created_at=first_created_at,
    )
    second_sibling = HotQuestionAnalysis(
        **fields,
        result={"analysis_version": "hot_v2", "batch": "second"},
        created_at=second_created_at,
    )
    db = _FakeDb([[first_sibling, second_sibling], []])

    deleted = asyncio.run(_delete_compatible_siblings(db, kept))

    assert deleted == 1
    assert db.deleted == [first_sibling]


def test_delete_compatible_siblings_keeps_ambiguous_exact_matches():
    fields = _business_fields()
    created_at = datetime(2026, 7, 13, 2, 1, tzinfo=timezone.utc)
    result = {"analysis_version": "hot_v2", "batch": "same-snapshot"}
    kept = TaskAnalysis(**fields, result=result, created_at=created_at)
    candidates = [
        HotQuestionAnalysis(**fields, result=result, created_at=created_at),
        HotQuestionAnalysis(**fields, result=result, created_at=created_at),
    ]
    db = _FakeDb([candidates, []])

    deleted = asyncio.run(_delete_compatible_siblings(db, kept))

    assert deleted == 0
    assert db.deleted == []


def test_delete_compatible_siblings_keeps_candidate_without_snapshot_fields():
    fields = _business_fields()
    kept = TaskAnalysis(
        **fields,
        result={"analysis_version": "hot_v2"},
        created_at=datetime(2026, 7, 13, 2, 1, tzinfo=timezone.utc),
    )
    incomplete_candidate = SimpleNamespace(
        **{key: value for key, value in fields.items() if key != "task_sheet"},
        task_sheet=fields["task_sheet"],
    )
    db = _FakeDb([[incomplete_candidate], []])

    deleted = asyncio.run(_delete_compatible_siblings(db, kept))

    assert deleted == 0
    assert db.deleted == []


def test_delete_compatible_siblings_deletes_one_unique_legacy_sibling():
    fields = _business_fields()
    created_at = datetime(2026, 7, 13, 2, 1, tzinfo=timezone.utc)
    result = {"analysis_version": "chain_v2", "batch": "unique"}
    kept = StudentChainAnalysis(**fields, result=result, created_at=created_at)
    legacy_sibling = TaskAnalysis(
        **fields,
        result=result,
        created_at=created_at,
    )
    db = _FakeDb([[legacy_sibling], []])

    deleted = asyncio.run(_delete_compatible_siblings(db, kept))

    assert deleted == 1
    assert db.deleted == [legacy_sibling]


def test_delete_legacy_record_checks_chain_even_with_nonempty_task_sheet():
    fields = _business_fields()
    created_at = datetime(2026, 7, 13, 2, 1, tzinfo=timezone.utc)
    result = {"analysis_version": "chain_v2", "batch": "unique-chain"}
    kept = TaskAnalysis(**fields, result=result, created_at=created_at)
    chain_sibling = StudentChainAnalysis(
        **fields,
        result=result,
        created_at=created_at,
    )
    db = _FakeDb([[], [chain_sibling]])

    deleted = asyncio.run(_delete_compatible_siblings(db, kept))

    assert deleted == 1
    assert db.deleted == [chain_sibling]


def test_delete_legacy_record_keeps_cross_type_ambiguous_matches():
    fields = _business_fields()
    created_at = datetime(2026, 7, 13, 2, 1, tzinfo=timezone.utc)
    result = {"analysis_version": "shared", "batch": "ambiguous"}
    kept = TaskAnalysis(**fields, result=result, created_at=created_at)
    hot_sibling = HotQuestionAnalysis(
        **fields,
        result=result,
        created_at=created_at,
    )
    chain_sibling = StudentChainAnalysis(
        **fields,
        result=result,
        created_at=created_at,
    )
    db = _FakeDb([[hot_sibling], [chain_sibling]])

    deleted = asyncio.run(_delete_compatible_siblings(db, kept))

    assert deleted == 0
    assert db.deleted == []
