import asyncio

import pytest

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


def test_initial_only_bootstrap_defers_empty_database_to_alembic(monkeypatch):
    conn = _FakeConn()
    calls = {"baseline": 0, "compat": 0, "views": 0}

    async def fake_has_alembic_version(_conn):
        return False

    async def fake_existing_tables(_conn):
        return set()

    async def fake_create_legacy_baseline(_conn):
        calls["baseline"] += 1

    async def fake_ensure_compat_columns(_conn):
        calls["compat"] += 1

    async def fake_ensure_views(_conn):
        calls["views"] += 1

    monkeypatch.setattr(bootstrap_db, "_has_alembic_version", fake_has_alembic_version)
    monkeypatch.setattr(bootstrap_db, "_get_existing_public_tables", fake_existing_tables)
    monkeypatch.setattr(bootstrap_db, "_create_legacy_baseline", fake_create_legacy_baseline)
    monkeypatch.setattr(bootstrap_db, "_ensure_compat_columns", fake_ensure_compat_columns)
    monkeypatch.setattr(bootstrap_db, "_ensure_views", fake_ensure_views)

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
    assert calls == {"baseline": 1, "compat": 0, "views": 0}
    assert not any("INSERT INTO alembic_version" in statement for statement in conn.executed)


def test_initial_bootstrap_refuses_non_empty_database_without_version(monkeypatch):
    async def fake_has_alembic_version(_conn):
        return False

    async def fake_existing_tables(_conn):
        return {"sys_users"}

    monkeypatch.setattr(bootstrap_db, "_has_alembic_version", fake_has_alembic_version)
    monkeypatch.setattr(bootstrap_db, "_get_existing_public_tables", fake_existing_tables)

    class FakeEngine:
        def begin(self):
            return self

        async def __aenter__(self):
            return object()

        async def __aexit__(self, exc_type, exc, tb):
            return None

    monkeypatch.setattr(bootstrap_db, "engine", FakeEngine())

    with pytest.raises(RuntimeError, match="public schema already has tables"):
        asyncio.run(bootstrap_db.main(initial_only=True))


def test_post_migration_bootstrap_refuses_unmigrated_empty_database(monkeypatch):
    async def fake_has_alembic_version(_conn):
        return False

    async def fake_existing_tables(_conn):
        return set()

    monkeypatch.setattr(bootstrap_db, "_has_alembic_version", fake_has_alembic_version)
    monkeypatch.setattr(bootstrap_db, "_get_existing_public_tables", fake_existing_tables)

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
