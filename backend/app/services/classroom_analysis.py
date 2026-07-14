"""课堂填空活动自动分析编排。"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agents import AIAgent
from app.models.classroom import ClassroomActivity


GetActivityForUpdate = Callable[
    [AsyncSession, int],
    Awaitable[ClassroomActivity],
]
GetStatistics = Callable[[AsyncSession, int], Awaitable[dict]]
ListCandidateAgents = Callable[[AsyncSession, Optional[int]], Awaitable[list[int]]]


class ClassroomAnalysisRetryableError(RuntimeError):
    """AI providers failed after the observable failure state was committed."""


async def run_auto_analysis_for_ended_activity(
    db: AsyncSession,
    activity_id: int,
    *,
    allow_running_retry: bool,
    get_activity_for_update: GetActivityForUpdate,
    get_statistics: GetStatistics,
    list_candidate_agents: ListCandidateAgents,
) -> None:
    activity = await get_activity_for_update(db, activity_id)
    if activity.status != "ended":
        await db.commit()
        return
    if activity.activity_type != "fill_blank":
        if activity.analysis_status != "not_applicable":
            activity.analysis_status = "not_applicable"
            activity.analysis_updated_at = datetime.now(timezone.utc)
        await db.commit()
        return
    if _analysis_status_blocks_run(
        activity.analysis_status,
        allow_running_retry=allow_running_retry,
    ):
        await db.commit()
        return

    claimed_ended_at = activity.ended_at
    stats = await get_statistics(db, activity_id)
    context = build_analysis_context(activity, stats)
    if stats.get("total_responses", 0) <= 0 or not context.get("risk_slots"):
        _mark_analysis_skipped(activity, context)
        await db.commit()
        return

    candidate_ids = await list_candidate_agents(db, activity.analysis_agent_id)
    if not candidate_ids:
        _mark_analysis_unconfigured(activity, context)
        await db.commit()
        return

    activity.analysis_status = "running"
    activity.analysis_error = None
    activity.analysis_updated_at = datetime.now(timezone.utc)
    await db.commit()

    failed_attempt = await _try_candidate_agents(
        db,
        activity_id,
        candidate_ids,
        claimed_ended_at=claimed_ended_at,
        prompt=build_analysis_prompt(context, activity.analysis_prompt),
        context=context,
        get_activity_for_update=get_activity_for_update,
    )
    if failed_attempt is None:
        return

    activity, errors = failed_attempt
    logger.error(
        "课堂互动自动分析失败: activity_id={}, 尝试了 {} 个智能体均失败",
        activity_id,
        len(candidate_ids),
    )
    activity.analysis_status = "failed"
    activity.analysis_result = None
    activity.analysis_context = context
    activity.analysis_error = (
        f"已尝试 {len(candidate_ids)} 个智能体均失败：{'; '.join(errors)}"
    )
    activity.analysis_updated_at = datetime.now(timezone.utc)
    await db.commit()
    raise ClassroomAnalysisRetryableError(activity.analysis_error)


async def list_candidate_agents(
    db: AsyncSession,
    preferred_id: Optional[int] = None,
) -> list[int]:
    """返回候选智能体 ID，优先使用教师指定的可用智能体。"""
    rows = await db.execute(
        select(AIAgent.id)
        .where(AIAgent.is_active == True, AIAgent.is_deleted == False)
        .order_by(AIAgent.id.asc())
    )
    all_ids = [row[0] for row in rows.all()]
    if preferred_id and preferred_id in all_ids:
        return [preferred_id, *(agent_id for agent_id in all_ids if agent_id != preferred_id)]
    return all_ids


async def mark_analysis_enqueue_failed(
    db: AsyncSession,
    activity_id: int,
    error: Exception,
    *,
    get_activity_for_update: GetActivityForUpdate,
) -> None:
    """记录 broker 最终发布失败，避免活动永久停留在 pending。"""
    activity = await get_activity_for_update(db, activity_id)
    if (
        activity.status != "ended"
        or activity.activity_type != "fill_blank"
        or activity.analysis_status != "pending"
    ):
        await db.commit()
        return
    activity.analysis_status = "failed"
    activity.analysis_result = None
    activity.analysis_error = f"自动分析任务入队失败：{str(error)[:200]}"
    activity.analysis_updated_at = datetime.now(timezone.utc)
    await db.commit()


def build_analysis_prompt(context: dict, custom_prompt: Optional[str]) -> str:
    custom = normalize_prompt(custom_prompt)
    if custom:
        return f"{custom}\n\n统计数据如下：\n{json.dumps(context, ensure_ascii=False)}"

    return (
        "你是教学诊断助手。请基于以下填空题统计数据，输出简洁的Markdown分析报告。\n\n"
        "**格式要求：**\n"
        "1. 总体结论（1-2句话）\n"
        "2. 易错分析（逐空位列出，每个空位2-3句话）\n"
        "3. 教学建议（3条，每条1句话）\n"
        "4. 最后输出JSON代码块：```json\n"
        '{"risk_slots": [...], "common_mistakes": [...], "teaching_actions": [...]}'
        "\n```\n\n"
        "**字数限制：分析内容（不含JSON）控制在200字以内。**\n\n"
        f"统计数据如下：\n{json.dumps(context, ensure_ascii=False)}"
    )


def build_analysis_context(activity: ClassroomActivity, stats: dict) -> dict:
    risk_slots = []
    for slot in sorted(
        stats.get("blank_slot_stats") or [],
        key=lambda item: item.get("correct_rate") or 0,
    ):
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


def analysis_claim_is_current(
    activity: ClassroomActivity,
    claimed_ended_at: Optional[datetime],
) -> bool:
    return (
        activity.status == "ended"
        and activity.analysis_status == "running"
        and activity.ended_at == claimed_ended_at
    )


def normalize_prompt(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    return text if text else None


def _analysis_status_blocks_run(
    status: Optional[str],
    *,
    allow_running_retry: bool,
) -> bool:
    if status in {"success", "skipped", "not_applicable"}:
        return True
    return status in {"failed", "running"} and not allow_running_retry


def _mark_analysis_skipped(activity: ClassroomActivity, context: dict) -> None:
    activity.analysis_status = "skipped"
    activity.analysis_result = "暂无可分析作答数据，已跳过自动分析。"
    activity.analysis_context = context
    activity.analysis_error = None
    activity.analysis_updated_at = datetime.now(timezone.utc)


def _mark_analysis_unconfigured(activity: ClassroomActivity, context: dict) -> None:
    activity.analysis_status = "failed"
    activity.analysis_result = None
    activity.analysis_context = context
    activity.analysis_error = "未找到可用智能体，请先配置并启用AI智能体。"
    activity.analysis_updated_at = datetime.now(timezone.utc)


async def _try_candidate_agents(
    db: AsyncSession,
    activity_id: int,
    candidate_ids: list[int],
    *,
    claimed_ended_at: Optional[datetime],
    prompt: str,
    context: dict,
    get_activity_for_update: GetActivityForUpdate,
) -> tuple[ClassroomActivity, list[str]] | None:
    from app.services.agents.chat_blocking import run_agent_chat_blocking

    errors: list[str] = []
    for index, agent_id in enumerate(candidate_ids):
        try:
            analysis_text = await run_agent_chat_blocking(
                db,
                agent_id=agent_id,
                message=prompt,
            )
        except Exception as exc:
            await db.rollback()
            activity = await get_activity_for_update(db, activity_id)
            if not analysis_claim_is_current(activity, claimed_ended_at):
                await db.commit()
                return None
            errors.append(f"agent#{agent_id}: {str(exc)[:200]}")
            logger.warning("课堂分析 agent#{} 失败，尝试下一个: {}", agent_id, exc)
            if index < len(candidate_ids) - 1:
                await db.commit()
            continue

        await db.rollback()
        activity = await get_activity_for_update(db, activity_id)
        if not analysis_claim_is_current(activity, claimed_ended_at):
            await db.commit()
            return None
        activity.analysis_agent_id = agent_id
        activity.analysis_status = "success"
        activity.analysis_result = analysis_text
        activity.analysis_context = context
        activity.analysis_error = None
        activity.analysis_updated_at = datetime.now(timezone.utc)
        await db.commit()
        return None

    return activity, errors
