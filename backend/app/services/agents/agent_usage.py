"""
智能体使用记录服务
提供使用记录的创建、查询和统计功能
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.agents import AIAgent, ZntConversation
from app.models.core import User


def _parse_usage_datetime(value: Optional[str], is_end: bool = False) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    if is_end:
        return parsed + timedelta(days=1)
    return parsed


def _build_usage_response_from_session(row: Dict[str, Any]) -> Dict[str, Any]:
    user_id = row.get("user_id")
    agent_id = row.get("agent_id")
    display_user_name = row.get("display_user_name")
    display_agent_name = row.get("display_agent_name")

    user = None
    if user_id:
        user = {
            "id": int(user_id),
            "student_id": row.get("student_id"),
            "name": row.get("full_name") or display_user_name,
            "grade": row.get("study_year"),
            "class_name": row.get("class_name"),
            "is_active": row.get("user_is_active"),
        }

    moxing = None
    if agent_id:
        moxing = {
            "id": int(agent_id),
            "agent_name": display_agent_name,
            "agent_type": row.get("agent_type"),
            "model_name": row.get("model_name"),
            "user_id": None,
            "status": row.get("agent_is_active"),
            "description": None,
        }

    return {
        "id": int(row.get("id") or 0),
        "user_id": int(user_id or 0),
        "moxing_id": int(agent_id or 0),
        "question": row.get("question") or "",
        "answer": row.get("answer") or "",
        "session_id": row.get("session_id"),
        "response_time_ms": row.get("response_time_ms"),
        "used_at": row.get("used_at"),
        "created_at": row.get("created_at"),
        "user": user,
        "moxing": moxing,
        "additional_data": None,
    }


async def create_agent_usage(
    db: AsyncSession,
    *,
    agent_id: int,
    user_id: Optional[int] = None,
    question: Optional[str] = None,
    answer: Optional[str] = None,
    session_id: Optional[str] = None,
    response_time_ms: Optional[int] = None,
    used_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    # 对话记录的权威时间必须来自服务端，不能信任浏览器/客户端时间。
    used_at_value = datetime.now(timezone.utc)

    agent_result = await db.execute(select(AIAgent).where(AIAgent.id == agent_id))
    agent = agent_result.scalar_one_or_none()

    user = None
    if user_id is not None:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

    question_row = None
    answer_row = None

    if question:
        question_row = ZntConversation(
            user_id=user.id if user else None,
            user_name=user.full_name if user else None,
            agent_id=agent.id if agent else None,
            agent_name=agent.name if agent else None,
            session_id=session_id,
            message_type="question",
            content=question,
            response_time_ms=response_time_ms,
            created_at=used_at_value,
        )
        db.add(question_row)

    if answer is not None:
        answer_row = ZntConversation(
            user_id=user.id if user else None,
            user_name=user.full_name if user else None,
            agent_id=agent.id if agent else None,
            agent_name=agent.name if agent else None,
            session_id=session_id,
            message_type="answer",
            content=answer,
            response_time_ms=response_time_ms,
            created_at=used_at_value,
        )
        db.add(answer_row)

    await db.commit()
    if answer_row:
        await db.refresh(answer_row)
    elif question_row:
        await db.refresh(question_row)
    persisted_at = (
        answer_row.created_at
        if answer_row is not None
        else (question_row.created_at if question_row is not None else used_at_value)
    )

    return {
        "id": (answer_row.id if answer_row else (question_row.id if question_row else 0)),
        "user_id": (user.id if user else 0),
        "moxing_id": (agent.id if agent else 0),
        "question": question or "",
        "answer": answer or "",
        "session_id": session_id,
        "response_time_ms": response_time_ms,
        "used_at": persisted_at,
        "created_at": persisted_at,
        "user": (
            {
                "id": user.id,
                "student_id": user.student_id,
                "name": user.full_name,
                "grade": user.study_year,
                "class_name": user.class_name,
                "is_active": user.is_active,
            }
            if user
            else None
        ),
        "moxing": (
            {
                "id": agent.id,
                "agent_name": agent.name,
                "agent_type": agent.agent_type,
                "model_name": agent.model_name,
                "user_id": None,
                "status": agent.is_active,
                "description": None,
            }
            if agent
            else None
        ),
        "additional_data": None,
    }


async def get_agent_usage_list(
    db: AsyncSession,
    *,
    keyword: Optional[str] = None,
    student_id: Optional[str] = None,
    student_name: Optional[str] = None,
    class_name: Optional[str] = None,
    grade: Optional[str] = None,
    agent_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    skip: Optional[int] = None,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    start_dt = _parse_usage_datetime(start_date)
    end_dt = _parse_usage_datetime(end_date, is_end=True)

    cte_where: List[str] = ["session_id IS NOT NULL"]
    cte_having: List[str] = []
    outer_where: List[str] = ["1=1"]
    params: Dict[str, Any] = {}

    # 可推入 CTE 的条件（不依赖 JOIN 表）
    if keyword:
        params["keyword"] = f"%{keyword}%"
        cte_having.append(
            "(MAX(CASE WHEN message_type='question' THEN content END) ILIKE :keyword "
            "OR MAX(CASE WHEN message_type='answer' THEN content END) ILIKE :keyword)"
        )
    if start_dt:
        params["start_dt"] = start_dt
        cte_where.append("created_at >= :start_dt")
    if end_dt:
        params["end_dt"] = end_dt
        cte_having.append("MAX(created_at) < :end_dt")

    # 依赖 JOIN 表的条件留在外层
    if student_id:
        params["student_id"] = f"%{student_id}%"
        outer_where.append("u.student_id ILIKE :student_id")
    if student_name:
        params["student_name"] = f"%{student_name}%"
        outer_where.append("(u.full_name ILIKE :student_name OR s.display_user_name ILIKE :student_name)")
    if class_name:
        params["class_name"] = f"%{class_name}%"
        outer_where.append("u.class_name ILIKE :class_name")
    if grade:
        params["grade"] = grade
        outer_where.append("u.study_year = :grade")
    if agent_name:
        params["agent_name"] = f"%{agent_name}%"
        outer_where.append("(a.name ILIKE :agent_name OR s.display_agent_name ILIKE :agent_name)")

    effective_limit = limit or page_size
    effective_skip = skip if skip is not None else max(page - 1, 0) * effective_limit
    params["limit"] = effective_limit
    params["offset"] = effective_skip

    cte_where_sql = " AND ".join(cte_where)
    cte_having_sql = " AND ".join(cte_having) if cte_having else "1=1"
    outer_where_sql = " AND ".join(outer_where)

    cte_sql = f"""
        WITH sessions AS (
            SELECT
                max(id) AS id,
                session_id,
                max(user_id) AS user_id,
                max(display_user_name) AS display_user_name,
                max(agent_id) AS agent_id,
                max(display_agent_name) AS display_agent_name,
                max(CASE WHEN message_type='question' THEN content END) AS question,
                max(CASE WHEN message_type='answer' THEN content END) AS answer,
                max(response_time_ms) AS response_time_ms,
                max(created_at) AS used_at,
                max(created_at) AS created_at
            FROM v_conversations_with_deleted
            WHERE {cte_where_sql}
            GROUP BY session_id
            HAVING {cte_having_sql}
        )
    """

    total_sql = text(
        cte_sql
        + f"""
        SELECT count(*)
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {outer_where_sql}
        """
    )
    total_result = await db.execute(total_sql, params)
    total = int(total_result.scalar() or 0)

    list_sql = text(
        cte_sql
        + f"""
        SELECT
            s.*,
            u.student_id,
            u.full_name,
            u.study_year,
            u.class_name,
            u.is_active AS user_is_active,
            a.agent_type,
            a.model_name,
            a.is_active AS agent_is_active
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {outer_where_sql}
        ORDER BY s.used_at DESC
        OFFSET :offset
        LIMIT :limit
        """
    )
    result = await db.execute(list_sql, params)
    rows = result.mappings().all()
    items = [_build_usage_response_from_session(dict(r)) for r in rows]
    total_pages = (total + effective_limit - 1) // effective_limit if effective_limit else 1

    return {"items": items, "total": total, "page": page, "page_size": effective_limit, "total_pages": total_pages}


async def get_agent_usage_statistics(
    db: AsyncSession,
    *,
    keyword: Optional[str] = None,
    student_id: Optional[str] = None,
    student_name: Optional[str] = None,
    class_name: Optional[str] = None,
    grade: Optional[str] = None,
    agent_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, int]:
    start_dt = _parse_usage_datetime(start_date)
    end_dt = _parse_usage_datetime(end_date, is_end=True)

    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    cte_where: List[str] = ["session_id IS NOT NULL"]
    cte_having: List[str] = []
    outer_where: List[str] = ["1=1"]
    params: Dict[str, Any] = {}

    if keyword:
        params["keyword"] = f"%{keyword}%"
        cte_having.append(
            "(MAX(CASE WHEN message_type='question' THEN content END) ILIKE :keyword "
            "OR MAX(CASE WHEN message_type='answer' THEN content END) ILIKE :keyword)"
        )
    if start_dt:
        params["start_dt"] = start_dt
        cte_where.append("created_at >= :start_dt")
    if end_dt:
        params["end_dt"] = end_dt
        cte_having.append("MAX(created_at) < :end_dt")

    if student_id:
        params["student_id"] = f"%{student_id}%"
        outer_where.append("u.student_id ILIKE :student_id")
    if student_name:
        params["student_name"] = f"%{student_name}%"
        outer_where.append("(u.full_name ILIKE :student_name OR s.display_user_name ILIKE :student_name)")
    if class_name:
        params["class_name"] = f"%{class_name}%"
        outer_where.append("u.class_name ILIKE :class_name")
    if grade:
        params["grade"] = grade
        outer_where.append("u.study_year = :grade")
    if agent_name:
        params["agent_name"] = f"%{agent_name}%"
        outer_where.append("(a.name ILIKE :agent_name OR s.display_agent_name ILIKE :agent_name)")

    cte_where_sql = " AND ".join(cte_where)
    cte_having_sql = " AND ".join(cte_having) if cte_having else "1=1"
    outer_where_sql = " AND ".join(outer_where)

    combined_sql = text(
        f"""
        WITH sessions AS (
            SELECT
                session_id,
                max(user_id) AS user_id,
                max(display_user_name) AS display_user_name,
                max(agent_id) AS agent_id,
                max(display_agent_name) AS display_agent_name,
                max(CASE WHEN message_type='question' THEN content END) AS question,
                max(CASE WHEN message_type='answer' THEN content END) AS answer,
                max(response_time_ms) AS response_time_ms,
                max(created_at) AS used_at
            FROM v_conversations_with_deleted
            WHERE {cte_where_sql}
            GROUP BY session_id
            HAVING {cte_having_sql}
        )
        SELECT
            count(*) AS total_usage,
            count(DISTINCT s.user_id) FILTER (WHERE s.user_id IS NOT NULL) AS active_students,
            count(DISTINCT s.agent_id) FILTER (WHERE s.agent_id IS NOT NULL) AS active_agents,
            coalesce(avg(s.response_time_ms), 0)::int AS avg_response_time,
            count(*) FILTER (WHERE s.used_at >= :today_start) AS today_usage,
            count(*) FILTER (WHERE s.used_at >= :week_start) AS week_usage,
            count(*) FILTER (WHERE s.used_at >= :month_start) AS month_usage
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {outer_where_sql}
        """
    )

    params.update({
        "today_start": today_start,
        "week_start": week_start,
        "month_start": month_start,
    })
    row = (await db.execute(combined_sql, params)).mappings().first()
    result = dict(row) if row else {}

    return {
        "total_usage": int(result.get("total_usage", 0)),
        "active_students": int(result.get("active_students", 0)),
        "active_agents": int(result.get("active_agents", 0)),
        "avg_response_time": int(result.get("avg_response_time", 0)),
        "today_usage": int(result.get("today_usage", 0)),
        "week_usage": int(result.get("week_usage", 0)),
        "month_usage": int(result.get("month_usage", 0)),
    }
