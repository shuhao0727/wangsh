import asyncio
from types import SimpleNamespace

from app.core import startup


class _RunSyncRecorder:
    def __init__(self):
        self.calls = 0

    async def run_sync(self, fn):
        self.calls += 1


def test_init_database_skips_create_all_for_versioned_existing_schema(monkeypatch):
    conn = _RunSyncRecorder()
    monkeypatch.setattr(startup.settings, "DEBUG", True)
    monkeypatch.setattr(startup.settings, "AUTO_CREATE_TABLES", False)

    async def fake_existing_tables(_conn, _schema):
        return {"sys_users"}

    async def fake_version_rows(_conn, _schema):
        return ["f1a2b3c4d5e6"]

    monkeypatch.setattr(startup, "_current_schema", lambda _conn: _async_value("tenant_test"))
    monkeypatch.setattr(startup, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(startup, "_alembic_version_rows", fake_version_rows)

    contract_called = False

    async def fake_check_view_contract(_conn):
        nonlocal contract_called
        contract_called = True
        return {"status": "healthy", "reason": "ok"}

    monkeypatch.setattr(startup, "check_conversations_view_contract", fake_check_view_contract)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(startup, "engine", FakeEngine())

    asyncio.run(startup.init_database())

    assert conn.calls == 0
    assert contract_called


def test_init_database_runs_alembic_for_empty_schema(monkeypatch):
    conn = _RunSyncRecorder()
    monkeypatch.setattr(startup.settings, "DEBUG", True)
    monkeypatch.setattr(startup.settings, "AUTO_CREATE_TABLES", False)

    async def fake_existing_tables(_conn, _schema):
        return set()

    async def fake_version_rows(_conn, _schema):
        return None

    monkeypatch.setattr(startup, "_current_schema", lambda _conn: _async_value("tenant_test"))
    monkeypatch.setattr(startup, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(startup, "_alembic_version_rows", fake_version_rows)

    calls = SimpleNamespace(contract=0, upgrade=0)

    async def fake_check_view_contract(_conn):
        calls.contract += 1
        return {"status": "healthy", "reason": "ok"}

    async def fake_upgrade_database_to_head():
        calls.upgrade += 1

    monkeypatch.setattr(startup, "check_conversations_view_contract", fake_check_view_contract)
    monkeypatch.setattr(startup, "_upgrade_database_to_head", fake_upgrade_database_to_head)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(startup, "engine", FakeEngine())

    asyncio.run(startup.init_database())

    assert conn.calls == 0
    assert calls.contract == 1
    assert calls.upgrade == 1

def test_init_database_refuses_unhealthy_view_contract(monkeypatch):
    conn = _RunSyncRecorder()
    monkeypatch.setattr(startup.settings, "DEBUG", True)
    monkeypatch.setattr(startup.settings, "AUTO_CREATE_TABLES", False)

    async def fake_existing_tables(_conn, _schema):
        return {"sys_users"}

    async def fake_version_rows(_conn, _schema):
        return ["f1a2b3c4d5e6"]

    async def fake_check_view_contract(_conn):
        return {"status": "unhealthy", "reason": "migration_not_at_f1a2b3c4d5e6"}

    monkeypatch.setattr(startup, "_current_schema", lambda _conn: _async_value("tenant_test"))
    monkeypatch.setattr(startup, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(startup, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(startup, "check_conversations_view_contract", fake_check_view_contract)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(startup, "engine", FakeEngine())

    import pytest
    with pytest.raises(RuntimeError, match="readiness contract"):
        asyncio.run(startup.init_database())


async def _async_value(value):
    return value


def test_init_database_rejects_empty_version_table_in_shadow_schema(monkeypatch):
    conn = _RunSyncRecorder()
    monkeypatch.setattr(startup.settings, "DEBUG", True)
    monkeypatch.setattr(startup.settings, "AUTO_CREATE_TABLES", False)

    async def fake_existing_tables(_conn, _schema):
        return set()

    async def fake_version_rows(_conn, _schema):
        return []

    async def fake_check_view_contract(_conn):
        return {
            "status": "unhealthy",
            "reason": "migration_state_invalid: empty_version_table: empty",
        }

    monkeypatch.setattr(startup, "_current_schema", lambda _conn: _async_value("tenant_shadow"))
    monkeypatch.setattr(startup, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(startup, "_alembic_version_rows", fake_version_rows)
    monkeypatch.setattr(startup, "check_conversations_view_contract", fake_check_view_contract)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return conn

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(startup, "engine", FakeEngine())

    import pytest
    with pytest.raises(RuntimeError, match="empty_version_table"):
        asyncio.run(startup.init_database())
    assert conn.calls == 0


class _ScalarRows:
    def __init__(self, scalar=None, rows=()):
        self._scalar = scalar
        self.rows = list(rows)

    def scalar(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar

    def __iter__(self):
        return iter(self.rows)


class _SchemaConnection:
    def __init__(self):
        self.calls = []

    async def execute(self, statement, parameters=None):
        sql = str(statement)
        self.calls.append((sql, parameters))
        if "current_schema()" in sql:
            return _ScalarRows(scalar="tenant_test")
        if "FROM pg_tables" in sql:
            return _ScalarRows(rows=[("sys_users",)])
        if "pg_catalog.pg_class" in sql:
            return _ScalarRows(scalar=True)
        if "SELECT version_num" in sql:
            return _ScalarRows(rows=[("head",)])
        raise AssertionError(sql)


def test_startup_helpers_use_effective_schema_and_visible_version_table():
    async def scenario():
        conn = _SchemaConnection()
        schema = await startup._current_schema(conn)
        tables = await startup._get_existing_schema_tables(conn, schema)
        revision = await startup._has_alembic_revision(conn)
        assert schema == "tenant_test"
        assert tables == {"sys_users"}
        assert revision is True
        assert any(params == {"schema": "tenant_test"} for _, params in conn.calls)
        assert all("public.alembic_version" not in sql for sql, _ in conn.calls)

    asyncio.run(scenario())


class _ContractConnection:
    def __init__(self, *, revisions=None, columns_ok=True, dependency_error=None):
        self.revisions = list(revisions if revisions is not None else [startup.VIEW_CONTRACT_MIGRATION])
        self.columns_ok = columns_ok
        self.dependency_error = dependency_error
        self.calls = []

    async def execute(self, statement, parameters=None):
        sql = str(statement)
        self.calls.append((sql, parameters))
        if "SELECT current_schema()" in sql:
            return _ScalarRows(scalar="tenant_test")
        if "alembic_version" in sql and "pg_catalog.pg_class" in sql:
            return _ScalarRows(scalar=True)
        if "SELECT version_num" in sql:
            return _ScalarRows(rows=[(revision,) for revision in self.revisions])
        if "array_agg" in sql and "attisdropped" in sql:
            return _ScalarRows(scalar=self.columns_ok)
        if "SELECT * FROM" in sql:
            if self.dependency_error is not None:
                raise self.dependency_error
            return _ScalarRows(scalar=None)
        raise AssertionError(sql)


def test_view_contract_requires_exact_single_head_and_schema_qualified_objects():
    async def scenario():
        conn = _ContractConnection()
        result = await startup.check_conversations_view_contract(conn)
        assert result == {
            "status": "healthy",
            "reason": "ok",
            "schema": "tenant_test",
            "migration": startup.VIEW_CONTRACT_MIGRATION,
        }

        sql = "\n".join(statement for statement, _ in conn.calls)
        assert '"tenant_test"."alembic_version"' in sql
        assert '"tenant_test"."v_conversations_with_deleted"' in sql
        assert "ORDER BY version_num" in sql
        assert "array_agg(a.attname::text ORDER BY a.attnum)" in sql
        upper_sql = sql.upper()
        assert "CREATE VIEW" not in upper_sql
        assert "ALTER VIEW" not in upper_sql
        assert "DROP VIEW" not in upper_sql
        assert all(
            params is None or params.get("schema") == "tenant_test"
            for _, params in conn.calls
            if params is not None and "schema" in params
        )

    import asyncio

    asyncio.run(scenario())


def test_view_contract_rejects_empty_multiple_old_and_unknown_revisions():
    async def scenario():
        cases = (
            ([], "empty_version_table"),
            ([startup.VIEW_CONTRACT_MIGRATION, startup.VIEW_CONTRACT_MIGRATION], "multiple_version_rows"),
            (["2de7995a8f24"], "revision_before_contract"),
            (["future_unknown_revision"], "unknown_revision"),
        )
        for revisions, reason in cases:
            result = await startup.check_conversations_view_contract(
                _ContractConnection(revisions=revisions)
            )
            assert result["status"] == "unhealthy"
            assert f"migration_state_invalid: {reason}:" in result["reason"]

    import asyncio

    asyncio.run(scenario())


def test_view_contract_accepts_current_head_and_validates_schema_qualified_view():
    async def scenario():
        conn = _ContractConnection(revisions=[startup.VIEW_CONTRACT_MIGRATION])
        result = await startup.check_conversations_view_contract(conn)
        assert result["status"] == "healthy"
        sql = "\n".join(statement for statement, _ in conn.calls)
        assert '"tenant_test"."v_conversations_with_deleted"' in sql

    asyncio.run(scenario())


def test_view_contract_rejects_column_mismatch_and_dependency_failure():
    async def scenario():
        columns = await startup.check_conversations_view_contract(
            _ContractConnection(columns_ok=False)
        )
        assert columns["status"] == "unhealthy"
        assert columns["reason"] == "view_missing_or_columns_mismatch"

        dependency = await startup.check_conversations_view_contract(
            _ContractConnection(dependency_error=RuntimeError("broken dependency"))
        )
        assert dependency["status"] == "unhealthy"
        assert dependency["reason"].startswith("dependency_check_failed:")

    import asyncio

    asyncio.run(scenario())
