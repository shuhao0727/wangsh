"""课堂互动 Service 层"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

from sqlalchemy import delete, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity, ClassroomResponse
from app.models.core.user import User
from app.services.classroom_analysis import (
    ClassroomAnalysisRetryableError,
    list_candidate_agents as _list_candidate_agents,
    mark_analysis_enqueue_failed,
    normalize_prompt as _normalize_prompt,
    run_auto_analysis_for_ended_activity as _execute_auto_analysis,
)
from app.services.classroom_events import (
    dispatch_activity_events as _dispatch_activity_events,
)
from app.services.classroom_lifecycle import (
    auto_end_overdue_activities as _execute_auto_end,
    ensure_activity_not_overdue as _execute_overdue_check,
)
from app.services.classroom_statistics import (
    check_correct as _check_correct,
    collect_statistics as _collect_statistics,
)

# ─── SSE pub/sub（已提取到 app.core.pubsub，此处保持向后兼容导入）───
from app.core.pubsub import publish, subscribe, unsubscribe  # noqa: F401

# 超时检查节流：最多每30秒执行一次
_last_auto_end_check: float = 0.0


def normalize_class_name(value: Optional[str]) -> Optional[str]:
    """课堂班级统一使用去首尾空白后的非空字符串。"""
    normalized = str(value or "").strip()
    return normalized or None


# ─── CRUD ───

async def create_activity(db: AsyncSession, data: dict, user_id: int) -> ClassroomActivity:
    analysis_prompt = _normalize_prompt(data.get("analysis_prompt"))
    analysis_status = "pending" if data["activity_type"] == "fill_blank" else "not_applicable"
    activity = ClassroomActivity(
        activity_type=data["activity_type"],
        title=data["title"],
        class_name=normalize_class_name(data.get("class_name")),
        description=data.get("description"),
        options=[o if isinstance(o, dict) else o.dict() for o in (data.get("options") or [])],
        correct_answer=data.get("correct_answer"),
        allow_multiple=data.get("allow_multiple", False),
        time_limit=data.get("time_limit", 60),
        analysis_agent_id=data.get("analysis_agent_id"),
        analysis_prompt=analysis_prompt,
        analysis_status=analysis_status,
        status="draft",
        created_by=user_id,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


async def update_activity(db: AsyncSession, activity_id: int, data: dict) -> ClassroomActivity:
    activity = await _get_activity(db, activity_id)
    if activity.status != "draft":
        raise ValueError("只有草稿状态的活动可以编辑")
    for k, v in data.items():
        if v is not None:
            if k == "class_name":
                v = normalize_class_name(v)
            if k == "options" and v is not None:
                v = [o if isinstance(o, dict) else o.dict() for o in v]
            setattr(activity, k, v)
    await db.commit()
    await db.refresh(activity)
    return activity


async def delete_activity(db: AsyncSession, activity_id: int):
    activity = await _get_activity(db, activity_id)
    if activity.status != "draft":
        raise ValueError("只有草稿状态的活动可以删除")
    await db.delete(activity)
    await db.commit()


async def bulk_delete_activities(db: AsyncSession, activity_ids: List[int]) -> dict:
    """批量删除活动，仅草稿状态可删除。"""
    result = await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.id.in_(activity_ids))
    )
    activities = result.scalars().all()
    deleted, skipped = [], []
    for act in activities:
        if act.status == "draft":
            await db.delete(act)
            deleted.append(act.id)
        else:
            skipped.append(act.id)
    await db.commit()
    return {"deleted": deleted, "skipped": skipped}


async def duplicate_activity(db: AsyncSession, activity_id: int, user_id: int) -> ClassroomActivity:
    """复制活动为新草稿"""
    src = await _get_activity(db, activity_id)
    analysis_status = "pending" if src.activity_type == "fill_blank" else "not_applicable"
    new_act = ClassroomActivity(
        activity_type=src.activity_type,
        title=src.title + "（副本）",
        class_name=normalize_class_name(src.class_name),
        description=src.description,
        options=src.options,
        correct_answer=src.correct_answer,
        allow_multiple=src.allow_multiple,
        time_limit=src.time_limit,
        analysis_agent_id=src.analysis_agent_id,
        analysis_prompt=src.analysis_prompt,
        analysis_status=analysis_status,
        status="draft",
        created_by=user_id,
    )
    db.add(new_act)
    await db.commit()
    await db.refresh(new_act)
    return new_act


async def list_activities(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    owner_id: Optional[int] = None,
):
    global _last_auto_end_check
    now = time.monotonic()
    if now - _last_auto_end_check >= 30.0:
        _last_auto_end_check = now
        await _auto_end_overdue_activities(db)
    q = select(ClassroomActivity).order_by(ClassroomActivity.id.desc())
    count_q = select(func.count(ClassroomActivity.id))
    if owner_id is not None:
        q = q.where(ClassroomActivity.created_by == owner_id)
        count_q = count_q.where(ClassroomActivity.created_by == owner_id)
    if status:
        q = q.where(ClassroomActivity.status == status)
        count_q = count_q.where(ClassroomActivity.status == status)
    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(q.offset(skip).limit(limit))).scalars().all()
    # 批量获取 response_count，以 dict 形式返回避免污染 ORM 实例
    rc_map: dict[int, int] = {}
    if rows:
        ids = [r.id for r in rows]
        rc_q = select(ClassroomResponse.activity_id, func.count(ClassroomResponse.id)).where(
            ClassroomResponse.activity_id.in_(ids)
        ).group_by(ClassroomResponse.activity_id)
        rc_rows = (await db.execute(rc_q)).all()
        rc_map = {r[0]: r[1] for r in rc_rows}
    return rows, rc_map, total


async def get_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    activity = await _get_activity(db, activity_id)
    await _ensure_activity_not_overdue(db, activity)
    return activity


def _append_activity_event(
    events: list[dict[str, Any]],
    event_type: str,
    activity: ClassroomActivity,
) -> None:
    events.append(
        {
            "type": event_type,
            "activity_id": activity.id,
            "created_by": activity.created_by,
            "class_name": normalize_class_name(activity.class_name),
        }
    )


async def dispatch_activity_events(
    db: AsyncSession,
    events: list[dict[str, Any]],
) -> None:
    await _dispatch_activity_events(
        db,
        events,
        publish_event=publish,
        enqueue_analysis=_enqueue_auto_analysis,
        mark_enqueue_failed=_mark_analysis_enqueue_failed,
    )


async def start_activity(
    db: AsyncSession,
    activity_id: int,
    *,
    commit: bool = True,
    deferred_events: Optional[list[dict[str, Any]]] = None,
) -> ClassroomActivity:
    activity = await _get_activity(db, activity_id)
    if activity.status != "draft":
        raise ValueError("只能开始草稿状态的活动")
    await _lock_activity_owner(db, activity.created_by)
    activity = await _get_activity_for_update(db, activity_id)
    if activity.status != "draft":
        raise ValueError("只能开始草稿状态的活动")
    events = deferred_events if deferred_events is not None else []
    # 自动结束同教师其他 active 活动
    active_q = select(ClassroomActivity).where(
        ClassroomActivity.created_by == activity.created_by,
        ClassroomActivity.status == "active",
    )
    active_rows = (await db.execute(active_q)).scalars().all()
    now = datetime.now(timezone.utc)
    for a in active_rows:
        await end_activity(
            db,
            a.id,
            commit=False,
            deferred_events=events,
        )
    activity.status = "active"
    activity.started_at = now
    _append_activity_event(events, "activity_started", activity)
    if not commit:
        await db.flush()
        return activity
    try:
        await db.commit()
    except BaseException:
        await db.rollback()
        raise
    await db.refresh(activity)
    await dispatch_activity_events(db, events)
    return activity


async def end_activity(
    db: AsyncSession,
    activity_id: int,
    analysis_agent_id: Optional[int] = None,
    analysis_prompt: Optional[str] = None,
    *,
    commit: bool = True,
    deferred_events: Optional[list[dict[str, Any]]] = None,
) -> ClassroomActivity:
    activity = await _get_activity(db, activity_id)
    if activity.status != "active":
        raise ValueError("只能结束进行中的活动")
    activity = await _get_activity_for_update(db, activity_id)
    if activity.status != "active":
        raise ValueError("只能结束进行中的活动")
    if analysis_agent_id is not None:
        activity.analysis_agent_id = analysis_agent_id
    if analysis_prompt is not None:
        activity.analysis_prompt = _normalize_prompt(analysis_prompt)
    activity.status = "ended"
    activity.ended_at = datetime.now(timezone.utc)
    # 自动判分
    if activity.correct_answer:
        responses = (await db.execute(
            select(ClassroomResponse).where(ClassroomResponse.activity_id == activity_id)
        )).scalars().all()
        for r in responses:
            r.is_correct = _check_correct(r.answer, activity.correct_answer, activity.allow_multiple)
    events = deferred_events if deferred_events is not None else []
    _append_activity_event(events, "activity_ended", activity)
    if not commit:
        await db.flush()
        return activity
    try:
        await db.commit()
    except BaseException:
        await db.rollback()
        raise
    await db.refresh(activity)
    await dispatch_activity_events(db, events)
    await db.refresh(activity)
    return activity


async def restart_activity(
    db: AsyncSession,
    activity_id: int,
    *,
    commit: bool = True,
    deferred_events: Optional[list[dict[str, Any]]] = None,
) -> ClassroomActivity:
    """重新开始一个已结束的活动（清除旧答题，重置为 active）"""
    activity = await _get_activity(db, activity_id)
    if activity.status != "ended":
        raise ValueError("只能重新开始已结束的活动")
    await _lock_activity_owner(db, activity.created_by)
    activity = await _get_activity_for_update(db, activity_id)
    if activity.status != "ended":
        raise ValueError("只能重新开始已结束的活动")
    events = deferred_events if deferred_events is not None else []
    active_q = select(ClassroomActivity).where(
        ClassroomActivity.created_by == activity.created_by,
        ClassroomActivity.status == "active",
        ClassroomActivity.id != activity.id,
    )
    active_rows = (await db.execute(active_q)).scalars().all()
    for active_activity in active_rows:
        await end_activity(
            db,
            active_activity.id,
            commit=False,
            deferred_events=events,
        )
    # 清除旧答题记录
    await db.execute(
        delete(ClassroomResponse).where(ClassroomResponse.activity_id == activity_id)
    )
    # 重置状态
    now = datetime.now(timezone.utc)
    activity.status = "active"
    activity.started_at = now
    activity.ended_at = None
    activity.analysis_status = "pending" if activity.activity_type == "fill_blank" else "not_applicable"
    activity.analysis_result = None
    activity.analysis_context = None
    activity.analysis_error = None
    activity.analysis_updated_at = None
    _append_activity_event(events, "activity_started", activity)
    if not commit:
        await db.flush()
        return activity
    try:
        await db.commit()
    except BaseException:
        await db.rollback()
        raise
    await db.refresh(activity)
    await dispatch_activity_events(db, events)
    return activity


async def check_and_auto_end(db: AsyncSession, activity_id: int) -> bool:
    activity = (await db.execute(select(ClassroomActivity).where(ClassroomActivity.id == activity_id))).scalar_one_or_none()
    if not activity:
        return False
    return await _ensure_activity_not_overdue(db, activity)

# PLACEHOLDER_SUBMIT_AND_STATS


async def submit_response(db: AsyncSession, activity_id: int, user_id: int, answer: str) -> ClassroomResponse:
    activity = await _get_activity(db, activity_id)
    if activity.status != "active":
        raise ValueError("活动未在进行中")
    # FOR SHARE 允许同一活动的学生并发提交，但会阻止教师结束活动，
    # 直到所有已开始的答题事务提交，确保结束统计不会漏掉在途响应。
    activity = await _get_activity_for_update(db, activity_id, read=True)
    if activity.status != "active":
        raise ValueError("活动未在进行中")
    # 检查超时
    if activity.time_limit > 0 and activity.started_at:
        elapsed = (datetime.now(timezone.utc) - activity.started_at).total_seconds()
        if elapsed > activity.time_limit + 2:  # 2s 容差
            # 释放共享锁后再用排他锁结束活动，避免并发答题间锁升级。
            await db.rollback()
            await end_activity(db, activity_id)
            raise ValueError("活动已超时结束")
    # 检查重复
    existing = (await db.execute(
        select(ClassroomResponse).where(
            ClassroomResponse.activity_id == activity_id,
            ClassroomResponse.user_id == user_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise ValueError("已提交过答案")
    is_correct = None
    if activity.correct_answer:
        is_correct = _check_correct(answer, activity.correct_answer, activity.allow_multiple)
    resp = ClassroomResponse(
        activity_id=activity_id, user_id=user_id,
        answer=answer, is_correct=is_correct,
    )
    db.add(resp)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ValueError("已提交过答案") from exc
    await db.refresh(resp)
    await publish(f"admin_{activity.created_by}", {
        "type": "new_response", "activity_id": activity_id,
    })
    await publish("admin_global", {"type": "new_response", "activity_id": activity_id})
    return resp


async def get_statistics(
    db: AsyncSession,
    activity_id: int,
    *,
    include_correct_answers: bool = True,
) -> dict:
    return await _collect_statistics(
        db,
        activity_id,
        include_correct_answers=include_correct_answers,
        get_activity=_get_activity,
    )


async def analyze_fill_blank_stats(db: AsyncSession, activity_id: int, agent_id: Optional[int] = None) -> dict:
    activity = await _get_activity(db, activity_id)
    if activity.activity_type != "fill_blank":
        raise ValueError("仅填空活动支持分析")
    if activity.status != "ended":
        raise ValueError("活动结束后才可查看分析")
    if agent_id is not None:
        activity.analysis_agent_id = agent_id
        await db.commit()
        await _run_auto_analysis_for_ended_activity(
            db,
            activity.id,
            allow_running_retry=True,
        )
        await db.refresh(activity)
    context = activity.analysis_context or {}
    risk_slots = context.get("risk_slots") or []
    return {
        "activity_id": activity.id,
        "agent_id": activity.analysis_agent_id,
        "analysis": activity.analysis_result or "",
        "analysis_context": context,
        "weakest_slot": risk_slots[0] if risk_slots else None,
        "analysis_status": activity.analysis_status,
        "analysis_error": activity.analysis_error,
    }


async def get_active_activities(
    db: AsyncSession,
    class_name: Optional[str] = None,
) -> List[ClassroomActivity]:
    """仅返回与学生非空班级完全匹配的进行中活动。"""
    global _last_auto_end_check
    now = time.monotonic()
    if now - _last_auto_end_check >= 30.0:
        _last_auto_end_check = now
        await _auto_end_overdue_activities(db)
    class_name = normalize_class_name(class_name)
    if not class_name:
        return []
    q = select(ClassroomActivity).where(
        ClassroomActivity.status == "active",
        ClassroomActivity.class_name == class_name,
    )
    q = q.order_by(ClassroomActivity.started_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return list(rows)


async def get_user_response(db: AsyncSession, activity_id: int, user_id: int) -> Optional[ClassroomResponse]:
    return (await db.execute(
        select(ClassroomResponse).where(
            ClassroomResponse.activity_id == activity_id,
            ClassroomResponse.user_id == user_id,
        )
    )).scalar_one_or_none()


def calc_remaining(activity: ClassroomActivity) -> Optional[int]:
    if activity.status != "active" or not activity.started_at or activity.time_limit <= 0:
        return None
    elapsed = (datetime.now(timezone.utc) - activity.started_at).total_seconds()
    remaining = max(0, int(activity.time_limit - elapsed))
    return remaining


async def _run_auto_analysis_for_ended_activity(
    db: AsyncSession,
    activity_id: int,
    *,
    allow_running_retry: bool = False,
) -> None:
    await _execute_auto_analysis(
        db,
        activity_id,
        allow_running_retry=allow_running_retry,
        get_activity_for_update=_get_activity_for_update,
        get_statistics=get_statistics,
        list_candidate_agents=_list_candidate_agents,
    )


async def _enqueue_auto_analysis(activity_id: int) -> None:
    from app.tasks.classroom import analyze_ended_classroom_activity

    await asyncio.to_thread(
        analyze_ended_classroom_activity.apply_async,
        args=[activity_id],
        retry=True,
        retry_policy={
            "max_retries": 3,
            "interval_start": 0,
            "interval_step": 1,
            "interval_max": 3,
        },
    )


async def _mark_analysis_enqueue_failed(
    db: AsyncSession,
    activity_id: int,
    error: Exception,
) -> None:
    await mark_analysis_enqueue_failed(
        db,
        activity_id,
        error,
        get_activity_for_update=_get_activity_for_update,
    )


async def _auto_end_overdue_activities(db: AsyncSession) -> None:
    await _execute_auto_end(db, end_activity=end_activity)


async def _ensure_activity_not_overdue(db: AsyncSession, activity: ClassroomActivity) -> bool:
    return await _execute_overdue_check(
        db,
        activity,
        end_activity=end_activity,
    )


# ─── helpers ───

async def _get_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    activity = (await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.id == activity_id)
    )).scalar_one_or_none()
    if not activity:
        raise ValueError("活动不存在")
    return activity


async def _get_activity_for_update(
    db: AsyncSession,
    activity_id: int,
    *,
    read: bool = False,
) -> ClassroomActivity:
    activity = (
        await db.execute(
            select(ClassroomActivity)
            .where(ClassroomActivity.id == activity_id)
            .with_for_update(read=read)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not activity:
        raise ValueError("活动不存在")
    return activity


async def _lock_activity_owner(db: AsyncSession, user_id: int) -> None:
    """同一教师的活动启动/重启必须串行，保证最多一个 active 活动。"""
    result = await db.execute(
        select(User.id).where(User.id == user_id).with_for_update()
    )
    if result.scalar_one_or_none() is None:
        raise ValueError("活动创建者不存在")
