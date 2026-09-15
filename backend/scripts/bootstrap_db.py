import ast
import asyncio
import os
import re
import sys
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import Integer, MetaData, text

from app.db.database import engine
from app.models import Base


LEGACY_BASELINE_TABLES = (
    "sys_users",
    "sys_refresh_tokens",
    "sys_feature_flags",
    "znt_agents",
    "znt_conversations",
    "znt_group_discussion_sessions",
    "znt_group_discussion_members",
    "znt_group_discussion_messages",
    "znt_group_discussion_analyses",
    "znt_optimize_logs",
    "inf_typst_notes",
    "inf_typst_assets",
    "wz_categories",
    "wz_markdown_styles",
    "wz_articles",
    "xbk_courses",
    "xbk_students",
    "xbk_selections",
    "xxjs_dianming",
)
MIGRATION_ORIGIN_COLUMNS = (("znt_group_discussion_members", "muted_until"),)
# Early migrations guarded these indexes with table_schema='public' and a later
# historical migration drops them without transaction-safe existence checks.
# A non-public legacy baseline must provide the disposable indexes so that the
# unchanged historical chain can advance. They are removed by 04afffb306ed.
NON_PUBLIC_LEGACY_DROP_INDEXES = (
    ("idx_inf_typst_assets_note_id_path", "inf_typst_assets", "note_id, path"),
    ("idx_inf_typst_assets_sha256", "inf_typst_assets", "sha256"),
    ("idx_inf_typst_notes_compiled_hash", "inf_typst_notes", "compiled_hash"),
    ("idx_inf_typst_notes_published", "inf_typst_notes", "published"),
    (
        "idx_znt_group_discussion_sessions_class_name",
        "znt_group_discussion_sessions",
        "class_name",
    ),
)
VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"


async def _current_schema(conn) -> str:
    schema = (await conn.execute(text("SELECT current_schema()"))).scalar_one_or_none()
    if not schema:
        raise RuntimeError(
            "PostgreSQL search_path does not contain an existing schema; "
            "cannot bootstrap the database"
        )
    return str(schema)


async def _has_alembic_version(conn, schema: str) -> bool:
    table_result = await conn.execute(
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
    if not table_result.scalar_one():
        return False
    result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
    return result.scalar_one_or_none() is not None


async def _get_existing_schema_tables(conn, schema: str) -> set[str]:
    result = await conn.execute(
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
    return {str(row[0]) for row in result}


async def _create_legacy_baseline(conn, *, schema: str) -> None:
    """Create only tables that predate the maintained Alembic migration chain."""
    # Current models include indexes introduced later by Alembic (some require
    # extensions). Filter a private copy before emitting DDL; never mutate the
    # ORM metadata or create-and-drop indexes before their dependencies exist.
    baseline = MetaData()
    for table in Base.metadata.tables.values():
        table.to_metadata(baseline)
    # These legacy tables predate the academic-year migration. Copying today's
    # String(9)/check constraints would make its integer-to-range conversion
    # fail even on an empty database. Keep the historical type only here.
    for name in ("xbk_students", "xbk_courses", "xbk_selections"):
        table = baseline.tables[name]
        table.c.year.type = Integer()
        table.c.year.comment = None
        for constraint in tuple(table.constraints):
            if constraint.name == f"ck_{name}_academic_year":
                table.constraints.remove(constraint)
    managed_indexes = _migration_managed_indexes()
    tables = [baseline.tables[name] for name in LEGACY_BASELINE_TABLES]
    for table in tables:
        for index in tuple(table.indexes):
            if index.name in managed_indexes:
                table.indexes.remove(index)
    await conn.run_sync(
        lambda sync_conn: baseline.create_all(
            sync_conn,
            tables=tables,
            checkfirst=True,
        )
    )
    for table_name, column_name in MIGRATION_ORIGIN_COLUMNS:
        await conn.execute(
            text(f'ALTER TABLE "{table_name}" DROP COLUMN IF EXISTS "{column_name}"')
        )
    if schema != "public":
        for index_name, table_name, columns in NON_PUBLIC_LEGACY_DROP_INDEXES:
            await conn.execute(
                text(
                    f'CREATE INDEX IF NOT EXISTS "{index_name}" '
                    f'ON "{table_name}" ({columns})'
                )
            )
    await conn.execute(
        text(
            "CREATE TABLE IF NOT EXISTS alembic_version "
            "(version_num VARCHAR(64) NOT NULL)"
        )
    )
    print("Legacy baseline tables created; Alembic version remains unset")


def _static_string_constants(tree: ast.Module) -> dict[str, str]:
    """Return module-level string constants without importing migrations."""
    constants: dict[str, str] = {}
    for node in tree.body:
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        try:
            value = ast.literal_eval(node.value)
        except (ValueError, TypeError):
            continue
        if not isinstance(value, str):
            continue
        for target in targets:
            if isinstance(target, ast.Name):
                constants[target.id] = value
    return constants


def _create_index_name(node: ast.Call, constants: dict[str, str]) -> str | None:
    """Resolve the first argument of ``op.create_index`` statically."""
    function = node.func
    if not (
        isinstance(function, ast.Attribute)
        and function.attr == "create_index"
        and isinstance(function.value, ast.Name)
        and function.value.id == "op"
        and node.args
    ):
        return None

    argument = node.args[0]
    if (
        isinstance(argument, ast.Call)
        and isinstance(argument.func, ast.Attribute)
        and argument.func.attr == "f"
        and isinstance(argument.func.value, ast.Name)
        and argument.func.value.id == "op"
        and argument.args
    ):
        argument = argument.args[0]

    if isinstance(argument, ast.Constant) and isinstance(argument.value, str):
        return argument.value
    if isinstance(argument, ast.Name):
        return constants.get(argument.id)
    return None


def _migration_managed_indexes() -> set[str]:
    indexes: set[str] = set()
    sql_pattern = re.compile(
        r'\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?'
        r'(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))',
        re.IGNORECASE,
    )
    for path in VERSIONS_DIR.glob("*.py"):
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
        constants = _static_string_constants(tree)
        # Resolve literal, op.f(...), and module-level constant names passed to
        # op.create_index. Parsing never imports or executes migration modules.
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                name = _create_index_name(node, constants)
                if name:
                    indexes.add(name)
            # AST folds adjacent Python string literals, including SQL held in
            # statement tuples.
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                for quoted, unquoted in sql_pattern.findall(node.value):
                    indexes.add(quoted or unquoted.lower())
    return indexes


async def _ensure_compat_columns(conn) -> None:
    # 兼容历史库：早期 xxjs_dianming 缺少 updated_at，导致 ORM 查询报 UndefinedColumnError
    await conn.execute(
        text(
            "ALTER TABLE xxjs_dianming "
            "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"
        )
    )
    await conn.execute(
        text(
            "UPDATE xxjs_dianming "
            "SET updated_at = created_at "
            "WHERE updated_at IS NULL"
        )
    )
    await conn.execute(
        text(
            "ALTER TABLE xxjs_dianming "
            "ALTER COLUMN updated_at SET NOT NULL"
        )
    )


async def _ensure_views(conn) -> None:
    # 创建功能必需的视图（不受 AUTO_CREATE_TABLES 控制）
    await conn.execute(
        text(
            """
            CREATE OR REPLACE VIEW v_conversations_with_deleted AS
            SELECT
                c.id, c.user_id,
                COALESCE(c.user_name, u.full_name, '未知用户') AS display_user_name,
                c.agent_id,
                COALESCE(c.agent_name, a.name, '未知智能体') AS display_agent_name,
                c.session_id, c.message_type, c.content, c.response_time_ms, c.created_at,
                CASE WHEN u.id IS NULL OR u.is_deleted = true THEN true ELSE false END AS is_user_deleted,
                CASE WHEN a.id IS NULL OR a.is_deleted = true THEN true ELSE false END AS is_agent_deleted
            FROM znt_conversations c
            LEFT JOIN sys_users u ON c.user_id = u.id
            LEFT JOIN znt_agents a ON c.agent_id = a.id
            """
        )
    )


async def main(*, initial_only: bool = False) -> None:
    async with engine.begin() as conn:
        schema = await _current_schema(conn)
        has_alembic_version = await _has_alembic_version(conn, schema)
        if not has_alembic_version:
            existing_tables = await _get_existing_schema_tables(conn, schema)
            if existing_tables:
                raise RuntimeError(
                    "alembic_version is missing or empty, but the effective schema "
                    f"{schema!r} already has tables. "
                    "Refusing to run create_all/stamp on a non-empty database. "
                    "Run `python /app/scripts/check_migration_state.py`, back up the database, "
                    "inspect the schema, and stamp only a verified revision."
                )
            if initial_only:
                await _create_legacy_baseline(conn, schema=schema)
                return
            raise RuntimeError(
                "Empty database has not been migrated. Run `alembic upgrade head` before "
                "applying compatibility patches and views."
            )
        elif initial_only:
            print("Alembic version already exists; initial bootstrap skipped")
            return

        await _ensure_compat_columns(conn)
        await _ensure_views(conn)
        print("Database compatibility patches and views are ready")


if __name__ == "__main__":
    asyncio.run(main(initial_only="--initial-only" in sys.argv[1:]))
