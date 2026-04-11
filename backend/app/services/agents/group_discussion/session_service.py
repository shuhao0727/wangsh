"""
Group Discussion 会话服务模块

包含会话创建、加入、消息发送、成员管理等核心业务逻辑。
"""

import json
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import delete, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.agents.group_discussion import (
    GroupDiscussionMember,
    GroupDiscussionMessage,
    GroupDiscussionSession,
)
from app.utils.cache import cache

from .core import _gd_key, _gd_metric_incr, _display_name, _normalize_class_name, _normalize_group_no, _normalize_group_name


async def get_or_create_today_session(
    db: AsyncSession,
    *,
    class_name: Optional[str],
    group_no: str,
    group_name: Optional[str],
    user: Dict[str, Any],
) -> GroupDiscussionSession:
    """获取或创建今日会话"""
    role = str(user.get("role_code") or "")
    is_admin = role in {"admin", "super_admin"}
    user_id = int(user["id"])
    user_class = (user.get("class_name") or "").strip()

    # 解析目标班级
    from .core import resolve_target_class_name
    target_class = resolve_target_class_name(user=user, class_name=class_name)

    # 验证组号
    group_no_norm = _normalize_group_no(group_no)

    # 验证组名
    group_name_norm = _normalize_group_name(group_name)

    today = date.today()

    # 管理员跨组发言不依赖成员身份，因此 join 只负责定位/创建目标会话，
    # 不为管理员写入 GroupDiscussionMember，也不读取/切换其成员关系。
    if is_admin:
        target_session = (
            await db.execute(
                select(GroupDiscussionSession)
                .where(
                    GroupDiscussionSession.session_date == today,
                    GroupDiscussionSession.class_name == target_class,
                    GroupDiscussionSession.group_no == group_no_norm,
                )
            )
        ).scalar_one_or_none()

        if not target_session:
            target_session = GroupDiscussionSession(
                session_date=today,
                class_name=target_class,
                group_no=group_no_norm,
                group_name=group_name_norm,
                created_by_user_id=user_id,
                last_message_at=None,
                message_count=0,
            )
            db.add(target_session)
            await db.commit()
            await db.refresh(target_session)
            return target_session

        if target_session.created_by_user_id == user_id and group_name_norm is not None:
            target_session.group_name = group_name_norm
            await db.commit()
            await db.refresh(target_session)

        return target_session

    # 1. 查询用户上次加入的会话（今天）
    last_member = (
        await db.execute(
            select(GroupDiscussionMember)
            .join(GroupDiscussionSession, GroupDiscussionMember.session_id == GroupDiscussionSession.id)
            .where(
                GroupDiscussionMember.user_id == user_id,
                GroupDiscussionSession.session_date == today,
                GroupDiscussionSession.class_name == target_class,
            )
            .order_by(GroupDiscussionMember.joined_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    # 2. 查询目标会话（今天、班级、组号）
    target_session = (
        await db.execute(
            select(GroupDiscussionSession)
            .where(
                GroupDiscussionSession.session_date == today,
                GroupDiscussionSession.class_name == target_class,
                GroupDiscussionSession.group_no == group_no_norm,
            )
        )
    ).scalar_one_or_none()

    # 3. 如果用户已在目标会话中，直接返回
    if last_member and target_session and last_member.session_id == target_session.id:
        # 如果是创建者，可以更新组名
        if target_session.created_by_user_id == user_id and group_name_norm is not None:
            target_session.group_name = group_name_norm
            await db.commit()
            await db.refresh(target_session)
        return target_session

    # 4. 冷却检查（仅对学生）
    if role == "student" and last_member:
        last_joined = last_member.joined_at
        if last_joined.tzinfo is None:
            last_joined = last_joined.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        elapsed = (now - last_joined).total_seconds()
        if elapsed < int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"切换小组需等待 {int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300)} 秒（还剩 {max(1, int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300) - int(elapsed))} 秒）",
            )

    # 5. 如果目标会话不存在，创建新会话
    if not target_session:
        target_session = GroupDiscussionSession(
            session_date=today,
            class_name=target_class,
            group_no=group_no_norm,
            group_name=group_name_norm,
            created_by_user_id=user_id,
            last_message_at=None,
            message_count=0,
        )
        db.add(target_session)
        await db.commit()
        await db.refresh(target_session)

    # 6. 如果用户上次加入的是其他会话，删除旧成员记录
    if last_member and last_member.session_id != target_session.id:
        # 查询上次会话（用于删除成员）
        last_session = (
            await db.execute(
                select(GroupDiscussionSession).where(GroupDiscussionSession.id == last_member.session_id)
            )
        ).scalar_one_or_none()
        if last_session:
            await db.execute(
                delete(GroupDiscussionMember).where(
                    GroupDiscussionMember.session_id == last_member.session_id,
                    GroupDiscussionMember.user_id == user_id,
                )
            )
            await db.commit()

    # 7. 添加用户到目标会话
    new_member = GroupDiscussionMember(
        session_id=target_session.id,
        user_id=user_id,
        joined_at=datetime.now(timezone.utc),
        muted_until=None,
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(target_session)

    return target_session


async def list_today_groups(
    db: AsyncSession,
    *,
    date: Optional[date],
    class_name: Optional[str],
    keyword: Optional[str] = None,
    limit: int = 50,
    ignore_time_limit: bool = False,
) -> List[Tuple[GroupDiscussionSession, int]]:
    """列出今日小组"""
    target_date = date or datetime.now(timezone.utc).date()
    class_raw = (class_name or "").strip()

    stmt = (
        select(GroupDiscussionSession, func.count(GroupDiscussionMember.id).label("member_count"))
        .outerjoin(GroupDiscussionMember, GroupDiscussionSession.id == GroupDiscussionMember.session_id)
        .where(GroupDiscussionSession.session_date == target_date)
        .group_by(GroupDiscussionSession.id)
        .order_by(GroupDiscussionSession.group_no.asc())
        .limit(limit)
    )

    if class_raw:
        class_norm = _normalize_class_name(class_raw)
        stmt = stmt.where(GroupDiscussionSession.class_name == class_norm)

    if keyword:
        kw = f"%{keyword}%"
        stmt = stmt.where(GroupDiscussionSession.group_name.ilike(kw))

    if not ignore_time_limit and settings.GROUP_DISCUSSION_LIST_RECENT_HOURS > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.GROUP_DISCUSSION_LIST_RECENT_HOURS)
        stmt = stmt.where(
            (GroupDiscussionSession.last_message_at >= cutoff) |
            (GroupDiscussionSession.last_message_at.is_(None))
        )

    rows = (await db.execute(stmt)).all()
    return [(session, member_count or 0) for session, member_count in rows]


async def set_group_name(
    db: AsyncSession,
    *,
    session_id: int,
    group_name: Optional[str],
    user: Dict[str, Any],
) -> None:
    """设置组名（仅创建者可修改）"""
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    if session.created_by_user_id != int(user["id"]):
        raise HTTPException(status_code=403, detail="只有创建者可以修改组名")

    session.group_name = _normalize_group_name(group_name)
    await db.commit()


async def enforce_join_lock(*, user_id: int, requested_group_no: str, user_role: str = "student") -> int:
    """检查加入锁（仅对学生生效）"""
    if user_role != "student":
        return int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300)

    if not settings.GROUP_DISCUSSION_REDIS_ENABLED:
        return int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300)

    lock_key = _gd_key("join_lock", int(user_id))
    locked_data = await cache.get(lock_key)
    if locked_data is None:
        return int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300)

    try:
        data = json.loads(locked_data) if isinstance(locked_data, str) else locked_data
        locked_group = str(data.get("group_no", ""))
    except Exception:
        locked_group = ""

    if locked_group == requested_group_no:
        return 0  # 可以加入同一组

    ttl = await cache.ttl(lock_key)
    return max(0, int(ttl or 0))


async def set_join_lock(*, user_id: int, requested_group_no: str, user_role: str = "student") -> None:
    """设置加入锁（仅对学生生效）"""
    if user_role != "student":
        return

    if not settings.GROUP_DISCUSSION_REDIS_ENABLED:
        return

    lock_key = _gd_key("join_lock", int(user_id))
    data = {"group_no": str(requested_group_no)}
    await cache.set(
        lock_key,
        json.dumps(data, ensure_ascii=False),
        expire_seconds=int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300),
        nx=True,
    )


async def list_messages(
    db: AsyncSession,
    *,
    session_id: int,
    after_id: int = 0,
    limit: int = 50,
) -> Tuple[List[GroupDiscussionMessage], int]:
    """列出消息"""
    if settings.GROUP_DISCUSSION_REDIS_ENABLED:
        last_id_key = _gd_key("last_id", int(session_id))
        cached_last_id = await cache.get(last_id_key)
        try:
            cached_last_id_n = int(cached_last_id) if cached_last_id is not None else None
        except Exception:
            cached_last_id_n = None

        if cached_last_id_n is not None and after_id >= cached_last_id_n:
            return [], after_id

    stmt = (
        select(GroupDiscussionMessage)
        .where(
            GroupDiscussionMessage.session_id == session_id,
            GroupDiscussionMessage.id > after_id,
        )
        .order_by(GroupDiscussionMessage.id.asc())
        .limit(limit)
    )

    msgs = (await db.execute(stmt)).scalars().all()
    next_after_id = after_id
    if msgs:
        next_after_id = msgs[-1].id

    return list(msgs), next_after_id


async def send_message(
    db: AsyncSession,
    *,
    session_id: int,
    student_user: Dict[str, Any],
    content: str,
) -> GroupDiscussionMessage:
    """发送消息；管理员可直接向任意讨论组发言，学生需先加入本组。"""
    session = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="讨论组不存在")

    now = datetime.now(timezone.utc)
    user_id = int(student_user["id"])
    role = str(student_user.get("role_code") or "")
    is_admin = role in {"admin", "super_admin"}

    if not is_admin:
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
    """禁言成员"""
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
    if minutes <= 0:
        member.muted_until = None
    else:
        member.muted_until = now + timedelta(minutes=minutes)

    await db.commit()


async def unmute_member(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
) -> None:
    """解除禁言"""
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
