"""课堂互动 Service 层"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity, ClassroomResponse

logger = logging.getLogger(__name__)

# ─── SSE pub/sub ───
_subscribers: Dict[str, Dict[str, asyncio.Queue]] = {}  # channel -> {sub_id: queue}


def _publish(channel: str, event: dict):
    """向指定频道的所有订阅者推送事件"""
    subs = _subscribers.get(channel, {})
    for q in subs.values():
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


def subscribe(channel: str, sub_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.setdefault(channel, {})[sub_id] = q
    return q


def unsubscribe(channel: str, sub_id: str):
    subs = _subscribers.get(channel, {})
    subs.pop(sub_id, None)
    if not subs:
        _subscribers.pop(channel, None)


# ─── CRUD ───

async def create_activity(db: AsyncSession, data: dict, user_id: int) -> ClassroomActivity:
    activity = ClassroomActivity(
        activity_type=data["activity_type"],
        title=data["title"],
        options=[o if isinstance(o, dict) else o.dict() for o in (data.get("options") or [])],
        correct_answer=data.get("correct_answer"),
        allow_multiple=data.get("allow_multiple", False),
        time_limit=data.get("time_limit", 60),
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
        raise ValueError("只能编辑草稿状态的活动")
    for k, v in data.items():
        if v is not None:
            if k == "options" and v is not None:
                v = [o if isinstance(o, dict) else o.dict() for o in v]
            setattr(activity, k, v)
    await db.commit()
    await db.refresh(activity)
    return activity


async def delete_activity(db: AsyncSession, activity_id: int):
    activity = await _get_activity(db, activity_id)
    if activity.status != "draft":
        raise ValueError("只能删除草稿状态的活动")
    await db.delete(activity)
    await db.commit()


async def list_activities(db: AsyncSession, *, skip: int = 0, limit: int = 20, status: Optional[str] = None):
    q = select(ClassroomActivity).order_by(ClassroomActivity.id.desc())
    count_q = select(func.count(ClassroomActivity.id))
    if status:
        q = q.where(ClassroomActivity.status == status)
        count_q = count_q.where(ClassroomActivity.status == status)
    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(q.offset(skip).limit(limit))).scalars().all()
    # 批量获取 response_count
    if rows:
        ids = [r.id for r in rows]
        rc_q = select(ClassroomResponse.activity_id, func.count(ClassroomResponse.id)).where(
            ClassroomResponse.activity_id.in_(ids)
        ).group_by(ClassroomResponse.activity_id)
        rc_rows = (await db.execute(rc_q)).all()
        rc_map = {r[0]: r[1] for r in rc_rows}
        for r in rows:
            r._response_count = rc_map.get(r.id, 0)
    return rows, total

# PLACEHOLDER_MORE_FUNCTIONS


async def get_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    return await _get_activity(db, activity_id)


async def start_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    activity = await _get_activity(db, activity_id)
    if activity.status != "draft":
        raise ValueError("只能开始草稿状态的活动")
    # 自动结束同教师其他 active 活动
    active_q = select(ClassroomActivity).where(
        ClassroomActivity.created_by == activity.created_by,
        ClassroomActivity.status == "active",
    )
    active_rows = (await db.execute(active_q)).scalars().all()
    now = datetime.now(timezone.utc)
    for a in active_rows:
        a.status = "ended"
        a.ended_at = now
    activity.status = "active"
    activity.started_at = now
    await db.commit()
    await db.refresh(activity)
    _publish("student", {"type": "activity_started", "activity_id": activity.id})
    _publish(f"admin_{activity.created_by}", {"type": "activity_started", "activity_id": activity.id})
    return activity


async def end_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    activity = await _get_activity(db, activity_id)
    if activity.status != "active":
        raise ValueError("只能结束进行中的活动")
    activity.status = "ended"
    activity.ended_at = datetime.now(timezone.utc)
    # 自动判分
    if activity.correct_answer:
        responses = (await db.execute(
            select(ClassroomResponse).where(ClassroomResponse.activity_id == activity_id)
        )).scalars().all()
        for r in responses:
            r.is_correct = _check_correct(r.answer, activity.correct_answer, activity.allow_multiple)
    await db.commit()
    await db.refresh(activity)
    _publish("student", {"type": "activity_ended", "activity_id": activity.id})
    _publish(f"admin_{activity.created_by}", {"type": "activity_ended", "activity_id": activity.id})
    return activity


async def check_and_auto_end(db: AsyncSession, activity_id: int) -> bool:
    activity = (await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.id == activity_id)
    )).scalar_one_or_none()
    if not activity or activity.status != "active":
        return False
    if activity.time_limit <= 0 or not activity.started_at:
        return False
    now = datetime.now(timezone.utc)
    elapsed = (now - activity.started_at).total_seconds()
    if elapsed >= activity.time_limit:
        await end_activity(db, activity_id)
        return True
    return False

# PLACEHOLDER_SUBMIT_AND_STATS


async def submit_response(db: AsyncSession, activity_id: int, user_id: int, answer: str) -> ClassroomResponse:
    activity = await _get_activity(db, activity_id)
    if activity.status != "active":
        raise ValueError("活动未在进行中")
    # 检查超时
    if activity.time_limit > 0 and activity.started_at:
        elapsed = (datetime.now(timezone.utc) - activity.started_at).total_seconds()
        if elapsed > activity.time_limit + 2:  # 2s 容差
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
    await db.commit()
    await db.refresh(resp)
    _publish(f"admin_{activity.created_by}", {
        "type": "new_response", "activity_id": activity_id,
    })
    return resp


async def get_statistics(db: AsyncSession, activity_id: int) -> dict:
    activity = await _get_activity(db, activity_id)
    responses = (await db.execute(
        select(ClassroomResponse).where(ClassroomResponse.activity_id == activity_id)
    )).scalars().all()
    total = len(responses)
    correct_count = sum(1 for r in responses if r.is_correct is True)
    option_counts: Optional[dict] = None
    blank_slot_stats: Optional[list] = None
    top_wrong_answers: Optional[list] = None
    if activity.activity_type == "vote" and activity.options:
        option_counts = {}
        for opt in activity.options:
            key = opt["key"] if isinstance(opt, dict) else opt.key
            option_counts[key] = sum(1 for r in responses if key in (r.answer or "").split(","))
    elif activity.activity_type == "fill_blank" and activity.correct_answer:
        correct_parts = _parse_blank_answers(activity.correct_answer)
        if correct_parts is None:
            correct_parts = [activity.correct_answer.strip()]
        slot_wrong_maps: list[dict[str, int]] = [dict() for _ in range(len(correct_parts))]
        slot_correct_counts = [0 for _ in range(len(correct_parts))]
        overall_wrong_map: dict[str, int] = {}
        for r in responses:
            student_parts = _parse_blank_answers(r.answer or "")
            if student_parts is None:
                student_parts = [(r.answer or "").strip()]
            for idx, right in enumerate(correct_parts):
                student_val = student_parts[idx].strip() if idx < len(student_parts) else ""
                if student_val.upper() == right.strip().upper():
                    slot_correct_counts[idx] += 1
                elif student_val:
                    slot_wrong_maps[idx][student_val] = slot_wrong_maps[idx].get(student_val, 0) + 1
            combined_wrong = " | ".join(student_parts).strip()
            if not r.is_correct and combined_wrong:
                overall_wrong_map[combined_wrong] = overall_wrong_map.get(combined_wrong, 0) + 1
        blank_slot_stats = []
        for idx, right in enumerate(correct_parts):
            wrong_top = sorted(slot_wrong_maps[idx].items(), key=lambda x: x[1], reverse=True)[:5]
            blank_slot_stats.append({
                "slot_index": idx + 1,
                "correct_answer": right,
                "total_count": total,
                "correct_count": slot_correct_counts[idx],
                "correct_rate": round(slot_correct_counts[idx] / total * 100, 1) if total > 0 else None,
                "top_wrong_answers": [{"answer": k, "count": v} for k, v in wrong_top],
            })
        top_wrong_answers = [
            {"answer": k, "count": v}
            for k, v in sorted(overall_wrong_map.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
    return {
        "activity_id": activity_id,
        "total_responses": total,
        "option_counts": option_counts,
        "correct_count": correct_count,
        "correct_rate": round(correct_count / total * 100, 1) if total > 0 else None,
        "blank_slot_stats": blank_slot_stats,
        "top_wrong_answers": top_wrong_answers,
    }


async def get_active_activities(db: AsyncSession) -> List[ClassroomActivity]:
    rows = (await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.status == "active")
        .order_by(ClassroomActivity.started_at.desc())
    )).scalars().all()
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


# ─── helpers ───

async def _get_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    activity = (await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.id == activity_id)
    )).scalar_one_or_none()
    if not activity:
        raise ValueError("活动不存在")
    return activity


def _check_correct(student_answer: str, correct_answer: str, allow_multiple: bool) -> bool:
    parsed_correct = _parse_blank_answers(correct_answer)
    if parsed_correct is not None:
        parsed_student = _parse_blank_answers(student_answer)
        if parsed_student is None:
            parsed_student = [student_answer.strip()]
        if len(parsed_student) != len(parsed_correct):
            return False
        for idx in range(len(parsed_correct)):
            if parsed_student[idx].strip().upper() != parsed_correct[idx].strip().upper():
                return False
        return True
    if allow_multiple:
        student_set = set(s.strip().upper() for s in student_answer.split(",") if s.strip())
        correct_set = set(s.strip().upper() for s in correct_answer.split(",") if s.strip())
        return student_set == correct_set
    return student_answer.strip().upper() == correct_answer.strip().upper()


def _parse_blank_answers(value: str) -> Optional[List[str]]:
    raw = (value or "").strip()
    if not raw:
        return []
    if not raw.startswith("[") and not raw.startswith("{"):
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    if isinstance(parsed, list):
        return [str(x).strip() for x in parsed]
    if isinstance(parsed, dict):
        keys = sorted(parsed.keys(), key=lambda k: int(k) if str(k).isdigit() else str(k))
        return [str(parsed[k]).strip() for k in keys]
    return None
