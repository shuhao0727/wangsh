import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text
from app.db.database import engine
from app.models import Base


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True))
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
        # 创建功能必需的视图（不受 AUTO_CREATE_TABLES 控制）
        await conn.execute(text("""
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
        """))
        print("Database tables and views created successfully")


if __name__ == "__main__":
    asyncio.run(main())
