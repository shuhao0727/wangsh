"""AgentData v2 explainable analysis pipelines.

The v2 pipeline is intentionally deterministic first: it builds structured
evidence from database events before optionally layering AI summaries later.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


TEACHER_ROLES = {"teacher", "admin", "super_admin"}
STUDENT_ROLE = "student"
QUESTION_TYPES = ("clarify", "follow_up", "apply", "debug", "challenge", "transfer", "extend", "off_track")
QUESTION_TYPE_LABELS = {
    "clarify": "澄清",
    "follow_up": "跟进",
    "apply": "应用",
    "debug": "调试",
    "challenge": "质疑",
    "transfer": "迁移",
    "extend": "延伸",
    "off_track": "偏离",
}
BLOOM_LEVELS = ("记忆", "理解", "应用", "分析", "评价", "创造")

STOP_WORDS = set(
    "的 了 是 吗 呢 吧 啊 呀 么 有 在 也 不 都 就 和 与 或 但 而 还 又 很 太 更 最 要 会 能 可以 应该 "
    "必须 需要 让 把 被 对 从 到 向 以 用 为 因为 所以 虽然 如果 但是 然而 因此 这个 那个 这些 那些 "
    "什么 怎么 怎样 为什么 哪 哪里 谁 多少 几 第一 第二 一个 一种 方面 请 请问 帮我 一下 能否 如何 "
    "怎么样 老师 同学 问题 代码 程序 运行".split()
)


@dataclass(frozen=True)
class ConversationEvent:
    message_id: int
    created_at: datetime
    role_code: str
    user_id: Optional[int]
    user_name: str
    student_id: Optional[str]
    class_name: Optional[str]
    agent_id: Optional[int]
    session_id: Optional[str]
    message_type: str
    content: str
    normalized_text: str
    question_type: str
    bloom_level: str
    terms: Tuple[str, ...]
    is_code_related: bool
    is_error_related: bool


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _normalize_text(value: str) -> str:
    text_value = re.sub(r"\s+", " ", (value or "").strip())
    text_value = re.sub(r"[？?。.!！；;]+$", "", text_value)
    return text_value.lower()


def _extract_terms(text_value: str, *, limit: int = 12) -> Tuple[str, ...]:
    normalized = _normalize_text(text_value)
    latin = re.findall(r"[a-zA-Z][a-zA-Z0-9_+#-]{1,}", normalized)
    chinese_text = re.sub(r"[a-zA-Z0-9_+#-]+", " ", normalized)
    terms: List[str] = []

    for word in latin:
        word_l = word.lower()
        if word_l not in STOP_WORDS:
            terms.append(word_l)

    try:
        import jieba  # type: ignore

        for word in jieba.lcut(chinese_text):
            w = word.strip().lower()
            if len(w) >= 2 and w not in STOP_WORDS:
                terms.append(w)
    except Exception:
        compact = re.sub(r"\s+", "", chinese_text)
        for size in (4, 3, 2):
            for i in range(0, max(len(compact) - size + 1, 0)):
                w = compact[i : i + size]
                if w and w not in STOP_WORDS:
                    terms.append(w)

    seen: Set[str] = set()
    result: List[str] = []
    for term in terms:
        if term in seen:
            continue
        seen.add(term)
        result.append(term)
        if len(result) >= limit:
            break
    return tuple(result)


def _term_similarity(left: Iterable[str], right: Iterable[str]) -> float:
    a = set(left)
    b = set(right)
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, min(len(a), len(b)))


def _detect_question_type(text_value: str) -> str:
    t = _normalize_text(text_value)
    if re.search(r"nameerror|typeerror|syntaxerror|traceback|报错|错误|bug|debug|调试|运行不了|不运行", t):
        return "debug"
    if re.search(r"为什么|原理|区别|对比|关系|本质", t):
        return "follow_up"
    if re.search(r"能不能|是否|一定|必须|合理|更好|评价|判断", t):
        return "challenge"
    if re.search(r"如果|换成|迁移|别的|其他|类似|扩展到", t):
        return "transfer"
    if re.search(r"怎么写|如何实现|帮我写|实现|应用|使用|例子", t):
        return "apply"
    if re.search(r"还可以|进一步|进阶|拓展|扩展|延伸", t):
        return "extend"
    if re.search(r"是什么|什么意思|不懂|解释|说明", t):
        return "clarify"
    return "follow_up"


def _detect_bloom_level(text_value: str, question_type: str) -> str:
    t = _normalize_text(text_value)
    if question_type in {"transfer", "extend"} or re.search(r"设计|创造|生成|扩展|改造", t):
        return "创造"
    if question_type == "challenge" or re.search(r"评价|更好|优缺点|合理|判断", t):
        return "评价"
    if re.search(r"区别|对比|为什么|原因|关系|原理|分析", t):
        return "分析"
    if question_type in {"apply", "debug"} or re.search(r"怎么写|实现|运行|报错|调试|使用", t):
        return "应用"
    if re.search(r"解释|理解|什么意思|举例|说明", t):
        return "理解"
    return "记忆"


def _is_code_related(text_value: str) -> bool:
    return bool(re.search(r"```|def |class |for |while |if |elif |return|print\(|列表|函数|循环|变量|python|代码|程序", text_value, re.I))


def _is_error_related(text_value: str) -> bool:
    return bool(re.search(r"error|exception|traceback|报错|错误|无法运行|运行不了|bug|debug|调试", text_value, re.I))


def _event_to_dict(event: ConversationEvent) -> Dict[str, Any]:
    return {
        "message_id": event.message_id,
        "created_at": event.created_at.isoformat(),
        "role_code": event.role_code,
        "user_id": event.user_id,
        "user_name": event.user_name,
        "student_id": event.student_id,
        "class_name": event.class_name,
        "agent_id": event.agent_id,
        "session_id": event.session_id,
        "message_type": event.message_type,
        "content": event.content,
        "normalized_text": event.normalized_text,
        "question_type": event.question_type,
        "question_type_label": QUESTION_TYPE_LABELS.get(event.question_type, event.question_type),
        "bloom_level": event.bloom_level,
        "terms": list(event.terms),
        "is_code_related": event.is_code_related,
        "is_error_related": event.is_error_related,
    }


async def load_conversation_events(
    db: AsyncSession,
    *,
    agent_id: int,
    start_at: datetime,
    end_at: datetime,
    class_name: Optional[str] = None,
) -> List[ConversationEvent]:
    """Load typed conversation events from the raw conversation table."""
    sql = text(
        """
        SELECT
            c.id AS message_id,
            c.created_at,
            c.user_id,
            COALESCE(u.full_name, c.user_name, '未知用户') AS user_name,
            u.student_id,
            u.class_name,
            COALESCE(u.role_code, 'guest') AS role_code,
            c.agent_id,
            c.session_id,
            c.message_type,
            c.content
        FROM znt_conversations c
        LEFT JOIN sys_users u ON u.id = c.user_id
        WHERE c.agent_id = :agent_id
          AND c.created_at >= :start_at
          AND c.created_at < :end_at
          AND c.content IS NOT NULL
          AND trim(c.content) != ''
          AND (CAST(:class_name AS TEXT) IS NULL OR u.class_name = CAST(:class_name AS TEXT))
        ORDER BY c.created_at ASC, c.id ASC
        """
    )
    rows = (
        await db.execute(
            sql,
            {
                "agent_id": agent_id,
                "start_at": _ensure_aware(start_at),
                "end_at": _ensure_aware(end_at),
                "class_name": (class_name or "").strip() or None,
            },
        )
    ).mappings().all()

    events: List[ConversationEvent] = []
    for row in rows:
        content = str(row.get("content") or "").strip()
        if not content:
            continue
        q_type = _detect_question_type(content)
        created_at = row.get("created_at")
        if not isinstance(created_at, datetime):
            continue
        terms = _extract_terms(content)
        events.append(
            ConversationEvent(
                message_id=int(row.get("message_id") or 0),
                created_at=_ensure_aware(created_at),
                role_code=str(row.get("role_code") or "guest"),
                user_id=row.get("user_id"),
                user_name=str(row.get("user_name") or "未知用户"),
                student_id=row.get("student_id"),
                class_name=row.get("class_name"),
                agent_id=row.get("agent_id"),
                session_id=row.get("session_id"),
                message_type=str(row.get("message_type") or ""),
                content=content,
                normalized_text=_normalize_text(content),
                question_type=q_type,
                bloom_level=_detect_bloom_level(content, q_type),
                terms=terms,
                is_code_related=_is_code_related(content),
                is_error_related=_is_error_related(content),
            )
        )
    return events


def _dedupe_student_questions(events: Sequence[ConversationEvent]) -> List[ConversationEvent]:
    seen: Dict[Tuple[Optional[int], str], ConversationEvent] = {}
    for event in events:
        if event.message_type != "question" or event.role_code != STUDENT_ROLE:
            continue
        key = (event.user_id, event.normalized_text)
        if key not in seen:
            seen[key] = event
    return sorted(seen.values(), key=lambda item: (item.created_at, item.message_id))


def _manual_teacher_event(mark: Dict[str, Any], index: int) -> Dict[str, Any]:
    raw_time = mark.get("time")
    time_value = raw_time if isinstance(raw_time, datetime) else datetime.fromisoformat(str(raw_time).replace("Z", "+00:00"))
    return {
        "id": f"manual-{index}",
        "message_id": None,
        "time": _ensure_aware(time_value).isoformat(),
        "question": str(mark.get("question") or "教师提问"),
        "source": "manual",
        "user_name": "手动标记",
        "evidence_ids": [],
    }


def build_teacher_questions(
    events: Sequence[ConversationEvent],
    teacher_marks: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    teacher_questions: List[Dict[str, Any]] = []
    for event in events:
        if event.message_type != "question" or event.role_code not in TEACHER_ROLES:
            continue
        teacher_questions.append(
            {
                "id": f"teacher-{event.message_id}",
                "message_id": event.message_id,
                "time": event.created_at.isoformat(),
                "question": event.content,
                "source": "auto",
                "user_name": event.user_name,
                "role_code": event.role_code,
                "evidence_ids": [event.message_id],
            }
        )
    for idx, mark in enumerate(teacher_marks or []):
        try:
            teacher_questions.append(_manual_teacher_event(mark, idx))
        except Exception:
            continue
    teacher_questions.sort(key=lambda item: item.get("time") or "")
    return teacher_questions


def _nearest_teacher(
    event: ConversationEvent,
    teacher_questions: Sequence[Dict[str, Any]],
    *,
    max_minutes: int = 15,
) -> Optional[Dict[str, Any]]:
    best: Optional[Dict[str, Any]] = None
    best_delta: Optional[float] = None
    for teacher in teacher_questions:
        try:
            t = datetime.fromisoformat(str(teacher.get("time")).replace("Z", "+00:00"))
        except Exception:
            continue
        delta = (event.created_at - _ensure_aware(t)).total_seconds()
        if delta < -120 or delta > max_minutes * 60:
            continue
        if best_delta is None or abs(delta) < abs(best_delta):
            best = teacher
            best_delta = delta
    if best is None:
        return None
    result = dict(best)
    result["delay_seconds"] = int(best_delta or 0)
    return result


def _build_evidence_index(events: Sequence[ConversationEvent]) -> Dict[str, Dict[str, Any]]:
    return {str(event.message_id): _event_to_dict(event) for event in events}


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
                "bloom_distribution": bloom_distribution,
                "_events": items,
                "_terms": set(cluster.get("_terms", set())),
            }
        )
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


def _teacher_anchor_for_event(event: ConversationEvent, teacher_questions: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    teacher = _nearest_teacher(event, teacher_questions, max_minutes=30)
    if teacher:
        return teacher
    return {
        "id": "anchor-unassigned",
        "message_id": None,
        "time": event.created_at.isoformat(),
        "question": "未匹配到明确教师提问",
        "source": "system",
        "user_name": "系统",
        "delay_seconds": None,
        "evidence_ids": [],
    }


def _build_student_question_chains(
    student_questions: Sequence[ConversationEvent],
    teacher_questions: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    by_session: Dict[str, List[ConversationEvent]] = {}
    for event in student_questions:
        session_key = event.session_id or f"user-{event.user_id or event.user_name}"
        by_session.setdefault(session_key, []).append(event)

    chains: List[Dict[str, Any]] = []
    for session_id, items in by_session.items():
        sorted_items = sorted(items, key=lambda item: (item.created_at, item.message_id))
        if not sorted_items:
            continue
        nodes = []
        for idx, event in enumerate(sorted_items):
            anchor = _teacher_anchor_for_event(event, teacher_questions)
            previous = sorted_items[idx - 1] if idx > 0 else None
            relation = event.question_type
            if previous and _term_similarity(previous.terms, event.terms) >= 0.45 and relation == "follow_up":
                relation = "follow_up"
            nodes.append(
                {
                    "node_id": f"student-{event.message_id}",
                    "message_id": event.message_id,
                    "time": event.created_at.isoformat(),
                    "question": event.content,
                    "student_name": event.user_name,
                    "student_id": event.student_id,
                    "class_name": event.class_name,
                    "question_type": relation,
                    "question_type_label": QUESTION_TYPE_LABELS.get(relation, relation),
                    "bloom_level": event.bloom_level,
                    "teacher_anchor_id": anchor.get("id"),
                    "teacher_anchor_question": anchor.get("question"),
                    "delay_seconds": anchor.get("delay_seconds"),
                    "terms": list(event.terms),
                    "evidence_ids": [event.message_id],
                }
            )
        chains.append(
            {
                "session_id": session_id,
                "student_name": sorted_items[0].user_name,
                "student_id": sorted_items[0].student_id,
                "class_name": sorted_items[0].class_name,
                "question_count": len(nodes),
                "start_at": sorted_items[0].created_at.isoformat(),
                "end_at": sorted_items[-1].created_at.isoformat(),
                "dominant_question_type": _dominant([node["question_type"] for node in nodes]),
                "summary": _summarize_student_chain(nodes),
                "nodes": nodes,
                "evidence_ids": [event.message_id for event in sorted_items],
            }
        )
    chains.sort(key=lambda item: item["question_count"], reverse=True)
    return chains


def _dominant(values: Sequence[str]) -> str:
    counts: Dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return max(counts.items(), key=lambda item: item[1])[0] if counts else ""


def _summarize_student_chain(nodes: Sequence[Dict[str, Any]]) -> str:
    if not nodes:
        return "暂无问题链"
    start = nodes[0].get("question", "")
    end = nodes[-1].get("question", "")
    dominant = QUESTION_TYPE_LABELS.get(_dominant([str(node.get("question_type")) for node in nodes]), "追问")
    if len(nodes) == 1:
        return f"学生围绕「{start[:28]}」提出了单点{dominant}问题。"
    return f"学生从「{start[:28]}」出发，经过 {len(nodes)} 次{dominant}式追问，推进到「{end[:28]}」。"


def _build_ai_main_question_chain(
    themes: Sequence[Dict[str, Any]],
    teacher_questions: Sequence[Dict[str, Any]],
    student_chains: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    chain: List[Dict[str, Any]] = []
    for idx, teacher in enumerate(teacher_questions[:6]):
        related_nodes = [
            node
            for student_chain in student_chains
            for node in student_chain.get("nodes", [])
            if node.get("teacher_anchor_id") == teacher.get("id")
        ]
        if related_nodes:
            representative = related_nodes[0]
            chain.append(
                {
                    "stage": f"教师主线 {idx + 1}",
                    "question": teacher.get("question") or "教师提问",
                    "student_response_summary": f"{len(related_nodes)} 个学生问题围绕该提问展开",
                    "next_ai_question": representative.get("question"),
                    "reason": "教师提问后学生产生的集中追问节点",
                    "evidence": [node.get("question") for node in related_nodes[:3] if node.get("question")],
                    "evidence_ids": [eid for node in related_nodes[:8] for eid in node.get("evidence_ids", [])],
                }
            )
    if chain:
        return chain
    for idx, theme in enumerate(themes[:6]):
        chain.append(
            {
                "stage": f"问题阶段 {idx + 1}",
                "question": theme.get("topic"),
                "student_response_summary": f"{theme.get('count', 0)} 个问题聚合到该主题",
                "next_ai_question": (theme.get("questions") or [""])[0],
                "reason": "由学生问题聚类生成的课堂主问题链节点",
                "evidence": (theme.get("questions") or [])[:3],
                "evidence_ids": theme.get("evidence_ids", [])[:8],
            }
        )
    return chain


def _build_beam(
    teacher_questions: Sequence[Dict[str, Any]],
    student_chains: Sequence[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    lanes: Dict[str, Dict[str, Any]] = {}

    for idx, teacher in enumerate(teacher_questions):
        node_id = str(teacher.get("id") or f"teacher-{idx}")
        nodes.append(
            {
                "id": node_id,
                "kind": "teacher_anchor",
                "label": teacher.get("question") or "教师提问",
                "time": teacher.get("time"),
                "lane": "teacher-mainline",
                "x_order": idx,
                "y_order": 0,
                "source": teacher.get("source"),
                "evidence_ids": teacher.get("evidence_ids", []),
            }
        )
    lanes["teacher-mainline"] = {"lane_id": "teacher-mainline", "label": "教师主线", "kind": "teacher", "y_order": 0}

    relation_order = {
        "clarify": -3,
        "follow_up": -2,
        "debug": -1,
        "apply": 1,
        "transfer": 2,
        "extend": 3,
        "challenge": 4,
        "off_track": 5,
    }
    for chain in student_chains:
        previous_node_id: Optional[str] = None
        for idx, item in enumerate(chain.get("nodes", [])):
            relation = str(item.get("question_type") or "follow_up")
            lane_id = f"relation-{relation}"
            lanes.setdefault(
                lane_id,
                {
                    "lane_id": lane_id,
                    "label": QUESTION_TYPE_LABELS.get(relation, relation),
                    "kind": "student_relation",
                    "y_order": relation_order.get(relation, 1),
                },
            )
            node_id = str(item.get("node_id"))
            nodes.append(
                {
                    "id": node_id,
                    "kind": "student_question",
                    "label": item.get("question"),
                    "time": item.get("time"),
                    "lane": lane_id,
                    "x_order": idx,
                    "y_order": relation_order.get(relation, 1),
                    "student_name": item.get("student_name"),
                    "question_type": relation,
                    "question_type_label": item.get("question_type_label"),
                    "bloom_level": item.get("bloom_level"),
                    "teacher_anchor_id": item.get("teacher_anchor_id"),
                    "evidence_ids": item.get("evidence_ids", []),
                }
            )
            anchor_id = item.get("teacher_anchor_id")
            if anchor_id and anchor_id != "anchor-unassigned":
                edges.append(
                    {
                        "id": f"edge-{anchor_id}-{node_id}",
                        "source": anchor_id,
                        "target": node_id,
                        "relation": "teacher_trigger",
                        "label": "教师触发",
                    }
                )
            if previous_node_id:
                edges.append(
                    {
                        "id": f"edge-{previous_node_id}-{node_id}",
                        "source": previous_node_id,
                        "target": node_id,
                        "relation": "same_student_follow_up",
                        "label": "同学生追问",
                    }
                )
            previous_node_id = node_id
    return nodes, edges, sorted(lanes.values(), key=lambda lane: lane["y_order"])


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
    }


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
