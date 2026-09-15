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

    async def fake_has_alembic_revision(_conn):
        return True

    monkeypatch.setattr(startup, "_current_schema", lambda _conn: _async_value("tenant_test"))
    monkeypatch.setattr(startup, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(startup, "_has_alembic_revision", fake_has_alembic_revision)

    ensure_views_called = False

    async def fake_ensure_views(_conn):
        nonlocal ensure_views_called
        ensure_views_called = True

    monkeypatch.setattr(startup, "_ensure_views", fake_ensure_views)

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
    assert ensure_views_called


def test_init_database_runs_alembic_for_empty_schema(monkeypatch):
    conn = _RunSyncRecorder()
    monkeypatch.setattr(startup.settings, "DEBUG", True)
    monkeypatch.setattr(startup.settings, "AUTO_CREATE_TABLES", False)

    async def fake_existing_tables(_conn, _schema):
        return set()

    async def fake_has_alembic_revision(_conn):
        return False

    monkeypatch.setattr(startup, "_current_schema", lambda _conn: _async_value("tenant_test"))
    monkeypatch.setattr(startup, "_get_existing_schema_tables", fake_existing_tables)
    monkeypatch.setattr(startup, "_has_alembic_revision", fake_has_alembic_revision)

    calls = SimpleNamespace(views=0, upgrade=0)

    async def fake_ensure_views(_conn):
        calls.views += 1

    async def fake_upgrade_database_to_head():
        calls.upgrade += 1

    monkeypatch.setattr(startup, "_ensure_views", fake_ensure_views)
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
    assert calls.views == 1
    assert calls.upgrade == 1

async def _async_value(value):
    return value



class _ScalarRows:
    def __init__(self, scalar=None, rows=()):
        self.scalar = scalar
        self.rows = list(rows)

    def scalar_one_or_none(self):
        return self.scalar

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
        if "to_regclass('alembic_version')" in sql:
            return _ScalarRows(scalar="public.alembic_version")
        if "SELECT version_num" in sql:
            return _ScalarRows(scalar="head")
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
