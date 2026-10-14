"""Opt-in real PostgreSQL regressions for legacy 0004 and forward f1.

Set only ``LEGACY_CONVERSATIONS_VIEW_TEST_DATABASE_URL`` to opt in. It must
explicitly name an asyncpg loopback endpoint, a non-5432/5433 port and a
test/testing/ci-named disposable database, using its synthetic superuser.
Run through a reviewed external bootstrap with ``--noconftest``, plugin
autoload disabled and dotenv/settings imports blocked before collection.
No app, Alembic env.py, project settings, Docker or default DB is loaded here.

Each case owns a schema/NOLOGIN roles, runs actual upgrade() in one real
Alembic transaction, reads catalog/data/permissions and finally removes its
resources. This is revision-level evidence, not a full migration-chain or
production rehearsal. Missing opt-in is a skip, never proof.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import sys
from types import ModuleType
import uuid

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import event, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool


URL_ENV = "LEGACY_CONVERSATIONS_VIEW_TEST_DATABASE_URL"
VERSIONS = Path(__file__).resolve().parents[2] / "alembic" / "versions"
LEGACY_PATH = VERSIONS / "20260211_0004_move_startup_ddl_to_migrations.py"
FORWARD_PATH = VERSIONS / "f1a2b3c4d5e6_rebuild_conversations_with_deleted_view.py"
VIEW = "v_conversations_with_deleted"
DEPENDENT = "legacy_view_dependent"
COMMENT = "legacy owner/ACL sentinel: 老视图 'quoted' comment"
EXPECTED_COLUMNS = (
    "id", "user_id", "display_user_name", "agent_id", "display_agent_name",
    "session_id", "message_type", "content", "response_time_ms", "created_at",
    "is_archived", "archived_at", "is_user_deleted", "is_agent_deleted",
)
# Independent schema/oracle: never extracted from migration SQL or helpers.
SOURCE_COLUMNS = {
    "znt_conversations": (
        ("id", "INTEGER"), ("user_id", "INTEGER"), ("user_name", "TEXT"),
        ("agent_id", "INTEGER"), ("agent_name", "TEXT"), ("session_id", "TEXT"),
        ("message_type", "TEXT"), ("content", "TEXT"),
        ("response_time_ms", "INTEGER"), ("created_at", "TIMESTAMPTZ"),
        ("is_archived", "BOOLEAN"), ("archived_at", "TIMESTAMPTZ"),
    ),
    "sys_users": (("id", "INTEGER"), ("full_name", "TEXT"), ("is_deleted", "BOOLEAN")),
    "znt_agents": (("id", "INTEGER"), ("name", "TEXT"), ("is_deleted", "BOOLEAN")),
}
REQUIRED_COLUMNS = tuple(
    (table, column) for table, columns in SOURCE_COLUMNS.items() for column, _ in columns
)
CREATED = datetime(2026, 10, 14, tzinfo=timezone.utc)
ARCHIVED = datetime(2026, 10, 14, 1, tzinfo=timezone.utc)
CONVERSATIONS = (
    (1, 7, None, 9, None, "session-live", "question", "live source", 10, CREATED, False, None),
    (2, 8, "快照用户", 10, "快照智能体", "session-deleted", "answer", "deleted source", 20, CREATED, True, ARCHIVED),
    (3, 99, None, 99, None, "session-missing", "question", "missing source", 30, CREATED, False, None),
)
EXPECTED_ROWS = (
    (1, 7, "目录用户", 9, "目录智能体", "session-live", "question", "live source", 10, CREATED, False, None, False, False),
    (2, 8, "快照用户", 10, "快照智能体", "session-deleted", "answer", "deleted source", 20, CREATED, True, ARCHIVED, True, True),
    (3, 99, "未知用户", 99, "未知智能体", "session-missing", "question", "missing source", 30, CREATED, False, None, True, True),
)
_RESOURCE_RE = re.compile(r"^lcvm_(?:owner_|reader_|delegate_)?[0-9a-f]{32}$")
UNSUPPORTED_PROPERTIES = {
    "security_barrier": ("ALTER VIEW {view} SET (security_barrier=true)",),
    "security_invoker": ("ALTER VIEW {view} SET (security_invoker=true)",),
    "column_acl": ("GRANT SELECT (id) ON TABLE {view} TO {delegate} WITH GRANT OPTION",),
    "column_comment": ("COMMENT ON COLUMN {view}.id IS 'column metadata sentinel'",),
    "user_trigger": (
        "CREATE FUNCTION view_trigger() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'",
        "CREATE TRIGGER view_trigger INSTEAD OF UPDATE ON {view} "
        "FOR EACH ROW EXECUTE FUNCTION view_trigger()",
    ),
    "custom_rule": ("CREATE RULE view_update AS ON UPDATE TO {view} DO INSTEAD NOTHING",),
}


def _quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


@pytest.fixture(scope="session")
def pg_url(request: pytest.FixtureRequest) -> URL:
    value = os.environ.get(URL_ENV, "").strip()
    if not value:
        pytest.skip(f"real PostgreSQL not configured: set {URL_ENV}")
    try:
        parsed = make_url(value)
        port = parsed.port
    except Exception:
        # Never echo a possibly credential-bearing input in diagnostics.
        pytest.fail(f"{URL_ENV} is not a valid explicit PostgreSQL URL", pytrace=False)
    if (
        parsed.drivername != "postgresql+asyncpg"
        or parsed.host not in {"127.0.0.1", "localhost", "::1"}
        or port is None or not 1 <= port <= 65535 or port in {5432, 5433}
        or not parsed.username
        or not re.search(r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I)
        or parsed.query
    ):
        pytest.fail(
            f"{URL_ENV} requires asyncpg, explicit loopback/port/user, a test-named "
            "database and no query overrides; ports 5432/5433 are protected",
            pytrace=False,
        )
    if not request.config.getoption("noconftest", default=False):
        pytest.fail("use a reviewed bootstrap with --noconftest", pytrace=False)
    if os.environ.get("PYTEST_DISABLE_PLUGIN_AUTOLOAD") != "1":
        pytest.fail("disable pytest plugin autoload before collection", pytrace=False)
    # Pin localhost rather than permitting DNS to choose another endpoint.
    # Explicit user/password prevent asyncpg's default credential fallback.
    return parsed.set(
        host="127.0.0.1" if parsed.host == "localhost" else parsed.host,
        password=parsed.password or "",
    )


@dataclass(frozen=True)
class Database:
    engine: AsyncEngine
    schema: str
    owner: str
    reader: str
    delegate: str

    def qualified(self, relation: str) -> str:
        return f"{_quote(self.schema)}.{_quote(relation)}"


def _engine(url: URL, schema: str, application: str) -> AsyncEngine:
    return create_async_engine(
        url,
        poolclass=NullPool,
        connect_args={
            "host": url.host, "port": url.port, "user": url.username,
            "password": url.password or "", "database": url.database,
            "timeout": 5,
            "ssl": False,
            "server_settings": {
                "search_path": schema,
                "application_name": application,
                "statement_timeout": "10000",
                "lock_timeout": "5000",
            },
        },
    )


@asynccontextmanager
async def _database(url: URL, relation: str | None = None):
    token = uuid.uuid4().hex
    schema = f"lcvm_{token}"
    roles = tuple(f"lcvm_{label}_{token}" for label in ("owner", "reader", "delegate"))
    assert all(_RESOURCE_RE.fullmatch(name) for name in (schema, *roles))
    admin = _engine(url, "pg_catalog", schema)
    scoped = None
    schema_oid = None
    role_oids = {}
    committed = False
    try:
        async with admin.begin() as connection:
            identity = (await connection.execute(text(
                "SELECT current_database(), current_user, rolsuper "
                "FROM pg_catalog.pg_roles WHERE rolname = current_user"
            ))).one()
            assert identity[0] == url.database, "connected database differs from explicit URL"
            assert identity[2], "dedicated synthetic superuser required for role/owner proofs"
            assert identity[1] not in roles
            await connection.execute(text(f"CREATE SCHEMA {_quote(schema)}"))
            schema_oid = await connection.scalar(text(
                "SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = :name"
            ), {"name": schema})
            for role in roles:
                await connection.execute(text(
                    f"CREATE ROLE {_quote(role)} NOLOGIN NOSUPERUSER "
                    "NOCREATEDB NOCREATEROLE NOINHERIT"
                ))
                role_oids[role] = await connection.scalar(text(
                    "SELECT oid FROM pg_catalog.pg_roles WHERE rolname = :name"
                ), {"name": role})
                await connection.execute(text(
                    f"GRANT USAGE ON SCHEMA {_quote(schema)} TO {_quote(role)}"
                ))
            await connection.execute(text(
                f"GRANT CREATE ON SCHEMA {_quote(schema)} TO {_quote(roles[0])}"
            ))
        committed = True
        scoped = _engine(url, schema, schema)
        database = Database(scoped, schema, *roles)
        async with scoped.begin() as connection:
            assert await connection.scalar(text("SELECT current_schema()")) == schema
            await connection.execute(text(
                "CREATE TABLE alembic_version (version_num VARCHAR(64) PRIMARY KEY)"
            ))
            await connection.execute(text(
                "INSERT INTO alembic_version VALUES ('20260211_0003')"
            ))
        await _sources(database)
        if relation is not None:
            await _old_relation(database, relation)
        yield database
    finally:
        try:
            if scoped is not None:
                await scoped.dispose()
            if committed:
                async with admin.begin() as connection:
                    live_oid = await connection.scalar(text(
                        "SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = :name"
                    ), {"name": schema})
                    assert live_oid in {None, schema_oid}, "refuse cleanup of replaced schema"
                    # CASCADE is confined to this unique synthetic namespace;
                    # no DROP OWNED/ALTER DATABASE/default search_path is used.
                    await connection.execute(text(f"DROP SCHEMA IF EXISTS {_quote(schema)} CASCADE"))
                    for role in reversed(roles):
                        live_role_oid = await connection.scalar(text(
                            "SELECT oid FROM pg_catalog.pg_roles WHERE rolname = :name"
                        ), {"name": role})
                        assert live_role_oid in {None, role_oids[role]}, "refuse cleanup of replaced role"
                        await connection.execute(text(f"DROP ROLE IF EXISTS {_quote(role)}"))
                    assert await connection.scalar(text(
                        "SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname = :name"
                    ), {"name": schema}) == 0
                    for role in roles:
                        assert await connection.scalar(text(
                            "SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname = :name"
                        ), {"name": role}) == 0
        finally:
            await admin.dispose()


@contextmanager
def _migration(path: Path):
    name = f"_lcvm_revision_{uuid.uuid4().hex}"
    module = ModuleType(name)
    module.__file__ = str(path)
    sys.modules[name] = module  # dataclasses requires a registered module.
    try:
        # Execute the whole current revision, without rewriting SQL or making
        # repo __pycache__ files. No source-string assertion supplies a result.
        exec(compile(path.read_bytes(), str(path), "exec"), module.__dict__)
        yield module
    finally:
        del sys.modules[name]


async def _upgrade(database: Database, path: Path) -> None:
    def invoke(connection):
        with _migration(path) as revision:
            with Operations.context(MigrationContext.configure(connection)):
                revision.upgrade()
            # Like Alembic, advance the version only after upgrade returns,
            # in the same real transaction. No migration env.py is imported.
            result = connection.execute(text(
                "UPDATE alembic_version SET version_num = :revision"
            ), {"revision": revision.revision})
            assert result.rowcount == 1

    async with database.engine.begin() as connection:
        await connection.run_sync(invoke)


async def _version(database: Database) -> str:
    async with database.engine.connect() as connection:
        return (await connection.execute(text("SELECT version_num FROM alembic_version"))).scalar_one()


async def _forward_parent(database: Database) -> None:
    # The synthetic tables represent columns supplied by the intervening
    # revisions. This intentionally does not claim to execute that whole chain.
    async with database.engine.begin() as connection:
        await connection.execute(text(
            "UPDATE alembic_version SET version_num = '2de7995a8f24'"
        ))


async def _sources(database: Database) -> None:
    seed_rows = {
        "znt_conversations": CONVERSATIONS,
        "sys_users": ((7, "目录用户", False), (8, "已删目录用户", True)),
        "znt_agents": ((9, "目录智能体", False), (10, "已删目录智能体", True)),
    }
    async with database.engine.begin() as connection:
        for table, columns in SOURCE_COLUMNS.items():
            definitions = ", ".join(f"{_quote(name)} {sql_type}" for name, sql_type in columns)
            await connection.execute(text(f"CREATE TABLE {_quote(table)} ({definitions})"))
            names = [name for name, _ in columns]
            statement = text(
                f"INSERT INTO {_quote(table)} ({', '.join(map(_quote, names))}) "
                f"VALUES ({', '.join(':' + name for name in names)})"
            )
            await connection.execute(statement, [dict(zip(names, row)) for row in seed_rows[table]])
            await connection.execute(text(
                f"GRANT SELECT ON TABLE {_quote(table)} TO {_quote(database.owner)}"
            ))


async def _source_snapshot(database: Database) -> dict:
    """Independent base-table rows, excluding 0004's unrelated description DDL."""
    result = {}
    async with database.engine.connect() as connection:
        for table, columns in SOURCE_COLUMNS.items():
            present = set((await connection.execute(text(
                "SELECT a.attname FROM pg_catalog.pg_attribute a "
                "JOIN pg_catalog.pg_class c ON c.oid = a.attrelid "
                "JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = :schema AND c.relname = :table "
                "AND a.attnum > 0 AND NOT a.attisdropped"
            ), {"schema": database.schema, "table": table})).scalars())
            names = tuple(name for name, _ in columns if name in present)
            projection = ", ".join(map(_quote, names))
            rows = await connection.execute(text(
                f"SELECT {projection} FROM {database.qualified(table)} ORDER BY {projection}"
            ))
            result[table] = (names, tuple(tuple(row) for row in rows))
        if await connection.scalar(text(
            "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_class c "
            "JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = :schema AND c.relname = 'legacy_view_source')"
        ), {"schema": database.schema}):
            rows = await connection.execute(text(
                f"SELECT key, payload FROM {database.qualified('legacy_view_source')} ORDER BY key"
            ))
            result["legacy_view_source"] = (("key", "payload"), tuple(tuple(row) for row in rows))
    return result


async def _rows(database: Database, relation: str, role: str | None = None) -> tuple:
    async with database.engine.begin() as connection:
        if role is not None:
            await connection.execute(text(f"SET LOCAL ROLE {_quote(role)}"))
            assert await connection.scalar(text("SELECT current_user")) == role
        rows = await connection.execute(text(
            f"SELECT * FROM {database.qualified(relation)} ORDER BY 1, 2"
        ))
        return tuple(tuple(row) for row in rows)


async def _snapshot(database: Database, relation: str = VIEW) -> dict | None:
    async with database.engine.connect() as connection:
        row = (await connection.execute(text(
            "SELECT c.oid, c.relkind::text AS relkind, pg_catalog.pg_get_userbyid(c.relowner) AS owner, "
            "c.relacl::text AS raw_acl, c.reloptions, "
            "pg_catalog.obj_description(c.oid, 'pg_class') AS comment, "
            "CASE WHEN c.relkind IN ('v', 'm') THEN pg_catalog.pg_get_viewdef(c.oid, true) "
            "END AS definition FROM pg_catalog.pg_class c "
            "JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = :schema AND c.relname = :name"
        ), {"schema": database.schema, "name": relation})).mappings().one_or_none()
        if row is None:
            return None
        snapshot = dict(row)
        snapshot["attributes"] = tuple(tuple(attribute) for attribute in (await connection.execute(text(
            "SELECT attname, attacl::text, pg_catalog.col_description(attrelid, attnum) "
            "FROM pg_catalog.pg_attribute WHERE attrelid = :oid "
            "AND attnum > 0 AND NOT attisdropped ORDER BY attnum"
        ), {"oid": row["oid"]})))
        snapshot["columns"] = tuple(attribute[0] for attribute in snapshot["attributes"])
        snapshot["triggers"] = tuple(tuple(trigger) for trigger in (await connection.execute(text(
            "SELECT oid, tgname, pg_catalog.pg_get_triggerdef(oid, true) "
            "FROM pg_catalog.pg_trigger WHERE tgrelid = :oid AND NOT tgisinternal ORDER BY oid"
        ), {"oid": row["oid"]})))
        snapshot["rules"] = tuple(tuple(rule) for rule in (await connection.execute(text(
            "SELECT oid, rulename, pg_catalog.pg_get_ruledef(oid, true) "
            "FROM pg_catalog.pg_rewrite WHERE ev_class = :oid AND rulename <> '_RETURN' ORDER BY oid"
        ), {"oid": row["oid"]})))
        snapshot["acl"] = tuple(tuple(entry) for entry in (await connection.execute(text(
            "SELECT pg_catalog.pg_get_userbyid(acl.grantor), "
            "CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(acl.grantee) END, "
            "acl.privilege_type, acl.is_grantable "
            "FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) acl "
            "WHERE c.oid = :oid ORDER BY 1, 2, 3, 4"
        ), {"oid": row["oid"]})))
    snapshot["rows"] = await _rows(database, relation)
    return snapshot


async def _decorate(database: Database, kind: str) -> None:
    async with database.engine.begin() as connection:
        await connection.execute(text(
            f"ALTER {kind} {database.qualified(VIEW)} OWNER TO {_quote(database.owner)}"
        ))
        await connection.execute(text(f"SET LOCAL ROLE {_quote(database.owner)}"))
        await connection.execute(text(
            f"GRANT SELECT ON TABLE {database.qualified(VIEW)} "
            f"TO {_quote(database.reader)} WITH GRANT OPTION"
        ))
        await connection.execute(text(
            f"GRANT UPDATE ON TABLE {database.qualified(VIEW)} TO {_quote(database.reader)}"
        ))
        literal = await connection.scalar(text("SELECT pg_catalog.quote_literal(:value)"), {"value": COMMENT})
        await connection.execute(text(f"COMMENT ON {kind} {database.qualified(VIEW)} IS {literal}"))


async def _old_relation(database: Database, kind: str = "VIEW") -> None:
    """A genuinely different old projection, independent of all 18 columns."""
    assert kind in {"VIEW", "TABLE", "MATERIALIZED VIEW"}
    async with database.engine.begin() as connection:
        await connection.execute(text("CREATE TABLE legacy_view_source (key INTEGER, payload TEXT)"))
        await connection.execute(text(
            "INSERT INTO legacy_view_source VALUES (41, 'old-row-A'), (42, 'old-row-B')"
        ))
        await connection.execute(text(
            f"GRANT SELECT ON TABLE legacy_view_source TO {_quote(database.owner)}"
        ))
        await connection.execute(text(
            f"CREATE {kind} {database.qualified(VIEW)} AS "
            "SELECT payload AS legacy_payload, key AS legacy_key FROM legacy_view_source"
        ))
    await _decorate(database, kind)


def _sqlstate(error: BaseException) -> str | None:
    seen = set()
    current = error
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        value = getattr(current, "sqlstate", None) or getattr(current, "pgcode", None)
        if value:
            return value
        current = getattr(current, "orig", None) or current.__cause__ or current.__context__
    return None


async def _access(database: Database, expected_rows: tuple) -> None:
    """Read as NOLOGIN roles and actually exercise SELECT's grant option."""
    before = await _snapshot(database)
    assert before is not None
    assert before["owner"] == database.owner and before["comment"] == COMMENT
    assert any(
        grantee == database.reader and privilege == "SELECT" and grantable
        for _, grantee, privilege, grantable in before["acl"]
    )
    for role in (database.owner, database.reader):
        assert await _rows(database, VIEW, role) == expected_rows
    async with database.engine.begin() as connection:
        privileges = (await connection.execute(text(
            "SELECT has_table_privilege(:reader, :view, 'SELECT'), "
            "has_table_privilege(:reader, :view, 'SELECT WITH GRANT OPTION'), "
            "has_table_privilege(:reader, :view, 'UPDATE'), "
            "has_table_privilege(:reader, :view, 'UPDATE WITH GRANT OPTION')"
        ), {"reader": database.reader, "view": database.qualified(VIEW)})).one()
        assert tuple(privileges) == (True, True, True, False)
    with pytest.raises(DBAPIError) as denied:
        await _rows(database, VIEW, database.delegate)
    assert _sqlstate(denied.value) == "42501"
    try:
        async with database.engine.begin() as connection:
            await connection.execute(text(f"SET LOCAL ROLE {_quote(database.reader)}"))
            await connection.execute(text(
                f"GRANT SELECT ON TABLE {database.qualified(VIEW)} TO {_quote(database.delegate)}"
            ))
        assert await _rows(database, VIEW, database.delegate) == expected_rows
    finally:
        async with database.engine.begin() as connection:
            await connection.execute(text(f"SET LOCAL ROLE {_quote(database.reader)}"))
            await connection.execute(text(
                f"REVOKE SELECT ON TABLE {database.qualified(VIEW)} FROM {_quote(database.delegate)}"
            ))
    assert await _snapshot(database) == before


async def _preserved(database, before, sources, revision):
    assert await _snapshot(database) == before
    assert await _source_snapshot(database) == sources
    assert await _version(database) == revision
    if before is not None:
        await _access(database, before["rows"])


@contextmanager
def _view_ddl(database):
    statements = []
    def record(connection, cursor, statement, parameters, context, executemany):
        if re.match(r"\s*(DROP|CREATE)\s+VIEW\b", statement, re.I):
            statements.append(statement)
    event.listen(database.engine.sync_engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(database.engine.sync_engine, "before_cursor_execute", record)


async def _column_reader(database):
    async with database.engine.begin() as connection:
        await connection.execute(text(f"SET LOCAL ROLE {_quote(database.delegate)}"))
        assert await connection.scalar(text(
            "SELECT has_column_privilege(current_user, :view, 'id', 'SELECT WITH GRANT OPTION')"
        ), {"view": database.qualified(VIEW)})
        rows = await connection.execute(text(f"SELECT id FROM {database.qualified(VIEW)} ORDER BY id"))
        assert tuple(tuple(row) for row in rows) == ((41,), (42,))


def test_existing_view_keeps_identity_metadata_definition_data_and_permissions(pg_url):
    async def scenario():
        async with _database(pg_url, "VIEW") as database:
            before = await _snapshot(database)
            assert before is not None and before["columns"] == ("legacy_payload", "legacy_key")
            assert before["rows"] == (("old-row-A", 41), ("old-row-B", 42))
            await _access(database, before["rows"])
            source_before = await _source_snapshot(database)
            await _upgrade(database, LEGACY_PATH)
            await _preserved(database, before, source_before, "20260211_0004")
    asyncio.run(scenario())


@pytest.mark.parametrize("missing", REQUIRED_COLUMNS, ids=lambda item: ".".join(item))
@pytest.mark.parametrize("existing", (False, True), ids=("no-view", "existing-view"))
def test_each_missing_projection_column_skips_creation_or_keeps_existing_view(pg_url, missing, existing):
    async def scenario():
        async with _database(pg_url, "VIEW" if existing else None) as database:
            table, column = missing
            async with database.engine.begin() as connection:
                await connection.execute(text(
                    f"ALTER TABLE {database.qualified(table)} DROP COLUMN {_quote(column)}"
                ))
            before = await _snapshot(database)
            source_before = await _source_snapshot(database)
            assert column not in source_before[table][0]
            if missing == ("znt_conversations", "archived_at"):
                assert "is_archived" in source_before[table][0]
            assert (before is not None) == existing
            await _upgrade(database, LEGACY_PATH)
            await _preserved(database, before, source_before, "20260211_0004")
    asyncio.run(scenario())


def test_complete_sources_create_exactly_fourteen_columns_and_expected_rows(pg_url):
    async def scenario():
        async with _database(pg_url) as database:
            source_before = await _source_snapshot(database)
            assert await _snapshot(database) is None
            await _upgrade(database, LEGACY_PATH)
            after = await _snapshot(database)
            assert after is not None and after["relkind"] == "v"
            assert after["columns"] == EXPECTED_COLUMNS
            assert after["rows"] == EXPECTED_ROWS
            assert await _source_snapshot(database) == source_before
            assert await _version(database) == "20260211_0004"
            # Repeat the actual historical revision to protect the newly
            # created object's OID too, rather than merely repeat a SELECT.
            await _upgrade(database, LEGACY_PATH)
            assert await _snapshot(database) == after
    asyncio.run(scenario())


def test_legacy_upgrade_preserves_dependent_view_and_its_catalog_identity(pg_url):
    async def scenario():
        async with _database(pg_url, "VIEW") as database:
            async with database.engine.begin() as connection:
                await connection.execute(text(
                    f"CREATE VIEW {database.qualified(DEPENDENT)} AS "
                    f"SELECT legacy_key, legacy_payload FROM {database.qualified(VIEW)}"
                ))
            before = await _snapshot(database)
            dependent_before = await _snapshot(database, DEPENDENT)
            source_before = await _source_snapshot(database)
            await _upgrade(database, LEGACY_PATH)
            assert await _snapshot(database, DEPENDENT) == dependent_before
            await _preserved(database, before, source_before, "20260211_0004")
    asyncio.run(scenario())


@pytest.mark.parametrize("dependent", (False, True), ids=("metadata-restored", "dependency-atomic-failure"))
def test_forward_after_legacy_preserves_metadata_or_fails_atomically(pg_url, dependent):
    async def scenario():
        async with _database(pg_url, "VIEW") as database:
            # Model the late archive column: 0004 must preserve this old view
            # while the column is absent; f1 runs only after it arrives.
            async with database.engine.begin() as connection:
                await connection.execute(text("ALTER TABLE znt_conversations DROP COLUMN archived_at"))
            original = await _snapshot(database)
            partial_sources = await _source_snapshot(database)
            await _upgrade(database, LEGACY_PATH)
            assert await _snapshot(database) == original
            assert await _source_snapshot(database) == partial_sources
            async with database.engine.begin() as connection:
                await connection.execute(text("ALTER TABLE znt_conversations ADD COLUMN archived_at TIMESTAMPTZ"))
                await connection.execute(text(
                    "UPDATE znt_conversations SET archived_at = :archived WHERE id = 2"
                ), {"archived": ARCHIVED})
            await _forward_parent(database)
            if dependent:
                async with database.engine.begin() as connection:
                    await connection.execute(text(
                        f"CREATE VIEW {database.qualified(DEPENDENT)} AS "
                        f"SELECT legacy_key, legacy_payload FROM {database.qualified(VIEW)}"
                    ))
            before = await _snapshot(database)
            dependent_before = await _snapshot(database, DEPENDENT)
            source_before = await _source_snapshot(database)
            if dependent:
                with pytest.raises(DBAPIError) as blocked:
                    await _upgrade(database, FORWARD_PATH)
                assert _sqlstate(blocked.value) == "2BP01"  # dependent_objects_still_exist
                assert await _snapshot(database, DEPENDENT) == dependent_before
                await _preserved(database, before, source_before, "2de7995a8f24")
            else:
                await _upgrade(database, FORWARD_PATH)
                after = await _snapshot(database)
                assert after is not None and after["oid"] != before["oid"]
                assert after["columns"] == EXPECTED_COLUMNS and after["rows"] == EXPECTED_ROWS
                assert after["owner"] == before["owner"] == database.owner
                assert after["comment"] == before["comment"] == COMMENT
                # f1 explicitly preserves effective ACL, not historic grantor
                # provenance; 0004 above compares the complete raw ACL too.
                assert sorted(entry[1:] for entry in after["acl"]) == sorted(entry[1:] for entry in before["acl"])
                assert await _version(database) == "f1a2b3c4d5e6"
                await _access(database, EXPECTED_ROWS)
            assert await _source_snapshot(database) == source_before
    asyncio.run(scenario())


@pytest.mark.parametrize("kind, relkind", (("TABLE", "r"), ("MATERIALIZED VIEW", "m")))
def test_existing_non_view_relation_survives_legacy_and_forward_failure(pg_url, kind, relkind):
    async def scenario():
        async with _database(pg_url, kind) as database:
            before = await _snapshot(database)
            assert before is not None and before["relkind"] == relkind
            source_before = await _source_snapshot(database)
            await _upgrade(database, LEGACY_PATH)
            assert await _snapshot(database) == before
            assert await _version(database) == "20260211_0004"
            await _access(database, before["rows"])
            await _forward_parent(database)
            with pytest.raises(DBAPIError) as blocked:
                await _upgrade(database, FORWARD_PATH)
            assert _sqlstate(blocked.value) == "42809"  # wrong_object_type
            await _preserved(database, before, source_before, "2de7995a8f24")
    asyncio.run(scenario())


@pytest.mark.parametrize("property_name", UNSUPPORTED_PROPERTIES)
def test_unsupported_view_property_is_preserved_by_legacy_and_forward_refuses_before_drop(pg_url, property_name):
    async def scenario():
        async with _database(pg_url, "VIEW") as database:
            view = database.qualified(VIEW)
            async with database.engine.begin() as connection:
                await connection.execute(text(f"ALTER VIEW {view} RENAME COLUMN legacy_key TO id"))
                # Invoker views require each reading role to have source rights.
                await connection.execute(text(
                    f"GRANT SELECT ON legacy_view_source TO {_quote(database.reader)}, {_quote(database.delegate)}"
                ))
                for sql in UNSUPPORTED_PROPERTIES[property_name]:
                    await connection.execute(text(sql.format(view=view, delegate=_quote(database.delegate))))
            before = await _snapshot(database)
            present = {
                "security_barrier": before["reloptions"] == ["security_barrier=true"],
                "security_invoker": before["reloptions"] == ["security_invoker=true"],
                "column_acl": any(name == "id" and acl for name, acl, _ in before["attributes"]),
                "column_comment": any(comment == "column metadata sentinel" for _, _, comment in before["attributes"]),
                "user_trigger": bool(before["triggers"]), "custom_rule": bool(before["rules"]),
            }
            assert present[property_name] and sum(map(bool, present.values())) == 1
            sources = await _source_snapshot(database)
            if property_name == "column_acl":
                await _column_reader(database)
            await _upgrade(database, LEGACY_PATH)
            await _preserved(database, before, sources, "20260211_0004")
            await _forward_parent(database)
            with _view_ddl(database) as statements:
                with pytest.raises(RuntimeError, match="当前 migration 不支持安全恢复"):
                    await _upgrade(database, FORWARD_PATH)
            assert statements == [], "unsupported metadata must be rejected before DROP/CREATE, not merely rolled back"
            await _preserved(database, before, sources, "2de7995a8f24")
            if property_name == "column_acl":
                await _column_reader(database)
    asyncio.run(scenario())
