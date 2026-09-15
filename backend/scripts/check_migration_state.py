"""Read-only Alembic migration preflight for production deploys.

This script intentionally does not mutate the database. It catches schema drift
that would otherwise surface later as Alembic ``DuplicateTable`` or
``DuplicateColumn`` errors during ``upgrade head``.
"""

from __future__ import annotations

import ast
import asyncio
import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from sqlalchemy import text


sys.path.append(str(Path(__file__).resolve().parents[1]))

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"


# Audited OPS-04 contract: the complete semantic AST, not a filename/helper-name
# allowlist. Covers _index_exists, its unqualified pg_indexes query, all bindings
# and the guarded upgrade call. Comments/formatting do not change this digest;
# any executable change requires a fresh review (never regenerate automatically).
_REVIEWED_INDEX_GUARD_AST = "69b2c63890b2e55b866415577c68ab652a760641e6535223cef7c2790eed6e92"
_REVIEWED_INDEX = "ix_znt_group_discussion_sessions_group_name"
_REVIEWED_TABLE = "znt_group_discussion_sessions"
_REVIEWED_DEFINITION = (
    f"CREATE INDEX {_REVIEWED_INDEX} ON public.{_REVIEWED_TABLE} USING btree (group_name)"
)


@dataclass(frozen=True)
class IndexDefinition:
    schema: str
    table: str
    definition: str
    valid: bool
    ready: bool
    live: bool
    kind: str


@dataclass(frozen=True)
class MigrationOps:
    revision: str
    path: Path
    create_tables: set[str] = field(default_factory=set)
    create_indexes: set[str] = field(default_factory=set)
    add_columns: set[tuple[str, str]] = field(default_factory=set)
    guarded_indexes: dict[str, str] = field(default_factory=dict)
    review_errors: tuple[str, ...] = ()


@dataclass(frozen=True)
class MigrationCheckResult:
    ok: bool
    messages: list[str]


def normalize_identifier(value: str) -> str:
    return value.strip().strip('"').strip("'").lower()


def _load_revision_namespace(path: Path) -> dict[str, object]:
    namespace: dict[str, object] = {}
    # Reading the graph must never import/execute migration modules.
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        targets = node.targets if isinstance(node, ast.Assign) else (
            [node.target] if isinstance(node, ast.AnnAssign) else []
        )
        for target in targets:
            if isinstance(target, ast.Name) and target.id in {"revision", "down_revision"}:
                try:
                    namespace[target.id] = ast.literal_eval(node.value)
                except (ValueError, TypeError) as exc:
                    raise RuntimeError(f"{path.name}: non-literal {target.id}") from exc
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

        if revision in revisions:
            raise RuntimeError(f"duplicate Alembic revision: {revision}")
        revisions[revision] = path
        parents: set[str] = set()
        if isinstance(down_revision, str):
            parents.add(down_revision)
        elif isinstance(down_revision, (tuple, list)):
            parents.update(item for item in down_revision if isinstance(item, str))
        parents.discard("None")
        down_revisions[revision] = parents
        referenced.update(parents)

    missing = referenced - set(revisions)
    if missing:
        raise RuntimeError(f"missing Alembic parent revision(s): {sorted(missing)}")
    visiting: set[str] = set()
    visited: set[str] = set()

    def validate(revision: str) -> None:
        if revision in visiting:
            raise RuntimeError(f"cycle in Alembic graph at {revision}")
        if revision in visited:
            return
        visiting.add(revision)
        for parent in down_revisions[revision]:
            validate(parent)
        visiting.remove(revision)
        visited.add(revision)

    for revision in revisions:
        validate(revision)
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


def _guard_ast_digest(tree: ast.AST) -> str:
    # ast.dump changed its empty-field rendering between supported Python
    # versions. Canonicalize meaningful fields explicitly, retaining executable
    # differences while treating omitted None/[] identically.
    def canonical(value):
        if isinstance(value, ast.AST):
            return [type(value).__name__, {
                name: canonical(item) for name, item in ast.iter_fields(value)
                if item is not None and item != []
            }]
        if isinstance(value, list):
            return [canonical(item) for item in value]
        return value

    return hashlib.sha256(json.dumps(canonical(tree), sort_keys=True).encode()).hexdigest()


def parse_migration_ops(path: Path, revision: str) -> MigrationOps:
    content = path.read_text(encoding="utf-8")

    create_tables = {
        normalize_identifier(match.group(1))
        for match in re.finditer(r"""op\.create_table\(\s*['"]([^'"]+)['"]""", content)
    }

    tree = ast.parse(content)
    reviewed = _guard_ast_digest(tree) == _REVIEWED_INDEX_GUARD_AST
    create_indexes: set[str] = set()
    guarded_indexes: dict[str, str] = {}
    review_errors: list[str] = []
    parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
    upgrades = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "upgrade"]
    # Follow local helper calls without executing them. A helper's control flow
    # is not an audited direct upgrade operation, so index creation fails closed.
    functions = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}
    reachable = list(upgrades)
    seen = set(upgrades)
    for function in reachable:
        for call in ast.walk(function):
            if isinstance(call, ast.Call) and isinstance(call.func, ast.Name):
                helper = functions.get(call.func.id)
                if helper is not None and helper not in seen:
                    seen.add(helper)
                    reachable.append(helper)
    for upgrade in reachable:
        for node in ast.walk(upgrade):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                    and isinstance(node.func.value, ast.Name) and node.func.value.id == "op"
                    and node.func.attr == "create_index"):
                continue
            name_node = node.args[0] if node.args else next(
                (kw.value for kw in node.keywords if kw.arg == "index_name"), None
            )
            if (isinstance(name_node, ast.Call) and isinstance(name_node.func, ast.Attribute)
                    and isinstance(name_node.func.value, ast.Name) and name_node.func.value.id == "op"
                    and name_node.func.attr == "f" and len(name_node.args) == 1):
                name_node = name_node.args[0]
            if not isinstance(name_node, ast.Constant) or not isinstance(name_node.value, str):
                review_errors.append(f"line {node.lineno}: unreviewed dynamic index name")
                continue
            name = normalize_identifier(name_node.value)
            create_indexes.add(name)
            ancestor = parents[node]
            conditional = upgrade not in upgrades
            while ancestor is not upgrade:
                if not isinstance(ancestor, ast.Expr):
                    conditional = True
                ancestor = parents[ancestor]
            if reviewed and name == _REVIEWED_INDEX:
                guarded_indexes[name] = _REVIEWED_DEFINITION
            elif conditional or any(kw.arg in {None, "if_not_exists"} for kw in node.keywords):
                review_errors.append(f"{name}: unreviewed index guard/control flow; manual review required")

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
        guarded_indexes=guarded_indexes,
        review_errors=tuple(review_errors),
    )


def build_drift_messages(
    pending_ops: Iterable[MigrationOps],
    *,
    existing_tables: set[str],
    existing_indexes: set[str],
    existing_columns: set[tuple[str, str]],
    existing_index_definitions: dict[str, tuple[IndexDefinition, ...]] | None = None,
    schema: str = "public",
) -> list[str]:
    messages: list[str] = []
    for ops in pending_ops:
        messages.extend(f"{ops.revision}: {error}" for error in ops.review_errors)
        table_conflicts = sorted(ops.create_tables & existing_tables)
        if table_conflicts:
            messages.append(
                f"{ops.revision}: pending migration would create existing table(s): "
                f"{', '.join(table_conflicts)}"
            )

        index_conflicts = sorted((ops.create_indexes - ops.guarded_indexes.keys()) & existing_indexes)
        for name, expected in ops.guarded_indexes.items():
            definitions = (existing_index_definitions or {}).get(name, ())
            if existing_index_definitions is None:
                messages.append(f"{ops.revision}: {name}: missing index catalog evidence for reviewed guard")
                continue
            # The reviewed helper is scoped to current_schema(); same-name
            # indexes in other schemas do not affect its decision.
            effective_definitions = tuple(item for item in definitions if item.schema == schema)
            if not effective_definitions and name not in existing_indexes:
                continue  # The reviewed guard will create the absent index.
            schema_definition = expected.replace(" ON public.", f" ON {schema}.")
            equivalent = len(effective_definitions) == 1 and effective_definitions[0] == IndexDefinition(
                schema=schema, table=_REVIEWED_TABLE, definition=schema_definition,
                valid=True, ready=True, live=True, kind="i",
            )
            if not equivalent or name not in existing_indexes:
                messages.append(
                    f"{ops.revision}: {name}: guarded index is not structurally equivalent "
                    "(or catalog evidence is missing/ambiguous); refusing to skip drift"
                )
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


async def _load_database_state(conn) -> tuple[
    str,
    list[str],
    set[str],
    set[str],
    set[tuple[str, str]],
    dict[str, tuple[IndexDefinition, ...]],
]:
    schema_result = await conn.execute(text("SELECT current_schema()"))
    schema = schema_result.scalar_one_or_none()
    if not schema:
        raise RuntimeError(
            "PostgreSQL search_path does not contain an existing schema; "
            "cannot inspect migration state"
        )
    schema = str(schema)

    version_table = await conn.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_class AS c
                JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                WHERE n.nspname = :schema
                  AND c.relname = 'alembic_version'
                  AND c.relkind IN ('r', 'p')
            )
            """
        ),
        {"schema": schema},
    )
    has_version_table = bool(version_table.scalar_one_or_none())

    current_revisions: list[str] = []
    if has_version_table:
        rows = await conn.execute(text("SELECT version_num FROM alembic_version"))
        current_revisions = [str(row[0]) for row in rows if row[0]]

    table_rows = await conn.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = :schema
              AND tablename != 'alembic_version'
            """
        ),
        {"schema": schema},
    )
    existing_tables = {normalize_identifier(row[0]) for row in table_rows}

    index_rows = await conn.execute(
        text(
            """
            SELECT idx.relname, ns.nspname, tbl.relname,
                   pg_catalog.pg_get_indexdef(i.indexrelid),
                   i.indisvalid, i.indisready, i.indislive, CAST(idx.relkind AS text)
            FROM pg_catalog.pg_index AS i
            JOIN pg_catalog.pg_class AS idx ON idx.oid = i.indexrelid
            JOIN pg_catalog.pg_namespace AS ns ON ns.oid = idx.relnamespace
            JOIN pg_catalog.pg_class AS tbl ON tbl.oid = i.indrelid
            """
        )
    )
    # Preserve catalog case and the complete server deparse: do not lowercase,
    # strip quotes, predicates, operator classes, INCLUDE or storage options.
    definitions_by_name: dict[str, list[IndexDefinition]] = {}
    existing_indexes: set[str] = set()
    for row in index_rows:
        name = str(row[0])
        definitions_by_name.setdefault(name, []).append(IndexDefinition(*row[1:]))
        if row[1] == schema:
            existing_indexes.add(normalize_identifier(name))
    existing_index_definitions = {name: tuple(items) for name, items in definitions_by_name.items()}

    column_rows = await conn.execute(
        text(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = :schema
            """
        ),
        {"schema": schema},
    )
    existing_columns = {
        (normalize_identifier(row[0]), normalize_identifier(row[1]))
        for row in column_rows
    }

    return (
        schema,
        current_revisions,
        existing_tables,
        existing_indexes,
        existing_columns,
        existing_index_definitions,
    )


def evaluate_migration_state(
    *,
    current_revisions: list[str],
    existing_tables: set[str],
    existing_indexes: set[str],
    existing_columns: set[tuple[str, str]],
    existing_index_definitions: dict[str, tuple[IndexDefinition, ...]] | None = None,
    versions_dir: Path = VERSIONS_DIR,
    schema: str = "public",
) -> MigrationCheckResult:
    try:
        revisions, down_revisions, heads = load_revision_graph(versions_dir)
    except (RuntimeError, SyntaxError, ValueError) as exc:
        return MigrationCheckResult(ok=False, messages=[str(exc)])

    if not current_revisions:
        if existing_tables:
            return MigrationCheckResult(
                ok=False,
                messages=[
                    "alembic_version is missing or empty, but effective schema "
                    f"{schema!r} already has tables: {', '.join(sorted(existing_tables)[:20])}",
                    "Refusing to auto-stamp a non-empty database. Back up the database, inspect the schema, "
                    "then run an explicit Alembic stamp only after confirming the schema matches the target revision.",
                ],
            )
        if len(heads) != 1:
            return MigrationCheckResult(
                ok=False,
                messages=[f"expected exactly one Alembic head, found: {sorted(heads)}"],
            )
        return MigrationCheckResult(
            ok=True,
            messages=[
                "empty database without alembic_version; run bootstrap_db.py --initial-only "
                "before alembic upgrade head"
            ],
        )

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
        existing_index_definitions=existing_index_definitions,
        schema=schema,
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
        # A consistent, read-only catalog snapshot; no normal DB migration or stamp.
        async with conn.begin():
            await conn.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
            (schema, current_revisions, existing_tables, existing_indexes,
             existing_columns, existing_index_definitions) = await _load_database_state(conn)

    result = evaluate_migration_state(
        current_revisions=current_revisions,
        existing_tables=existing_tables,
        existing_indexes=existing_indexes,
        existing_columns=existing_columns,
        existing_index_definitions=existing_index_definitions,
        schema=schema,
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
