"""Real PostgreSQL regression tests for Alembic's version-table search path.

These tests are deliberately opt-in.  The URL must point to a loopback,
dedicated test-named database.  Every test owns a unique schema and drops it in
``finally``.  The real-upgrade case temporarily sets that dedicated database's
default ``search_path`` and restores it before cleanup.
"""
from __future__ import annotations

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

from app.db.alembic_compat import ensure_alembic_version_capacity

if os.environ.get("ALEMBIC_SEARCH_PATH_PG") != "1":
    pytest.skip("requires isolated PostgreSQL bootstrap", allow_module_level=True)

DATABASE_URL = os.environ.get("ALEMBIC_SEARCH_PATH_PG_URL", "").strip()
PARSED_URL = make_url(DATABASE_URL)
_TEST_DATABASE_RE = re.compile(r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", re.I)
if (
    PARSED_URL.drivername != "postgresql+asyncpg"
    or PARSED_URL.host not in {"127.0.0.1", "localhost", "::1"}
    or not _TEST_DATABASE_RE.search(PARSED_URL.database or "")
):
    raise RuntimeError(
        "Alembic search_path tests require loopback asyncpg and a test-named database"
    )

BACKEND_ROOT = Path(__file__).resolve().parents[2]
_SCHEMA_RE = re.compile(r"^alembic_sp_[0-9a-f]{32}$")


def _quoted_identifier(value: str) -> str:
    assert _SCHEMA_RE.fullmatch(value) or value == (PARSED_URL.database or "")
    return '"' + value.replace('"', '""') + '"'


@asynccontextmanager
async def isolated_schema(*, database_default: bool = False):
    schema = f"alembic_sp_{uuid.uuid4().hex}"
    assert _SCHEMA_RE.fullmatch(schema)
    admin = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    scoped: AsyncEngine | None = None
    prior_database_search_path: str | None = None
    try:
        async with admin.begin() as conn:
            await conn.execute(text(f"CREATE SCHEMA {_quoted_identifier(schema)}"))
            if database_default:
                prior_database_search_path = await conn.scalar(
                    text(
                        """
                        SELECT option
                        FROM (
                            SELECT unnest(setconfig) AS option
                            FROM pg_db_role_setting
                            WHERE setdatabase = (
                                SELECT oid FROM pg_database WHERE datname = current_database()
                            ) AND setrole = 0
                        ) AS settings
                        WHERE option LIKE 'search_path=%'
                        """
                    )
                )
                database = _quoted_identifier(PARSED_URL.database or "")
                await conn.execute(
                    text(
                        f"ALTER DATABASE {database} SET search_path "
                        f"TO {_quoted_identifier(schema)}, public"
                    )
                )
        scoped = create_async_engine(
            DATABASE_URL,
            connect_args={
                "server_settings": {
                    "search_path": f"{schema},public",
                    "application_name": schema,
                    "statement_timeout": "30000",
                    "lock_timeout": "10000",
                }
            },
        )
        yield scoped, schema
    finally:
        if scoped is not None:
            await scoped.dispose()
        async with admin.begin() as conn:
            if database_default:
                database = _quoted_identifier(PARSED_URL.database or "")
                if prior_database_search_path is None:
                    await conn.execute(text(f"ALTER DATABASE {database} RESET search_path"))
                else:
                    value = prior_database_search_path.split("=", 1)[1]
                    await conn.execute(
                        text(f"ALTER DATABASE {database} SET search_path TO {value}")
                    )
            await conn.execute(
                text(f"DROP SCHEMA IF EXISTS {_quoted_identifier(schema)} CASCADE")
            )
        await admin.dispose()


async def _version_column_length(engine: AsyncEngine, schema: str) -> int | None:
    async with engine.connect() as conn:
        return await conn.scalar(
            text(
                """
                SELECT character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name = 'alembic_version'
                  AND column_name = 'version_num'
                """
            ),
            {"schema": schema},
        )


def test_missing_version_table_is_created_in_effective_search_path_schema():
    async def scenario():
        async with isolated_schema() as (engine, schema):
            async with engine.begin() as conn:
                assert await conn.scalar(text("SELECT current_schema()")) == schema
                await conn.run_sync(ensure_alembic_version_capacity)

            assert await _version_column_length(engine, schema) == 64
            async with engine.connect() as conn:
                public_table = await conn.scalar(
                    text("SELECT to_regclass('public.alembic_version')")
                )
                assert public_table is None
                primary_key = await conn.scalar(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM pg_constraint AS c
                            JOIN pg_class AS t ON t.oid = c.conrelid
                            JOIN pg_namespace AS n ON n.oid = t.relnamespace
                            WHERE n.nspname = :schema
                              AND t.relname = 'alembic_version'
                              AND c.contype = 'p'
                        )
                        """
                    ),
                    {"schema": schema},
                )
                assert primary_key is True

    asyncio.run(scenario())


def test_default_public_search_path_remains_compatible():
    async def scenario():
        engine = create_async_engine(DATABASE_URL)
        created = False
        try:
            async with engine.begin() as conn:
                assert await conn.scalar(text("SELECT current_schema()")) == "public"
                if await conn.scalar(text("SELECT to_regclass('public.alembic_version')")) is not None:
                    pytest.skip("requires a disposable database without public.alembic_version")
                await conn.run_sync(ensure_alembic_version_capacity)
                created = True
            assert await _version_column_length(engine, "public") == 64
        finally:
            if created:
                async with engine.begin() as conn:
                    await conn.execute(text("DROP TABLE public.alembic_version"))
            await engine.dispose()

    asyncio.run(scenario())


def test_public_version_table_does_not_shadow_custom_effective_schema():
    async def scenario():
        async with isolated_schema() as (engine, schema):
            admin = create_async_engine(DATABASE_URL)
            created_public = False
            try:
                async with admin.begin() as conn:
                    existing = await conn.scalar(text("SELECT to_regclass('public.alembic_version')"))
                    if existing is not None:
                        pytest.skip("requires a disposable database without public.alembic_version")
                    await conn.execute(
                        text("CREATE TABLE public.alembic_version (version_num VARCHAR(32) NOT NULL)")
                    )
                    created_public = True
                async with engine.begin() as conn:
                    assert await conn.scalar(text("SELECT current_schema()")) == schema
                    await conn.run_sync(ensure_alembic_version_capacity)

                assert await _version_column_length(admin, "public") == 32
                assert await _version_column_length(engine, schema) == 64
            finally:
                if created_public:
                    async with admin.begin() as conn:
                        await conn.execute(text("DROP TABLE public.alembic_version"))
                await admin.dispose()

    asyncio.run(scenario())


def test_project_upgrade_writes_long_revision_in_custom_database_search_path():
    async def scenario():
        async with isolated_schema(database_default=True) as (engine, schema):
            env = os.environ.copy()
            env.update(
                {
                    "DATABASE_URL": DATABASE_URL,
                    "POSTGRES_HOST": PARSED_URL.host or "127.0.0.1",
                    "POSTGRES_PORT": str(PARSED_URL.port or 5432),
                    "POSTGRES_DB": PARSED_URL.database or "",
                    "POSTGRES_USER": PARSED_URL.username or "",
                    "POSTGRES_PASSWORD": PARSED_URL.password or "",
                }
            )
            target_revision = "20260210_0000_legacy_baseline_tables"
            assert len(target_revision) > 32
            completed = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "alembic",
                    "-c",
                    "alembic.ini",
                    "upgrade",
                    target_revision,
                ],
                cwd=BACKEND_ROOT,
                env=env,
                text=True,
                capture_output=True,
                timeout=180,
                check=False,
            )
            assert completed.returncode == 0, completed.stdout + completed.stderr

            current_check = subprocess.run(
                [sys.executable, "-m", "alembic", "-c", "alembic.ini", "current"],
                cwd=BACKEND_ROOT,
                env=env,
                text=True,
                capture_output=True,
                timeout=60,
                check=False,
            )
            assert current_check.returncode == 0, (
                current_check.stdout + current_check.stderr
            )
            assert target_revision in current_check.stdout

            async with engine.connect() as conn:
                assert await conn.scalar(text("SELECT current_schema()")) == schema
                current = (
                    await conn.execute(text("SELECT version_num FROM alembic_version"))
                ).scalars().all()
                assert current == [target_revision]
                public_table = await conn.scalar(
                    text("SELECT to_regclass('public.alembic_version')")
                )
                assert public_table is None
            assert await _version_column_length(engine, schema) == 64

    asyncio.run(scenario())
