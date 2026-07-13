import asyncio
import os
import re
import sys
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text

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
VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"


async def _has_alembic_version(conn) -> bool:
    table_result = await conn.execute(text("SELECT to_regclass('public.alembic_version')"))
    if table_result.scalar_one_or_none() is None:
        return False
    result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
    return result.scalar_one_or_none() is not None


async def _get_existing_public_tables(conn) -> set[str]:
    result = await conn.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename != 'alembic_version'
            """
        )
    )
    return {str(row[0]) for row in result}


async def _create_legacy_baseline(conn) -> None:
    """Create only tables that predate the maintained Alembic migration chain."""
    tables = [Base.metadata.tables[name] for name in LEGACY_BASELINE_TABLES]
    await conn.run_sync(
        lambda sync_conn: Base.metadata.create_all(
            sync_conn,
            tables=tables,
            checkfirst=True,
        )
    )
    for index_name in _migration_managed_indexes():
        await conn.execute(text(f'DROP INDEX IF EXISTS "{index_name}"'))
    for table_name, column_name in MIGRATION_ORIGIN_COLUMNS:
        await conn.execute(
            text(f'ALTER TABLE "{table_name}" DROP COLUMN IF EXISTS "{column_name}"')
        )
    await conn.execute(
        text(
            "CREATE TABLE IF NOT EXISTS alembic_version "
            "(version_num VARCHAR(64) NOT NULL)"
        )
    )
    print("Legacy baseline tables created; Alembic version remains unset")


def _migration_managed_indexes() -> set[str]:
    indexes: set[str] = set()
    pattern = re.compile(
        r"""op\.create_index\(\s*(?:op\.f\()?['"]([^'"]+)['"]"""
    )
    for path in VERSIONS_DIR.glob("*.py"):
        indexes.update(pattern.findall(path.read_text(encoding="utf-8")))
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
        has_alembic_version = await _has_alembic_version(conn)
        if not has_alembic_version:
            existing_tables = await _get_existing_public_tables(conn)
            if existing_tables:
                raise RuntimeError(
                    "alembic_version is missing or empty, but public schema already has tables. "
                    "Refusing to run create_all/stamp on a non-empty database. "
                    "Run `python /app/scripts/check_migration_state.py`, back up the database, "
                    "inspect the schema, and stamp only a verified revision."
                )
            if initial_only:
                await _create_legacy_baseline(conn)
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
