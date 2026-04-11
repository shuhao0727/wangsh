"""
Group Discussion 分析服务模块

包含所有分析相关的函数，包括单会话分析、对比分析、学生画像分析和跨系统分析。
"""

import json
import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.agents.group_discussion import GroupDiscussionAnalysis, GroupDiscussionMessage, GroupDiscussionSession, GroupDiscussionMember
from app.models.agents.ai_agent import ZntConversation
from app.models.core.user import User
from app.services.agents.chat_blocking import run_agent_chat_blocking
from app.utils.cache import cache

from .core import _gd_key
from .prompts import _default_prompt, _default_compare_prompt, _student_profile_prompt, _cross_system_prompt


async def admin_analyze_session(
    db: AsyncSession,
    *,
    session_id: int,
    agent_id: int,
    admin_user: Dict[str, Any],
    analysis_type: str,
    prompt: Optional[str],
) -> GroupDiscussionAnalysis:
    """管理员分析单个会话"""
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
    """管理员对比分析多个会话"""
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


async def admin_student_profile_analysis(
    db: AsyncSession,
    *,
    session_id: int,
    user_id: int,
    agent_id: int,
    admin_user: Dict[str, Any],
) -> GroupDiscussionAnalysis:
    """管理员分析学生画像"""
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


async def admin_cross_system_analysis(
    db: AsyncSession,
    *,
    session_ids: List[int],
    agent_id: int,
    admin_user: Dict[str, Any],
    target_date: Optional[str] = None,
    class_name: Optional[str] = None,
) -> GroupDiscussionAnalysis:
    """管理员进行跨系统分析（小组讨论 + AI 智能体）"""
    ids = sorted({int(i) for i in (session_ids or []) if int(i) > 0})
    if not ids:
        raise HTTPException(status_code=422, detail="请选择要分析的会话")

    target_day: Optional[date] = None
    date_text = (target_date or "").strip()
    if date_text:
        try:
            target_day = date.fromisoformat(date_text)
        except ValueError:
            raise HTTPException(status_code=422, detail="日期格式不正确，请使用 YYYY-MM-DD")

    target_class_name: Optional[str] = None
    class_text = (class_name or "").strip()
    if class_text:
        from .core import _normalize_class_name
        target_class_name = _normalize_class_name(class_text)

    sessions = (
        await db.execute(select(GroupDiscussionSession).where(GroupDiscussionSession.id.in_(ids)))
    ).scalars().all()
    if not sessions:
        raise HTTPException(status_code=404, detail="未找到会话")

    if target_day is not None:
        mismatch = [int(s.id) for s in sessions if s.session_date != target_day]
        if mismatch:
            raise HTTPException(status_code=422, detail="所选会话与指定日期不一致")
    if target_class_name is not None:
        mismatch = [int(s.id) for s in sessions if str(getattr(s, "class_name", "")) != target_class_name]
        if mismatch:
            raise HTTPException(status_code=422, detail="所选会话与指定班级不一致")

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
    if not member_user_ids:
        raise HTTPException(status_code=422, detail="所选会话暂无成员，无法进行跨系统分析")

    # 查询这些学生同期的 AI 对话
    if target_day is not None:
        day_start = datetime.combine(target_day, datetime.min.time())
        day_end = day_start + timedelta(days=1)

    conv_stmt = (
        select(ZntConversation)
        .where(
            ZntConversation.message_type == "question",
            ZntConversation.created_at >= day_start,
            ZntConversation.created_at < day_end,
            ZntConversation.user_id.in_(member_user_ids),
        )
        .order_by(ZntConversation.created_at.asc())
        .limit(500)
    )

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