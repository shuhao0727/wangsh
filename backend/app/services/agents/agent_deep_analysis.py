"""AgentData v2 explainable analysis pipeline orchestration.

The v2 pipeline is intentionally deterministic first: it builds structured
evidence from database events before optionally layering AI summaries later.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from .agent_analysis_events import (
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
    _normalize_text,
    _term_similarity,
    build_teacher_questions,
    load_conversation_events,
)
from .agent_analysis_summaries import (
    _int_or_fallback,
    summarize_chain_list_item,
    summarize_hot_list_item,
)
from .agent_chain_analysis import (
    _build_ai_main_question_chain,
    _build_beam,
    _build_student_question_chains,
    _dominant,
    _summarize_student_chain,
    _teacher_anchor_for_event,
)
from .agent_hot_analysis import (
    _build_course_hotspot_sequence,
    _build_hot_teaching_suggestions,
    _build_timeline,
    _cluster_questions,
    _compute_word_cloud,
    _merge_similar_questions,
    _strip_private_fields,
    _theme_for_event,
    _top_questions,
)


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
) -> Dict[str, Any]:
    events = await load_conversation_events(db, agent_id=agent_id, start_at=start_at, end_at=end_at, class_name=class_name)
    student_questions = _dedupe_student_questions(events)
    teacher_questions = build_teacher_questions(events, teacher_marks)
    themes = _cluster_questions(student_questions)
    timeline_buckets, burst_points = _build_timeline(
        student_questions,
        themes,
        teacher_questions,
        start_at=start_at,
        end_at=end_at,
        bucket_seconds=bucket_seconds,
    )
    word_cloud = _compute_word_cloud(themes, student_questions)
    course_sequence = _build_course_hotspot_sequence(timeline_buckets)
    student_question_events = []
    for event in student_questions:
        theme = _theme_for_event(event, themes)
        teacher = _nearest_teacher(event, teacher_questions, max_minutes=20)
        student_question_events.append(
            {
                **_event_to_dict(event),
                "theme_id": theme.get("theme_id") if theme else None,
                "theme": theme.get("topic") if theme else None,
                "teacher_anchor_id": teacher.get("id") if teacher else None,
                "teacher_anchor_question": teacher.get("question") if teacher else None,
                "trigger_delay_seconds": teacher.get("delay_seconds") if teacher else None,
            }
        )

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
        "teacher_questions": teacher_questions,
        "teacher_marks": teacher_questions,
        "student_question_events": student_question_events,
        "burst_points": burst_points,
        "course_hotspot_sequence": course_sequence,
        "teaching_suggestions": _build_hot_teaching_suggestions(themes, burst_points),
        "summary": {
            "question_count": len(student_questions),
            "unique_students": len({event.user_id for event in student_questions if event.user_id is not None}),
            "teacher_anchor_count": len(teacher_questions),
            "theme_count": len(themes),
            "burst_count": len(burst_points),
        },
        "evidence_index": _build_evidence_index(student_questions),
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
) -> Dict[str, Any]:
    events = await load_conversation_events(db, agent_id=agent_id, start_at=start_at, end_at=end_at, class_name=class_name)
    student_questions = _dedupe_student_questions(events)
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
        "teacher_mainline": teacher_questions,
        "ai_main_question_chain": ai_main_question_chain,
        "student_question_chains": student_question_chains,
        "student_chain_summary": {
            "chain_count": len(student_question_chains),
            "question_count": len(student_questions),
            "unique_students": len({event.user_id for event in student_questions if event.user_id is not None}),
            "teacher_anchor_count": len(teacher_questions),
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
        "teacher_marks": teacher_questions,
        "merged_groups": _merge_similar_questions(student_questions, time_window_seconds=120, similarity_threshold=merge_threshold),
    }
