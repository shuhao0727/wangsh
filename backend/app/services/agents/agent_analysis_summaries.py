"""Backward-compatible list summaries for deep-analysis results."""

from __future__ import annotations

from typing import Any, Dict, Optional


def _int_or_fallback(value: Any, fallback: int = 0) -> int:
    """Return value as int if explicitly set (including 0), else fallback."""
    if value is None:
        return fallback
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def summarize_hot_list_item(result: Optional[Dict[str, Any]]) -> Dict[str, int]:
    data = result or {}
    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
    timeline_buckets = data.get("timeline_buckets") if isinstance(data.get("timeline_buckets"), list) else []
    themes = data.get("themes") if isinstance(data.get("themes"), list) else []
    uncovered = data.get("uncovered") if isinstance(data.get("uncovered"), list) else []
    main_chain = data.get("main_question_chain") if isinstance(data.get("main_question_chain"), list) else []

    def _qc() -> int:
        if "question_count" in summary and summary["question_count"] is not None:
            return int(summary["question_count"])
        events = data.get("student_question_events")
        if isinstance(events, list) and events:
            return len(events)
        from_buckets = sum(int(bucket.get("question_count") or 0) for bucket in timeline_buckets if isinstance(bucket, dict))
        if from_buckets > 0:
            return from_buckets
        from_themes = sum(int(item.get("count") or 0) for item in themes if isinstance(item, dict))
        if from_themes > 0:
            return from_themes
        return sum(int(item.get("count") or 0) for item in uncovered if isinstance(item, dict))

    def _burst() -> int:
        if "burst_count" in summary and summary["burst_count"] is not None:
            return int(summary["burst_count"])
        burst_points = data.get("burst_points")
        if isinstance(burst_points, list) and burst_points:
            return len(burst_points)
        return sum(1 for bucket in timeline_buckets if isinstance(bucket, dict) and bucket.get("is_burst"))

    def _theme() -> int:
        if "theme_count" in data and data["theme_count"] is not None:
            return int(data["theme_count"])
        if themes:
            return len(themes)
        if uncovered:
            return len(uncovered)
        return len(main_chain)

    def _teacher() -> int:
        if "teacher_anchor_count" in summary and summary["teacher_anchor_count"] is not None:
            return int(summary["teacher_anchor_count"])
        tq = data.get("teacher_questions")
        if isinstance(tq, list) and tq:
            return len(tq)
        tm = data.get("teacher_marks")
        if isinstance(tm, list) and tm:
            return len(tm)
        return 0

    return {
        "theme_count": _theme(),
        "question_count": _qc(),
        "teacher_anchor_count": _teacher(),
        "burst_count": _burst(),
    }


def summarize_chain_list_item(result: Optional[Dict[str, Any]]) -> Dict[str, int]:
    data = result or {}
    summary = data.get("student_chain_summary") if isinstance(data.get("student_chain_summary"), dict) else {}
    student_chains = data.get("student_question_chains") if isinstance(data.get("student_question_chains"), list) else []
    uncovered = data.get("uncovered") if isinstance(data.get("uncovered"), list) else []
    main_chain = data.get("main_question_chain") if isinstance(data.get("main_question_chain"), list) else []
    ai_chain = data.get("ai_main_question_chain") if isinstance(data.get("ai_main_question_chain"), list) else []

    def _qc() -> int:
        if "question_count" in summary and summary["question_count"] is not None:
            return int(summary["question_count"])
        from_chains = sum(
            int(chain.get("question_count") or len(chain.get("nodes") or []))
            for chain in student_chains if isinstance(chain, dict)
        )
        if from_chains > 0:
            return from_chains
        return sum(
            int(item.get("count") or len(item.get("questions") or []))
            for item in uncovered if isinstance(item, dict)
        )

    def _chain() -> int:
        if "chain_count" in summary and summary["chain_count"] is not None:
            return int(summary["chain_count"])
        if student_chains:
            return len(student_chains)
        if uncovered:
            return len(uncovered)
        return len(main_chain)

    def _teacher() -> int:
        if "teacher_anchor_count" in summary and summary["teacher_anchor_count"] is not None:
            return int(summary["teacher_anchor_count"])
        tml = data.get("teacher_mainline")
        if isinstance(tml, list) and tml:
            return len(tml)
        tq = data.get("teacher_questions")
        if isinstance(tq, list) and tq:
            return len(tq)
        tm = data.get("teacher_marks")
        if isinstance(tm, list) and tm:
            return len(tm)
        return 0

    def _ai_chain_nodes() -> int:
        if "ai_chain_node_count" in summary and summary["ai_chain_node_count"] is not None:
            return int(summary["ai_chain_node_count"])
        if ai_chain:
            return len(ai_chain)
        return len(main_chain)

    return {
        "chain_count": _chain(),
        "question_count": _qc(),
        "teacher_anchor_count": _teacher(),
        "ai_chain_node_count": _ai_chain_nodes(),
    }
