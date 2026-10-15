"""Learning progress endpoint contract and concurrency regressions."""

import asyncio
import json
from datetime import datetime

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError, MissingGreenlet
from sqlalchemy.orm import Session

from app.api.endpoints.learning.progress import (
    get_learning_progress,
    create_learning_progress,
    _progress_payload,
    patch_learning_progress,
    _progress_version,
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
            error, self.flush_error = self.flush_error, None
            raise error

    async def rollback(self):
        self.rollback_count += 1

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _value, *, attribute_names=None):
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
        "version": None,
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


@pytest.mark.parametrize(
    "writer", [create_learning_progress, patch_learning_progress, upsert_learning_progress]
)
@pytest.mark.parametrize("first_write", [False, True])
def test_write_refreshes_expired_timestamps_before_commit_snapshot(
    monkeypatch, writer, first_write
):
    """真实 ORM expiration；受控 loader 模拟 async 隐式 IO 的 MissingGreenlet。

    更新仅过期 updated_at，首次创建过期两个时间戳；SQLite 内存存储
    不证明 PostgreSQL 行锁或 Docker HTTP，这两项交由独立栈复测。
    """
    engine = create_engine("sqlite://")
    LearningProgress.__table__.create(engine)
    with Session(engine) as session:
        row = LearningProgress(
            user_id=42, module_key="ml", progress_data='{"keep": true}'
        )
        if not first_write:
            session.add(row)
            session.commit()
            session.refresh(row)

        expired_names = ["created_at", "updated_at"] if first_write else ["updated_at"]
        events = []

        def reject_implicit_load(_state, names, _passive):
            raise MissingGreenlet("implicit load of " + ",".join(sorted(names)))

        monkeypatch.setattr(
            inspect(row).manager, "expired_attribute_loader", reject_implicit_load
        )

        class ExpiringDb(_ProgressDb):
            def __init__(self):
                super().__init__([None if first_write else row])
                self.row = None if first_write else row

            def add(self, value):
                super().add(value)
                session.add(value)
                self.row = value

            async def flush(self):
                await super().flush()
                session.flush()
                session.expire(self.row, expired_names)
                events.append("flush")
                # The old flush -> payload path fails on expired ORM attributes.
                with pytest.raises(MissingGreenlet, match="updated_at"):
                    _progress_payload(self.row)

            async def refresh(self, value, *, attribute_names=None):
                assert self.commit_count == 0
                assert attribute_names == ["created_at", "updated_at"]
                assert set(expired_names) <= inspect(value).expired_attributes
                session.refresh(value, attribute_names=attribute_names)
                await super().refresh(value, attribute_names=attribute_names)
                events.append("refresh")

            async def commit(self):
                assert not set(expired_names) & inspect(self.row).expired_attributes
                await super().commit()
                session.commit()
                # Any serialization after commit would fail too; only a prior
                # detached response snapshot may be returned safely.
                assert inspect(self.row).expired_attributes
                events.append("commit")

        db = ExpiringDb()
        result = asyncio.run(
            writer(
                "ml",
                LearningProgressUpdate(
                    version=None if first_write else _progress_version(row), notes="saved"
                ),
                db,
                {"id": "42"},
            )
        )
        assert events == (["flush", "flush"] if first_write else ["flush"]) + [
            "refresh", "commit"
        ]
        assert isinstance(result["created_at"], datetime)
        assert isinstance(result["updated_at"], datetime)
        assert result["data"]["notes"] == "saved"
        assert result["version"]
        assert db.refresh_count == 1
        assert db.commit_count == 1
    engine.dispose()


def test_patch_merges_nested_fields_and_preserves_legacy_data():
    existing = LearningProgress(
        id=9,
        user_id=42,
        module_key="ml",
        current_stage="basics",
        completed_stages='["basics"]',
        progress_data=json.dumps(
            {
                "overall_percent": 20,
                "completedItems": {"old": True, "keep": True},
                "favoriteItems": {"favorite": True},
                "notes": "retain me",
            }
        ),
        notes="retain me",
        created_at=datetime(2026, 7, 22, 8, 0, 0),
        updated_at=datetime(2026, 7, 22, 8, 0, 0),
    )
    db = _ProgressDb([existing])

    result = asyncio.run(
        patch_learning_progress(
            "ml",
            LearningProgressUpdate(
                version=_progress_version(existing),
                overall_percent=25,
                completedItems={"new": True},
            ),
            db,
            {"id": "42"},
        )
    )

    data = json.loads(existing.progress_data)
    assert data["overall_percent"] == 25
    assert data["completedItems"] == {"old": True, "keep": True, "new": True}
    assert data["favoriteItems"] == {"favorite": True}
    assert data["notes"] == "retain me"
    assert result["version"]


def test_put_replaces_the_canonical_payload_instead_of_merging():
    existing = LearningProgress(
        id=10,
        user_id=42,
        module_key="ai",
        progress_data=json.dumps({"old": True, "keep": True}),
        updated_at=datetime(2026, 7, 22, 8, 0, 0),
        created_at=datetime(2026, 7, 22, 8, 0, 0),
    )
    db = _ProgressDb([existing])

    asyncio.run(
        upsert_learning_progress(
            "ai",
            LearningProgressUpdate(overall_percent=50),
            db,
            {"id": "42"},
        )
    )

    assert json.loads(existing.progress_data) == {"overall_percent": 50}


def test_patch_rejects_a_stale_version_without_mutating_the_row():
    existing = LearningProgress(
        id=11,
        user_id=42,
        module_key="agents",
        progress_data=json.dumps({"overall_percent": 10}),
        updated_at=datetime(2026, 7, 22, 8, 0, 0),
        created_at=datetime(2026, 7, 22, 8, 0, 0),
    )
    db = _ProgressDb([existing])

    try:
        asyncio.run(
            patch_learning_progress(
                "agents",
                LearningProgressUpdate(version="stale-version", overall_percent=99),
                db,
                {"id": "42"},
            )
        )
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 409
    else:
        raise AssertionError("Expected a version conflict")

    assert json.loads(existing.progress_data) == {"overall_percent": 10}
    assert db.commit_count == 0


def test_patch_requires_explicit_null_for_first_write_and_rejects_second_tab():
    first_db = _ProgressDb([None])

    result = asyncio.run(
        patch_learning_progress(
            "ml",
            LearningProgressUpdate(version=None, overall_percent=10),
            first_db,
            {"id": "42"},
        )
    )

    created = first_db.added[0]
    assert result["id"] is None
    assert result["version"]
    assert json.loads(created.progress_data) == {"overall_percent": 10}

    second_db = _ProgressDb([created])
    try:
        asyncio.run(
            patch_learning_progress(
                "ml",
                LearningProgressUpdate(version=None, overall_percent=20),
                second_db,
                {"id": "42"},
            )
        )
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 409
    else:
        raise AssertionError("Expected a first-write version conflict")

    assert json.loads(created.progress_data) == {"overall_percent": 10}
    assert second_db.commit_count == 0


def test_patch_without_version_is_rejected_before_database_write():
    db = _ProgressDb([None])

    try:
        asyncio.run(
            patch_learning_progress(
                "ml", LearningProgressUpdate(overall_percent=10), db, {"id": "42"}
            )
        )
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 428
    else:
        raise AssertionError("Expected a missing version rejection")

    assert db.execute_count == 0


def test_read_merges_legacy_columns_into_partial_canonical_json():
    existing = LearningProgress(
        id=12,
        user_id=42,
        module_key="ml",
        current_stage="basics",
        completed_stages='["basics"]',
        progress_data=json.dumps({"overall_percent": 20}),
        notes="legacy notes",
        created_at=datetime(2026, 7, 22, 8, 0, 0),
        updated_at=datetime(2026, 7, 22, 8, 0, 0),
    )

    result = asyncio.run(
        get_learning_progress("ml", _ProgressDb([existing]), {"id": "42"}),
    )

    assert result["data"] == {
        "overall_percent": 20,
        "current_stage": "basics",
        "completed_stages": ["basics"],
        "notes": "legacy notes",
    }


def test_patch_distinguishes_empty_array_and_explicit_null_from_omitted_fields():
    existing = LearningProgress(
        id=13,
        user_id=42,
        module_key="agents",
        current_stage="old-stage",
        completed_stages='["old-stage"]',
        progress_data=json.dumps({"notes": "old notes"}),
        notes="old notes",
        created_at=datetime(2026, 7, 22, 8, 0, 0),
        updated_at=datetime(2026, 7, 22, 8, 0, 0),
    )

    asyncio.run(
        patch_learning_progress(
            "agents",
            LearningProgressUpdate(
                version=_progress_version(existing), completed_stages=[], notes=None
            ),
            _ProgressDb([existing]),
            {"id": "42"},
        ),
    )

    assert existing.current_stage == "old-stage"
    assert existing.completed_stages == "[]"
    assert existing.notes is None
    assert json.loads(existing.progress_data) == {
        "current_stage": "old-stage",
        "notes": None,
        "completed_stages": [],
    }


def test_get_progress_does_not_turn_a_read_failure_into_default_data():
    class FailingDb:
        async def execute(self, _statement):
            raise RuntimeError("database unavailable")

    try:
        asyncio.run(get_learning_progress("ml", FailingDb(), {"id": "42"}))
    except RuntimeError as exc:
        assert str(exc) == "database unavailable"
    else:
        raise AssertionError("Expected the read failure to propagate")
