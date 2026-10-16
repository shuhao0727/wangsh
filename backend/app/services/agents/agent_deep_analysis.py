"""AgentData v2 explainable analysis pipeline orchestration.

The v2 pipeline is intentionally deterministic first: it builds structured
evidence from database events before optionally layering AI summaries later.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from .agent_analysis_events import (  # noqa: F401  有意回导，非未使用导入
    BLOOM_LEVELS,
    NEGATIVE_QUESTION_TYPES,
    POSITIVE_QUESTION_TYPES,
    QUESTION_TYPES,
    QUESTION_TYPE_LABELS,
    STOP_WORDS,
    STUDENT_ROLE,
    TEACHER_ROLES,
    ConversationEvent,
    _build_evidence_index,
    _dedupe_student_questions,
    _detect_bloom_level,
    _detect_question_type,
    _ensure_aware,
    _event_to_dict,
    _extract_terms,
    _is_code_related,
    _is_error_related,
    _manual_teacher_event,
    _nearest_teacher,
    _public_teacher_question,
    _normalize_text,
    prepare_student_questions,
    _term_similarity,
    build_teacher_questions,
    load_conversation_events,
)
from .agent_analysis_summaries import (  # noqa: F401  有意回导，非未使用导入
    _int_or_fallback,
    summarize_chain_list_item,
    summarize_hot_list_item,
)
from .agent_chain_analysis import (  # noqa: F401  有意回导，非未使用导入
    _build_ai_main_question_chain,
    _build_beam,
    _build_student_question_chains,
    _dominant,
    _summarize_student_chain,
    _teacher_anchor_for_event,
)
from .agent_hot_analysis import (  # noqa: F401  有意回导，非未使用导入
    _build_course_hotspot_sequence,
    _build_hot_teaching_suggestions,
    _build_timeline,
    _cluster_questions,
    _compute_word_cloud,
    _merge_similar_questions,
    _score_themes,
    _strip_private_fields,
    _theme_for_event,
    _top_questions,
)


def _active_interval_count(timeline_buckets: List[Dict[str, Any]]) -> int:
    """按连续时间桶统计活跃区间，避免把跨空档的问题误读成一条课堂热点。"""
    if not timeline_buckets:
        return 0
    count = 1
    previous_end: Optional[datetime] = None
    for bucket in timeline_buckets:
        try:
            start = datetime.fromisoformat(str(bucket.get("bucket_start")).replace("Z", "+00:00"))
            end = datetime.fromisoformat(str(bucket.get("bucket_end")).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            continue
        if previous_end is not None and _ensure_aware(start) > _ensure_aware(previous_end):
            count += 1
        previous_end = end
    return count


def _anchor_summary(items: List[Dict[str, Any]], *, total_count: Optional[int] = None) -> Dict[str, Any]:
    """Summarize teacher-anchor coverage without treating low-confidence matches as facts.

    chain 路径在无匹配时用占位 id ``anchor-unassigned``，它不是真实命中；
    若不排除会把覆盖率恒定为 1.0，误导教师以为每个问题都关联了教师提问。
    """
    matched = [
        item
        for item in items
        if item.get("teacher_anchor_id") and item.get("teacher_anchor_id") != "anchor-unassigned"
    ]
    confidence_distribution: Dict[str, int] = {}
    for item in matched:
        confidence = str(item.get("teacher_anchor_confidence") or "unknown")
        confidence_distribution[confidence] = confidence_distribution.get(confidence, 0) + 1
    denominator = total_count if total_count is not None else len(items)
    return {
        "match_count": len(matched),
        "coverage": round(len(matched) / max(1, denominator), 4),
        "confidence_distribution": confidence_distribution,
    }


def _build_analysis_audit(
    *,
    raw_event_count: int,
    raw_student_event_count: int,
    valid_question_count: int,
    excluded_event_count: int,
    teacher_anchor_denominator: int,
    anchor_stats: Dict[str, Any],
) -> Dict[str, Any]:
    """Build explicit accounting metadata for the hot-v2 result contract.

    The audit is derived from the exact collections used by the analysis. It
    exposes inconsistencies instead of silently repairing them, so downstream
    UIs and reports do not have to infer the denominator.
    """
    confidence_total = sum(
        int(value)
        for value in (anchor_stats.get("confidence_distribution") or {}).values()
        if isinstance(value, (int, float))
    )
    warnings: List[str] = []
    if raw_student_event_count < valid_question_count:
        warnings.append("raw_count_less_than_valid_count")
    if excluded_event_count != max(0, raw_student_event_count - valid_question_count):
        warnings.append("excluded_count_mismatch")
    if teacher_anchor_denominator != valid_question_count:
        warnings.append("anchor_denominator_mismatch")
    if int(anchor_stats.get("match_count") or 0) > valid_question_count:
        warnings.append("anchor_match_exceeds_valid_count")
    if confidence_total != int(anchor_stats.get("match_count") or 0):
        warnings.append("confidence_distribution_mismatch")

    statistics_consistent = not warnings
    return {
        "audit_version": "hot_v2_audit_1",
        "raw_event_count": raw_event_count,
        "raw_student_event_count": raw_student_event_count,
        "valid_question_count": valid_question_count,
        "excluded_event_count": excluded_event_count,
        "teacher_anchor_denominator": teacher_anchor_denominator,
        "teacher_anchor_match_count": int(anchor_stats.get("match_count") or 0),
        "teacher_anchor_coverage": anchor_stats.get("coverage"),
        "teacher_anchor_confidence_total": confidence_total,
        "teacher_anchor_statistics_consistent": statistics_consistent,
        "warnings": warnings,
    }


def _intent_distribution(student_questions: List[Any]) -> Dict[str, int]:
    intent_distribution: Dict[str, int] = {}
    for event in student_questions:
        intent_code = str(event.intent_code or "other")
        intent_distribution[intent_code] = intent_distribution.get(intent_code, 0) + 1
    return intent_distribution


def _build_student_question_events(
    all_student_events: List[Any],
    themes: List[Dict[str, Any]],
    teacher_questions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    student_question_events = []
    for event in all_student_events:
        included = event.quality_label == "valid_question"
        theme = _theme_for_event(event, themes) if included else None
        teacher = _nearest_teacher(event, teacher_questions, max_minutes=20)
        student_question_events.append(
            {
                **_event_to_dict(event),
                "theme_id": theme.get("theme_id") if theme else None,
                "theme": theme.get("topic") if theme else None,
                "teacher_anchor_id": teacher.get("id") if teacher else None,
                "teacher_anchor_question": teacher.get("question") if teacher else None,
                "teacher_anchor_score": teacher.get("anchor_score") if teacher else None,
                "teacher_anchor_confidence": teacher.get("anchor_confidence") if teacher else None,
                "teacher_anchor_match_type": teacher.get("anchor_match_type") if teacher else None,
                "teacher_anchor_reason": teacher.get("anchor_reason") if teacher else [],
                "trigger_delay_seconds": teacher.get("delay_seconds") if teacher else None,
            }
        )
    return student_question_events


def _heat_profile_distribution(
    themes: List[Dict[str, Any]],
) -> tuple[Dict[str, int], float]:
    heat_profile_distribution: Dict[str, int] = {}
    for theme in themes:
        profile = str(theme.get("heat_profile") or "局部热点")
        heat_profile_distribution[profile] = heat_profile_distribution.get(profile, 0) + 1
    top_hotness_score = max(
        (float(theme.get("hotness_score") or 0) for theme in themes),
        default=0.0,
    )
    return heat_profile_distribution, top_hotness_score


async def analyze_hot_questions_v2(
    db: AsyncSession,
    *,
    agent_id: int,
    start_at: datetime,
    end_at: datetime,
    class_name: Optional[str] = None,
    task_sheet: str = "",
    bucket_seconds: int = 180,
    teacher_marks: Optional[List[Dict[str, Any]]] = None,
    custom_prompt: Optional[str] = None,
    include_archived: bool = False,
) -> Dict[str, Any]:
    events = await load_conversation_events(
        db,
        agent_id=agent_id,
        start_at=start_at,
        end_at=end_at,
        class_name=class_name,
        include_archived=include_archived,
    )

    # 限制单次分析最多 500 条数据,避免 O(n²) 聚类超时
    MAX_EVENTS = 500
    if len(events) > MAX_EVENTS:
        logger.warning(f"事件数 {len(events)} 超过限制 {MAX_EVENTS},按时间采样")
        # 按时间均匀采样(保留最新的,按时间倒序取前 500)
        events = sorted(events, key=lambda e: e.created_at, reverse=True)[:MAX_EVENTS]

    student_questions, all_student_events, quality_counts = prepare_student_questions(
        events,
        task_sheet=task_sheet,
    )
    teacher_questions = build_teacher_questions(events, teacher_marks)
    themes = _cluster_questions(student_questions)
    intent_distribution = _intent_distribution(student_questions)
    timeline_buckets, burst_points = _build_timeline(
        student_questions,
        themes,
        teacher_questions,
        start_at=start_at,
        end_at=end_at,
        bucket_seconds=bucket_seconds,
    )
    _score_themes(
        themes,
        student_questions,
        timeline_buckets,
        start_at=start_at,
        bucket_seconds=bucket_seconds,
    )
    word_cloud = _compute_word_cloud(themes, student_questions)
    course_sequence = _build_course_hotspot_sequence(timeline_buckets)
    student_question_events = _build_student_question_events(
        all_student_events, themes, teacher_questions
    )

    quality_events_by_id = {event.message_id: event for event in all_student_events}
    evidence_events = [quality_events_by_id.get(event.message_id, event) for event in events]
    active_interval_count = _active_interval_count(timeline_buckets)
    # Teacher-anchor coverage must use the same quality-filtered event set as the
    # hotspot statistics. Excluded events remain in ``student_question_events`` for
    # evidence traceability, but must not inflate match counts or confidence
    # distributions for the valid-question denominator.
    analysis_anchor_events = [
        item
        for item in student_question_events
        if item.get("included_in_analysis") is not False
    ]
    anchor_stats = _anchor_summary(analysis_anchor_events, total_count=len(student_questions))
    analysis_audit = _build_analysis_audit(
        raw_event_count=len(events),
        raw_student_event_count=quality_counts["raw_count"],
        valid_question_count=len(student_questions),
        excluded_event_count=quality_counts["excluded_count"],
        teacher_anchor_denominator=len(analysis_anchor_events),
        anchor_stats=anchor_stats,
    )
    public_teacher_questions = [_public_teacher_question(item) for item in teacher_questions]
    quality_summary = {
        **quality_counts,
        "raw_event_count": len(events),
        "active_interval_count": active_interval_count,
        "prompt_echo_rate": round(quality_counts["prompt_echo_count"] / max(1, quality_counts["raw_count"]), 4),
        "noise_rate": round(quality_counts["noise_count"] / max(1, quality_counts["raw_count"]), 4),
    }
    heat_profile_distribution, top_hotness_score = _heat_profile_distribution(themes)

    return {
        "analysis_version": "hot_v2",
        "analysis_type": "hot_questions",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters": {
            "agent_id": agent_id,
            "class_name": class_name,
            "start_at": _ensure_aware(start_at).isoformat(),
            "end_at": _ensure_aware(end_at).isoformat(),
            "bucket_seconds": bucket_seconds,
        },
        "task_sheet": task_sheet,
        "custom_prompt": custom_prompt,
        "word_cloud": word_cloud,
        "themes": _strip_private_fields(themes),
        "theme_count": len(themes),
        "timeline_buckets": timeline_buckets,
        "teacher_questions": public_teacher_questions,
        "teacher_marks": public_teacher_questions,
        "student_question_events": student_question_events,
        "burst_points": burst_points,
        "course_hotspot_sequence": course_sequence,
        "teaching_suggestions": _build_hot_teaching_suggestions(themes, burst_points),
        "summary": {
            "question_count": len(student_questions),
            "valid_question_count": quality_counts["valid_question_count"],
            "raw_count": quality_counts["raw_count"],
            "unique_students": len({event.user_id for event in student_questions if event.user_id is not None}),
            "teacher_anchor_count": len(teacher_questions),
            "teacher_anchor_match_count": anchor_stats["match_count"],
            "teacher_anchor_coverage": anchor_stats["coverage"],
            "teacher_anchor_confidence_distribution": anchor_stats["confidence_distribution"],
            "theme_count": len(themes),
            "burst_count": len(burst_points),
            "active_interval_count": active_interval_count,
            "prompt_echo_count": quality_counts["prompt_echo_count"],
            "noise_count": quality_counts["noise_count"],
            "duplicate_count": quality_counts["duplicate_count"],
            "intent_distribution": intent_distribution,
            "top_hotness_score": round(top_hotness_score, 2),
            "heat_profile_distribution": heat_profile_distribution,
        },
        "data_quality": quality_summary,
        "analysis_audit": analysis_audit,
        "evidence_index": _build_evidence_index(evidence_events),
        # Backward-compatible fields used by old UI/report code.
        "covered": [],
        "uncovered": [
            {"topic": theme["topic"], "questions": theme["questions"], "count": theme["count"]}
            for theme in _strip_private_fields(themes)
        ],
        "main_question_chain": [
            {
                "stage": item["stage"],
                "question": item.get("dominant_theme") or "热点阶段",
                "reason": item.get("phase_type"),
                "evidence": item.get("representative_questions", [])[:2],
            }
            for item in course_sequence[:6]
        ],
    }


async def analyze_student_chains_v2(
    db: AsyncSession,
    *,
    agent_id: int,
    start_at: datetime,
    end_at: datetime,
    class_name: Optional[str] = None,
    task_sheet: Optional[str] = None,
    teacher_marks: Optional[List[Dict[str, Any]]] = None,
    custom_prompt: Optional[str] = None,
    merge_threshold: float = 0.30,
    include_archived: bool = False,
) -> Dict[str, Any]:
    events = await load_conversation_events(
        db,
        agent_id=agent_id,
        start_at=start_at,
        end_at=end_at,
        class_name=class_name,
        include_archived=include_archived,
    )
    student_questions = _dedupe_student_questions(events, task_sheet=task_sheet or "")
    teacher_questions = build_teacher_questions(events, teacher_marks)
    themes = _cluster_questions(student_questions, max_clusters=10)
    student_question_chains = _build_student_question_chains(student_questions, teacher_questions)
    ai_main_question_chain = _build_ai_main_question_chain(themes, teacher_questions, student_question_chains)
    beam_nodes, beam_edges, lanes = _build_beam(teacher_questions, student_question_chains)
    unresolved_questions = [
        _event_to_dict(event)
        for event in student_questions
        if event.question_type in {"debug", "challenge", "off_track"}
    ][:30]
    chain_nodes = [
        node
        for chain in student_question_chains
        for node in (chain.get("nodes") or [])
    ]
    chain_anchor_stats = _anchor_summary(chain_nodes, total_count=len(chain_nodes))
    public_teacher_questions = [_public_teacher_question(item) for item in teacher_questions]

    return {
        "analysis_version": "chain_v2",
        "analysis_type": "student_chains",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters": {
            "agent_id": agent_id,
            "class_name": class_name,
            "start_at": _ensure_aware(start_at).isoformat(),
            "end_at": _ensure_aware(end_at).isoformat(),
        },
        "task_sheet": task_sheet,
        "custom_prompt": custom_prompt,
        "teacher_mainline": public_teacher_questions,
        "ai_main_question_chain": ai_main_question_chain,
        "student_question_chains": student_question_chains,
        "student_chain_summary": {
            "chain_count": len(student_question_chains),
            "question_count": len(student_questions),
            "unique_students": len({event.user_id for event in student_questions if event.user_id is not None}),
            "teacher_anchor_count": len(teacher_questions),
            "teacher_anchor_match_count": chain_anchor_stats["match_count"],
            "teacher_anchor_coverage": chain_anchor_stats["coverage"],
            "teacher_anchor_confidence_distribution": chain_anchor_stats["confidence_distribution"],
            "ai_chain_node_count": len(ai_main_question_chain),
            "dominant_question_type": _dominant([event.question_type for event in student_questions]),
        },
        "themes": _strip_private_fields(themes),
        "beam_nodes": beam_nodes,
        "beam_edges": beam_edges,
        "lanes": lanes,
        "unresolved_questions": unresolved_questions,
        "evidence_index": _build_evidence_index(student_questions),
        # Backward-compatible fields used by existing components.
        "word_cloud": _compute_word_cloud(themes, student_questions),
        "covered": [],
        "uncovered": [
            {"topic": theme["topic"], "questions": theme["questions"], "count": theme["count"]}
            for theme in _strip_private_fields(themes)
        ],
        "main_question_chain": [
            {
                "stage": item.get("stage", "主线阶段"),
                "question": item.get("question") or item.get("next_ai_question") or "",
                "reason": item.get("reason"),
                "evidence": item.get("evidence", []),
            }
            for item in ai_main_question_chain
        ],
        "teacher_marks": public_teacher_questions,
        "merged_groups": _merge_similar_questions(student_questions, time_window_seconds=120, similarity_threshold=merge_threshold),
    }
