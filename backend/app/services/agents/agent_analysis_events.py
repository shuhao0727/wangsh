"""Conversation event primitives and database loading for deep analysis."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
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

# 正向思维问题类型（跟进、应用、迁移、延伸）
POSITIVE_QUESTION_TYPES = {"follow_up", "apply", "transfer", "extend"}
# 偏离思维问题类型（澄清、质疑、调试、偏离）
NEGATIVE_QUESTION_TYPES = {"clarify", "challenge", "debug", "off_track"}


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
    if re.search(r"怎么写|如何实现|帮我写|实现|应用|使用", t):
        return "apply"
    if re.search(r"还可以|进一步|进阶|拓展|扩展|延伸", t):
        return "extend"
    if re.search(r"是什么|什么意思|不懂|解释|说明|举例|例子|示例", t):
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
    if question_type in {"apply", "debug"} or re.search(r"怎么写|如何实现|实现|运行|报错|调试|使用|代码|程序", t):
        return "应用"
    if re.search(r"解释|理解|什么意思|举例|例子|示例|说明", t):
        return "理解"
    if re.search(r"是什么|定义|概念|知道|了解", t):
        return "记忆"
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
