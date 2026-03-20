"""
智能体分析服务
提供热门问题分析和学生对话链分析功能
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.core import User


async def analyze_hot_questions(
    db: AsyncSession,
    *,
    agent_id: int,
    start_at: datetime,
    end_at: datetime,
    bucket_seconds: int = 60,
    top_n: int = 10,
) -> List[Dict[str, Any]]:
    if bucket_seconds <= 0:
        bucket_seconds = 60
    if top_n <= 0:
        top_n = 10
    if top_n > 50:
        top_n = 50

    bucket_sql = text(
        """
        WITH q AS (
            SELECT
                user_id,
                content,
                created_at,
                to_timestamp(floor(extract(epoch from created_at) / :bucket_seconds) * :bucket_seconds) AS bucket_start
            FROM v_conversations_with_deleted
            WHERE agent_id = :agent_id
              AND message_type = 'question'
              AND created_at >= :start_at
              AND created_at < :end_at
        ),
        bucket_stats AS (
            SELECT
                bucket_start,
                count(*) AS question_count,
                count(distinct user_id) AS unique_students
            FROM q
            GROUP BY bucket_start
        ),
        question_rank AS (
            SELECT
                bucket_start,
                content AS question,
                count(*) AS cnt,
                row_number() OVER (PARTITION BY bucket_start ORDER BY count(*) DESC, max(created_at) DESC) AS rn
            FROM q
            GROUP BY bucket_start, content
        )
        SELECT
            bs.bucket_start,
            bs.question_count,
            bs.unique_students,
            qr.question,
            qr.cnt,
            qr.rn
        FROM bucket_stats bs
        LEFT JOIN question_rank qr
          ON bs.bucket_start = qr.bucket_start
         AND qr.rn <= :top_n
        ORDER BY bs.bucket_start ASC, qr.rn ASC
        """
    )
    result = await db.execute(
        bucket_sql,
        {
            "agent_id": agent_id,
            "start_at": start_at,
            "end_at": end_at,
            "bucket_seconds": bucket_seconds,
            "top_n": top_n,
        },
    )
    rows = result.mappings().all()

    buckets: Dict[Any, Dict[str, Any]] = {}
    for r in rows:
        bucket_start = r.get("bucket_start")
        if bucket_start not in buckets:
            buckets[bucket_start] = {
                "bucket_start": bucket_start,
                "question_count": int(r.get("question_count") or 0),
                "unique_students": int(r.get("unique_students") or 0),
                "top_questions": [],
            }
        question = r.get("question")
        cnt = r.get("cnt")
        rn = r.get("rn")
        if question and cnt is not None and rn is not None:
            buckets[bucket_start]["top_questions"].append(
                {"question": question, "count": int(cnt)}
            )

    return list(buckets.values())


async def analyze_student_chains(
    db: AsyncSession,
    *,
    agent_id: int,
    user_id: Optional[int] = None,
    student_id: Optional[str] = None,
    class_name: Optional[str] = None,
    start_at: datetime,
    end_at: datetime,
    limit_sessions: int = 5,
) -> List[Dict[str, Any]]:
    resolved_user_id: Optional[int] = user_id
    if resolved_user_id is None and student_id:
        user_result = await db.execute(select(User).where(User.student_id == student_id))
        user = user_result.scalar_one_or_none()
        resolved_user_id = int(user.id) if user else None

    if resolved_user_id is None and not class_name:
        return []

    if limit_sessions <= 0:
        limit_sessions = 5
    if limit_sessions > 20:
        limit_sessions = 20

    class_name_value = (class_name or "").strip() or None
    class_name_like = f"%{class_name_value}%" if class_name_value else None

    sessions_sql = text(
        """
        SELECT
            c.session_id,
            max(c.created_at) AS last_at,
            sum(CASE WHEN c.message_type = 'question' THEN 1 ELSE 0 END) AS turns,
            max(u.student_id) AS student_id,
            max(u.full_name) AS user_name,
            max(u.class_name) AS class_name
        FROM v_conversations_with_deleted c
        JOIN sys_users u ON u.id = c.user_id
        WHERE c.agent_id = :agent_id
          AND (CAST(:user_id AS INTEGER) IS NULL OR c.user_id = CAST(:user_id AS INTEGER))
          AND (CAST(:class_name_like AS TEXT) IS NULL OR u.class_name ILIKE CAST(:class_name_like AS TEXT))
          AND c.session_id IS NOT NULL
          AND c.created_at >= :start_at
          AND c.created_at < :end_at
        GROUP BY c.session_id
        ORDER BY last_at DESC
        LIMIT :limit_sessions
        """
    )
    sessions_result = await db.execute(
        sessions_sql,
        {
            "agent_id": agent_id,
            "user_id": resolved_user_id,
            "class_name_like": class_name_like,
            "start_at": start_at,
            "end_at": end_at,
            "limit_sessions": limit_sessions,
        },
    )
    session_rows = sessions_result.mappings().all()
    session_ids = [r.get("session_id") for r in session_rows if r.get("session_id")]
    if not session_ids:
        return []

    messages_sql = text(
        """
        SELECT
            c.id,
            c.session_id,
            c.message_type,
            c.content,
            c.created_at
        FROM v_conversations_with_deleted c
        WHERE c.agent_id = :agent_id
          AND c.session_id = ANY(:session_ids)
          AND c.created_at >= :start_at
          AND c.created_at < :end_at
        ORDER BY c.session_id ASC, c.created_at ASC, c.id ASC
        """
    )
    messages_result = await db.execute(
        messages_sql,
        {
            "agent_id": agent_id,
            "session_ids": session_ids,
            "start_at": start_at,
            "end_at": end_at,
        },
    )
    msg_rows = messages_result.mappings().all()

    by_session: Dict[str, Dict[str, Any]] = {}
    for s in session_rows:
        sid = s.get("session_id")
        if not sid:
            continue
        by_session[sid] = {
            "session_id": sid,
            "last_at": s.get("last_at"),
            "turns": int(s.get("turns") or 0),
            "student_id": s.get("student_id"),
            "user_name": s.get("user_name"),
            "class_name": s.get("class_name"),
            "messages": [],
        }

    for m in msg_rows:
        sid = m.get("session_id")
        if sid not in by_session:
            continue
        by_session[sid]["messages"].append(
            {
                "id": int(m.get("id")),
                "message_type": m.get("message_type"),
                "content": m.get("content"),
                "created_at": m.get("created_at"),
            }
        )

    ordered = [by_session[sid] for sid in session_ids if sid in by_session]
    return ordered
