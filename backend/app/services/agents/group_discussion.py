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


async def get_or_create_today_session(
    db: AsyncSession,
    *,
    class_name: Optional[str] = None,
    group_no: str,
    group_name: Optional[str] = None,
    user: Dict[str, Any],
) -> GroupDiscussionSession:
    # Prioritize explicit class_name, fallback to user's class_name
    if class_name and class_name.strip():
        raw_class_name = class_name
    else:
        role = str(user.get("role_code") or "")
        if role == "student":
            raw_class_name = (user.get("class_name") or "").strip() or "未知班级"
        else:
            raw_class_name = "管理员"

    class_name_n = _normalize_class_name(raw_class_name)
    group_no_n = _normalize_group_no(group_no)
    group_name_n = _normalize_group_name(group_name)
    user_id = int(user.get("id") or 0)
    today = datetime.now().date()

    # 1. 检查上次加入时间（用于冷却检查）
    last_member = (
        await db.execute(
            select(GroupDiscussionMember)
            .where(GroupDiscussionMember.user_id == user_id)
            .order_by(GroupDiscussionMember.joined_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    # 2. 获取现有 Session (不创建)
    row = (
        await db.execute(
            select(GroupDiscussionSession).where(
                GroupDiscussionSession.session_date == today,
                GroupDiscussionSession.class_name == class_name_n,
                GroupDiscussionSession.group_no == group_no_n,
            )
        )
    ).scalar_one_or_none()

    # 3. 冷却检查逻辑
    # 如果找到了目标 Session，且用户已经在其中，直接返回（无视冷却）
    if row and last_member and last_member.session_id == row.id:
        # 如果是创建者且提供了新组名，更新组名
        if (
            group_name_n
            and not (row.group_name or "").strip()
            and int(row.created_by_user_id or 0) == user_id
        ):
            row.group_name = group_name_n
            await db.commit()
            await db.refresh(row)
        return row

    # 否则（切换或新建），检查冷却
    # 管理员/超级管理员跳过冷却检查
    user_role = str(user.get("role_code") or "")
    if last_member and user_role not in ["admin", "super_admin"]:
        joined_at = last_member.joined_at
        if joined_at.tzinfo is None:
            joined_at = joined_at.replace(tzinfo=timezone.utc)
        
        delta = datetime.now(timezone.utc) - joined_at
        lock_seconds = int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS)
        if delta.total_seconds() < lock_seconds:
            remain = lock_seconds - int(delta.total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"切换小组需等待 {remain} 秒",
            )

    # 4. 获取或创建 Session (如果之前没找到)
    if not row:
        row = GroupDiscussionSession(
            session_date=today,
            class_name=class_name_n,
            group_no=group_no_n,
            group_name=group_name_n,
            created_by_user_id=user_id,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
    else:
        # 如果 Session 已存在但用户不在其中，更新组名（如果是创建者补录）
        if (
            group_name_n
            and not (row.group_name or "").strip()
            and int(row.created_by_user_id or 0) == user_id
        ):
            row.group_name = group_name_n
            await db.commit()
            await db.refresh(row)

    # 5. 处理成员变更
    # 先检查目标 session 中是否已有该用户（防止唯一约束冲突）
    existing_in_target = (
        await db.execute(
            select(GroupDiscussionMember).where(
                GroupDiscussionMember.session_id == row.id,
                GroupDiscussionMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if existing_in_target:
        # 用户已在目标组中，直接返回
        return row

    if last_member:
        prev_session = (
            await db.execute(
                select(GroupDiscussionSession).where(GroupDiscussionSession.id == last_member.session_id)
            )
        ).scalar_one_or_none()
        if prev_session and prev_session.session_date == today:
            await db.delete(last_member)
            await db.flush()

    try:
        new_mem = GroupDiscussionMember(session_id=row.id, user_id=user_id)
        db.add(new_mem)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # 并发请求已插入，忽略冲突

    return row


async def list_today_groups(
    db: AsyncSession,
    *,
    date: Optional[date] = None,
    class_name: Optional[str],
    keyword: Optional[str] = None,
    limit: int = 50,
    ignore_time_limit: bool = False,
) -> List[Any]:
    limit_n = max(1, min(int(limit or 50), 200))
    target_date = date if date else datetime.now().date()
    
    stmt = (
        select(GroupDiscussionSession, func.count(GroupDiscussionMember.id).label("real_member_count"))
        .outerjoin(GroupDiscussionMember, GroupDiscussionSession.id == GroupDiscussionMember.session_id)
        .where(
            GroupDiscussionSession.session_date == target_date,
        )
    )
    if class_name is not None:
        class_name_n = _normalize_class_name(class_name)
        stmt = stmt.where(GroupDiscussionSession.class_name == class_name_n)
    
    stmt = stmt.group_by(GroupDiscussionSession.id)
    q = (keyword or "").strip()
    if q:
        stmt = stmt.where(
            (GroupDiscussionSession.group_no.ilike(f"%{q}%"))
            | (GroupDiscussionSession.group_name.ilike(f"%{q}%"))
        )
    
    if not ignore_time_limit and settings.GROUP_DISCUSSION_LIST_RECENT_HOURS > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.GROUP_DISCUSSION_LIST_RECENT_HOURS)
        stmt = stmt.where(
            func.coalesce(GroupDiscussionSession.last_message_at, GroupDiscussionSession.created_at) >= cutoff
        )

    rows = (
        await db.execute(
            stmt.order_by(
                GroupDiscussionSession.last_message_at.desc().nullslast(),
                GroupDiscussionSession.created_at.desc(),
                GroupDiscussionSession.group_no.asc(),
            ).limit(limit_n)
        )
    ).all()
    # rows is list of (Session, member_count) tuples
    return rows


async def set_group_name(
    db: AsyncSession,
    *,
    session_id: int,
    user: Dict[str, Any],
    group_name: str,
) -> GroupDiscussionSession:
    v = _normalize_group_name(group_name)
    if not v:
        raise HTTPException(status_code=422, detail="组名不能为空")
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == int(session_id)))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")
    if int(session.created_by_user_id or 0) != int(user.get("id") or 0):
        raise HTTPException(status_code=403, detail="只有创建者可以修改组名")
    today = datetime.now().date()
    if session.session_date != today:
        raise HTTPException(status_code=403, detail="只能修改当天讨论组的组名")
    session.group_name = v
    await db.commit()
    await db.refresh(session)
    return session


async def enforce_join_lock(*, user_id: int, requested_group_no: str, user_role: str = "student") -> int:
    # 管理员不受锁定限制
    if user_role in ["admin", "super_admin"]:
        return 0

    if not settings.GROUP_DISCUSSION_REDIS_ENABLED:
        return int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS)
    key = _gd_key("join_lock", int(user_id))
    locked = await cache.get(key)
    ttl = await cache.ttl(key)
    remaining = int(ttl or 0)
    if isinstance(locked, dict):
        locked_group = locked.get("group_no")
        if isinstance(locked_group, str) and locked_group and locked_group != requested_group_no and remaining > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"组号已锁定，{remaining}秒内不可更改",
            )
    await cache.set(key, {"group_no": requested_group_no}, expire_seconds=int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS))
    return int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS)


async def list_messages(
    db: AsyncSession,
    *,
    session_id: int,
    after_id: int = 0,
    limit: int = 50,
) -> Tuple[List[GroupDiscussionMessage], int]:
    limit_n = max(1, min(int(limit or 50), 200))
    if settings.GROUP_DISCUSSION_REDIS_ENABLED:
        cached_last_id = await cache.get(_gd_key("last_id", int(session_id)))
        try:
            last_id_n = int(cached_last_id) if cached_last_id is not None else None
        except Exception:
            last_id_n = None
        if last_id_n is not None and int(after_id or 0) >= last_id_n:
            await _gd_metric_incr("list_fast_empty")
            return [], int(after_id or 0)
    stmt = select(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id == session_id)
    if after_id:
        stmt = stmt.where(GroupDiscussionMessage.id > int(after_id))
    stmt = stmt.order_by(GroupDiscussionMessage.id.asc()).limit(limit_n)
    rows = (await db.execute(stmt)).scalars().all()
    next_after_id = int(rows[-1].id) if rows else int(after_id or 0)
    if rows and settings.GROUP_DISCUSSION_REDIS_ENABLED:
        await cache.set(
            _gd_key("last_id", int(session_id)),
            int(rows[-1].id),
            expire_seconds=int(settings.GROUP_DISCUSSION_LAST_ID_TTL),
        )
        await cache.set(
            _gd_key("last_at", int(session_id)),
            rows[-1].created_at.isoformat(),
            expire_seconds=int(settings.GROUP_DISCUSSION_LAST_AT_TTL),
        )
    await _gd_metric_incr("list_db")
    return rows, next_after_id


async def send_message(
    db: AsyncSession,
    *,
    session_id: int,
    student_user: Dict[str, Any],
    content: str,
) -> GroupDiscussionMessage:
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    now = datetime.now(timezone.utc)
    user_id = int(student_user["id"])

    # 验证是否为该组成员
    is_member = (
        await db.execute(
            select(GroupDiscussionMember).where(
                GroupDiscussionMember.session_id == session_id,
                GroupDiscussionMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not is_member:
        raise HTTPException(status_code=403, detail="请先加入该小组")

    if is_member.muted_until:
        muted_until = is_member.muted_until
        if muted_until.tzinfo is None:
            muted_until = muted_until.replace(tzinfo=timezone.utc)
        if muted_until > now:
            raise HTTPException(status_code=403, detail="您已被禁言")

    rate_seconds = int(settings.GROUP_DISCUSSION_RATE_LIMIT_SECONDS or 0)
    if rate_seconds > 0:
        rate_key = _gd_key("rate", int(session_id), int(user_id))
        if settings.GROUP_DISCUSSION_REDIS_ENABLED:
            # 使用 Redis SET NX EX 原子限流，避免并发请求下重复放行
            acquired = await cache.set(rate_key, 1, expire_seconds=rate_seconds, nx=True)
            if not acquired:
                ttl = await cache.ttl(rate_key)
                remain = int(ttl or 0)
                if remain > 0:
                    await _gd_metric_incr("send_rate_block")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"发送过于频繁（{max(1, remain)}秒后可再发送）",
                    )
                last_created_at = (
                    await db.execute(
                        select(GroupDiscussionMessage.created_at)
                        .where(
                            GroupDiscussionMessage.session_id == session_id,
                            GroupDiscussionMessage.user_id == user_id,
                        )
                        .order_by(GroupDiscussionMessage.created_at.desc())
                        .limit(1)
                    )
                ).scalar_one_or_none()
                if last_created_at is not None:
                    last = last_created_at
                    if last.tzinfo is None:
                        last = last.replace(tzinfo=timezone.utc)
                    if now - last < timedelta(seconds=rate_seconds):
                        await _gd_metric_incr("send_rate_block_db_fallback")
                        raise HTTPException(
                            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail=f"发送过于频繁（每{rate_seconds}秒最多发送1条）",
                        )
                await _gd_metric_incr("send_rate_db_fallback")
        else:
            last_created_at = (
                await db.execute(
                    select(GroupDiscussionMessage.created_at)
                    .where(
                        GroupDiscussionMessage.session_id == session_id,
                        GroupDiscussionMessage.user_id == user_id,
                    )
                    .order_by(GroupDiscussionMessage.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if last_created_at is not None:
                last = last_created_at
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                if now - last < timedelta(seconds=rate_seconds):
                    await _gd_metric_incr("send_rate_block_db")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"发送过于频繁（每{rate_seconds}秒最多发送1条）",
                    )

    text = (content or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="内容不能为空")
    if len(text) > 500:
        raise HTTPException(status_code=422, detail="内容过长（最多500字）")

    msg = GroupDiscussionMessage(
        session_id=session_id,
        user_id=user_id,
        user_display_name=_display_name(student_user),
        content=text,
    )
    db.add(msg)

    session.last_message_at = now
    session.message_count = int(session.message_count or 0) + 1

    await db.commit()
    await db.refresh(msg)

    if settings.GROUP_DISCUSSION_REDIS_ENABLED:
        await cache.set(
            _gd_key("last_id", int(session_id)),
            int(msg.id),
            expire_seconds=int(settings.GROUP_DISCUSSION_LAST_ID_TTL),
        )
        await cache.set(
            _gd_key("last_at", int(session_id)),
            now.isoformat(),
            expire_seconds=int(settings.GROUP_DISCUSSION_LAST_AT_TTL),
        )
        await cache.publish(_gd_key("ch", int(session_id)), int(msg.id))
    await _gd_metric_incr("send_ok")
    return msg


async def mute_member(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
    minutes: int,
) -> None:
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

    now = datetime.now(timezone.utc)
    member.muted_until = now + timedelta(minutes=minutes)
    await db.commit()


async def unmute_member(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
) -> None:
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

    member.muted_until = None
    await db.commit()


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
            stmt.order_by(GroupDiscussionSession.session_date.desc(), GroupDiscussionSession.group_no.asc())
            .offset((page_n - 1) * size_n)
            .limit(size_n)
        )
    ).scalars().all()
    total_pages = (total + size_n - 1) // size_n if size_n else 1
    return rows, total, page_n, total_pages


async def admin_delete_session(
    db: AsyncSession,
    *,
    session_id: int,
) -> None:
    session_id_n = int(session_id)
    exists_row = (
        await db.execute(
            select(GroupDiscussionSession.id).where(GroupDiscussionSession.id == session_id_n)
        )
    ).scalar_one_or_none()
    if not exists_row:
        raise HTTPException(status_code=404, detail="会话不存在")

    await db.execute(
        delete(GroupDiscussionAnalysis).where(GroupDiscussionAnalysis.session_id == session_id_n)
    )
    await db.execute(
        delete(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id == session_id_n)
    )
    await db.execute(
        delete(GroupDiscussionMember).where(GroupDiscussionMember.session_id == session_id_n)
    )
    await db.execute(delete(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id_n))
    await db.commit()


async def admin_delete_sessions(
    db: AsyncSession,
    *,
    session_ids: List[int],
) -> int:
    ids = sorted({int(i) for i in (session_ids or []) if int(i) > 0})
    if not ids:
        return 0

    await db.execute(delete(GroupDiscussionAnalysis).where(GroupDiscussionAnalysis.session_id.in_(ids)))
    await db.execute(delete(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id.in_(ids)))
    await db.execute(delete(GroupDiscussionMember).where(GroupDiscussionMember.session_id.in_(ids)))
    res = await db.execute(delete(GroupDiscussionSession).where(GroupDiscussionSession.id.in_(ids)))
    await db.commit()
    return int(getattr(res, "rowcount", 0) or 0)


async def admin_list_analyses(
    db: AsyncSession,
    *,
    session_id: int,
    limit: int = 20,
) -> List[GroupDiscussionAnalysis]:
    limit_n = max(1, min(int(limit or 20), 100))
    rows = (
        await db.execute(
            select(GroupDiscussionAnalysis)
            .where(GroupDiscussionAnalysis.session_id == int(session_id))
            .order_by(GroupDiscussionAnalysis.created_at.desc())
            .limit(limit_n)
        )
    ).scalars().all()
    return rows


async def admin_list_messages(
    db: AsyncSession,
    *,
    session_id: int,
    page: int,
    size: int,
) -> Tuple[List[GroupDiscussionMessage], int, int, int]:
    page_n = max(1, int(page or 1))
    size_n = max(1, min(int(size or 100), 500))

    base = select(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id == session_id)
    count_stmt = select(func.count()).select_from(base.subquery())
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    rows = (
        await db.execute(
            base.order_by(GroupDiscussionMessage.id.asc())
            .offset((page_n - 1) * size_n)
            .limit(size_n)
        )
    ).scalars().all()
    total_pages = (total + size_n - 1) // size_n if size_n else 1
    return rows, total, page_n, total_pages


def _default_prompt(session: GroupDiscussionSession, analysis_type: str, content: str) -> str:
    ctx = (
        f"你是一位经验丰富的教学分析助手，擅长从学生讨论中发现深层学习问题。\n"
        f"讨论日期：{session.session_date}\n"
        f"班级：{getattr(session, 'class_name', '')}\n"
        f"组号：{session.group_no}\n\n"
    )
    if analysis_type == "learning_topics":
        task = (
            "请深入分析本次讨论的学习主题，输出 Markdown 格式：\n\n"
            "## 一、学习主题（按重要性排序）\n"
            "每个主题请标注：\n"
            "- 讨论深度：浅层提及 / 深入探讨 / 有争议\n"
            "- 核心要点与代表性发言\n"
            "- 学生暴露的认知误区或概念混淆（如有）\n\n"
            "## 二、知识薄弱点\n"
            "从讨论中识别学生理解不到位的知识点，说明判断依据。\n\n"
            "## 三、教学建议\n"
            "针对发现的薄弱点，给教师 3 条具体的补充讲解建议。\n"
        )
    elif analysis_type == "question_chain":
        task = (
            "请深入梳理本次讨论的问题链条，输出 Markdown 格式：\n\n"
            "## 一、问题链条\n"
            "按步骤列出：初始问题 → 追问 → 分歧 → 验证 → 结论。\n"
            "每个问题请标注认知层次（记忆/理解/应用/分析/评价/创造）。\n\n"
            "## 二、断裂点\n"
            "识别问题链中断、话题跳转、无人回应的问题，分析可能原因。\n\n"
            "## 三、解答状态\n"
            "标注哪些问题得到了有效解答，哪些仍悬而未决，未解决的问题给出建议的解答方向。\n"
        )
    elif analysis_type == "timeline":
        task = (
            "请按时间线深入分析本次讨论，输出 Markdown 格式：\n\n"
            "## 一、时间线总结\n"
            "按 3 分钟为桶，每段标注：\n"
            "- 主要内容与关键问题\n"
            "- 讨论质量评估（活跃度高/中/低、深度浅/中/深、是否偏题）\n\n"
            "## 二、关键转折点\n"
            "识别话题转换、突破性理解、争议爆发等关键时刻，说明其教学意义。\n\n"
            "## 三、时间利用效率\n"
            "评估整体时间分配是否合理，哪些阶段效率高/低，给出优化建议。\n"
        )
    else:
        task = (
            "请对本次讨论做深度结构化分析，输出 Markdown 格式：\n\n"
            "## 一、学习主题与关键观点\n"
            "提炼核心主题，列出关键观点和代表性发言。\n\n"
            "## 二、学生参与度评估\n"
            "评估每位学生的参与情况：发言次数、有效发言比例、角色（主导者/跟随者/沉默者）。\n\n"
            "## 三、问题链条与待解决问题\n"
            "梳理讨论中的问题演进，标注已解决和未解决的问题。\n\n"
            "## 四、小组协作质量\n"
            "给出协作质量评分（1-10）及理由，分析互动模式。\n\n"
            "## 五、改进建议\n"
            "- 给学生的 3 条建议\n"
            "- 给教师的 3 条建议\n"
        )
    return f"{ctx}{task}\n讨论记录如下（按时间顺序）：\n{content}\n"


def _default_compare_prompt(*, bucket_seconds: int, content: str) -> str:
    return (
        "你是一位教学数据分析专家，擅长横向对比多个小组的讨论质量。\n"
        f"请基于下面按时间桶（每{bucket_seconds}秒）汇总的多组讨论记录，输出 Markdown 格式：\n\n"
        "## 一、各时间段主题对比\n"
        "每个时间桶的主要学习主题（1-3条），标注各组的讨论侧重点差异。\n\n"
        "## 二、问题链条对比\n"
        "各组的代表性问题链条（问题→追问→验证/结论），对比深度和完整度。\n\n"
        "## 三、讨论质量排名\n"
        "从讨论深度、参与度、问题解决率三个维度对各组排名，给出理由。\n\n"
        "## 四、共性薄弱知识点\n"
        "多个小组都暴露出的共性问题或知识盲点，这些是教师需要重点关注的。\n\n"
        "## 五、优秀讨论片段\n"
        "推荐 2-3 个值得全班分享的优秀讨论片段，说明其价值。\n\n"
        "## 六、教学建议\n"
        "基于以上对比分析，给教师 3 条具体的教学调整建议。\n\n"
        f"{content}\n"
    )


async def admin_analyze_session(
    db: AsyncSession,
    *,
    session_id: int,
    agent_id: int,
    admin_user: Dict[str, Any],
    analysis_type: str,
    prompt: Optional[str],
) -> GroupDiscussionAnalysis:
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    msgs = (
        await db.execute(
            select(GroupDiscussionMessage)
            .where(GroupDiscussionMessage.session_id == session_id)
            .order_by(GroupDiscussionMessage.id.asc())
            .limit(300)
        )
    ).scalars().all()
    content_lines = [f"[{m.created_at}] {m.user_display_name}: {m.content}" for m in msgs]
    joined = "\n".join(content_lines)

    prompt_text = (prompt or "").strip() or _default_prompt(session, analysis_type, joined)
    try:
        result_text = await run_agent_chat_blocking(db, agent_id=agent_id, message=prompt_text, user="admin")
    except ValueError as e:
        msg = str(e)
        if msg.startswith("provider_status_429"):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"智能体分析失败: {msg}")
        result_text = (
            "fallback_analysis\n"
            + f"error={msg}\n"
            + f"session_id={int(session_id)}\n"
            + f"analysis_type={analysis_type}\n"
        ).strip()

    analysis = GroupDiscussionAnalysis(
        session_id=session_id,
        agent_id=agent_id,
        created_by_admin_user_id=int(admin_user["id"]),
        analysis_type=analysis_type,
        prompt=prompt_text,
        result_text=result_text,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


async def admin_compare_analyze_sessions(
    db: AsyncSession,
    *,
    session_ids: List[int],
    agent_id: int,
    admin_user: Dict[str, Any],
    bucket_seconds: int,
    analysis_type: str,
    prompt: Optional[str],
    use_cache: bool = True,
) -> GroupDiscussionAnalysis:
    ids = [int(x) for x in (session_ids or []) if int(x) > 0]
    ids = list(dict.fromkeys(ids))
    if not ids:
        raise HTTPException(status_code=422, detail="请选择要分析的会话")
    if len(ids) > 50:
        raise HTTPException(status_code=422, detail="会话数量过多（最多50个）")

    bucket_n = max(60, min(int(bucket_seconds or 180), 3600))

    sessions = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id.in_(ids)))
    ).scalars().all()
    if not sessions:
        raise HTTPException(status_code=404, detail="未找到会话")

    versions = []
    for s in sessions:
        last_at = getattr(s, "last_message_at", None)
        last_at_s = last_at.isoformat() if last_at is not None else ""
        versions.append({"id": int(s.id), "mc": int(getattr(s, "message_count", 0) or 0), "lm": last_at_s})
    versions.sort(key=lambda x: x["id"])

    bucket_n = max(60, min(int(bucket_seconds or 180), 3600))
    cache_key = None
    if use_cache and settings.GROUP_DISCUSSION_REDIS_ENABLED and int(settings.GROUP_DISCUSSION_COMPARE_CACHE_TTL or 0) > 0:
        raw = json.dumps(
            {
                "ids": ids,
                "bucket": bucket_n,
                "agent": int(agent_id),
                "type": str(analysis_type or "learning_compare"),
                "prompt": (prompt or "").strip(),
                "versions": versions,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
        cache_key = _gd_key("compare_cache", digest)
        cached_id = await cache.get(cache_key)
        try:
            cached_id_n = int(cached_id) if cached_id is not None else None
        except Exception:
            cached_id_n = None
        if cached_id_n is not None and cached_id_n > 0:
            cached_row = (
                await db.execute(select(GroupDiscussionAnalysis).where(GroupDiscussionAnalysis.id == int(cached_id_n)))
            ).scalar_one_or_none()
            if cached_row:
                return cached_row

    msgs = (
        await db.execute(
            select(GroupDiscussionMessage)
            .where(GroupDiscussionMessage.session_id.in_(ids))
            .order_by(GroupDiscussionMessage.created_at.asc(), GroupDiscussionMessage.id.asc())
            .limit(2000)
        )
    ).scalars().all()

    sh_tz = timezone(timedelta(hours=8))
    session_label = {
        int(s.id): f"{s.session_date} · {getattr(s, 'class_name', '')} · {s.group_no}组" for s in sessions
    }

    buckets: Dict[int, List[GroupDiscussionMessage]] = {}
    for m in msgs:
        t = m.created_at
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        key = int(t.timestamp()) // bucket_n
        buckets.setdefault(key, []).append(m)

    lines: List[str] = []
    for bucket_key in sorted(buckets.keys()):
        bucket_msgs = buckets[bucket_key]
        start_ts = bucket_key * bucket_n
        end_ts = start_ts + bucket_n
        start_label = datetime.fromtimestamp(start_ts, tz=timezone.utc).astimezone(sh_tz).strftime("%H:%M:%S")
        end_label = datetime.fromtimestamp(end_ts, tz=timezone.utc).astimezone(sh_tz).strftime("%H:%M:%S")
        lines.append(f"## 时间段 {start_label} - {end_label}\n")

        per_session_count: Dict[int, int] = {}
        for m in bucket_msgs:
            per_session_count[int(m.session_id)] = per_session_count.get(int(m.session_id), 0) + 1
        for sid, cnt in sorted(per_session_count.items(), key=lambda x: (-x[1], x[0])):
            lines.append(f"### {session_label.get(sid, f'会话{sid}')}（{cnt}条）")
            shown = 0
            for m in bucket_msgs:
                if int(m.session_id) != sid:
                    continue
                t = m.created_at
                if t.tzinfo is None:
                    t = t.replace(tzinfo=timezone.utc)
                t_str = t.astimezone(sh_tz).strftime("%H:%M:%S")
                lines.append(f"- {t_str} {m.user_display_name}: {m.content}")
                shown += 1
                if shown >= 40:
                    lines.append("- （该时间段本组消息过多，已截断）")
                    break
            lines.append("")

    content = "\n".join(lines).strip()
    prompt_text = (prompt or "").strip() or _default_compare_prompt(bucket_seconds=bucket_n, content=content)
    try:
        result_text = await run_agent_chat_blocking(db, agent_id=agent_id, message=prompt_text, user="admin")
    except ValueError as e:
        msg = str(e)
        if msg.startswith("provider_status_429"):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"智能体分析失败: {msg}")
        per_session = {int(s.id): int(getattr(s, "message_count", 0) or 0) for s in sessions}
        result_text = (
            "fallback_compare\n"
            + f"error={msg}\n"
            + f"sessions={json.dumps(ids, ensure_ascii=False)}\n"
            + f"message_counts={json.dumps(per_session, ensure_ascii=False)}\n"
        ).strip()

    analysis = GroupDiscussionAnalysis(
        session_id=int(ids[0]),
        agent_id=agent_id,
        created_by_admin_user_id=int(admin_user["id"]),
        analysis_type=analysis_type or "learning_compare",
        prompt=prompt_text,
        result_text=result_text,
        compare_session_ids=json.dumps(ids, ensure_ascii=False),
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    if cache_key:
        await cache.set(cache_key, int(analysis.id), expire_seconds=int(settings.GROUP_DISCUSSION_COMPARE_CACHE_TTL))
    return analysis


async def admin_add_member(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
) -> GroupDiscussionMember:
    # 1. 获取目标会话
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    # 2. 检查用户是否已在当天其他会话中
    existing_member = (
        await db.execute(
            select(GroupDiscussionMember)
            .join(GroupDiscussionSession, GroupDiscussionMember.session_id == GroupDiscussionSession.id)
            .where(
                GroupDiscussionMember.user_id == user_id,
                GroupDiscussionSession.session_date == session.session_date,
            )
        )
    ).scalar_one_or_none()

    if existing_member:
        # 如果已存在，先移除（即移动分组）
        await db.delete(existing_member)

    # 添加新成员
    new_member = GroupDiscussionMember(session_id=session_id, user_id=user_id)
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)
    return new_member


async def admin_remove_member(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
) -> None:
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
    stmt = (
        select(GroupDiscussionMember)
        .options(selectinload(GroupDiscussionMember.user))
        .where(GroupDiscussionMember.session_id == session_id)
        .order_by(GroupDiscussionMember.joined_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def list_classes(db: AsyncSession, *, date: Optional[date] = None) -> List[str]:
    stmt = select(GroupDiscussionSession.class_name).distinct().order_by(GroupDiscussionSession.class_name)
    if date:
        stmt = stmt.where(GroupDiscussionSession.session_date == date)
    rows = await db.execute(stmt)
    return [r for r in rows.scalars().all() if r]


def _student_profile_prompt(
    name: str, session_date: str, class_name: str,
    discussion_lines: List[str], agent_lines: List[str],
) -> str:
    disc_text = "\n".join(discussion_lines) if discussion_lines else "（无发言记录）"
    agent_text = "\n".join(agent_lines) if agent_lines else "（无 AI 提问记录）"
    return (
        "你是一位专业的学生学习行为分析助手。\n"
        f"以下是学生「{name}」在 {session_date}（{class_name}）的学习数据。\n\n"
        f"【小组讨论发言】（{len(discussion_lines)} 条）\n{disc_text}\n\n"
        f"【AI 智能体提问记录】（{len(agent_lines)} 条）\n{agent_text}\n\n"
        "请输出 Markdown 格式的学生学习画像：\n\n"
        "## 一、学习参与度\n"
        "发言频率、主动性、是否积极回应他人、在小组中的角色（引导者/跟随者/质疑者/沉默者）。\n\n"
        "## 二、知识掌握情况\n"
        "从发言和 AI 提问中推断其对哪些知识点掌握较好、哪些较差，给出具体证据。\n\n"
        "## 三、思维特征\n"
        "提问方式分析（直接要答案 vs 尝试理解原理）、思维深度、是否有批判性思考。\n\n"
        "## 四、知识盲点\n"
        "在讨论中暴露的误解 + 向 AI 反复追问的知识点，这些是该学生最需要补强的。\n\n"
        "## 五、学习建议\n"
        "针对该学生的 3 条具体、可操作的学习建议。\n"
    )


async def admin_student_profile_analysis(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
    agent_id: int,
    admin_user: Dict[str, Any],
) -> GroupDiscussionAnalysis:
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    user_name = (user.full_name if user else None) or f"用户{user_id}"

    # 该学生在本 session 的发言
    msgs = (
        await db.execute(
            select(GroupDiscussionMessage)
            .where(GroupDiscussionMessage.session_id == session_id, GroupDiscussionMessage.user_id == user_id)
            .order_by(GroupDiscussionMessage.id.asc()).limit(200)
        )
    ).scalars().all()
    disc_lines = [f"[{m.created_at}] {m.content}" for m in msgs]

    # 该学生同一天的 AI 智能体对话
    day_start = datetime.combine(session.session_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)
    convs = (
        await db.execute(
            select(ZntConversation)
            .where(
                ZntConversation.user_id == user_id,
                ZntConversation.message_type == "question",
                ZntConversation.created_at >= day_start,
                ZntConversation.created_at < day_end,
            )
            .order_by(ZntConversation.created_at.asc()).limit(100)
        )
    ).scalars().all()
    agent_lines = [f"[{c.created_at}] → {c.agent_name or '智能体'}: {c.content}" for c in convs]

    prompt_text = _student_profile_prompt(
        user_name, str(session.session_date), str(session.class_name),
        disc_lines, agent_lines,
    )
    try:
        result_text = await run_agent_chat_blocking(db, agent_id=agent_id, message=prompt_text, user="admin")
    except ValueError as e:
        msg = str(e)
        if msg.startswith("provider_status_429"):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"分析失败: {msg}")
        result_text = f"fallback_student_profile\nerror={msg}\nuser_id={user_id}"

    analysis = GroupDiscussionAnalysis(
        session_id=session_id,
        agent_id=agent_id,
        created_by_admin_user_id=int(admin_user["id"]),
        analysis_type="student_profile",
        prompt=prompt_text,
        result_text=result_text,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


def _cross_system_prompt(discussion_summary: str, agent_questions: str) -> str:
    return (
        "你是一位教学数据分析专家。以下是同一班级学生在同一时间段的两类学习数据。\n\n"
        f"【小组讨论记录摘要】\n{discussion_summary}\n\n"
        f"【AI 智能体提问记录】\n{agent_questions}\n\n"
        "请输出 Markdown 格式的跨系统关联分析：\n\n"
        "## 一、话题关联\n"
        "小组讨论的热点话题与 AI 提问的热门问题是否一致？哪些话题只在讨论中出现？哪些只在 AI 提问中出现？\n\n"
        "## 二、学习路径\n"
        "学生是先讨论再问 AI，还是先问 AI 再回到讨论？这反映了什么学习模式？\n\n"
        "## 三、共性知识盲点\n"
        "两个渠道都反复出现的问题/概念，说明是班级共性薄弱点，列出具体知识点。\n\n"
        "## 四、AI 依赖度分析\n"
        "哪些学生过度依赖 AI（讨论中沉默但频繁问 AI）？哪些学生善于利用两个渠道互补？\n\n"
        "## 五、教学建议\n"
        "基于以上分析，给教师 3 条具体的教学调整建议。\n"
    )


async def admin_cross_system_analysis(
    db: AsyncSession,
    *,
    session_ids: List[int],
    agent_id: int,
    admin_user: Dict[str, Any],
    target_date: Optional[str] = None,
    class_name: Optional[str] = None,
) -> GroupDiscussionAnalysis:
    ids = sorted({int(i) for i in (session_ids or []) if int(i) > 0})
    if not ids:
        raise HTTPException(status_code=422, detail="请选择要分析的会话")

    sessions = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id.in_(ids)))
    ).scalars().all()
    if not sessions:
        raise HTTPException(status_code=404, detail="未找到会话")

    # 小组讨论消息
    msgs = (
        await db.execute(
            select(GroupDiscussionMessage)
            .where(GroupDiscussionMessage.session_id.in_(ids))
            .order_by(GroupDiscussionMessage.created_at.asc())
            .limit(1000)
        )
    ).scalars().all()

    session_label = {int(s.id): f"{s.class_name} {s.group_no}组" for s in sessions}
    disc_lines = []
    for m in msgs:
        label = session_label.get(int(m.session_id), "")
        disc_lines.append(f"[{m.created_at}] {label} {m.user_display_name}: {m.content}")
    disc_summary = "\n".join(disc_lines[:500]) if disc_lines else "（无讨论记录）"

    # 确定日期范围和班级
    dates = sorted({s.session_date for s in sessions})
    day_start = datetime.combine(dates[0], datetime.min.time())
    day_end = datetime.combine(dates[-1], datetime.min.time()) + timedelta(days=1)

    # 收集参与讨论的学生 user_id
    member_rows = (
        await db.execute(
            select(GroupDiscussionMember.user_id).where(GroupDiscussionMember.session_id.in_(ids)).distinct()
        )
    ).scalars().all()
    member_user_ids = [int(uid) for uid in member_rows if uid]

    # 查询这些学生同期的 AI 对话
    conv_stmt = (
        select(ZntConversation)
        .where(
            ZntConversation.message_type == "question",
            ZntConversation.created_at >= day_start,
            ZntConversation.created_at < day_end,
        )
        .order_by(ZntConversation.created_at.asc())
        .limit(500)
    )
    if member_user_ids:
        conv_stmt = conv_stmt.where(ZntConversation.user_id.in_(member_user_ids))

    convs = (await db.execute(conv_stmt)).scalars().all()
    agent_lines = [f"[{c.created_at}] {c.user_name or '学生'} → {c.agent_name or '智能体'}: {c.content}" for c in convs]
    agent_text = "\n".join(agent_lines[:500]) if agent_lines else "（无 AI 提问记录）"

    prompt_text = _cross_system_prompt(disc_summary, agent_text)
    try:
        result_text = await run_agent_chat_blocking(db, agent_id=agent_id, message=prompt_text, user="admin")
    except ValueError as e:
        msg = str(e)
        if msg.startswith("provider_status_429"):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"分析失败: {msg}")
        result_text = f"fallback_cross_system\nerror={msg}\nsessions={json.dumps(ids)}"

    analysis = GroupDiscussionAnalysis(
        session_id=int(ids[0]),
        agent_id=agent_id,
        created_by_admin_user_id=int(admin_user["id"]),
        analysis_type="cross_system",
        prompt=prompt_text,
        result_text=result_text,
        compare_session_ids=json.dumps(ids, ensure_ascii=False),
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis
