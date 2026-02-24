import re
import json
import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.agents.group_discussion import (
    GroupDiscussionAnalysis,
    GroupDiscussionMember,
    GroupDiscussionMessage,
    GroupDiscussionSession,
)
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
    class_name: str,
    group_no: str,
    group_name: Optional[str] = None,
    user: Dict[str, Any],
) -> GroupDiscussionSession:
    class_name_n = _normalize_class_name(class_name)
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
    if last_member:
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
    if last_member:
        await db.delete(last_member)

    new_mem = GroupDiscussionMember(session_id=row.id, user_id=user_id)
    db.add(new_mem)
    await db.commit()
    
    return row


async def list_today_groups(
    db: AsyncSession,
    *,
    class_name: str,
    keyword: Optional[str] = None,
    limit: int = 50,
) -> List[Any]:
    class_name_n = _normalize_class_name(class_name)
    limit_n = max(1, min(int(limit or 50), 200))
    today = datetime.now().date()
    
    stmt = (
        select(GroupDiscussionSession, func.count(GroupDiscussionMember.id).label("real_member_count"))
        .outerjoin(GroupDiscussionMember, GroupDiscussionSession.id == GroupDiscussionMember.session_id)
        .where(
            GroupDiscussionSession.session_date == today,
            GroupDiscussionSession.class_name == class_name_n,
        )
        .group_by(GroupDiscussionSession.id)
    )
    q = (keyword or "").strip()
    if q:
        stmt = stmt.where(
            (GroupDiscussionSession.group_no.ilike(f"%{q}%"))
            | (GroupDiscussionSession.group_name.ilike(f"%{q}%"))
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


async def enforce_join_lock(*, user_id: int, requested_group_no: str) -> int:
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

    rate_seconds = int(settings.GROUP_DISCUSSION_RATE_LIMIT_SECONDS or 0)
    if rate_seconds > 0:
        rate_key = _gd_key("rate", int(session_id), int(user_id))
        if settings.GROUP_DISCUSSION_REDIS_ENABLED:
            if await cache.exists(rate_key):
                ttl = await cache.ttl(rate_key)
                remain = int(ttl or 0)
                await _gd_metric_incr("send_rate_block")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"发送过于频繁（{max(1, remain)}秒后可再发送）",
                )
            ok = await cache.set(rate_key, 1, expire_seconds=rate_seconds)
            if not ok:
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
    if analysis_type == "learning_topics":
        task = "请提炼本次讨论的学习主题（按重要性排序），并给出每个主题的要点与代表性问题。"
    elif analysis_type == "question_chain":
        task = "请梳理本次讨论的“问题链条”：从最初问题到追问、分歧、验证与结论，按步骤列出。"
    elif analysis_type == "timeline":
        task = "请按时间线总结本次讨论：按3分钟为桶概括每段时间的主要内容、关键问题与结论变化。"
    else:
        task = "请对讨论内容做结构化总结：学习主题、关键观点、问题链条、待解决问题、下一步建议。"
    return (
        f"你是班级小组讨论记录分析助手。\n"
        f"讨论日期：{session.session_date}\n"
        f"班级：{getattr(session, 'class_name', '')}\n"
        f"组号：{session.group_no}\n\n"
        f"{task}\n\n"
        f"讨论记录如下（按时间顺序）：\n{content}\n"
    )


def _default_compare_prompt(*, bucket_seconds: int, content: str) -> str:
    return (
        "你是学习讨论对比分析助手。\n"
        f"请基于下面按时间桶（每{bucket_seconds}秒）汇总的多组讨论记录，输出：\n"
        "1) 每个时间桶的主要学习主题（1-3条）\n"
        "2) 每个时间桶的代表性问题链条（问题→追问→验证/结论）\n"
        "3) 不同小组在同一时间桶的差异点/共性（条目化）\n"
        "4) 最终给出整体结论：各组主要在讨论什么、讨论进展如何、下一步建议。\n\n"
        "请用 Markdown 输出，使用清晰的小标题与列表。\n\n"
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
        raise HTTPException(status_code=422, detail=f"智能体分析失败: {msg}")

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
        raise HTTPException(status_code=422, detail=f"智能体分析失败: {msg}")

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
