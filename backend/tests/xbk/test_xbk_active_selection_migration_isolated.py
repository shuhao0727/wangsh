"""Pure synthetic contract tests for the XBK active-selection migration.

No application settings, dotenv, database, network, or repository conftest is
required.  Run with plugin autoload disabled and ``--noconftest``.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_ROOT = Path(__file__).parents[2]
MIGRATION = (
    BACKEND_ROOT / "alembic/versions/20260914_0001_xbk_active_selection_unique.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location("xbk_active_unique_migration", MIGRATION)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self._rows


class _Bind:
    def __init__(self, dialect: str, rows=()):
        self.dialect = SimpleNamespace(name=dialect)
        self.rows = list(rows)
        self.statements = []

    def execute(self, statement):
        sql = str(statement)
        self.statements.append(sql)
        if "SELECT year, term, student_no" in sql:
            return _Result(self.rows)
        return _Result(())


def test_upgrade_refuses_historical_active_duplicates(monkeypatch):
    module = _load_module()
    bind = _Bind(
        "postgresql",
        [{"year": "2026-2027", "term": "上学期", "student_no": "S001", "active_count": 2}],
    )
    created = []
    monkeypatch.setattr(module.op, "get_bind", lambda: bind)
    monkeypatch.setattr(module.op, "create_index", lambda *args, **kwargs: created.append((args, kwargs)))

    with pytest.raises(RuntimeError, match=r"2026-2027/上学期/S001=2"):
        module.upgrade()

    assert "LOCK TABLE xbk_selections" in bind.statements[0]
    assert "SELECT year, term, student_no" in bind.statements[1]
    assert created == []


def test_preflight_matches_the_partial_unique_key_and_covers_unselected_rows():
    module = _load_module()
    sql = " ".join(str(module._DUPLICATE_QUERY).split())

    assert "WHERE is_deleted IS FALSE" in sql
    assert "GROUP BY year, term, student_no" in sql
    assert "HAVING COUNT(*) > 1" in sql
    assert "LIMIT 20" in sql
    assert "course_code" not in sql


def test_upgrade_creates_partial_unique_index_after_clean_preflight(monkeypatch):
    module = _load_module()
    bind = _Bind("postgresql")
    created = []
    monkeypatch.setattr(module.op, "get_bind", lambda: bind)
    monkeypatch.setattr(module.op, "create_index", lambda *args, **kwargs: created.append((args, kwargs)))

    module.upgrade()

    assert len(created) == 1
    args, kwargs = created[0]
    assert args[:3] == (
        "uq_xbk_selections_active_period_student",
        "xbk_selections",
        ["year", "term", "student_no"],
    )
    assert kwargs["unique"] is True
    assert str(kwargs["postgresql_where"]) == "is_deleted IS FALSE"
    assert "sqlite_where" not in kwargs


def test_upgrade_rejects_non_postgresql_without_running_preflight_or_ddl(monkeypatch):
    module = _load_module()
    bind = _Bind("sqlite")
    created = []
    monkeypatch.setattr(module.op, "get_bind", lambda: bind)
    monkeypatch.setattr(module.op, "create_index", lambda *args, **kwargs: created.append((args, kwargs)))

    with pytest.raises(RuntimeError, match="requires PostgreSQL"):
        module.upgrade()

    assert bind.statements == []
    assert created == []


def test_downgrade_locks_writers_before_dropping_only_the_new_index(monkeypatch):
    module = _load_module()
    bind = _Bind("postgresql")
    events = []
    original_execute = bind.execute

    def execute(statement):
        events.append(("execute", str(statement)))
        return original_execute(statement)

    bind.execute = execute
    monkeypatch.setattr(module.op, "get_bind", lambda: bind)
    monkeypatch.setattr(
        module.op,
        "drop_index",
        lambda *args, **kwargs: events.append(("drop_index", (args, kwargs))),
    )

    module.downgrade()

    assert events[0][0] == "execute"
    assert "LOCK TABLE xbk_selections IN SHARE ROW EXCLUSIVE MODE" in events[0][1]
    assert events[1] == (
        "drop_index",
        (("uq_xbk_selections_active_period_student",), {"table_name": "xbk_selections"}),
    )


def _ancestor_revision_ids(script: ScriptDirectory, head: str) -> set[str]:
    """Return a head and every revision reachable through its parents."""
    pending = [head]
    seen: set[str] = set()
    while pending:
        revision_id = pending.pop()
        if revision_id in seen:
            continue
        seen.add(revision_id)
        revision = script.get_revision(revision_id)
        assert revision is not None, f"迁移图引用了不存在的 revision: {revision_id}"
        parents = revision.down_revision
        if parents is None:
            continue
        if isinstance(parents, tuple):
            pending.extend(parents)
        else:
            pending.append(parents)
    return seen


def test_revision_is_the_single_alembic_head_and_follows_auth_authority():
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    script = ScriptDirectory.from_config(config)

    # 断言「迁移图只有一个 head」，而不是「head 恰好等于某个特定 revision」。
    # 早期版本写死了当时的 head（20260914_0001_xbk_active_selection_unique），
    # 之后每新增一条迁移都会让断言失效——它测的是快照而非不变量。
    # 单 head 才是真正要守的性质：多 head 会让 alembic upgrade head 失败。
    heads = script.get_heads()
    assert len(heads) == 1, (
        f"alembic 存在多个 head（{heads}），upgrade head 将无法确定目标"
    )

    # XBK 迁移本身仍在链上，且紧接 auth_authority（这才是本用例关心的契约）。
    target_id = "20260914_0001_xbk_active_selection_unique"
    revision = script.get_revision(target_id)
    assert revision is not None
    assert revision.down_revision == "20260910_0001_auth_authority"
    assert target_id in _ancestor_revision_ids(script, heads[0]), (
        f"XBK revision {target_id} 不在当前 head {heads[0]} 的祖先链上"
    )
