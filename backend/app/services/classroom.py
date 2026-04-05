"""课堂互动 Service 层"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity, ClassroomResponse
from app.models.agents import AIAgent

logger = logging.getLogger(__name__)

# ─── SSE pub/sub（已提取到 app.core.pubsub，此处保持向后兼容导入）───
from app.core.pubsub import publish, subscribe, unsubscribe  # noqa: F401

# 超时检查节流：最多每30秒执行一次
_last_auto_end_check: float = 0.0


# ─── CRUD ───

async def create_activity(db: AsyncSession, data: dict, user_id: int) -> ClassroomActivity:
    analysis_prompt = _normalize_prompt(data.get("analysis_prompt"))
    analysis_status = "pending" if data["activity_type"] == "fill_blank" else "not_applicable"
    activity = ClassroomActivity(
        activity_type=data["activity_type"],
        title=data["title"],
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
    if activity.status == "active":
        raise ValueError("进行中的活动不可编辑")
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
    if activity.status == "active":
        raise ValueError("进行中的活动不可删除")
    await db.delete(activity)
    await db.commit()


async def bulk_delete_activities(db: AsyncSession, activity_ids: List[int]) -> dict:
    """批量删除活动（进行中的不可删除）"""
    result = await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.id.in_(activity_ids))
    )
    activities = result.scalars().all()
    deleted, skipped = [], []
    for act in activities:
        if act.status != "active":
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


async def list_activities(db: AsyncSession, *, skip: int = 0, limit: int = 20, status: Optional[str] = None):
    global _last_auto_end_check
    now = time.monotonic()
    if now - _last_auto_end_check >= 30.0:
        _last_auto_end_check = now
        await _auto_end_overdue_activities(db)
    q = select(ClassroomActivity).order_by(ClassroomActivity.id.desc())
    count_q = select(func.count(ClassroomActivity.id))
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
        await end_activity(db, a.id)
    activity.status = "active"
    activity.started_at = now
    await db.commit()
    await db.refresh(activity)
    await publish("student", {"type": "activity_started", "activity_id": activity.id})
    await publish(f"admin_{activity.created_by}", {"type": "activity_started", "activity_id": activity.id})
    await publish("admin_global", {"type": "activity_started", "activity_id": activity.id})
    return activity


async def end_activity(
    db: AsyncSession,
    activity_id: int,
    analysis_agent_id: Optional[int] = None,
    analysis_prompt: Optional[str] = None,
) -> ClassroomActivity:
    activity = await _get_activity(db, activity_id)
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
    await db.commit()
    await db.refresh(activity)
    await publish("student", {"type": "activity_ended", "activity_id": activity.id})
    await publish(f"admin_{activity.created_by}", {"type": "activity_ended", "activity_id": activity.id})
    await publish("admin_global", {"type": "activity_ended", "activity_id": activity.id})
    await _run_auto_analysis_for_ended_activity(db, activity.id)
    await db.refresh(activity)
    return activity


async def restart_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    """重新开始一个已结束的活动（清除旧答题，重置为 active）"""
    activity = await _get_activity(db, activity_id)
    if activity.status != "ended":
        raise ValueError("只能重新开始已结束的活动")
    # 清除旧答题记录
    old_responses = (await db.execute(
        select(ClassroomResponse).where(ClassroomResponse.activity_id == activity_id)
    )).scalars().all()
    for r in old_responses:
        await db.delete(r)
    # 重置状态
    now = datetime.now(timezone.utc)
    activity.status = "active"
    activity.started_at = now
    activity.ended_at = None
    activity.analysis_status = "pending" if activity.activity_type == "fill_blank" else "not_applicable"
    activity.analysis_result = None
    activity.analysis_error = None
    await db.commit()
    await db.refresh(activity)
    await publish("student", {"type": "activity_started", "activity_id": activity.id})
    await publish(f"admin_{activity.created_by}", {"type": "activity_started", "activity_id": activity.id})
    await publish("admin_global", {"type": "activity_started", "activity_id": activity.id})
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
    await publish(f"admin_{activity.created_by}", {
        "type": "new_response", "activity_id": activity_id,
    })
    await publish("admin_global", {"type": "new_response", "activity_id": activity_id})
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


async def analyze_fill_blank_stats(db: AsyncSession, activity_id: int, agent_id: Optional[int] = None) -> dict:
    activity = await _get_activity(db, activity_id)
    if activity.activity_type != "fill_blank":
        raise ValueError("仅填空活动支持分析")
    if activity.status != "ended":
        raise ValueError("活动结束后才可查看分析")
    if agent_id is not None:
        activity.analysis_agent_id = agent_id
        await db.commit()
        await _run_auto_analysis_for_ended_activity(db, activity.id)
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


async def get_active_activities(db: AsyncSession) -> List[ClassroomActivity]:
    global _last_auto_end_check
    now = time.monotonic()
    if now - _last_auto_end_check >= 30.0:
        _last_auto_end_check = now
        await _auto_end_overdue_activities(db)
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


async def _run_auto_analysis_for_ended_activity(db: AsyncSession, activity_id: int) -> None:
    activity = await _get_activity(db, activity_id)
    if activity.activity_type != "fill_blank":
        if activity.analysis_status != "not_applicable":
            activity.analysis_status = "not_applicable"
            activity.analysis_updated_at = datetime.now(timezone.utc)
            await db.commit()
        return
    stats = await get_statistics(db, activity_id)
    context = _build_analysis_context(activity, stats)
    if stats.get("total_responses", 0) <= 0 or not context.get("risk_slots"):
        activity.analysis_status = "skipped"
        activity.analysis_result = "暂无可分析作答数据，已跳过自动分析。"
        activity.analysis_context = context
        activity.analysis_error = None
        activity.analysis_updated_at = datetime.now(timezone.utc)
        await db.commit()
        return

    # 构建候选智能体列表：优先用指定的，再 fallback 到其他可用智能体
    candidate_ids = await _list_candidate_agents(db, preferred_id=activity.analysis_agent_id)
    if not candidate_ids:
        activity.analysis_status = "failed"
        activity.analysis_result = None
        activity.analysis_context = context
        activity.analysis_error = "未找到可用智能体，请先配置并启用AI智能体。"
        activity.analysis_updated_at = datetime.now(timezone.utc)
        await db.commit()
        return

    activity.analysis_status = "running"
    activity.analysis_error = None
    activity.analysis_updated_at = datetime.now(timezone.utc)
    await db.commit()

    prompt = _build_analysis_prompt(context, activity.analysis_prompt)
    from app.services.agents.chat_blocking import run_agent_chat_blocking

    errors = []
    for agent_id in candidate_ids:
        try:
            analysis_text = await run_agent_chat_blocking(
                db,
                agent_id=agent_id,
                message=prompt,
            )
            activity.analysis_agent_id = agent_id
            activity.analysis_status = "success"
            activity.analysis_result = analysis_text
            activity.analysis_context = context
            activity.analysis_error = None
            activity.analysis_updated_at = datetime.now(timezone.utc)
            await db.commit()
            return
        except Exception as exc:
            errors.append(f"agent#{agent_id}: {str(exc)[:200]}")
            logger.warning("课堂分析 agent#%s 失败，尝试下一个: %s", agent_id, exc)
            continue

    # 所有候选都失败
    logger.error("课堂互动自动分析失败: activity_id=%s, 尝试了 %d 个智能体均失败", activity_id, len(candidate_ids))
    activity.analysis_status = "failed"
    activity.analysis_result = None
    activity.analysis_context = context
    activity.analysis_error = f"已尝试 {len(candidate_ids)} 个智能体均失败：{'; '.join(errors)}"
    activity.analysis_updated_at = datetime.now(timezone.utc)
    await db.commit()


async def _list_candidate_agents(db: AsyncSession, preferred_id: Optional[int] = None) -> List[int]:
    """返回候选智能体 ID 列表，优先指定的，再按 ID 排序取其他可用的"""
    rows = await db.execute(
        select(AIAgent.id)
        .where(AIAgent.is_active == True, AIAgent.is_deleted == False)
        .order_by(AIAgent.id.asc())
    )
    all_ids = [r[0] for r in rows.all()]
    if not all_ids:
        return []
    if preferred_id and preferred_id in all_ids:
        # 优先指定的，其余作为 fallback
        return [preferred_id] + [i for i in all_ids if i != preferred_id]
    return all_ids


def _build_analysis_prompt(context: dict, custom_prompt: Optional[str]) -> str:
    custom = _normalize_prompt(custom_prompt)
    if custom:
        # 用户自定义提示词，直接使用
        return f"{custom}\n\n统计数据如下：\n{json.dumps(context, ensure_ascii=False)}"

    # 默认提示词
    return (
        "你是教学诊断助手。请基于以下填空题统计数据，输出简洁的Markdown分析报告。\n\n"
        "**格式要求：**\n"
        "1. 总体结论（1-2句话）\n"
        "2. 易错分析（逐空位列出，每个空位2-3句话）\n"
        "3. 教学建议（3条，每条1句话）\n"
        "4. 最后输出JSON代码块：```json\n{\"risk_slots\": [...], \"common_mistakes\": [...], \"teaching_actions\": [...]}\n```\n\n"
        "**字数限制：分析内容（不含JSON）控制在200字以内。**\n\n"
        f"统计数据如下：\n{json.dumps(context, ensure_ascii=False)}"
    )


def _build_analysis_context(activity: ClassroomActivity, stats: dict) -> dict:
    risk_slots = []
    for slot in sorted(stats.get("blank_slot_stats") or [], key=lambda x: x.get("correct_rate") or 0):
        risk_slots.append(
            {
                "slot_index": slot.get("slot_index"),
                "correct_answer": slot.get("correct_answer"),
                "correct_rate": slot.get("correct_rate"),
                "total_count": slot.get("total_count"),
                "top_wrong_answers": (slot.get("top_wrong_answers") or [])[:5],
            }
        )
    return {
        "activity_id": activity.id,
        "title": activity.title,
        "total_responses": stats.get("total_responses"),
        "overall_correct_rate": stats.get("correct_rate"),
        "risk_slots": risk_slots,
        "common_mistakes": (stats.get("top_wrong_answers") or [])[:10],
        "blank_slot_stats": stats.get("blank_slot_stats") or [],
    }


async def _auto_end_overdue_activities(db: AsyncSession) -> None:
    rows = (await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.status == "active")
    )).scalars().all()
    for activity in rows:
        await _ensure_activity_not_overdue(db, activity)


async def _ensure_activity_not_overdue(db: AsyncSession, activity: ClassroomActivity) -> bool:
    if activity.status != "active":
        return False
    if activity.time_limit <= 0 or not activity.started_at:
        return False
    elapsed = (datetime.now(timezone.utc) - activity.started_at).total_seconds()
    if elapsed < activity.time_limit:
        return False
    await end_activity(db, activity.id)
    return True


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


def _normalize_prompt(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    return text if text else None
