"""
Group Discussion 核心模块

包含工具函数、核心业务逻辑和管理员基础函数。
"""

import re
import json
import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import delete, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.agents.group_discussion import (
    GroupDiscussionAnalysis,
    GroupDiscussionMember,
    GroupDiscussionMessage,
    GroupDiscussionSession,
)
from app.models.agents.ai_agent import ZntConversation
from app.models.core.user import User
from app.services.agents.chat_blocking import run_agent_chat_blocking
from app.utils.cache import cache


_GROUP_NO_RE = re.compile(r"^[0-9]{1,16}$")
_CLASS_NAME_RE = re.compile(r"^[^\s]{1,64}$")


# ============================================================================
# 工具函数
# ============================================================================

def _gd_key(prefix: str, *parts: Any) -> str:
    base = f"znt:group_discussion:{prefix}"
    if not parts:
        return base
    return base + ":" + ":".join(str(p) for p in parts)


async def _gd_metric_incr(name: str, amount: int = 1) -> None:
    if not settings.GROUP_DISCUSSION_METRICS_ENABLED:
        return
    await cache.increment(_gd_key("metrics", name), amount=amount)


def _normalize_group_no(group_no: str) -> str:
    v = (group_no or "").strip()
    if not _GROUP_NO_RE.match(v):
        raise HTTPException(status_code=422, detail="组号格式不正确（仅允许数字）")
    return v


def _normalize_class_name(class_name: str) -> str:
    v = (class_name or "").strip()
    if not _CLASS_NAME_RE.match(v):
        raise HTTPException(status_code=422, detail="班级格式不正确")
    return v


def _normalize_group_name(group_name: Optional[str]) -> Optional[str]:
    if group_name is None:
        return None
    v = str(group_name).strip()
    if not v:
        return None
    if len(v) > 64:
        raise HTTPException(status_code=422, detail="组名长度不能超过64")
    return v


def _display_name(user: Dict[str, Any]) -> str:
    for k in ["full_name", "student_id", "username"]:
        v = user.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return f"用户{user.get('id')}"


# ============================================================================
# 核心业务函数
# ============================================================================

def resolve_target_class_name(*, user: Dict[str, Any], class_name: Optional[str]) -> str:
    role = str(user.get("role_code") or "")
    requested_class = (class_name or "").strip()
    user_class = (user.get("class_name") or "").strip()

    if role == "student":
        target = user_class or "未知班级"
        if requested_class:
            requested_n = _normalize_class_name(requested_class)
            target_n = _normalize_class_name(target)
            if requested_n != target_n:
                raise HTTPException(status_code=403, detail="学生只能加入本班小组")
        return _normalize_class_name(target)

    if requested_class:
        return _normalize_class_name(requested_class)
    if user_class:
        return _normalize_class_name(user_class)
    if role in ["admin", "super_admin"]:
        raise HTTPException(status_code=422, detail="管理员加入或创建小组时必须指定班级")
    return _normalize_class_name("管理员")


async def ensure_session_view_access(
    db: AsyncSession,
    *,
    session_id: int,
    user: Dict[str, Any],
) -> None:
    """确保用户有权限查看会话"""
    role = str(user.get("role_code") or "")
    user_id = int(user.get("id") or 0)

    # 首先检查会话是否存在
    session_exists = (
        await db.execute(
            select(GroupDiscussionSession).where(
                GroupDiscussionSession.id == session_id
            )
        )
    ).scalar_one_or_none()
    if not session_exists:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    # 管理员可以查看任何会话
    if role in ["admin", "super_admin"]:
        return

    # 学生只能查看自己所在的会话
    is_member = (
        await db.execute(
            select(GroupDiscussionMember).where(
                GroupDiscussionMember.session_id == session_id,
                GroupDiscussionMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not is_member:
        raise HTTPException(status_code=403, detail="无权查看此讨论组")


# ============================================================================
# 管理员基础函数
# ============================================================================

async def admin_list_sessions(
    db: AsyncSession,
    *,
    start_date: Optional[date],
    end_date: Optional[date],
    class_name: Optional[str],
    group_no: Optional[str],
    group_name: Optional[str],
    user_name: Optional[str],
    page: int,
    size: int,
) -> Tuple[List[GroupDiscussionSession], int, int, int]:
    page_n = max(1, int(page or 1))
    size_n = max(1, min(int(size or 20), 200))

    stmt = select(GroupDiscussionSession)
    if start_date:
        stmt = stmt.where(GroupDiscussionSession.session_date >= start_date)
    if end_date:
        stmt = stmt.where(GroupDiscussionSession.session_date <= end_date)
    if class_name:
        stmt = stmt.where(GroupDiscussionSession.class_name == _normalize_class_name(class_name))
    if group_no:
        stmt = stmt.where(GroupDiscussionSession.group_no == _normalize_group_no(group_no))
    if group_name:
        gn = (group_name or "").strip()
        if gn:
            stmt = stmt.where(GroupDiscussionSession.group_name.ilike(f"%{gn}%"))
    if user_name:
        q = (user_name or "").strip()
        if q:
            stmt = stmt.where(
                exists(
                    select(1).where(
                        GroupDiscussionMessage.session_id == GroupDiscussionSession.id,
                        GroupDiscussionMessage.user_display_name.ilike(f"%{q}%"),
                    )
                )
            )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    rows = (
        await db.execute(
            stmt.order_by(GroupDiscussionSession.session_date.desc(), GroupDiscussionSession.id.desc())
            .offset((page_n - 1) * size_n)
            .limit(size_n)
        )
    ).scalars().all()

    total_pages = (total + size_n - 1) // size_n if total > 0 else 1
    return list(rows), total, page_n, total_pages


async def admin_delete_session(db: AsyncSession, *, session_id: int) -> None:
    """管理员删除会话（级联删除消息、成员、分析记录）"""
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    # 删除相关记录
    await db.execute(delete(GroupDiscussionAnalysis).where(GroupDiscussionAnalysis.session_id == session_id))
    await db.execute(delete(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id == session_id))
    await db.execute(delete(GroupDiscussionMember).where(GroupDiscussionMember.session_id == session_id))
    await db.delete(session)
    await db.commit()


async def admin_delete_sessions(db: AsyncSession, *, session_ids: List[int]) -> None:
    """批量删除会话"""
    if not session_ids:
        return

    ids = [int(i) for i in session_ids if int(i) > 0]
    if not ids:
        return

    # 删除相关记录
    await db.execute(delete(GroupDiscussionAnalysis).where(GroupDiscussionAnalysis.session_id.in_(ids)))
    await db.execute(delete(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id.in_(ids)))
    await db.execute(delete(GroupDiscussionMember).where(GroupDiscussionMember.session_id.in_(ids)))
    await db.execute(delete(GroupDiscussionSession).where(GroupDiscussionSession.id.in_(ids)))
    await db.commit()


async def admin_list_analyses(
    db: AsyncSession,
    *,
    session_id: Optional[int] = None,
    page: int = 1,
    size: int = 20,
) -> Tuple[List[GroupDiscussionAnalysis], int]:
    page_n = max(1, int(page or 1))
    size_n = max(1, min(int(size or 20), 100))

    stmt = select(GroupDiscussionAnalysis)
    if session_id:
        stmt = stmt.where(GroupDiscussionAnalysis.session_id == int(session_id))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    rows = (
        await db.execute(
            stmt.order_by(GroupDiscussionAnalysis.created_at.desc())
            .offset((page_n - 1) * size_n)
            .limit(size_n)
        )
    ).scalars().all()

    return list(rows), total


async def admin_list_messages(
    db: AsyncSession,
    *,
    session_id: int,
    page: int = 1,
    size: int = 50,
) -> Tuple[List[GroupDiscussionMessage], int, int, int]:
    page_n = max(1, int(page or 1))
    size_n = max(1, min(int(size or 50), 200))

    stmt = select(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id == session_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    rows = (
        await db.execute(
            stmt.order_by(GroupDiscussionMessage.id.desc())
            .offset((page_n - 1) * size_n)
            .limit(size_n)
        )
    ).scalars().all()

    total_pages = (total + size_n - 1) // size_n if total > 0 else 1
    return list(rows), total, page_n, total_pages


async def admin_add_member(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
) -> None:
    """管理员添加成员"""
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    # 检查是否已是成员
    existing = (
        await db.execute(
            select(GroupDiscussionMember).where(
                GroupDiscussionMember.session_id == session_id,
                GroupDiscussionMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return  # 已是成员，无需重复添加

    member = GroupDiscussionMember(
        session_id=session_id,
        user_id=user_id,
        joined_at=datetime.now(timezone.utc),
        muted_until=None,
    )
    db.add(member)
    await db.commit()


async def admin_remove_member(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
) -> None:
    """管理员移除成员"""
    member = (
        await db.execute(
            select(GroupDiscussionMember).where(
                GroupDiscussionMember.session_id == session_id,
                GroupDiscussionMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    await db.delete(member)
    await db.commit()


async def admin_list_members(
    db: AsyncSession,
    *,
    session_id: int,
) -> List[GroupDiscussionMember]:
    """列出会话成员"""
    members = (
        await db.execute(
            select(GroupDiscussionMember).where(GroupDiscussionMember.session_id == session_id)
            .order_by(GroupDiscussionMember.joined_at.asc())
        )
    ).scalars().all()
    return list(members)


async def list_classes(db: AsyncSession, *, date: Optional[date] = None) -> List[str]:
    """列出有会话的班级"""
    stmt = select(GroupDiscussionSession.class_name).distinct()
    if date:
        stmt = stmt.where(GroupDiscussionSession.session_date == date)
    else:
        # 默认查最近30天
        cutoff = datetime.now().date() - timedelta(days=30)
        stmt = stmt.where(GroupDiscussionSession.session_date >= cutoff)

    rows = (await db.execute(stmt.order_by(GroupDiscussionSession.class_name.asc()))).scalars().all()
    return [str(c) for c in rows if c]
