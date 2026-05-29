"""Read-only Alembic migration preflight for production deploys.

This script intentionally does not mutate the database. It catches schema drift
that would otherwise surface later as Alembic ``DuplicateTable`` or
``DuplicateColumn`` errors during ``upgrade head``.
"""

from __future__ import annotations

import asyncio
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from sqlalchemy import text


sys.path.append(str(Path(__file__).resolve().parents[1]))

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"


@dataclass(frozen=True)
class MigrationOps:
    revision: str
    path: Path
    create_tables: set[str] = field(default_factory=set)
    create_indexes: set[str] = field(default_factory=set)
    add_columns: set[tuple[str, str]] = field(default_factory=set)


@dataclass(frozen=True)
class MigrationCheckResult:
    ok: bool
    messages: list[str]


def normalize_identifier(value: str) -> str:
    return value.strip().strip('"').strip("'").lower()


def _load_revision_namespace(path: Path) -> dict[str, object]:
    namespace: dict[str, object] = {}
    exec(path.read_text(encoding="utf-8"), namespace)
    return namespace


def load_revision_graph(versions_dir: Path = VERSIONS_DIR) -> tuple[dict[str, Path], dict[str, set[str]], set[str]]:
    revisions: dict[str, Path] = {}
    down_revisions: dict[str, set[str]] = {}
    referenced: set[str] = set()

    for path in sorted(versions_dir.glob("*.py")):
        namespace = _load_revision_namespace(path)
        revision = namespace.get("revision")
        down_revision = namespace.get("down_revision")
        if not isinstance(revision, str):
            continue

        revisions[revision] = path
        parents: set[str] = set()
        if isinstance(down_revision, str):
            parents.add(down_revision)
        elif isinstance(down_revision, (tuple, list)):
            parents.update(item for item in down_revision if isinstance(item, str))
        parents.discard("None")
        down_revisions[revision] = parents
        referenced.update(parents)

    heads = set(revisions) - referenced
    return revisions, down_revisions, heads


def pending_revisions_from_current(
    current_revisions: Iterable[str],
    revisions: dict[str, Path],
    down_revisions: dict[str, set[str]],
    heads: set[str],
) -> list[str]:
    """Return pending revisions from current to the single Alembic head.

    WangSh currently expects a single linear head. Merge revisions are supported
    as long as all branches eventually resolve to one head.
    """
    current = set(current_revisions)
    unknown = current - set(revisions)
    if unknown:
        raise RuntimeError(f"unknown alembic revision(s): {sorted(unknown)}")
    if len(heads) != 1:
        raise RuntimeError(f"expected exactly one Alembic head, found: {sorted(heads)}")

    head = next(iter(heads))
    if head in current:
        current_heads = {head}
    else:
        current_heads = current

    def collect_ancestors(seed_revisions: Iterable[str]) -> set[str]:
        ancestors: set[str] = set()

        def walk(revision: str) -> None:
            if revision in ancestors:
                return
            if revision not in revisions:
                return
            ancestors.add(revision)
            for parent in down_revisions.get(revision, set()):
                walk(parent)

        for revision in seed_revisions:
            walk(revision)
        return ancestors

    target_ancestors = collect_ancestors([head])
    if not current_heads.issubset(target_ancestors):
        raise RuntimeError(f"current revision(s) {sorted(current)} are not ancestors of head {head}")

    applied_ancestors = collect_ancestors(current_heads)
    pending_set = target_ancestors - applied_ancestors
    pending: list[str] = []
    visited: set[str] = set()

    def append_in_dependency_order(revision: str) -> None:
        if revision in visited:
            return
        visited.add(revision)
        for parent in down_revisions.get(revision, set()):
            append_in_dependency_order(parent)
        if revision in pending_set:
            pending.append(revision)

    append_in_dependency_order(head)
    return pending


def parse_migration_ops(path: Path, revision: str) -> MigrationOps:
    content = path.read_text(encoding="utf-8")

    create_tables = {
        normalize_identifier(match.group(1))
        for match in re.finditer(r"""op\.create_table\(\s*['"]([^'"]+)['"]""", content)
    }

    create_indexes = {
        normalize_identifier(match.group(1))
        for match in re.finditer(
            r"""op\.create_index\(\s*(?:op\.f\()?['"]([^'"]+)['"]""",
            content,
        )
    }

    add_columns: set[tuple[str, str]] = set()
    for match in re.finditer(
        r"""op\.add_column\(\s*['"]([^'"]+)['"]\s*,\s*sa\.Column\(\s*['"]([^'"]+)['"]""",
        content,
    ):
        add_columns.add((normalize_identifier(match.group(1)), normalize_identifier(match.group(2))))

    return MigrationOps(
        revision=revision,
        path=path,
        create_tables=create_tables,
        create_indexes=create_indexes,
        add_columns=add_columns,
    )


def build_drift_messages(
    pending_ops: Iterable[MigrationOps],
    *,
    existing_tables: set[str],
    existing_indexes: set[str],
    existing_columns: set[tuple[str, str]],
) -> list[str]:
    messages: list[str] = []
    for ops in pending_ops:
        table_conflicts = sorted(ops.create_tables & existing_tables)
        if table_conflicts:
            messages.append(
                f"{ops.revision}: pending migration would create existing table(s): "
                f"{', '.join(table_conflicts)}"
            )

        index_conflicts = sorted(ops.create_indexes & existing_indexes)
        if index_conflicts:
            messages.append(
                f"{ops.revision}: pending migration would create existing index(es): "
                f"{', '.join(index_conflicts)}"
            )

        column_conflicts = sorted(ops.add_columns & existing_columns)
        if column_conflicts:
            cols = ", ".join(f"{table}.{column}" for table, column in column_conflicts)
            messages.append(f"{ops.revision}: pending migration would add existing column(s): {cols}")

    return messages


async def _load_database_state(conn) -> tuple[list[str], set[str], set[str], set[tuple[str, str]]]:
    version_table = await conn.execute(text("SELECT to_regclass('public.alembic_version')"))
    has_version_table = version_table.scalar_one_or_none() is not None

    current_revisions: list[str] = []
    if has_version_table:
        rows = await conn.execute(text("SELECT version_num FROM alembic_version"))
        current_revisions = [str(row[0]) for row in rows if row[0]]

    table_rows = await conn.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename != 'alembic_version'
            """
        )
    )
    existing_tables = {normalize_identifier(row[0]) for row in table_rows}

    index_rows = await conn.execute(
        text(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            """
        )
    )
    existing_indexes = {normalize_identifier(row[0]) for row in index_rows}

    column_rows = await conn.execute(
        text(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            """
        )
    )
    existing_columns = {
        (normalize_identifier(row[0]), normalize_identifier(row[1]))
        for row in column_rows
    }

    return current_revisions, existing_tables, existing_indexes, existing_columns


def evaluate_migration_state(
    *,
    current_revisions: list[str],
    existing_tables: set[str],
    existing_indexes: set[str],
    existing_columns: set[tuple[str, str]],
    versions_dir: Path = VERSIONS_DIR,
) -> MigrationCheckResult:
    revisions, down_revisions, heads = load_revision_graph(versions_dir)

    if not current_revisions:
        if existing_tables:
            return MigrationCheckResult(
                ok=False,
                messages=[
                    "alembic_version is missing or empty, but public schema already has tables: "
                    f"{', '.join(sorted(existing_tables)[:20])}",
                    "Refusing to auto-stamp a non-empty database. Back up the database, inspect the schema, "
                    "then run an explicit Alembic stamp only after confirming the schema matches the target revision.",
                ],
            )
        return MigrationCheckResult(ok=True, messages=["empty database without alembic_version; Alembic can initialize it"])

    try:
        pending = pending_revisions_from_current(current_revisions, revisions, down_revisions, heads)
    except RuntimeError as exc:
        return MigrationCheckResult(ok=False, messages=[str(exc)])

    if not pending:
        return MigrationCheckResult(ok=True, messages=[f"database is already at Alembic head: {', '.join(current_revisions)}"])

    pending_ops = [parse_migration_ops(revisions[revision], revision) for revision in pending]
    drift_messages = build_drift_messages(
        pending_ops,
        existing_tables=existing_tables,
        existing_indexes=existing_indexes,
        existing_columns=existing_columns,
    )
    if drift_messages:
        return MigrationCheckResult(
            ok=False,
            messages=[
                "schema drift detected before Alembic upgrade",
                *drift_messages,
                "Do not delete existing data. Back up the database, compare the real schema with the pending "
                "migration(s), add any missing indexes/constraints, then stamp the verified target revision.",
            ],
        )

    return MigrationCheckResult(
        ok=True,
        messages=[f"pending Alembic migrations look safe to run: {', '.join(pending)}"],
    )


async def async_main() -> int:
    from app.db.database import engine

    async with engine.connect() as conn:
        current_revisions, existing_tables, existing_indexes, existing_columns = await _load_database_state(conn)

    result = evaluate_migration_state(
        current_revisions=current_revisions,
        existing_tables=existing_tables,
        existing_indexes=existing_indexes,
        existing_columns=existing_columns,
    )
    prefix = "[OK]" if result.ok else "[FAIL]"
    for message in result.messages:
        print(f"{prefix} {message}", file=sys.stdout if result.ok else sys.stderr)
    await engine.dispose()
    return 0 if result.ok else 1


def main() -> int:
    return asyncio.run(async_main())


if __name__ == "__main__":
    raise SystemExit(main())
