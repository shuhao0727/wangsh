"""Proofs for the online Alembic runner's PostgreSQL advisory lock.

The PostgreSQL test is opt-in and refuses normal/protected databases. It starts
real ``alembic current`` subprocesses against a disposable loopback test DB,
then verifies that both runners wait for the same transaction-scoped lock.
Without the opt-in URL, only source-contract tests run; those do not prove
runtime PostgreSQL behavior.
"""
from __future__ import annotations

import ast
import asyncio
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine


BACKEND_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = BACKEND_ROOT / "alembic" / "env.py"


def _env_source() -> str:
    return ENV_PATH.read_text(encoding="utf-8")


def _migration_lock_key() -> int:
    tree = ast.parse(_env_source(), filename=str(ENV_PATH))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "_MIGRATION_LOCK_KEY"
            for target in node.targets
        ):
            value = ast.literal_eval(node.value)
            assert isinstance(value, int)
            return value
    raise AssertionError("_MIGRATION_LOCK_KEY is missing")


def test_online_runner_contract_uses_one_stable_transaction_lock():
    source = _env_source()
    key = _migration_lock_key()
    assert key == 0x57534D4947
    assert "pg_advisory_xact_lock(:lock_key)" in source

    tree = ast.parse(source, filename=str(ENV_PATH))
    online = next(
        node
        for node in tree.body
        if isinstance(node, ast.AsyncFunctionDef)
        and node.name == "run_migrations_online"
    )
    online_source = ast.get_source_segment(source, online)
    assert online_source is not None
    assert online_source.index(
        "await connection.run_sync(acquire_migration_lock)"
    ) < online_source.index(
        "await connection.run_sync(ensure_alembic_version_capacity)"
    )
    assert "async with connectable.begin()" in online_source
    assert "finally:\n        await connectable.dispose()" in online_source


def test_offline_runner_contract_does_not_acquire_online_lock():
    tree = ast.parse(_env_source(), filename=str(ENV_PATH))
    offline = next(
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name == "run_migrations_offline"
    )
    offline_source = ast.get_source_segment(_env_source(), offline)
    assert offline_source is not None
    assert "acquire_migration_lock" not in offline_source
    assert "pg_advisory" not in offline_source


def _database_url() -> str | None:
    value = os.environ.get("ALEMBIC_CONCURRENCY_TEST_DATABASE_URL", "").strip()
    if not value:
        return None
    parsed = make_url(value)
    if parsed.drivername != "postgresql+asyncpg":
        pytest.fail("Alembic concurrency test requires postgresql+asyncpg")
    if parsed.host not in {"127.0.0.1", "localhost", "::1"}:
        pytest.fail("Alembic concurrency test refuses non-loopback PostgreSQL")
    if parsed.port in {5432, 5433}:
        pytest.fail("Alembic concurrency test refuses protected PostgreSQL ports 5432/5433")
    if not re.search(
        r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I
    ):
        pytest.fail("Alembic concurrency test requires a test-named database")
    return value


DATABASE_URL = _database_url()


async def _wait_for_waiters(
    engine, processes: list[subprocess.Popen[str]], expected: int
) -> None:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        async with engine.connect() as conn:
            count = await conn.scalar(
                text(
                    """
                    SELECT count(*)
                    FROM pg_locks
                    WHERE locktype = 'advisory'
                      AND classid = :classid
                      AND objid = :objid
                      AND granted = false
                    """
                ),
                {
                    "classid": _migration_lock_key() >> 32,
                    "objid": _migration_lock_key() & 0xFFFFFFFF,
                },
            )
        if int(count or 0) >= expected:
            return
        if any(process.poll() is not None for process in processes):
            details = [process.communicate() for process in processes]
            pytest.fail(f"Alembic runner exited before acquiring lock: {details}")
        await asyncio.sleep(0.1)
    pytest.fail(f"expected {expected} advisory-lock waiters, timed out")


def _start_alembic(
    database_url: str, config_path: Path, *arguments: str
) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env["PYTHONPATH"] = str(BACKEND_ROOT)
    return subprocess.Popen(
        [sys.executable, "-m", "alembic", "-c", str(config_path), *arguments],
        cwd=BACKEND_ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def _write_synthetic_alembic_tree(root: Path, *, migration_body: str) -> Path:
    script_dir = root / "alembic"
    versions_dir = script_dir / "versions"
    versions_dir.mkdir(parents=True)
    shutil.copy2(ENV_PATH, script_dir / "env.py")
    (versions_dir / "test_head.py").write_text(
        "revision = 'test_head'\n"
        "down_revision = None\n"
        "branch_labels = None\n"
        "depends_on = None\n"
        f"{migration_body}",
        encoding="utf-8",
    )
    config_path = root / "alembic.ini"
    config_path.write_text(
        (BACKEND_ROOT / "alembic.ini")
        .read_text(encoding="utf-8")
        .replace("script_location = alembic", f"script_location = {script_dir}"),
        encoding="utf-8",
    )
    return config_path


@pytest.mark.skipif(
    DATABASE_URL is None,
    reason="set ALEMBIC_CONCURRENCY_TEST_DATABASE_URL to an isolated loopback test database",
)
def test_offline_runner_emits_sql_without_acquiring_online_lock():
    assert DATABASE_URL is not None
    with tempfile.TemporaryDirectory(prefix="alembic-concurrency-offline-") as temp_dir:
        config_path = _write_synthetic_alembic_tree(
            Path(temp_dir),
            migration_body=(
                "\nfrom alembic import op\n"
                "\ndef upgrade():\n"
                "    op.execute(\"CREATE TABLE offline_probe (id integer)\")\n"
                "\ndef downgrade():\n"
                "    op.execute(\"DROP TABLE offline_probe\")\n"
            ),
        )
        process = _start_alembic(DATABASE_URL, config_path, "upgrade", "head", "--sql")
        stdout, stderr = process.communicate(timeout=40)
        assert process.returncode == 0, (stdout, stderr)
        assert "pg_advisory" not in stdout
        assert "CREATE TABLE offline_probe" in stdout


@pytest.mark.skipif(
    DATABASE_URL is None,
    reason="set ALEMBIC_CONCURRENCY_TEST_DATABASE_URL to an isolated loopback test database",
)
def test_failed_online_runner_releases_transaction_scoped_lock():
    async def scenario() -> None:
        assert DATABASE_URL is not None
        engine = create_async_engine(DATABASE_URL)
        process = None
        try:
            with tempfile.TemporaryDirectory(prefix="alembic-concurrency-failure-") as temp_dir:
                config_path = _write_synthetic_alembic_tree(
                    Path(temp_dir),
                    migration_body=(
                        "\ndef upgrade():\n"
                        "    raise RuntimeError('intentional test migration failure')\n"
                        "\ndef downgrade():\n"
                        "    pass\n"
                    ),
                )
                process = _start_alembic(
                    DATABASE_URL, config_path, "upgrade", "head"
                )
                stdout, stderr = process.communicate(timeout=40)
                assert process.returncode != 0, (stdout, stderr)

            async with engine.connect() as conn:
                acquired = await conn.scalar(
                    text("SELECT pg_try_advisory_lock(:lock_key)"),
                    {"lock_key": _migration_lock_key()},
                )
                assert acquired is True
                await conn.execute(
                    text("SELECT pg_advisory_unlock(:lock_key)"),
                    {"lock_key": _migration_lock_key()},
                )
        finally:
            if process is not None and process.poll() is None:
                process.kill()
                process.communicate()
            await engine.dispose()

    asyncio.run(scenario())


@pytest.mark.skipif(
    DATABASE_URL is None,
    reason="set ALEMBIC_CONCURRENCY_TEST_DATABASE_URL to an isolated loopback test database",
)
def test_two_online_runners_serialize_on_the_same_postgresql_lock():
    async def scenario() -> None:
        assert DATABASE_URL is not None
        engine = create_async_engine(DATABASE_URL)
        processes: list[subprocess.Popen[str]] = []
        with tempfile.TemporaryDirectory(prefix="alembic-concurrency-") as temp_dir:
            temp_root = Path(temp_dir)
            config_path = _write_synthetic_alembic_tree(
                temp_root,
                migration_body=(
                    "\nfrom alembic import op\n"
                    "\ndef upgrade():\n"
                    "    op.execute(\"SELECT pg_sleep(1)\")\n"
                    "\ndef downgrade():\n"
                    "    pass\n"
                ),
            )
            try:
                async with engine.begin() as conn:
                    await conn.execute(text("DROP TABLE IF EXISTS public.alembic_version"))

                processes = [
                    _start_alembic(DATABASE_URL, config_path, "upgrade", "head"),
                    _start_alembic(DATABASE_URL, config_path, "upgrade", "head"),
                ]
                # The first runner holds the transaction-scoped lock during
                # pg_sleep; the second must be observable waiting on that same
                # lock before the first runner commits.
                await _wait_for_waiters(engine, processes, expected=1)

                results = [process.communicate(timeout=40) for process in processes]
                assert all(process.returncode == 0 for process in processes), results
            finally:
                for process in processes:
                    if process.poll() is None:
                        process.kill()
                        process.communicate()
                async with engine.begin() as conn:
                    await conn.execute(text("DROP TABLE IF EXISTS public.alembic_version"))
                await engine.dispose()

    asyncio.run(scenario())
