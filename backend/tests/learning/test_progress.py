"""Learning progress endpoint contract and concurrency regressions."""

import asyncio
import json
from datetime import datetime

from sqlalchemy.exc import IntegrityError

from app.api.endpoints.learning.progress import (
    get_learning_progress,
    upsert_learning_progress,
)
from app.models.learning.progress import LearningProgress
from app.schemas.learning.progress import LearningProgressUpdate


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalar_one(self):
        if self._value is None:
            raise AssertionError("Expected a progress row")
        return self._value


class _ProgressDb:
    def __init__(self, execute_values, *, flush_error=None):
        self.execute_values = list(execute_values)
        self.flush_error = flush_error
        self.added = []
        self.execute_count = 0
        self.flush_count = 0
        self.rollback_count = 0
        self.commit_count = 0
        self.refresh_count = 0

    async def execute(self, _statement):
        self.execute_count += 1
        return _ScalarResult(self.execute_values.pop(0))

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        self.flush_count += 1
        if self.flush_error is not None:
            raise self.flush_error

    async def rollback(self):
        self.rollback_count += 1

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _value):
        self.refresh_count += 1


def test_get_progress_returns_stable_default_payload_when_record_is_missing():
    db = _ProgressDb([None])

    result = asyncio.run(
        get_learning_progress("ml", db, {"id": "42"}),
    )

    assert result == {
        "id": None,
        "user_id": 42,
        "module_key": "ml",
        "data": {
            "current_stage": None,
            "completed_stages": None,
            "notes": None,
        },
        "created_at": None,
        "updated_at": None,
    }
    assert db.execute_count == 1
    assert db.added == []
    assert db.commit_count == 0


def test_upsert_integrity_race_rolls_back_reloads_and_updates_validated_payload():
    existing = LearningProgress(
        id=7,
        user_id=42,
        module_key="agents",
        current_stage="old-stage",
        completed_stages='["old-stage"]',
        progress_data='{"overall_percent": 10}',
        notes="old notes",
        created_at=datetime(2026, 7, 22, 8, 0, 0),
        updated_at=datetime(2026, 7, 22, 8, 0, 0),
    )
    db = _ProgressDb(
        [None, existing],
        flush_error=IntegrityError(
            "insert learning progress",
            {},
            Exception("duplicate user/module"),
        ),
    )
    data = LearningProgressUpdate(
        current_stage="stage-2",
        completed_stages=["stage-1"],
        notes="new notes",
        completedItems={"intro": True},
        overall_percent=25,
    )
    progress_dict = data.to_progress_dict()

    result = asyncio.run(
        upsert_learning_progress("agents", data, db, {"id": "42"}),
    )

    assert db.execute_count == 2
    assert db.rollback_count == 1
    assert db.commit_count == 1
    assert db.refresh_count == 1
    assert json.loads(existing.progress_data) == progress_dict
    assert existing.current_stage == "stage-2"
    assert json.loads(existing.completed_stages) == ["stage-1"]
    assert existing.notes == "new notes"
    assert result["data"] == progress_dict
