"""Hot-question clustering, merging, timeline, and teaching suggestions."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from .agent_analysis_events import (
    BLOOM_LEVELS,
    NEGATIVE_QUESTION_TYPES,
    POSITIVE_QUESTION_TYPES,
    QUESTION_TYPES,
    QUESTION_TYPE_LABELS,
    STUDENT_ROLE,
    ConversationEvent,
    _ensure_aware,
    _nearest_teacher,
    _term_similarity,
)


def _cluster_questions(events: Sequence[ConversationEvent], *, max_clusters: int = 12) -> List[Dict[str, Any]]:
    clusters: List[Dict[str, Any]] = []
    for event in events:
        terms = set(event.terms)
        best_idx = -1
        best_score = 0.0
        for idx, cluster in enumerate(clusters):
            score = _term_similarity(terms, cluster.get("_terms", set()))
            if score > best_score:
                best_idx = idx
                best_score = score
        if best_idx >= 0 and best_score >= 0.35:
            cluster = clusters[best_idx]
            cluster["events"].append(event)
            cluster["_terms"].update(terms)
        else:
            clusters.append({"events": [event], "_terms": set(terms)})

    def cluster_sort_key(cluster: Dict[str, Any]) -> Tuple[int, int]:
        items = cluster["events"]
        students = {event.user_id for event in items if event.user_id is not None}
        return (len(items), len(students))

    clusters.sort(key=cluster_sort_key, reverse=True)
    result: List[Dict[str, Any]] = []
    for index, cluster in enumerate(clusters[:max_clusters]):
        items: List[ConversationEvent] = cluster["events"]
        term_counts: Dict[str, int] = {}
        for event in items:
            for term in event.terms:
                term_counts[term] = term_counts.get(term, 0) + 1
        top_terms = sorted(term_counts.items(), key=lambda pair: pair[1], reverse=True)
        label = " / ".join(term for term, _ in top_terms[:3]) or items[0].content[:18]
        students = {event.user_id for event in items if event.user_id is not None}
        bloom_distribution: Dict[str, int] = {level: 0 for level in BLOOM_LEVELS}
        type_distribution: Dict[str, int] = {kind: 0 for kind in QUESTION_TYPES}
        for event in items:
            bloom_distribution[event.bloom_level] = bloom_distribution.get(event.bloom_level, 0) + 1
            type_distribution[event.question_type] = type_distribution.get(event.question_type, 0) + 1
        result.append(
            {
                "theme_id": f"theme-{index + 1}",
                "topic": label,
                "canonical_keyword": top_terms[0][0] if top_terms else label,
                "keywords": [{"word": term, "count": count} for term, count in top_terms[:8]],
                "count": len(items),
                "unique_students": len(students),
                "questions": [event.content for event in items[:5]],
                "representative_question": items[0].content,
                "evidence_ids": [event.message_id for event in items],
                "question_type_distribution": type_distribution,
                "positive_count": sum(type_distribution.get(t, 0) for t in POSITIVE_QUESTION_TYPES),
                "negative_count": sum(type_distribution.get(t, 0) for t in NEGATIVE_QUESTION_TYPES),
                "bloom_distribution": bloom_distribution,
                "_events": items,
                "_terms": set(cluster.get("_terms", set())),
            }
        )
    return result


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
            event_j = valid_events[j]

            # 时间窗口检查（与组内最早成员比较）
            earliest = min(m.created_at for m in group)
            if (event_j.created_at - earliest).total_seconds() > time_window_seconds:
                break

            # 与组内任意成员的时间差检查
            within_window = any(
                abs((event_j.created_at - member.created_at).total_seconds()) <= time_window_seconds
                for member in group
            )
            if not within_window:
                continue

            # 必须来自不同学生（同一学生的问题属于链条，不合并）
            if event_j.user_id is not None and any(
                m.user_id == event_j.user_id for m in group if m.user_id is not None
            ):
                continue

            # 与组内任何成员的相似度检查（overlap coefficient）
            matched = any(
                _term_similarity(event_j.terms, member.terms) >= similarity_threshold
                for member in group
            )
            if matched:
                group.append(event_j)
                assigned.add(j)

        groups.append(group)

    # 构建输出
    result: List[Dict[str, Any]] = []
    for group_idx, group in enumerate(groups):
        # 统计关键词频率
        term_counts: Dict[str, int] = {}
        for event in group:
            for term in event.terms:
                term_counts[term] = term_counts.get(term, 0) + 1
        top_terms = sorted(term_counts.items(), key=lambda pair: pair[1], reverse=True)
        topic_label = " / ".join(term for term, _ in top_terms[:3]) or group[0].content[:18]

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

        result.append({
            "group_id": group_idx + 1,
            "topic_label": topic_label,
            "merged_time": merged_time.isoformat(),
            "question_ids": question_ids,
            "student_ids": student_ids,
            "representative_question": representative.content,
            "questions": questions,
            "member_count": len(group),
        })

    return result


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
    best: Optional[Dict[str, Any]] = None
    best_score = 0.0
    for theme in themes:
        score = _term_similarity(event.terms, theme.get("_terms", set()))
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
        student_ids = [event.user_id for event in items if event.user_id is not None]
        theme_distribution: Dict[str, int] = {}
        bloom_distribution: Dict[str, int] = {level: 0 for level in BLOOM_LEVELS}
        type_distribution: Dict[str, int] = {kind: 0 for kind in QUESTION_TYPES}
        for event in items:
            theme = _theme_for_event(event, themes)
            theme_key = str(theme.get("topic")) if theme else "未聚类"
            theme_distribution[theme_key] = theme_distribution.get(theme_key, 0) + 1
            bloom_distribution[event.bloom_level] = bloom_distribution.get(event.bloom_level, 0) + 1
            type_distribution[event.question_type] = type_distribution.get(event.question_type, 0) + 1
        nearest = _nearest_teacher(items[0], teacher_questions, max_minutes=20)
        growth_rate = ((len(items) - prev_count) / prev_count) if prev_count > 0 else (1.0 if len(items) >= 3 else 0.0)
        is_burst = len(items) >= 3 and (prev_count == 0 or len(items) >= prev_count * 1.8)
        buckets.append(
            {
                "bucket_start": bucket_start.isoformat(),
                "bucket_end": bucket_end.isoformat(),
                "question_count": len(items),
                "unique_students": len(set(student_ids)),
                "student_ids": student_ids,
                "top_questions": _top_questions(items),
                "is_burst": is_burst,
                "growth_rate": round(growth_rate, 3),
                "near_teacher_mark": nearest.get("question") if nearest else None,
                "teacher_question": nearest,
                "trigger_delay_seconds": nearest.get("delay_seconds") if nearest else None,
                "theme_distribution": theme_distribution,
                "bloom_distribution": bloom_distribution,
                "question_type_distribution": type_distribution,
                "positive_count": sum(type_distribution.get(t, 0) for t in POSITIVE_QUESTION_TYPES),
                "negative_count": sum(type_distribution.get(t, 0) for t in NEGATIVE_QUESTION_TYPES),
                "representative_questions": [event.content for event in items[:5]],
                "unresolved_questions": [event.content for event in items if event.question_type in {"debug", "challenge"}][:5],
                "evidence_ids": [event.message_id for event in items],
            }
        )
        prev_count = len(items)
    burst_points = [bucket for bucket in buckets if bucket.get("is_burst")]
    return buckets, burst_points


def _build_course_hotspot_sequence(buckets: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sequence: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    for bucket in buckets:
        top_theme = "未聚类"
        theme_distribution = bucket.get("theme_distribution") or {}
        if theme_distribution:
            top_theme = max(theme_distribution.items(), key=lambda item: item[1])[0]
        teacher = (bucket.get("teacher_question") or {}).get("question") or bucket.get("near_teacher_mark")
        if current and current.get("dominant_theme") == top_theme and current.get("teacher_question") == teacher:
            current["end_at"] = bucket.get("bucket_end")
            current["question_count"] += int(bucket.get("question_count") or 0)
            merged_student_ids = set(current.get("_student_ids", [])) | set(bucket.get("student_ids") or [])
            current["unique_students"] = len(merged_student_ids)
            current["_student_ids"] = list(merged_student_ids)
            current["evidence_ids"].extend(bucket.get("evidence_ids") or [])
            current["representative_questions"].extend(bucket.get("representative_questions") or [])
        else:
            if current:
                current["representative_questions"] = current["representative_questions"][:5]
                current.pop("_student_ids", None)
                sequence.append(current)
            current = {
                "stage": f"阶段 {len(sequence) + 1}",
                "start_at": bucket.get("bucket_start"),
                "end_at": bucket.get("bucket_end"),
                "teacher_question": teacher,
                "dominant_theme": top_theme,
                "question_count": int(bucket.get("question_count") or 0),
                "unique_students": int(bucket.get("unique_students") or 0),
                "_student_ids": list(bucket.get("student_ids") or []),
                "phase_type": "学生集中生发" if bucket.get("is_burst") else "主题扩散",
                "representative_questions": list(bucket.get("representative_questions") or []),
                "evidence_ids": list(bucket.get("evidence_ids") or []),
            }
    if current:
        current["representative_questions"] = current["representative_questions"][:5]
        current.pop("_student_ids", None)
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
    for theme in themes[:5]:
        dominant_type = max((theme.get("question_type_distribution") or {"follow_up": 1}).items(), key=lambda item: item[1])[0]
        suggestions.append(
            {
                "theme": theme.get("topic"),
                "priority": "high" if int(theme.get("unique_students") or 0) >= 3 else "medium",
                "reason": f"{theme.get('unique_students', 0)} 位学生围绕该主题提出 {theme.get('count', 0)} 个问题",
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
