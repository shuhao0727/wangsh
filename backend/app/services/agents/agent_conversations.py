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
    agent_id: int | None = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    # A session has the same identity here and in the detail endpoint. Filter
    # session membership after aggregation so another agent's (or NULL-agent)
    # messages in the same user's session still contribute to its summary.
    agent_filter = (
        "HAVING sum(CASE WHEN agent_id = :agent_id THEN 1 ELSE 0 END) > 0"
        if agent_id is not None else ""
    )
    # Rank within each message type using the reverse of detail's (created_at, id)
    # order. Keep all ranked rows for counts and agent membership; only preview
    # takes rank 1, preserving answer-first/blank fallback below.
    sql = text(
        f"""
        WITH ranked_messages AS (
            SELECT *,
                row_number() OVER (
                    PARTITION BY session_id, message_type
                    ORDER BY created_at DESC, id DESC
                ) AS message_rank
            FROM v_conversations_with_deleted
            WHERE user_id = :user_id
              AND session_id IS NOT NULL
        ), sessions AS (
            SELECT
                session_id,
                CASE WHEN count(agent_id) = count(*) AND count(DISTINCT agent_id) = 1
                     THEN max(agent_id) ELSE NULL END AS agent_id,
                max(created_at) AS last_at,
                max(display_user_name) AS display_user_name,
                CASE WHEN count(agent_id) = count(*) AND count(DISTINCT agent_id) = 1
                     THEN max(display_agent_name) ELSE NULL END AS display_agent_name,
                sum(CASE WHEN message_type='question' THEN 1 ELSE 0 END) AS question_count,
                sum(CASE WHEN message_type='answer' THEN 1 ELSE 0 END) AS answer_count,
                max(CASE WHEN message_type='question' AND message_rank = 1 THEN content END) AS last_question,
                max(CASE WHEN message_type='answer' AND message_rank = 1 THEN content END) AS last_answer
            FROM ranked_messages
            GROUP BY session_id
            {agent_filter}
        )
        SELECT *
        FROM sessions
        ORDER BY last_at DESC, session_id ASC
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
                "agent_id": r.get("agent_id"),
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
