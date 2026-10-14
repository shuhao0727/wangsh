"""Contracts for ``v_conversations_with_deleted``.

This module deliberately separates three kinds of evidence:

* the current forward Alembic migration owns the view definition;
* the historical migration may contain the old definition, but is not a
  runtime owner;
* startup/bootstrap code must not mutate the view.  Its contract belongs to
  the migration runner plus a read-only readiness check.

The PostgreSQL lifecycle test is opt-in through
``CONVERSATIONS_VIEW_TEST_DATABASE_URL``.  It refuses non-loopback,
non-test-named databases and never falls back to the project's development
connection.
"""
from __future__ import annotations

import ast
import asyncio
import os
import re
import subprocess
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

BACKEND = Path(__file__).resolve().parents[1]
VERSIONS = BACKEND / "alembic" / "versions"
VIEW_NAME = "v_conversations_with_deleted"
VIEW_REVISION = "f1a2b3c4d5e6"
VIEW_PARENT_REVISION = "2de7995a8f24"
HISTORICAL_MIGRATION = VERSIONS / "20260211_0004_move_startup_ddl_to_migrations.py"
FORWARD_MIGRATION = VERSIONS / "f1a2b3c4d5e6_rebuild_conversations_with_deleted_view.py"
RUNTIME_FILES = {
    "startup": BACKEND / "app" / "core" / "startup.py",
    "bootstrap": BACKEND / "scripts" / "bootstrap_db.py",
}

# This is a positional SQL contract.  The services select these columns by
# name, while PostgreSQL also preserves the view's positional column names.
EXPECTED_COLUMNS = [
    "id",
    "user_id",
    "display_user_name",
    "agent_id",
    "display_agent_name",
    "session_id",
    "message_type",
    "content",
    "response_time_ms",
    "created_at",
    "is_archived",
    "archived_at",
    "is_user_deleted",
    "is_agent_deleted",
]

_TEST_DATABASE_RE = re.compile(r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", re.I)
_SCHEMA_RE = re.compile(r"^view_contract_[0-9a-f]{32}$")


def _read(path: Path) -> str:
    assert path.exists(), f"文件不存在：{path}"
    return path.read_text(encoding="utf-8")


def _extract_view_columns(sql: str) -> list[str]:
    """Extract the top-level projection aliases from a CREATE VIEW SQL."""
    match = re.search(r"\bSELECT\b(.*?)\bFROM\b", sql, flags=re.I | re.S)
    if not match:
        raise AssertionError(f"未能从 SQL 中解析出 SELECT ... FROM：\n{sql[:400]}")

    projection = match.group(1)
    parts: list[str] = []
    depth = 0
    buffer: list[str] = []
    for char in projection:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(buffer))
            buffer = []
        else:
            buffer.append(char)
    if "".join(buffer).strip():
        parts.append("".join(buffer))

    columns: list[str] = []
    for part in parts:
        item = part.strip()
        alias = re.search(r"\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\s*$", item, flags=re.I)
        if alias:
            columns.append(alias.group(1))
            continue
        identifier = re.search(r"([A-Za-z_][A-Za-z0-9_]*)\s*$", item)
        if identifier:
            columns.append(identifier.group(1))
    return columns


def _find_view_create_sql(source: str) -> list[str]:
    """Return CREATE VIEW statements for this view, preserving their prefix."""
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+"
        + re.escape(VIEW_NAME)
        + r"\b.*?(?=;|\"\"\"|''')",
        flags=re.I | re.S,
    )
    return [match.group(0).strip() for match in pattern.finditer(source)]


def _string_literals(path: Path) -> list[str]:
    """Return Python string literals without matching comments/doc comments."""
    tree = ast.parse(_read(path), filename=str(path))
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]


def _runtime_view_ddl_literals(path: Path) -> list[str]:
    """Find executable string literals that mutate the target view."""
    ddl = re.compile(
        rf"\b(?:DROP\s+VIEW|CREATE\s+(?:OR\s+REPLACE\s+)?VIEW)\b"
        rf"[^;\n]*\b{re.escape(VIEW_NAME)}\b",
        flags=re.I,
    )
    return [literal.strip() for literal in _string_literals(path) if ddl.search(literal)]


def test_expected_view_contract_has_exactly_fourteen_unique_columns():
    assert len(EXPECTED_COLUMNS) == 14
    assert len(set(EXPECTED_COLUMNS)) == len(EXPECTED_COLUMNS)
    assert EXPECTED_COLUMNS[10:12] == ["is_archived", "archived_at"]
    assert EXPECTED_COLUMNS[-2:] == ["is_user_deleted", "is_agent_deleted"]


def test_forward_migration_is_the_current_view_ddl_owner():
    sqls = _find_view_create_sql(_read(FORWARD_MIGRATION))
    assert len(sqls) == 1, "当前 forward migration 必须只有一处目标视图定义"
    sql = sqls[0]
    assert "OR REPLACE" not in sql.upper()
    assert _extract_view_columns(sql) == EXPECTED_COLUMNS
    assert "public." not in sql.lower(), (
        "目标视图不能硬编码到 public；由有效 search_path/current_schema 决定归属"
    )


def test_historical_view_sql_is_classified_as_history_not_runtime_owner():
    source = _read(HISTORICAL_MIGRATION)
    sqls = _find_view_create_sql(source)
    assert sqls, "历史 migration 应保留可审计的旧视图定义"
    assert _extract_view_columns(sqls[0]) == EXPECTED_COLUMNS
    assert "revision" in source and "down_revision" in source
    assert HISTORICAL_MIGRATION != FORWARD_MIGRATION


@pytest.mark.parametrize("label,path", list(RUNTIME_FILES.items()))
def test_runtime_paths_do_not_execute_target_view_ddl(label: str, path: Path):
    literals = _runtime_view_ddl_literals(path)
    assert not literals, (
        f"{label} 不得拥有 {VIEW_NAME} 的 DROP/CREATE DDL；"
        "目标视图只能由 Alembic forward migration 管理。\n"
        + "\n---\n".join(literals)
    )


def test_runtime_paths_do_not_hide_target_view_ddl_in_non_literal_sql():
    """Guard the runtime files against assembling target DDL from fragments."""
    for label, path in RUNTIME_FILES.items():
        source = _read(path)
        assert not re.search(
            rf"(?:DROP|CREATE(?:\s+OR\s+REPLACE)?)\s+VIEW[^\n;]*"
            rf"{re.escape(VIEW_NAME)}",
            source,
            flags=re.I,
        ), f"{label} 源码仍包含目标视图 DDL 片段"


def test_forward_migration_checks_dependencies_before_destructive_drop():
    source = _read(FORWARD_MIGRATION)
    missing_guard = source.find("missing =")
    drop_view = source.find("DROP VIEW IF EXISTS")
    assert missing_guard >= 0
    assert drop_view > missing_guard
    assert "current_schema()" in source
    assert "DROP VIEW IF EXISTS" in source
    assert "CASCADE" not in source.upper()


def test_migration_downgrade_is_idempotent_and_has_no_cascade():
    source = _read(FORWARD_MIGRATION)
    downgrade = source.split("def downgrade()", 1)[1]
    assert "DROP VIEW IF EXISTS" in downgrade
    assert "CASCADE" not in downgrade.upper()


def _ancestor_revisions(script, head: str) -> set[str]:
    """Return a revision's transitive parents, including the revision itself."""
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


def test_current_head_is_single_and_xbk_revision_remains_its_ancestor():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    script = ScriptDirectory.from_config(config)
    heads = script.get_heads()
    assert len(heads) == 1, f"alembic 存在多个 head: {heads}"

    xbk_id = "20260914_0001_xbk_active_selection_unique"
    xbk = script.get_revision(xbk_id)
    assert xbk is not None
    assert xbk.down_revision == "20260910_0001_auth_authority"
    assert xbk_id in _ancestor_revisions(script, heads[0]), (
        f"XBK revision {xbk_id} 不在当前 head {heads[0]} 的祖先链上"
    )


# ---------------------------------------------------------------------------
# Opt-in real PostgreSQL lifecycle evidence
# ---------------------------------------------------------------------------


def _database_url_for_real_pg() -> tuple[str, object]:
    value = os.environ.get("CONVERSATIONS_VIEW_TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip(
            "blocked: set CONVERSATIONS_VIEW_TEST_DATABASE_URL to a dedicated "
            "loopback test PostgreSQL database"
        )
    parsed = make_url(value)
    if parsed.drivername != "postgresql+asyncpg":
        raise RuntimeError("real view contract test requires postgresql+asyncpg")
    if parsed.host not in {"127.0.0.1", "localhost", "::1"}:
        raise RuntimeError("real view contract test requires a loopback PostgreSQL host")
    if not _TEST_DATABASE_RE.search(parsed.database or ""):
        raise RuntimeError("real view contract test requires a test-named database")
    if parsed.port == 5433:
        raise RuntimeError("refusing the WangSh development PostgreSQL port 5433")
    return value, parsed


def _quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


async def _catalog_columns(engine: AsyncEngine, schema: str) -> list[str]:
    async with engine.connect() as connection:
        result = await connection.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name = :view_name
                ORDER BY ordinal_position
                """
            ),
            {"schema": schema, "view_name": VIEW_NAME},
        )
        return list(result.scalars())


async def _view_snapshot(engine: AsyncEngine, schema: str) -> dict[str, object] | None:
    async with engine.connect() as connection:
        return (
            await connection.execute(
                text(
                    """
                    SELECT c.relowner::regrole::text AS owner,
                           COALESCE(
                               (
                                   SELECT array_agg(
                                       format(
                                           '%s:%s:%s',
                                           COALESCE(grantee_role.rolname, 'PUBLIC'),
                                           acl.privilege_type,
                                           acl.is_grantable
                                       )
                                       ORDER BY acl.grantee,
                                                acl.privilege_type,
                                                acl.is_grantable
                                   )
                                   FROM pg_catalog.aclexplode(c.relacl) AS acl
                                   LEFT JOIN pg_catalog.pg_roles AS grantee_role
                                     ON grantee_role.oid = acl.grantee
                               ),
                               ARRAY[]::text[]
                           ) AS acl,
                           obj_description(c.oid, 'pg_class') AS comment
                    FROM pg_catalog.pg_class AS c
                    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                    WHERE n.nspname = :schema
                      AND c.relname = :view_name
                      AND c.relkind = 'v'
                    """
                ),
                {"schema": schema, "view_name": VIEW_NAME},
            )
        ).mappings().one_or_none()


async def _version(engine: AsyncEngine) -> str:
    async with engine.connect() as connection:
        return str(
            await connection.scalar(text("SELECT version_num FROM alembic_version"))
        )


async def _run_alembic(backend: Path, database_url: str, *arguments: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["DATABASE_URL"] = database_url
    return await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *arguments],
        cwd=backend,
        env=environment,
        text=True,
        capture_output=True,
        timeout=180,
        check=False,
    )


def _assert_alembic_ok(result: subprocess.CompletedProcess[str], action: str) -> None:
    assert result.returncode == 0, (
        f"{action} 失败（returncode={result.returncode}）\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )


@asynccontextmanager
async def _isolated_view_database(database_url: str):
    """Create a disposable schema and base objects in a dedicated test DB."""
    parsed = make_url(database_url)
    schema = f"view_contract_{uuid.uuid4().hex}"
    owner_role = f"view_owner_{uuid.uuid4().hex[:16]}"
    reader_role = f"view_reader_{uuid.uuid4().hex[:16]}"
    assert _SCHEMA_RE.fullmatch(schema)

    admin = create_async_engine(database_url, pool_pre_ping=True)
    scoped: AsyncEngine | None = None
    prior_database_search_path: str | None = None
    database = _quote_identifier(parsed.database or "")
    schema_identifier = _quote_identifier(schema)
    owner_identifier = _quote_identifier(owner_role)
    reader_identifier = _quote_identifier(reader_role)
    try:
        async with admin.begin() as connection:
            await connection.execute(text(f"CREATE SCHEMA {schema_identifier}"))
            await connection.execute(
                text(f"CREATE ROLE {owner_identifier} NOLOGIN")
            )
            await connection.execute(
                text(f"CREATE ROLE {reader_identifier} NOLOGIN")
            )
            prior_database_search_path = await connection.scalar(
                text(
                    """
                    SELECT option
                    FROM (
                        SELECT unnest(setconfig) AS option
                        FROM pg_db_role_setting
                        WHERE setdatabase = (
                            SELECT oid FROM pg_database
                            WHERE datname = current_database()
                        ) AND setrole = 0
                    ) AS settings
                    WHERE option LIKE 'search_path=%'
                    """
                )
            )
            await connection.execute(
                text(
                    f"ALTER DATABASE {database} SET search_path "
                    f"TO {schema_identifier}, public"
                )
            )

        scoped = create_async_engine(
            database_url,
            connect_args={
                "server_settings": {
                    "search_path": f"{schema},public",
                    "application_name": schema,
                    "statement_timeout": "30000",
                    "lock_timeout": "10000",
                }
            },
        )
        async with scoped.begin() as connection:
            current_schema = await connection.scalar(text("SELECT current_schema()"))
            assert current_schema == schema
            assert await connection.scalar(
                text("SELECT to_regclass('public.alembic_version')")
            ) is None
            await connection.execute(
                text(
                    """
                    CREATE TABLE znt_conversations (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER,
                        user_name TEXT,
                        agent_id INTEGER,
                        agent_name TEXT,
                        session_id TEXT,
                        message_type TEXT,
                        content TEXT,
                        response_time_ms INTEGER,
                        created_at TIMESTAMP WITH TIME ZONE,
                        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
                        archived_at TIMESTAMP WITH TIME ZONE
                    )
                    """
                )
            )
            await connection.execute(
                text(
                    """
                    CREATE TABLE sys_users (
                        id INTEGER PRIMARY KEY,
                        full_name TEXT,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                    )
                    """
                )
            )
            await connection.execute(
                text(
                    """
                    CREATE TABLE znt_agents (
                        id INTEGER PRIMARY KEY,
                        name TEXT,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                    )
                    """
                )
            )
            await connection.execute(
                text(
                    """
                    CREATE TABLE alembic_version (
                        version_num VARCHAR(64) NOT NULL PRIMARY KEY
                    )
                    """
                )
            )
            await connection.execute(
                text("INSERT INTO alembic_version(version_num) VALUES (:revision)"),
                {"revision": VIEW_PARENT_REVISION},
            )
            await connection.execute(
                text(
                    """
                    INSERT INTO znt_conversations (
                        id, user_id, user_name, agent_id, agent_name, session_id,
                        message_type, content, response_time_ms,
                        created_at, is_archived, archived_at
                    ) VALUES (
                        1, 7, '测试用户', 9, '测试智能体', 'session-1',
                        'question', 'contract row', 10, CURRENT_TIMESTAMP,
                        FALSE, NULL
                    )
                    """
                )
            )

        yield scoped, schema, owner_role, reader_role
    finally:
        if scoped is not None:
            await scoped.dispose()
        async with admin.begin() as connection:
            if prior_database_search_path is None:
                await connection.execute(text(f"ALTER DATABASE {database} RESET search_path"))
            else:
                previous_value = prior_database_search_path.split("=", 1)[1]
                await connection.execute(
                    text(
                        f"ALTER DATABASE {database} SET search_path TO "
                        f"{previous_value}"
                    )
                )
            # Remove only objects created by this fixture.  The dependency case
            # deliberately leaves a dependent view behind after the failed
            # migration, so cleanup drops it before the target view and schema.
            await connection.execute(
                text(
                    f"DROP VIEW IF EXISTS {schema_identifier}."
                    f"{_quote_identifier('v_conversations_dependent')}"
                )
            )
            await connection.execute(
                text(
                    f"DROP VIEW IF EXISTS {schema_identifier}."
                    f"{_quote_identifier(VIEW_NAME)}"
                )
            )
            for table_name in (
                "alembic_version",
                "znt_conversations",
                "sys_users",
                "znt_agents",
            ):
                await connection.execute(
                    text(
                        f"DROP TABLE IF EXISTS {schema_identifier}."
                        f"{_quote_identifier(table_name)}"
                    )
                )
            await connection.execute(text(f"DROP SCHEMA IF EXISTS {schema_identifier}"))
            await connection.execute(text(f"DROP ROLE IF EXISTS {owner_identifier}"))
            await connection.execute(text(f"DROP ROLE IF EXISTS {reader_identifier}"))
        await admin.dispose()


async def _create_current_view(scoped: AsyncEngine) -> None:
    async with scoped.begin() as connection:
        await connection.execute(
            text(
                """
                CREATE VIEW v_conversations_with_deleted AS
                SELECT
                    c.id,
                    c.user_id,
                    COALESCE(c.user_name, u.full_name, '未知用户') AS display_user_name,
                    c.agent_id,
                    COALESCE(c.agent_name, a.name, '未知智能体') AS display_agent_name,
                    c.session_id,
                    c.message_type,
                    c.content,
                    c.response_time_ms,
                    c.created_at,
                    c.is_archived,
                    c.archived_at,
                    CASE WHEN u.id IS NULL OR u.is_deleted = true
                         THEN true ELSE false END AS is_user_deleted,
                    CASE WHEN a.id IS NULL OR a.is_deleted = true
                         THEN true ELSE false END AS is_agent_deleted
                FROM znt_conversations c
                LEFT JOIN sys_users u ON c.user_id = u.id
                LEFT JOIN znt_agents a ON c.agent_id = a.id
                """
            )
        )


def test_real_postgresql_custom_schema_upgrade_downgrade_upgrade_contract():
    """Rebuild a view while preserving owner, grants and comment."""

    async def scenario() -> None:
        database_url, _ = _database_url_for_real_pg()
        async with _isolated_view_database(database_url) as (
            scoped,
            schema,
            owner_role,
            reader_role,
        ):
            await _create_current_view(scoped)
            schema_identifier = _quote_identifier(schema)
            qualified_view = f"{schema_identifier}.{_quote_identifier(VIEW_NAME)}"
            async with scoped.begin() as connection:
                await connection.execute(
                    text(
                        f"ALTER VIEW {qualified_view} OWNER TO "
                        f"{_quote_identifier(owner_role)}"
                    )
                )
                await connection.execute(
                    text(
                        f"GRANT SELECT ON TABLE {qualified_view} TO "
                        f"{_quote_identifier(reader_role)} WITH GRANT OPTION"
                    )
                )
                await connection.execute(
                    text(
                        f"COMMENT ON VIEW {qualified_view} IS "
                        "'phase1-f-metadata-sentinel'"
                    )
                )

            before = await _view_snapshot(scoped, schema)
            assert before is not None
            assert before["owner"] == owner_role
            assert before["comment"] == "phase1-f-metadata-sentinel"
            assert before["acl"]

            upgraded = await _run_alembic(BACKEND, database_url, "upgrade", "head")
            _assert_alembic_ok(upgraded, "upgrade head with existing metadata")
            assert await _version(scoped) == VIEW_REVISION
            assert await _catalog_columns(scoped, schema) == EXPECTED_COLUMNS
            after = await _view_snapshot(scoped, schema)
            assert after is not None
            assert after["owner"] == before["owner"] == owner_role
            assert after["comment"] == before["comment"]
            assert after["acl"] == before["acl"]

            downgraded = await _run_alembic(BACKEND, database_url, "downgrade", "-1")
            _assert_alembic_ok(downgraded, "downgrade -1")
            assert await _version(scoped) == VIEW_PARENT_REVISION
            assert await _view_snapshot(scoped, schema) is None
            async with scoped.connect() as connection:
                assert await connection.scalar(
                    text("SELECT COUNT(*) FROM znt_conversations")
                ) == 1

            re_upgraded = await _run_alembic(BACKEND, database_url, "upgrade", "head")
            _assert_alembic_ok(re_upgraded, "upgrade head after downgrade -1")
            assert await _version(scoped) == VIEW_REVISION
            assert await _catalog_columns(scoped, schema) == EXPECTED_COLUMNS
            fresh = await _view_snapshot(scoped, schema)
            assert fresh is not None
            assert fresh["comment"] is None
            assert fresh["owner"]

    asyncio.run(scenario())


def test_real_postgresql_dependency_failure_does_not_remove_view():
    """A dependent object must make the non-cascading rebuild fail atomically."""

    async def scenario() -> None:
        database_url, _ = _database_url_for_real_pg()
        async with _isolated_view_database(database_url) as (scoped, schema, _, _):
            await _create_current_view(scoped)
            async with scoped.begin() as connection:
                await connection.execute(
                    text(
                        """
                        CREATE VIEW v_conversations_dependent AS
                        SELECT id FROM v_conversations_with_deleted
                        """
                    )
                )

            failed = await _run_alembic(BACKEND, database_url, "upgrade", "head")
            assert failed.returncode != 0
            combined = f"{failed.stdout}\n{failed.stderr}".lower()
            assert "depend" in combined or "cannot drop view" in combined
            assert await _version(scoped) == VIEW_PARENT_REVISION
            assert await _view_snapshot(scoped, schema) is not None
            async with scoped.connect() as connection:
                assert await connection.scalar(
                    text(
                        """
                        SELECT to_regclass(
                            current_schema() || '.v_conversations_dependent'
                        )
                        """
                    )
                ) is not None

    asyncio.run(scenario())

def test_real_postgresql_insufficient_privilege_fails_fast_without_mutation():
    """A non-owner runner must fail at DROP before changing the view or version."""

    async def scenario() -> None:
        database_url, parsed = _database_url_for_real_pg()
        async with _isolated_view_database(database_url) as (
            scoped,
            schema,
            owner_role,
            reader_role,
        ):
            await _create_current_view(scoped)
            schema_identifier = _quote_identifier(schema)
            qualified_view = f"{schema_identifier}.{_quote_identifier(VIEW_NAME)}"
            version_table = f"{schema_identifier}.{_quote_identifier('alembic_version')}"
            runner_role = f"view_runner_{uuid.uuid4().hex[:16]}"
            runner_password = f"phase1-f-{uuid.uuid4().hex}"
            runner_identifier = _quote_identifier(runner_role)
            runner_created = False
            try:
                async with scoped.begin() as connection:
                    password_literal = await connection.scalar(
                        text("SELECT pg_catalog.quote_literal(:password)"),
                        {"password": runner_password},
                    )
                    await connection.execute(
                        text(
                            f"CREATE ROLE {runner_identifier} LOGIN PASSWORD "
                            f"{password_literal}"
                        )
                    )
                    runner_created = True
                    await connection.execute(
                        text(
                            f"ALTER TABLE {version_table} OWNER TO "
                            f"{runner_identifier}"
                        )
                    )
                    await connection.execute(
                        text(
                            f"GRANT USAGE, CREATE ON SCHEMA {schema_identifier} "
                            f"TO {runner_identifier}"
                        )
                    )
                    await connection.execute(
                        text(
                            f"GRANT SELECT ON TABLE {schema_identifier}."
                            f"{_quote_identifier('znt_conversations')}, "
                            f"{schema_identifier}.{_quote_identifier('sys_users')}, "
                            f"{schema_identifier}.{_quote_identifier('znt_agents')} "
                            f"TO {runner_identifier}"
                        )
                    )
                    await connection.execute(
                        text(
                            f"ALTER VIEW {qualified_view} OWNER TO "
                            f"{_quote_identifier(owner_role)}"
                        )
                    )
                    await connection.execute(
                        text(
                            f"GRANT SELECT ON TABLE {qualified_view} TO "
                            f"{_quote_identifier(reader_role)} WITH GRANT OPTION"
                        )
                    )
                    await connection.execute(
                        text(
                            f"COMMENT ON VIEW {qualified_view} IS "
                            "'phase1-f-permission-sentinel'"
                        )
                    )

                before = await _view_snapshot(scoped, schema)
                assert before is not None
                assert before["owner"] == owner_role
                assert before["comment"] == "phase1-f-permission-sentinel"

                runner_url = parsed.set(
                    username=runner_role,
                    password=runner_password,
                ).render_as_string(hide_password=False)
                failed = await _run_alembic(BACKEND, runner_url, "upgrade", "head")
                assert failed.returncode != 0
                combined = f"{failed.stdout}\n{failed.stderr}".lower()
                assert "must be owner" in combined or "permission denied" in combined

                assert await _version(scoped) == VIEW_PARENT_REVISION
                after = await _view_snapshot(scoped, schema)
                assert after == before
            finally:
                if runner_created:
                    async with scoped.begin() as connection:
                        await connection.execute(
                            text(f"ALTER TABLE {version_table} OWNER TO CURRENT_USER")
                        )
                        await connection.execute(
                            text(
                                f"REVOKE ALL PRIVILEGES ON SCHEMA "
                                f"{schema_identifier} FROM {runner_identifier}"
                            )
                        )
                        for table_name in (
                            "znt_conversations",
                            "sys_users",
                            "znt_agents",
                        ):
                            await connection.execute(
                                text(
                                    f"REVOKE ALL PRIVILEGES ON TABLE "
                                    f"{schema_identifier}.{_quote_identifier(table_name)} "
                                    f"FROM {runner_identifier}"
                                )
                            )
                        await connection.execute(
                            text(f"DROP ROLE IF EXISTS {runner_identifier}")
                        )

    asyncio.run(scenario())
