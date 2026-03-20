"""
智能体对话服务
提供用户对话列表和消息查询功能
"""

from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def list_user_conversations(
    db: AsyncSession,
    *,
    user_id: int,
    agent_id: int,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    sql = text(
        """
        WITH sessions AS (
            SELECT
                session_id,
                max(created_at) AS last_at,
                max(display_user_name) AS display_user_name,
                max(display_agent_name) AS display_agent_name,
                sum(CASE WHEN message_type='question' THEN 1 ELSE 0 END) AS question_count,
                sum(CASE WHEN message_type='answer' THEN 1 ELSE 0 END) AS answer_count,
                max(CASE WHEN message_type='question' THEN content END) AS last_question,
                max(CASE WHEN message_type='answer' THEN content END) AS last_answer
            FROM v_conversations_with_deleted
            WHERE user_id = :user_id
              AND agent_id = :agent_id
              AND session_id IS NOT NULL
            GROUP BY session_id
        )
        SELECT *
        FROM sessions
        ORDER BY last_at DESC
        LIMIT :limit
        """
    )
    result = await db.execute(
        sql, {"user_id": user_id, "agent_id": agent_id, "limit": limit}
    )
    rows = result.mappings().all()
    items: List[Dict[str, Any]] = []
    for r in rows:
        last_question = (r.get("last_question") or "").strip()
        last_answer = (r.get("last_answer") or "").strip()
        preview = last_answer or last_question
        if len(preview) > 80:
            preview = preview[:80] + "\u2026"
        items.append(
            {
                "session_id": r.get("session_id"),
                "agent_id": agent_id,
                "display_agent_name": r.get("display_agent_name"),
                "display_user_name": r.get("display_user_name"),
                "last_at": r.get("last_at"),
                "turns": int(r.get("question_count") or 0),
                "preview": preview,
            }
        )
    return items


async def get_conversation_messages(
    db: AsyncSession,
    *,
    user_id: int,
    session_id: str,
) -> List[Dict[str, Any]]:
    sql = text(
        """
        SELECT
            id,
            user_id,
            display_user_name,
            agent_id,
            display_agent_name,
            session_id,
            message_type,
            content,
            response_time_ms,
            created_at
        FROM v_conversations_with_deleted
        WHERE user_id = :user_id
          AND session_id = :session_id
        ORDER BY created_at ASC, id ASC
        """
    )
    result = await db.execute(sql, {"user_id": user_id, "session_id": session_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def get_conversation_messages_admin(
    db: AsyncSession,
    *,
    session_id: str,
) -> List[Dict[str, Any]]:
    sql = text(
        """
        SELECT
            id,
            user_id,
            display_user_name,
            agent_id,
            display_agent_name,
            session_id,
            message_type,
            content,
            response_time_ms,
            created_at
        FROM v_conversations_with_deleted
        WHERE session_id = :session_id
        ORDER BY created_at ASC, id ASC
        """
    )
    result = await db.execute(sql, {"session_id": session_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]
