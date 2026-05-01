import asyncio
import os
import sys
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text

from app.db.database import engine
from app.models import Base


def _find_alembic_head() -> str:
    versions_dir = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    revisions: set[str] = set()
    down_revisions: set[str] = set()

    for file in versions_dir.glob("*.py"):
        namespace: dict[str, object] = {}
        exec(file.read_text(encoding="utf-8"), namespace)
        revision = namespace.get("revision")
        down_revision = namespace.get("down_revision")
        if isinstance(revision, str):
            revisions.add(revision)
        if isinstance(down_revision, str):
            down_revisions.add(down_revision)
        elif isinstance(down_revision, (tuple, list)):
            down_revisions.update(item for item in down_revision if isinstance(item, str))

    heads = revisions - down_revisions
    if len(heads) != 1:
        raise RuntimeError(f"Expected exactly one Alembic head, found: {sorted(heads)}")
    return next(iter(heads))


async def _has_alembic_version(conn) -> bool:
    table_result = await conn.execute(text("SELECT to_regclass('public.alembic_version')"))
    if table_result.scalar_one_or_none() is None:
        return False
    result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
    return result.scalar_one_or_none() is not None


async def _legacy_create_all_and_stamp(conn) -> None:
    """历史兼容路径：空库可直接创建完整 ORM schema，并标记为当前 Alembic head。"""
    await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True))
    head = _find_alembic_head()
    await conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"))
    await conn.execute(text("DELETE FROM alembic_version"))
    await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:rev)"), {"rev": head})
    print(f"Database schema created and stamped at Alembic head: {head}")


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


async def main() -> None:
    async with engine.begin() as conn:
        if not await _has_alembic_version(conn):
            await _legacy_create_all_and_stamp(conn)

        await _ensure_compat_columns(conn)
        await _ensure_views(conn)
        print("Database compatibility patches and views are ready")


if __name__ == "__main__":
    asyncio.run(main())
