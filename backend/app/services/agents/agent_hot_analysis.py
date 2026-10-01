"""Hot-question clustering, merging, timeline, and teaching suggestions."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from .agent_analysis_events import (
    BLOOM_LEVELS,
    NEGATIVE_QUESTION_TYPES,
    POSITIVE_QUESTION_TYPES,
    QUESTION_INTENT_LABELS,
    QUESTION_TYPES,
    QUESTION_TYPE_LABELS,
    STUDENT_ROLE,
    ConversationEvent,
    _CLUSTER_GENERIC_TERMS,
    _ensure_aware,
    _nearest_teacher,
    _public_teacher_question,
    _semantic_labels as _cluster_semantic_labels,
    _term_similarity,
)


# 这些权重只表达“可观察的困难信号”，不把它们解释成真实学习困难。
# 保持固定且可解释，后续再用人工标注校准，而不是先引入黑盒模型。
_DIFFICULTY_SIGNAL_WEIGHTS = {
    "debug": 1.0,
    "clarify": 0.7,
    "challenge": 0.7,
    "follow_up": 0.25,
    "apply": 0.15,
    "transfer": 0.15,
    "extend": 0.10,
    "off_track": 0.0,
}
_HOTNESS_WEIGHTS = {
    "commonness": 0.45,
    "difficulty": 0.30,
    "persistence": 0.25,
}


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _round01(value: float) -> float:
    return round(_clamp01(value), 4)


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


def _greedy_cluster(events: Sequence[ConversationEvent]) -> List[Dict[str, Any]]:
    """Greedy single-pass clustering by weighted term overlap, preserving order.

    相似度用 ``cluster_similarity``（词法去通用词 + 语义别名加权），避免
    “报错/调试”等提问方式词把不同知识点误并为同一主题。
    """
    clusters: List[Dict[str, Any]] = []
    for event in events:
        event_lexical = tuple(t for t in event.terms if t not in _CLUSTER_GENERIC_TERMS)
        event_semantic = _cluster_semantic_labels(event)
        best_idx = -1
        best_score = 0.0
        for idx, cluster in enumerate(clusters):
            lexical_score = _term_similarity(event_lexical, cluster.get("_lexical", set()))
            semantic_score = _term_similarity(event_semantic, cluster.get("_semantic", set()))
            score = 0.5 * lexical_score + 0.5 * semantic_score
            if score > best_score:
                best_idx = idx
                best_score = score
        if best_idx >= 0 and best_score >= 0.35:
            cluster = clusters[best_idx]
            cluster["events"].append(event)
            cluster["_lexical"].update(event_lexical)
            cluster["_semantic"].update(event_semantic)
        else:
            clusters.append({
                "events": [event],
                "_lexical": set(event_lexical),
                "_semantic": set(event_semantic),
            })
    return clusters


def _cluster_label_and_students(items: Sequence[ConversationEvent]) -> Tuple[List[Tuple[str, int]], str, Set[Optional[int]]]:
    top_terms = sorted(_term_counts_for_items(items).items(), key=lambda pair: pair[1], reverse=True)
    label = _top_terms_label(top_terms, items)
    students = {event.user_id for event in items if event.user_id is not None}
    return top_terms, label, students


def _cluster_distributions(items: Sequence[ConversationEvent]) -> Tuple[Dict[str, int], Dict[str, int]]:
    bloom_distribution: Dict[str, int] = {level: 0 for level in BLOOM_LEVELS}
    type_distribution: Dict[str, int] = {kind: 0 for kind in QUESTION_TYPES}
    for event in items:
        bloom_distribution[event.bloom_level] = bloom_distribution.get(event.bloom_level, 0) + 1
        type_distribution[event.question_type] = type_distribution.get(event.question_type, 0) + 1
    return bloom_distribution, type_distribution


def _intent_distribution(items: Sequence[ConversationEvent]) -> Dict[str, int]:
    distribution: Dict[str, int] = {}
    for event in items:
        code = event.intent_code or "other"
        distribution[code] = distribution.get(code, 0) + 1
    return distribution


def _dominant_intent(items: Sequence[ConversationEvent]) -> str:
    distribution = _intent_distribution(items)
    if not distribution:
        return "other"
    return max(distribution.items(), key=lambda item: (item[1], item[0]))[0]


def _difficulty_signal_score(items: Sequence[ConversationEvent]) -> float:
    """Return an explainable 0..1 signal from observable question types."""
    if not items:
        return 0.0
    weighted = 0.0
    for event in items:
        signal = _DIFFICULTY_SIGNAL_WEIGHTS.get(event.question_type, 0.1)
        # 少数分类漏判但明确包含报错语义时，不让错误信号被 follow_up 覆盖。
        if event.is_error_related:
            signal = max(signal, 0.9)
        weighted += signal
    return _round01(weighted / len(items))


def _theme_heat_profile(theme: Dict[str, Any]) -> str:
    """把三个分量翻译成可读标签，允许一个主题同时具备多个特征。"""
    profiles: List[str] = []
    if int(theme.get("unique_students") or 0) >= 2 and float(theme.get("commonness_score") or 0) >= 0.5:
        profiles.append("共性热点")
    if float(theme.get("difficulty_signal_score") or 0) >= 0.5:
        profiles.append("困难信号")
    if float(theme.get("persistence_score") or 0) >= 0.5:
        profiles.append("持续关注")
    return "、".join(profiles) or "局部热点"


def _score_themes(
    themes: Sequence[Dict[str, Any]],
    events: Sequence[ConversationEvent],
    timeline_buckets: Sequence[Dict[str, Any]],
    *,
    start_at: datetime,
    bucket_seconds: int,
) -> None:
    """Attach deterministic, normalized hotness signals to each theme in-place.

    ``commonness`` answers “多少学生共同遇到”，``difficulty`` answers “提问中有多少
    可观察的卡点信号”，``persistence`` answers “是否跨多个非空时间桶持续出现”。
    这三个量都不是学习困难的真值，只是后续人工复核的排序依据。
    """
    valid_student_ids = {event.user_id for event in events if event.user_id is not None}
    all_valid_unique_students = len(valid_student_ids)
    active_bucket_starts = {
        str(bucket.get("bucket_start"))
        for bucket in timeline_buckets
        if bucket.get("bucket_start")
    }
    active_bucket_count = len(active_bucket_starts)
    start = _ensure_aware(start_at)
    safe_bucket_seconds = max(1, int(bucket_seconds))

    for theme in themes:
        theme_events = list(theme.get("_events") or [])
        unique_students = {
            event.user_id for event in theme_events if event.user_id is not None
        }
        commonness = (
            len(unique_students) / all_valid_unique_students
            if all_valid_unique_students > 0
            else 0.0
        )

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
        persistence = (
            len(theme_bucket_starts) / active_bucket_count
            if active_bucket_count > 0
            else 0.0
        )
        difficulty = _difficulty_signal_score(theme_events)
        hotness = (
            _HOTNESS_WEIGHTS["commonness"] * _clamp01(commonness)
            + _HOTNESS_WEIGHTS["difficulty"] * difficulty
            + _HOTNESS_WEIGHTS["persistence"] * _clamp01(persistence)
        )

        commonness_score = _round01(commonness)
        persistence_score = _round01(persistence)
        hotness_score = round(_clamp01(hotness) * 100, 2)
        type_distribution = theme.get("question_type_distribution") or {}
        difficulty_types = [
            f"{QUESTION_TYPE_LABELS.get(kind, kind)} {count} 条"
            for kind, count in sorted(type_distribution.items(), key=lambda item: (-int(item[1] or 0), item[0]))
            if int(count or 0) > 0
        ]
        difficulty_basis = "、".join(difficulty_types[:3]) or "暂无可解释的问题类型"
        commonness_contribution = round(_HOTNESS_WEIGHTS["commonness"] * commonness_score * 100, 2)
        difficulty_contribution = round(_HOTNESS_WEIGHTS["difficulty"] * difficulty * 100, 2)
        persistence_contribution = round(_HOTNESS_WEIGHTS["persistence"] * persistence_score * 100, 2)

        theme["active_bucket_count"] = len(theme_bucket_starts)
        theme["commonness_score"] = commonness_score
        theme["difficulty_signal_score"] = difficulty
        theme["persistence_score"] = persistence_score
        theme["hotness_score"] = hotness_score
        theme["hotness_components"] = {
            "commonness": {
                "score": commonness_score,
                "weight": _HOTNESS_WEIGHTS["commonness"],
                "contribution": commonness_contribution,
                "evidence": f"{len(unique_students)}/{all_valid_unique_students} 位有效学生覆盖",
            },
            "difficulty": {
                "score": difficulty,
                "weight": _HOTNESS_WEIGHTS["difficulty"],
                "contribution": difficulty_contribution,
                "evidence": difficulty_basis,
            },
            "persistence": {
                "score": persistence_score,
                "weight": _HOTNESS_WEIGHTS["persistence"],
                "contribution": persistence_contribution,
                "evidence": f"{len(theme_bucket_starts)}/{active_bucket_count} 个非空时间桶",
            },
        }
        theme["hotness_explanation"] = [
            f"共性覆盖：{len(unique_students)}/{all_valid_unique_students} 位有效学生，贡献 {commonness_contribution} 分。",
            f"困难信号：{difficulty_basis}，仅代表可观察提问形态，贡献 {difficulty_contribution} 分。",
            f"持续性：覆盖 {len(theme_bucket_starts)}/{active_bucket_count} 个非空时间桶，贡献 {persistence_contribution} 分。",
        ]
        theme["score_basis"] = "确定性规则排序信号，不等同于真实学习困难"
        theme["heat_profile"] = _theme_heat_profile(theme)


def _cluster_dict(index: int, cluster: Dict[str, Any]) -> Dict[str, Any]:
    items: List[ConversationEvent] = cluster["events"]
    top_terms, label, students = _cluster_label_and_students(items)
    bloom_distribution, type_distribution = _cluster_distributions(items)
    return {
        "theme_id": f"theme-{index + 1}",
        "topic": label,
        "canonical_keyword": top_terms[0][0] if top_terms else label,
        "intent_code": _dominant_intent(items),
        "intent_label": QUESTION_INTENT_LABELS.get(_dominant_intent(items), QUESTION_INTENT_LABELS["other"]),
        "keywords": [{"word": term, "count": count} for term, count in top_terms[:8]],
        "count": len(items),
        "unique_students": len(students),
        "questions": [event.content for event in items[:5]],
        "representative_question": items[0].content,
        "evidence_ids": [event.message_id for event in items],
        "question_type_distribution": type_distribution,
        "intent_distribution": _intent_distribution(items),
        "dominant_intent": _dominant_intent(items),
        "positive_count": sum(type_distribution.get(t, 0) for t in POSITIVE_QUESTION_TYPES),
        "negative_count": sum(type_distribution.get(t, 0) for t in NEGATIVE_QUESTION_TYPES),
        "bloom_distribution": bloom_distribution,
        "_events": items,
        "_terms": set(cluster.get("_lexical", set())) | set(cluster.get("_semantic", set())),
        "_lexical": set(cluster.get("_lexical", set())),
        "_semantic": set(cluster.get("_semantic", set())),
    }


def _cluster_questions(events: Sequence[ConversationEvent], *, max_clusters: int = 12) -> List[Dict[str, Any]]:
    clusters = _greedy_cluster(events)

    def cluster_sort_key(cluster: Dict[str, Any]) -> Tuple[int, int]:
        items = cluster["events"]
        students = {event.user_id for event in items if event.user_id is not None}
        return (len(items), len(students))

    clusters.sort(key=cluster_sort_key, reverse=True)
    return [
        _cluster_dict(index, cluster)
        for index, cluster in enumerate(clusters[:max_clusters])
    ]


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


def _compute_word_cloud(themes: Sequence[Dict[str, Any]], events: Sequence[ConversationEvent]) -> List[Dict[str, Any]]:
    student_by_word: Dict[str, Set[Optional[int]]] = {}
    count_by_word: Dict[str, int] = {}
    burst_bonus: Dict[str, float] = {}
    for theme in themes:
        importance = 1.0 + math.log1p(float(theme.get("count") or 0))
        for item in theme.get("keywords", []):
            word = str(item.get("word") or "")
            if not word:
                continue
            burst_bonus[word] = burst_bonus.get(word, 0.0) + importance
    for event in events:
        # 词云展示学生原始用词：语义别名（如“错误”“边界”）是派生标签，
        # 出现在词云里会让教师看到原文没有的词，故此处只用原始 terms。
        for term in event.terms:
            count_by_word[term] = count_by_word.get(term, 0) + 1
            student_by_word.setdefault(term, set()).add(event.user_id)
    items = []
    for word, count in count_by_word.items():
        unique_students = len(student_by_word.get(word, set()))
        score = count * 1.0 + unique_students * 1.7 + burst_bonus.get(word, 0.0)
        items.append({"word": word, "count": count, "unique_students": unique_students, "weight": round(score, 2)})
    items.sort(key=lambda item: (item["weight"], item["count"]), reverse=True)
    return items[:60]


def _theme_for_event(event: ConversationEvent, themes: Sequence[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """按聚类同款加权相似度把事件归属到主题，避免通用词导致误归属。"""
    event_lexical = tuple(t for t in event.terms if t not in _CLUSTER_GENERIC_TERMS)
    event_semantic = _cluster_semantic_labels(event)
    best: Optional[Dict[str, Any]] = None
    best_score = 0.0
    for theme in themes:
        lexical_score = _term_similarity(event_lexical, theme.get("_lexical", set()))
        semantic_score = _term_similarity(event_semantic, theme.get("_semantic", set()))
        score = 0.5 * lexical_score + 0.5 * semantic_score
        if score > best_score:
            best = theme
            best_score = score
    return best if best_score >= 0.2 else None


def _top_questions(events: Sequence[ConversationEvent], limit: int = 5) -> List[Dict[str, Any]]:
    freq: Dict[str, Dict[str, Any]] = {}
    for event in events:
        key = event.normalized_text
        if key not in freq:
            freq[key] = {"question": event.content, "count": 0, "evidence_ids": []}
        freq[key]["count"] += 1
        freq[key]["evidence_ids"].append(event.message_id)
    items = sorted(freq.values(), key=lambda item: item["count"], reverse=True)
    return items[:limit]


def _distributions_for_items(items: Sequence[ConversationEvent], themes: Sequence[Dict[str, Any]]) -> Tuple[Dict[str, int], Dict[str, int], Dict[str, int]]:
    theme_distribution: Dict[str, int] = {}
    bloom_distribution: Dict[str, int] = {level: 0 for level in BLOOM_LEVELS}
    type_distribution: Dict[str, int] = {kind: 0 for kind in QUESTION_TYPES}
    for event in items:
        theme = _theme_for_event(event, themes)
        theme_key = str(theme.get("topic")) if theme else "未聚类"
        theme_distribution[theme_key] = theme_distribution.get(theme_key, 0) + 1
        bloom_distribution[event.bloom_level] = bloom_distribution.get(event.bloom_level, 0) + 1
        type_distribution[event.question_type] = type_distribution.get(event.question_type, 0) + 1
    return theme_distribution, bloom_distribution, type_distribution


def _bucket_growth_metrics(items: Sequence[ConversationEvent], prev_count: int) -> Tuple[float, bool]:
    growth_rate = ((len(items) - prev_count) / prev_count) if prev_count > 0 else (1.0 if len(items) >= 3 else 0.0)
    is_burst = len(items) >= 3 and (prev_count == 0 or len(items) >= prev_count * 1.8)
    return growth_rate, is_burst


def _apply_timeline_signals(buckets: List[Dict[str, Any]]) -> None:
    """Add normalized timeline signals without changing the legacy burst rule."""
    if not buckets:
        return
    max_count = max(int(bucket.get("question_count") or 0) for bucket in buckets)
    for bucket in buckets:
        question_count = int(bucket.get("question_count") or 0)
        unique_students = int(bucket.get("unique_students") or 0)
        growth_rate = float(bucket.get("growth_rate") or 0.0)
        volume_signal = question_count / max(1, max_count)
        growth_signal = _clamp01(max(growth_rate, 0.0))
        diversity_signal = unique_students / max(1, question_count)
        burst_score = (
            0.45 * _clamp01(volume_signal)
            + 0.30 * growth_signal
            + 0.25 * _clamp01(diversity_signal)
        )

        reasons: List[str] = []
        if question_count >= 3:
            reasons.append("问题量达到3条以上")
        if growth_rate >= 0.8:
            reasons.append("较上一非空时间桶增长至少80%")
        if unique_students >= 2:
            reasons.append("至少2位学生参与")
        if bool(bucket.get("is_burst")) and not reasons:
            reasons.append("达到原爆发判定")

        bucket["volume_signal"] = _round01(volume_signal)
        bucket["growth_signal"] = _round01(growth_signal)
        bucket["student_diversity_signal"] = _round01(diversity_signal)
        bucket["burst_score"] = round(_clamp01(burst_score) * 100, 2)
        bucket["burst_reasons"] = reasons


def _bucket_question_lists(items: Sequence[ConversationEvent]) -> Tuple[List[str], List[str], List[int]]:
    representative_questions = [event.content for event in items[:5]]
    unresolved_questions = [
        event.content for event in items if event.question_type in {"debug", "challenge"}
    ][:5]
    evidence_ids = [event.message_id for event in items]
    return representative_questions, unresolved_questions, evidence_ids


def _best_teacher_for_items(
    items: Sequence[ConversationEvent],
    teacher_questions: Sequence[Dict[str, Any]],
    *,
    max_minutes: int,
) -> Optional[Dict[str, Any]]:
    candidates = [
        candidate
        for event in items
        if (candidate := _nearest_teacher(event, teacher_questions, max_minutes=max_minutes)) is not None
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: (float(item.get("anchor_score") or 0.0), -abs(int(item.get("delay_seconds") or 0))))


def _build_bucket(idx: int, bucket_start: datetime, bucket_end: datetime, items: Sequence[ConversationEvent],
                  prev_count: int, themes: Sequence[Dict[str, Any]], teacher_questions: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    student_ids = [event.user_id for event in items if event.user_id is not None]
    theme_distribution, bloom_distribution, type_distribution = _distributions_for_items(items, themes)
    nearest = _best_teacher_for_items(items, teacher_questions, max_minutes=20)
    growth_rate, is_burst = _bucket_growth_metrics(items, prev_count)
    representative_questions, unresolved_questions, evidence_ids = _bucket_question_lists(items)
    return {
        "bucket_start": bucket_start.isoformat(),
        "bucket_end": bucket_end.isoformat(),
        "question_count": len(items),
        "unique_students": len(set(student_ids)),
        "student_ids": student_ids,
        "top_questions": _top_questions(items),
        "is_burst": is_burst,
        "growth_rate": round(growth_rate, 3),
        "near_teacher_mark": nearest.get("question") if nearest else None,
        "teacher_question": _public_teacher_question(nearest) if nearest else None,
        "teacher_anchor_id": nearest.get("id") if nearest else None,
        "teacher_anchor_score": nearest.get("anchor_score") if nearest else None,
        "teacher_anchor_confidence": nearest.get("anchor_confidence") if nearest else None,
        "teacher_anchor_reason": nearest.get("anchor_reason") if nearest else [],
        "trigger_delay_seconds": nearest.get("delay_seconds") if nearest else None,
        "theme_distribution": theme_distribution,
        "bloom_distribution": bloom_distribution,
        "question_type_distribution": type_distribution,
        "intent_distribution": _intent_distribution(items),
        "dominant_intent": _dominant_intent(items),
        "positive_count": sum(type_distribution.get(t, 0) for t in POSITIVE_QUESTION_TYPES),
        "negative_count": sum(type_distribution.get(t, 0) for t in NEGATIVE_QUESTION_TYPES),
        "representative_questions": representative_questions,
        "unresolved_questions": unresolved_questions,
        "evidence_ids": evidence_ids,
    }


def _build_timeline(
    events: Sequence[ConversationEvent],
    themes: Sequence[Dict[str, Any]],
    teacher_questions: Sequence[Dict[str, Any]],
    *,
    start_at: datetime,
    end_at: datetime,
    bucket_seconds: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    student_events = [event for event in events if event.role_code == STUDENT_ROLE and event.message_type == "question"]
    if not student_events:
        return [], []

    start = _ensure_aware(start_at)
    end = _ensure_aware(end_at)
    bucket_count = max(1, math.ceil((end - start).total_seconds() / bucket_seconds))
    buckets: List[Dict[str, Any]] = []
    prev_count = 0
    for idx in range(bucket_count):
        bucket_start = start + timedelta(seconds=idx * bucket_seconds)
        bucket_end = min(end, bucket_start + timedelta(seconds=bucket_seconds))
        items = [event for event in student_events if bucket_start <= event.created_at < bucket_end]
        if not items:
            continue
        buckets.append(
            _build_bucket(idx, bucket_start, bucket_end, items, prev_count, themes, teacher_questions)
        )
        prev_count = len(items)
    _apply_timeline_signals(buckets)
    burst_points = [bucket for bucket in buckets if bucket.get("is_burst")]
    return buckets, burst_points


def _bucket_dominant_theme(bucket: Dict[str, Any]) -> str:
    theme_distribution = bucket.get("theme_distribution") or {}
    if theme_distribution:
        return max(theme_distribution.items(), key=lambda item: item[1])[0]
    return "未聚类"


def _bucket_teacher_question(bucket: Dict[str, Any]) -> Optional[str]:
    return (bucket.get("teacher_question") or {}).get("question") or bucket.get("near_teacher_mark")


def _buckets_are_contiguous(current: Dict[str, Any], bucket: Dict[str, Any]) -> bool:
    """Only merge adjacent non-empty buckets; never bridge an empty interval."""
    try:
        current_end = datetime.fromisoformat(str(current.get("end_at")).replace("Z", "+00:00"))
        next_start = datetime.fromisoformat(str(bucket.get("bucket_start")).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return False
    return _ensure_aware(current_end) == _ensure_aware(next_start)


def _merge_into_current(current: Dict[str, Any], bucket: Dict[str, Any]) -> None:
    current["end_at"] = bucket.get("bucket_end")
    current["question_count"] += int(bucket.get("question_count") or 0)
    merged_student_ids = set(current.get("_student_ids", [])) | set(bucket.get("student_ids") or [])
    current["unique_students"] = len(merged_student_ids)
    current["_student_ids"] = list(merged_student_ids)
    current["evidence_ids"].extend(bucket.get("evidence_ids") or [])
    current["representative_questions"].extend(bucket.get("representative_questions") or [])
    bucket_score = float(bucket.get("teacher_anchor_score") or 0.0)
    current_score = float(current.get("teacher_anchor_score") or 0.0)
    if bucket_score > current_score:
        current["teacher_anchor_id"] = bucket.get("teacher_anchor_id")
        current["teacher_anchor_score"] = bucket.get("teacher_anchor_score")
        current["teacher_anchor_confidence"] = bucket.get("teacher_anchor_confidence")
        current["teacher_anchor_reason"] = bucket.get("teacher_anchor_reason") or []


def _new_hotspot_stage(sequence: List[Dict[str, Any]], bucket: Dict[str, Any],
                       top_theme: str, teacher: Optional[str]) -> Dict[str, Any]:
    return {
        "stage": f"阶段 {len(sequence) + 1}",
        "start_at": bucket.get("bucket_start"),
        "end_at": bucket.get("bucket_end"),
        "teacher_question": teacher,
        "teacher_anchor_id": bucket.get("teacher_anchor_id"),
        "teacher_anchor_score": bucket.get("teacher_anchor_score"),
        "teacher_anchor_confidence": bucket.get("teacher_anchor_confidence"),
        "teacher_anchor_reason": list(bucket.get("teacher_anchor_reason") or []),
        "dominant_theme": top_theme,
        "question_count": int(bucket.get("question_count") or 0),
        "unique_students": int(bucket.get("unique_students") or 0),
        "_student_ids": list(bucket.get("student_ids") or []),
        "phase_type": "学生集中生发" if bucket.get("is_burst") else "主题扩散",
        "representative_questions": list(bucket.get("representative_questions") or []),
        "evidence_ids": list(bucket.get("evidence_ids") or []),
    }


def _finalize_hotspot(current: Dict[str, Any]) -> None:
    current["representative_questions"] = current["representative_questions"][:5]
    current.pop("_student_ids", None)


def _build_course_hotspot_sequence(buckets: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sequence: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    for bucket in buckets:
        top_theme = _bucket_dominant_theme(bucket)
        teacher = _bucket_teacher_question(bucket)
        if (
            current
            and current.get("dominant_theme") == top_theme
            and current.get("teacher_question") == teacher
            and _buckets_are_contiguous(current, bucket)
        ):
            _merge_into_current(current, bucket)
        else:
            if current:
                _finalize_hotspot(current)
                sequence.append(current)
            current = _new_hotspot_stage(sequence, bucket, top_theme, teacher)
    if current:
        _finalize_hotspot(current)
        sequence.append(current)
    return sequence


def _strip_private_fields(items: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cleaned: List[Dict[str, Any]] = []
    for item in items:
        next_item = {key: value for key, value in item.items() if not key.startswith("_")}
        cleaned.append(next_item)
    return cleaned


def _build_hot_teaching_suggestions(themes: Sequence[Dict[str, Any]], burst_points: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    suggestions: List[Dict[str, Any]] = []
    ranked_themes = sorted(
        themes,
        key=lambda theme: (
            float(theme.get("hotness_score") or 0),
            int(theme.get("unique_students") or 0),
            int(theme.get("count") or 0),
        ),
        reverse=True,
    )
    for theme in ranked_themes[:5]:
        dominant_type = max((theme.get("question_type_distribution") or {"follow_up": 1}).items(), key=lambda item: item[1])[0]
        score = theme.get("hotness_score")
        score_text = f"，综合热点分数 {score}/100" if score is not None else ""
        suggestions.append(
            {
                "theme": theme.get("topic"),
                "priority": "high" if int(theme.get("unique_students") or 0) >= 3 else "medium",
                "reason": (
                    f"{theme.get('unique_students', 0)} 位学生围绕该主题提出 "
                    f"{theme.get('count', 0)} 个问题，属于{theme.get('heat_profile', '热点')}{score_text}"
                ),
                "suggestion": f"围绕「{theme.get('topic')}」补充{QUESTION_TYPE_LABELS.get(dominant_type, '跟进')}型讲解与练习。",
                "evidence_ids": theme.get("evidence_ids", [])[:8],
            }
        )
    if burst_points:
        suggestions.insert(
            0,
            {
                "theme": "课堂爆发点",
                "priority": "high",
                "reason": f"检测到 {len(burst_points)} 个学生集中提问时段",
                "suggestion": "复盘爆发点前后的教师提问，并将高频追问整理成下节课导入问题。",
                "evidence_ids": [eid for bucket in burst_points for eid in bucket.get("evidence_ids", [])][:12],
            },
        )
    return suggestions
