"""Hot-analysis 合并与打分辅助函数。

从 app/services/agents/agent_hot_analysis.py 拆出的私有辅助：
事件词项提取、词频/标签统计、相似问题贪心合并、主题桶统计与难度依据。
行为与原内联代码逐句等价；仅由 agent_hot_analysis.py 引用。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from .agent_analysis_events import (
    QUESTION_TYPE_LABELS,
    ConversationEvent,
    _term_similarity,
)


def _event_terms(event: ConversationEvent) -> Tuple[str, ...]:
    """优先使用补充了同义词的语义词，旧构造的事件仍回退到 terms。"""
    return event.semantic_terms or event.terms


def _term_counts_for_items(items: Sequence[ConversationEvent]) -> Dict[str, int]:
    term_counts: Dict[str, int] = {}
    for event in items:
        for term in _event_terms(event):
            term_counts[term] = term_counts.get(term, 0) + 1
    return term_counts


def _top_terms_label(top_terms: List[Tuple[str, int]], items: Sequence[ConversationEvent]) -> str:
    label = " / ".join(term for term, _ in top_terms[:3])
    if label:
        return label
    # 降级：从第一个事件提取标题（若 items 为空则返回占位符）
    return items[0].content[:18] if items else "未知主题"


# 贪心合并决策结果：break=时间窗耗尽停止向后扫描；skip=跳过该事件；ok=并入当前组
_MERGE_BREAK = "break"
_MERGE_SKIP = "skip"
_MERGE_OK = "ok"


def _within_window(group: Sequence[ConversationEvent], event_j: ConversationEvent, time_window_seconds: int) -> bool:
    return any(
        abs((event_j.created_at - member.created_at).total_seconds()) <= time_window_seconds
        for member in group
    )


def _shares_student_with_group(group: Sequence[ConversationEvent], event_j: ConversationEvent) -> bool:
    return event_j.user_id is not None and any(
        m.user_id == event_j.user_id for m in group if m.user_id is not None
    )


def _similar_to_group(group: Sequence[ConversationEvent], event_j: ConversationEvent, similarity_threshold: float) -> bool:
    return any(
        _term_similarity(_event_terms(event_j), _event_terms(member)) >= similarity_threshold
        for member in group
    )


def _merge_decision(group: List[ConversationEvent], event_j: ConversationEvent, time_window_seconds: int, similarity_threshold: float) -> str:
    """Decide whether event_j joins the group: _MERGE_BREAK / _MERGE_SKIP / _MERGE_OK."""
    earliest = min(m.created_at for m in group)
    if (event_j.created_at - earliest).total_seconds() > time_window_seconds:
        return _MERGE_BREAK
    if not _within_window(group, event_j, time_window_seconds):
        return _MERGE_SKIP
    if _shares_student_with_group(group, event_j):
        return _MERGE_SKIP
    if _similar_to_group(group, event_j, similarity_threshold):
        return _MERGE_OK
    return _MERGE_SKIP


def _build_merge_group(group_idx: int, group: List[ConversationEvent]) -> Dict[str, Any]:
    top_terms = sorted(_term_counts_for_items(group).items(), key=lambda pair: pair[1], reverse=True)
    topic_label = _top_terms_label(top_terms, group)

    # 计算平均时间
    timestamps = [e.created_at.timestamp() for e in group]
    avg_ts = sum(timestamps) / len(timestamps)
    merged_time = datetime.fromtimestamp(avg_ts, tz=timezone.utc)

    # 选择最短问题作为代表性问题（最简洁）
    representative = min(group, key=lambda e: len(e.content))

    question_ids = [e.message_id for e in group]
    student_ids = list({e.user_id for e in group if e.user_id is not None})
    questions = [
        {
            "message_id": e.message_id,
            "user_id": e.user_id,
            "content": e.content,
            "created_at": e.created_at.isoformat(),
        }
        for e in group
    ]

    return {
        "group_id": group_idx + 1,
        "topic_label": topic_label,
        "merged_time": merged_time.isoformat(),
        "question_ids": question_ids,
        "student_ids": student_ids,
        "representative_question": representative.content,
        "questions": questions,
        "member_count": len(group),
    }


def _merge_similar_questions(
    events: Sequence[ConversationEvent],
    *,
    time_window_seconds: int = 120,
    similarity_threshold: float = 0.35,
) -> List[Dict[str, Any]]:
    """
    阶段 1 确定性合并：将不同学生在 time_window 内语义相似的问题聚合为一组。

    合并规则：
    1. 来自不同学生（同一学生的问题是链条，不合并）
    2. 时间差 ≤ time_window_seconds
    3. 关键词 overlap coefficient ≥ similarity_threshold

    Returns:
        List of merge groups: [{
            "group_id": int,
            "topic_label": str,  # 最频繁的关键词组合
            "merged_time": str,  # ISO timestamp (group average)
            "question_ids": [message_id, ...],
            "student_ids": [user_id, ...],
            "representative_question": str,
            "questions": [{message_id, user_id, content, created_at}, ...],
            "member_count": int,
        }]
    """
    # 按时间排序，跳过无关键词的事件
    sorted_events = sorted(events, key=lambda e: (e.created_at, e.message_id))
    valid_events = [e for e in sorted_events if e.terms]

    # 跟踪已分配的事件索引
    assigned: Set[int] = set()
    groups: List[List[ConversationEvent]] = []

    for i, event_i in enumerate(valid_events):
        if i in assigned:
            continue
        # 开始新组
        group = [event_i]
        assigned.add(i)

        # 贪心扩展：向后查找可合并的事件
        for j in range(i + 1, len(valid_events)):
            if j in assigned:
                continue
            decision = _merge_decision(
                group,
                valid_events[j],
                time_window_seconds,
                similarity_threshold,
            )
            if decision == _MERGE_BREAK:
                break
            if decision == _MERGE_SKIP:
                continue
            group.append(valid_events[j])
            assigned.add(j)

        groups.append(group)

    # 构建输出
    return [
        _build_merge_group(group_idx, group)
        for group_idx, group in enumerate(groups)
    ]


def _theme_bucket_starts(
    theme_events: Sequence[ConversationEvent],
    start: datetime,
    safe_bucket_seconds: int,
    active_bucket_starts: Set[str],
) -> Set[str]:
    theme_bucket_starts: Set[str] = set()
    for event in theme_events:
        offset = (event.created_at - start).total_seconds()
        if offset < 0:
            continue
        bucket_start = start + timedelta(
            seconds=int(offset // safe_bucket_seconds) * safe_bucket_seconds
        )
        bucket_key = bucket_start.isoformat()
        if bucket_key in active_bucket_starts:
            theme_bucket_starts.add(bucket_key)
    return theme_bucket_starts


def _difficulty_basis(type_distribution: Dict[str, int]) -> str:
    difficulty_types = [
        f"{QUESTION_TYPE_LABELS.get(kind, kind)} {count} 条"
        for kind, count in sorted(type_distribution.items(), key=lambda item: (-int(item[1] or 0), item[0]))
        if int(count or 0) > 0
    ]
    return "、".join(difficulty_types[:3]) or "暂无可解释的问题类型"
