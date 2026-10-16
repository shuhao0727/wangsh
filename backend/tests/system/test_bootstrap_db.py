import asyncio
from pathlib import Path

import pytest
import scripts

from scripts import bootstrap_db


class _FakeConn:
    def __init__(self):
        self.run_sync_calls = 0
        self.executed: list[str] = []

    async def run_sync(self, fn):
        self.run_sync_calls += 1

    async def execute(self, statement, params=None):
        self.executed.append(str(statement))
        return _FakeResult(None)


class _FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


def test_backend_scripts_is_an_explicit_python_package():
    scripts_dir = Path(__file__).resolve().parents[2] / "scripts"

    assert Path(scripts.__file__).resolve() == (scripts_dir / "__init__.py").resolve()


def test_initial_only_bootstrap_defers_empty_database_to_alembic(monkeypatch):
    conn = _FakeConn()
    calls = {"baseline": 0, "compat": 0, "contract": 0}

    async def fake_version_rows(_conn, _schema):
        return None

    async def fake_existing_tables(_conn, _schema):
        return set()

    async def fake_create_legacy_baseline(_conn, *, schema):
        assert schema == "public"
        calls["baseline"] += 1

    async def fake_ensure_compat_columns(_conn, schema):
        assert schema == "public"
        calls["compat"] += 1

    async def fake_current_schema(_conn):
        return "public"

    monkeypatch.setattr(bootstrap_db, "_current_schema", fake_current_schema)
    monkeypatch.setattr(bootstrap_db, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(bootstrap_db, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(bootstrap_db, "_create_legacy_baseline", fake_create_legacy_baseline)
    monkeypatch.setattr(bootstrap_db, "_ensure_compat_columns", fake_ensure_compat_columns)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    asyncio.run(bootstrap_db.main(initial_only=True))

    assert conn.run_sync_calls == 0
    assert calls == {"baseline": 1, "compat": 0, "contract": 0}
    assert not any("INSERT INTO alembic_version" in statement for statement in conn.executed)


def test_initial_bootstrap_refuses_non_empty_database_without_version(monkeypatch):
    async def fake_version_rows(_conn, _schema):
        return None

    async def fake_existing_tables(_conn, _schema):
        return {"sys_users"}

    async def fake_current_schema(_conn):
        return "public"

    monkeypatch.setattr(bootstrap_db, "_current_schema", fake_current_schema)
    monkeypatch.setattr(bootstrap_db, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(bootstrap_db, "_get_existing_schema_tables", fake_existing_tables)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return object()

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    with pytest.raises(RuntimeError, match="effective schema .*public.* already has tables"):
        asyncio.run(bootstrap_db.main(initial_only=True))


def test_initial_only_bootstrap_rejects_empty_version_table(monkeypatch):
    conn = _FakeConn()

    async def fake_current_schema(_conn):
        return "tenant_shadow"

    async def fake_version_rows(_conn, _schema):
        return []

    async def fake_existing_tables(_conn, _schema):
        return set()

    async def fake_check_view_contract(_conn):
        return {
            "status": "unhealthy",
            "reason": "migration_state_invalid: empty_version_table: empty",
        }

    monkeypatch.setattr(bootstrap_db, "_current_schema", fake_current_schema)
    monkeypatch.setattr(bootstrap_db, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(bootstrap_db, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(bootstrap_db, "_check_view_contract", fake_check_view_contract)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    with pytest.raises(RuntimeError, match="empty_version_table"):
        asyncio.run(bootstrap_db.main(initial_only=True))
    assert conn.run_sync_calls == 0


def test_initial_only_bootstrap_allows_known_ancestor_before_view_contract(monkeypatch):
    conn = _FakeConn()

    async def fake_current_schema(_conn):
        return "public"

    async def fake_version_rows(_conn, _schema):
        return ["2de7995a8f24"]

    async def fail_if_readiness_is_checked(_conn):
        raise AssertionError("initial-only bootstrap must not require post-upgrade readiness")

    monkeypatch.setattr(bootstrap_db, "_current_schema", fake_current_schema)
    monkeypatch.setattr(bootstrap_db, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(bootstrap_db, "_check_view_contract", fail_if_readiness_is_checked)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    asyncio.run(bootstrap_db.main(initial_only=True))

    assert conn.run_sync_calls == 0


def test_post_migration_bootstrap_refuses_unmigrated_empty_database(monkeypatch):
    async def fake_version_rows(_conn, _schema):
        return None

    async def fake_existing_tables(_conn, _schema):
        return set()

    async def fake_current_schema(_conn):
        return "public"

    monkeypatch.setattr(bootstrap_db, "_current_schema", fake_current_schema)
    monkeypatch.setattr(bootstrap_db, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(bootstrap_db, "_get_existing_schema_tables", fake_existing_tables)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return object()

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    with pytest.raises(RuntimeError, match="Run `alembic upgrade head`"):
        asyncio.run(bootstrap_db.main())


def test_post_migration_bootstrap_preserves_compatibility_patch_and_checks_view(monkeypatch):
    conn = _FakeConn()
    calls = {"compat": 0, "contract": 0}

    async def fake_current_schema(_conn):
        return "public"

    async def fake_version_rows(_conn, _schema):
        return ["f1a2b3c4d5e6"]

    async def fake_ensure_compat_columns(_conn, schema):
        assert schema == "public"
        calls["compat"] += 1

    async def fake_check_view_contract(_conn):
        calls["contract"] += 1
        return {"status": "healthy", "reason": "ok"}

    monkeypatch.setattr(bootstrap_db, "_current_schema", fake_current_schema)
    monkeypatch.setattr(bootstrap_db, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(bootstrap_db, "_ensure_compat_columns", fake_ensure_compat_columns)
    monkeypatch.setattr(bootstrap_db, "_check_view_contract", fake_check_view_contract)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    asyncio.run(bootstrap_db.main())

    assert calls == {"compat": 1, "contract": 2}


def test_post_migration_bootstrap_refuses_unhealthy_view_contract(monkeypatch):
    conn = _FakeConn()

    async def fake_current_schema(_conn):
        return "public"

    async def fake_version_rows(_conn, _schema):
        return ["f1a2b3c4d5e6"]

    async def fake_ensure_compat_columns(_conn, schema):
        assert schema == "public"
        conn.executed.append("compatibility patch")

    async def fake_check_view_contract(_conn):
        return {"status": "unhealthy", "reason": "view_missing_or_columns_mismatch"}

    monkeypatch.setattr(bootstrap_db, "_current_schema", fake_current_schema)
    monkeypatch.setattr(bootstrap_db, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(bootstrap_db, "_ensure_compat_columns", fake_ensure_compat_columns)
    monkeypatch.setattr(bootstrap_db, "_check_view_contract", fake_check_view_contract)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    with pytest.raises(RuntimeError, match="invalid Alembic migration state"):
        asyncio.run(bootstrap_db.main())

    assert "compatibility patch" not in conn.executed


def test_compatibility_patch_qualifies_custom_schema_identifiers():
    statements = []

    class Connection:
        async def execute(self, statement, parameters=None):
            statements.append(str(statement))

    asyncio.run(bootstrap_db._ensure_compat_columns(Connection(), "tenant_shadow"))

    assert len(statements) == 3
    assert all('"tenant_shadow"."xxjs_dianming"' in statement for statement in statements)
    assert all("public.xxjs_dianming" not in statement for statement in statements)


def test_migration_managed_indexes_are_discovered_dynamically(tmp_path, monkeypatch):
    versions = tmp_path / "versions"
    versions.mkdir()
    (versions / "001.py").write_text(
        """
from alembic import op

def upgrade():
    op.create_index("ix_plain", "sample", ["id"])
    op.create_index(op.f("ix_named"), "sample", ["name"])
""",
        encoding="utf-8",
    )
    monkeypatch.setattr(bootstrap_db, "VERSIONS_DIR", versions)

    assert bootstrap_db._migration_managed_indexes() == {"ix_plain", "ix_named"}


def test_migration_managed_index_constant_is_deferred(tmp_path, monkeypatch):
    versions = tmp_path / "versions"
    versions.mkdir()
    (versions / "constant.py").write_text(
        '_INDEX_NAME = "uq_active_selection"\n'
        "def upgrade():\n"
        '    op.create_index(_INDEX_NAME, "sample", ["id"], unique=True)\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(bootstrap_db, "VERSIONS_DIR", versions)

    assert bootstrap_db._migration_managed_indexes() == {"uq_active_selection"}


def test_raw_sql_migration_indexes_are_deferred(tmp_path, monkeypatch):
    versions = tmp_path / "versions"
    versions.mkdir()
    (versions / "raw.py").write_text(
        "def upgrade():\n"
        "    op.execute('CREATE INDEX IF NOT EXISTS ix_text_trgm ' 'ON t USING gin (body gin_trgm_ops)')\n"
        "    op.execute('CREATE UNIQUE INDEX \"ix_quoted\" ON t (id)')\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(bootstrap_db, "VERSIONS_DIR", versions)
    assert bootstrap_db._migration_managed_indexes() == {"ix_text_trgm", "ix_quoted"}


def test_baseline_defers_migration_indexes_without_mutating_models():
    from sqlalchemy import create_mock_engine

    original_indexes = {
        name: {id(index) for index in table.indexes}
        for name, table in bootstrap_db.Base.metadata.tables.items()
    }
    statements = []
    def capture_ddl(statement, *args, **kwargs):
        statements.append(str(statement.compile(dialect=mock_engine.dialect)))

    mock_engine = create_mock_engine("postgresql://", capture_ddl)

    class Connection:
        async def run_sync(self, action):
            return action(mock_engine)

        async def execute(self, statement):
            statements.append(str(statement))

    asyncio.run(bootstrap_db._create_legacy_baseline(Connection(), schema="public"))
    ddl = "\n".join(statements)
    assert "CREATE TABLE public.wz_articles" in ddl
    conversations_ddl = next(
        statement
        for statement in statements
        if "CREATE TABLE public.znt_conversations (" in statement
    )
    members_ddl = next(
        statement
        for statement in statements
        if "CREATE TABLE public.znt_group_discussion_members (" in statement
    )
    assert "is_archived" not in conversations_ddl
    assert "archived_at" not in conversations_ddl
    assert "muted_until" not in members_ddl
    assert "gin_trgm_ops" not in ddl
    assert "CREATE EXTENSION" not in ddl
    assert "DROP INDEX" not in ddl
    assert "DROP COLUMN" not in ddl
    assert "CREATE TABLE IF NOT EXISTS \"public\".\"alembic_version\"" in ddl
    assert original_indexes == {
        name: {id(index) for index in table.indexes}
        for name, table in bootstrap_db.Base.metadata.tables.items()
    }


def test_non_public_baseline_creates_disposable_legacy_drop_indexes():
    from sqlalchemy import create_mock_engine

    statements = []

    def capture_ddl(statement, *args, **kwargs):
        statements.append(str(statement.compile(dialect=mock_engine.dialect)))

    mock_engine = create_mock_engine("postgresql://", capture_ddl)

    class Connection:
        async def run_sync(self, action):
            return action(mock_engine)

        async def execute(self, statement, parameters=None):
            statements.append(str(statement))

    asyncio.run(
        bootstrap_db._create_legacy_baseline(
            Connection(), schema="bootstrap_custom_test"
        )
    )
    ddl = "\n".join(statements)
    for index_name, table_name, _columns in bootstrap_db.NON_PUBLIC_LEGACY_DROP_INDEXES:
        assert f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "bootstrap_custom_test"."{table_name}"' in ddl


def test_baseline_uses_legacy_xbk_year_before_academic_year_migration():
    from sqlalchemy import create_mock_engine

    statements = []
    tables = ("xbk_students", "xbk_courses", "xbk_selections")
    originals = {
        name: (table.c.year.type, {id(c) for c in table.constraints})
        for name, table in bootstrap_db.Base.metadata.tables.items()
        if name in tables
    }

    def capture_ddl(statement, *args, **kwargs):
        statements.append(str(statement.compile(dialect=mock_engine.dialect)))

    mock_engine = create_mock_engine("postgresql://", capture_ddl)

    class Connection:
        async def run_sync(self, action):
            return action(mock_engine)

        async def execute(self, statement):
            statements.append(str(statement))

    asyncio.run(bootstrap_db._create_legacy_baseline(Connection(), schema="public"))
    for name in tables:
        ddl = next(s for s in statements if f"CREATE TABLE public.{name} (" in s)
        assert "year INTEGER NOT NULL" in ddl
        assert f"ck_{name}_academic_year" not in ddl
        assert f"uq_{name}_year_term_" in ddl
        original = bootstrap_db.Base.metadata.tables[name]
        assert original.c.year.type is originals[name][0]
        assert str(original.c.year.type) == "VARCHAR(9)"
        assert {id(c) for c in original.constraints} == originals[name][1]
