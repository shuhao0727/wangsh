"""Conversation event primitives and database loading for deep analysis."""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .agent_analysis_events_helpers import (  # noqa: F401  有意回导，非未使用导入
    _compact_for_match,
    _dedupe_terms,
    _detect_bloom_level,
    _detect_question_intent,
    _detect_question_type,
    _is_code_related,
    _is_error_related,
    _looks_like_prompt_echo,
    _normalize_text,
    _semantic_terms,
)

logger = logging.getLogger(__name__)


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
QUESTION_INTENT_LABELS = {
    "concept_definition": "概念定义",
    "mechanism_reason": "原理原因",
    "implementation_howto": "实现方法",
    "runtime_debug": "运行调试",
    "boundary_condition": "边界条件",
    "comparison_choice": "对比选择",
    "transfer_application": "迁移应用",
    "extension_design": "延伸设计",
    "other": "其他问题",
}
BLOOM_LEVELS = ("记忆", "理解", "应用", "分析", "评价", "创造")

# 质量标签只描述"是否进入热点主统计"，不会删除原始消息。
QUALITY_RAW = "raw"
QUALITY_VALID = "valid_question"
QUALITY_PROMPT_ECHO = "prompt_echo"
QUALITY_DUPLICATE = "duplicate"
QUALITY_OFF_TRACK = "off_track"
QUALITY_TOO_SHORT = "too_short"
QUALITY_EXCLUDED = {QUALITY_PROMPT_ECHO, QUALITY_DUPLICATE, QUALITY_OFF_TRACK, QUALITY_TOO_SHORT}
QUALITY_FLAG_CODE_DEBUG = "code_debug"
QUALITY_FLAG_CONCEPT = "concept_question"

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
    quality_label: str = QUALITY_RAW
    quality_reason: str = ""
    quality_flags: Tuple[str, ...] = ()
    intent_code: str = "other"
    intent_label: str = QUESTION_INTENT_LABELS["other"]
    semantic_terms: Tuple[str, ...] = ()


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _jieba_terms(chinese_text: str) -> List[str]:
    """用 jieba 对中文片段分词（lexical fallback 之外的首选路径）。"""
    import jieba  # type: ignore

    terms: List[str] = []
    for word in jieba.lcut(chinese_text):
        w = word.strip().lower()
        if len(w) >= 2 and w not in STOP_WORDS:
            terms.append(w)
    return terms


def _fallback_terms(chinese_text: str) -> List[str]:
    """jieba 不可用时退化为定长滑动窗口切词。"""
    terms: List[str] = []
    compact = re.sub(r"\s+", "", chinese_text)
    for size in (4, 3, 2):
        for i in range(0, max(len(compact) - size + 1, 0)):
            w = compact[i : i + size]
            if w and w not in STOP_WORDS:
                terms.append(w)
    return terms


def _extract_terms(text_value: str, *, limit: int = 12) -> Tuple[str, ...]:
    # 截断超长文本避免分词超时（保留前 2000 字符足够提取关键词）
    if len(text_value) > 2000:
        text_value = text_value[:2000]

    normalized = _normalize_text(text_value)
    latin = re.findall(r"[a-zA-Z][a-zA-Z0-9_+#-]{1,}", normalized)
    chinese_text = re.sub(r"[a-zA-Z0-9_+#-]+", " ", normalized)
    terms: List[str] = []

    for word in latin:
        word_l = word.lower()
        if word_l not in STOP_WORDS:
            terms.append(word_l)

    try:
        terms.extend(_jieba_terms(chinese_text))
    except Exception as e:
        logger.warning(f"jieba 分词失败，降级到滑动窗口: {e}")
        terms.extend(_fallback_terms(chinese_text))

    return _dedupe_terms(terms, limit)


def _term_similarity(left: Iterable[str], right: Iterable[str]) -> float:
    a = set(left)
    b = set(right)
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, min(len(a), len(b)))


# 提问方式类通用词：它们表达"怎么问"而不是"问什么"，不区分知识点。
# 若参与聚类，会把"循环报错怎么调试"和"递归报错怎么调试"这类不同主题合并，
# 因此聚类时剔除；展示/词云仍保留原始词。
#
# 注意："错误"已从通用词中移除，因为在"错误处理"课程中它是核心主题词，
# 需要参与区分"语法错误"、"运行时错误"、"逻辑错误"等不同子话题。
# "报错"(动作/状态)和"异常"(技术术语)保留为通用词。
_CLUSTER_GENERIC_TERMS = frozenset({
    "报错", "异常", "调试", "怎么", "怎样", "如何", "为什么", "什么",
    "哪里", "哪些", "哪个", "可以", "能不能", "是否", "应该", "需要", "必须",
    "区别", "关系", "原理", "本质", "对比", "更好", "合理", "判断", "评价",
    "帮我", "请", "一下", "还是", "或者", "以及", "关于", "这个", "那个",
})


def _semantic_labels(event: "ConversationEvent") -> Tuple[str, ...]:
    """取事件命中的语义别名，并剔除通用词（如"错误"本身不区分知识点）。"""
    aliases = tuple(term for term in (event.semantic_terms or ()) if term not in event.terms)
    return tuple(term for term in aliases if term not in _CLUSTER_GENERIC_TERMS)


def _teacher_semantic_labels(teacher: Dict[str, Any]) -> Tuple[str, ...]:
    """教师侧事件的语义别名，来源字段与 ``_nearest_teacher`` 的候选结构一致。"""
    terms = set(teacher.get("_terms") or teacher.get("terms") or ())
    aliases = teacher.get("_semantic_terms") or teacher.get("semantic_terms") or ()
    return tuple(
        term for term in aliases if term not in terms and term not in _CLUSTER_GENERIC_TERMS
    )


def cluster_similarity(left_event: "ConversationEvent", right_event: "ConversationEvent") -> float:
    """聚类相似度：词法（去通用词）与语义别名分别计算后加权。

    语义别名若与词法词并入同一集合，会被大量词法词稀释（overlap coefficient
    的分母取较小集合大小）。这里分开计算再加权，使语义信号不被稀释：
      - 语义分：同义问法（如"取不到"与"不包含最后"都命中"边界"）
      - 词法分：共享知识点词（如 range、递归）
    权重 0.5/0.5：任一维度强匹配即可跨过阈值，同时要求两者都不弱；
    不同主题的报错问题因通用词（报错/调试）被剔除，词法分归零，不再误并。
    """
    left_lexical = tuple(term for term in left_event.terms if term not in _CLUSTER_GENERIC_TERMS)
    right_lexical = tuple(term for term in right_event.terms if term not in _CLUSTER_GENERIC_TERMS)
    semantic_score = _term_similarity(_semantic_labels(left_event), _semantic_labels(right_event))
    lexical_score = _term_similarity(left_lexical, right_lexical)
    return 0.5 * semantic_score + 0.5 * lexical_score



def _looks_off_track(event: ConversationEvent, task_sheet: str) -> bool:
    if event.question_type == QUALITY_OFF_TRACK:
        return True
    if event.is_code_related or event.is_error_related:
        return False
    # 关键词不重合只能作为弱信号，不能单独把"range 结束值为什么取不到"这类
    # 同主题但换了说法的问题过滤掉。这里仅对明显闲聊/跨课题词做保守标记。
    if not task_sheet:
        return False
    return bool(
        re.search(
            r"天气|电影|电视剧|游戏|足球|篮球|明星|八卦|辅导班|保护环境|环境恶化|滚回|tv|gv",
            event.content,
            re.I,
        )
    )


def classify_question_quality(event: ConversationEvent, *, task_sheet: str = "") -> ConversationEvent:
    """给事件添加可追溯的质量标签；不改变原始文本，也不直接丢弃事件。"""
    if event.role_code != STUDENT_ROLE or event.message_type != "question":
        return replace(event, quality_label=QUALITY_RAW, quality_reason="非学生问题，不参与热点主统计")

    flags: List[str] = []
    if event.is_error_related or (event.is_code_related and re.search(r"代码|程序|运行|函数|循环|变量|def |return", event.content, re.I)):
        flags.append(QUALITY_FLAG_CODE_DEBUG)
    if event.question_type in {"clarify", "follow_up", "challenge", "transfer", "extend"} and QUALITY_FLAG_CODE_DEBUG not in flags:
        flags.append(QUALITY_FLAG_CONCEPT)

    compact = _compact_for_match(event.content)
    if len(compact) < 4:
        return replace(event, quality_label=QUALITY_TOO_SHORT, quality_reason="有效信息过短", quality_flags=tuple(flags))
    if _looks_like_prompt_echo(event, task_sheet):
        return replace(event, quality_label=QUALITY_PROMPT_ECHO, quality_reason="疑似整段复制任务单或代码题", quality_flags=tuple(flags))
    if _looks_off_track(event, task_sheet):
        return replace(event, quality_label=QUALITY_OFF_TRACK, quality_reason="与任务单主题无明显关联", quality_flags=tuple(flags))
    return replace(event, quality_label=QUALITY_VALID, quality_reason="通过基础质量筛选", quality_flags=tuple(flags))


def _quality_counts(
    raw_student_events: Sequence[ConversationEvent],
    valid: List[ConversationEvent],
    output: List[ConversationEvent],
) -> Dict[str, int]:
    counts = {
        "raw_count": len(raw_student_events),
        "valid_question_count": len(valid),
        "prompt_echo_count": sum(event.quality_label == QUALITY_PROMPT_ECHO for event in output),
        "duplicate_count": sum(event.quality_label == QUALITY_DUPLICATE for event in output),
        "off_track_count": sum(event.quality_label == QUALITY_OFF_TRACK for event in output),
        "too_short_count": sum(event.quality_label == QUALITY_TOO_SHORT for event in output),
        "noise_count": sum(event.quality_label in {QUALITY_OFF_TRACK, QUALITY_TOO_SHORT} for event in output),
    }
    counts["excluded_count"] = counts["raw_count"] - counts["valid_question_count"]
    return counts


def prepare_student_questions(
    events: Sequence[ConversationEvent],
    *,
    task_sheet: str = "",
    duplicate_window_seconds: int = 10,
) -> Tuple[List[ConversationEvent], List[ConversationEvent], Dict[str, int]]:
    """返回(有效问题、全部学生问题、质量统计)。

    全部学生问题带有质量标签并保留用于证据追溯；只有有效问题进入热点聚类、词云和时间线。
    """
    raw_student_events = [
        event for event in events
        if event.role_code == STUDENT_ROLE and event.message_type == "question"
    ]
    classified = [classify_question_quality(event, task_sheet=task_sheet) for event in raw_student_events]
    valid: List[ConversationEvent] = []
    output: List[ConversationEvent] = []
    last_seen: Dict[Tuple[int, str], ConversationEvent] = {}

    for event in classified:
        current = event
        if event.quality_label == QUALITY_VALID and event.user_id is not None:
            key = (int(event.user_id), event.normalized_text)
            previous = last_seen.get(key)
            if previous is not None and (event.created_at - previous.created_at).total_seconds() <= duplicate_window_seconds:
                current = replace(
                    event,
                    quality_label=QUALITY_DUPLICATE,
                    quality_reason=f"同一学生在 {duplicate_window_seconds} 秒内重复提交",
                )
            else:
                last_seen[key] = event
        output.append(current)
        if current.quality_label == QUALITY_VALID:
            valid.append(current)

    counts = _quality_counts(raw_student_events, valid, output)
    return valid, output, counts


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
        "quality_label": event.quality_label,
        "quality_reason": event.quality_reason,
        "quality_flags": list(event.quality_flags),
        "included_in_analysis": event.quality_label == QUALITY_VALID,
        "intent_code": event.intent_code,
        "intent_label": event.intent_label,
        "semantic_terms": list(event.semantic_terms or event.terms),
    }


async def load_conversation_events(
    db: AsyncSession,
    *,
    agent_id: int,
    start_at: datetime,
    end_at: datetime,
    class_name: Optional[str] = None,
    include_archived: bool = False,
) -> List[ConversationEvent]:
    """Load typed conversation events from the raw conversation table.

    Args:
        db: 数据库会话
        agent_id: 智能体ID
        start_at: 开始时间
        end_at: 结束时间
        class_name: 班级名称过滤（可选）
        include_archived: 是否包含已归档数据，默认 False
    """
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
          AND (:include_archived = TRUE OR c.is_archived = FALSE)
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
                "include_archived": include_archived,
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
                intent_code=_detect_question_intent(content, q_type),
                intent_label=QUESTION_INTENT_LABELS[_detect_question_intent(content, q_type)],
                semantic_terms=_semantic_terms(content, terms),
            )
        )
    return events


def _dedupe_student_questions(
    events: Sequence[ConversationEvent],
    *,
    task_sheet: str = "",
) -> List[ConversationEvent]:
    """兼容旧调用方的学生问题筛选入口。"""
    valid, _, _ = prepare_student_questions(events, task_sheet=task_sheet)
    return valid


def _manual_teacher_event(mark: Dict[str, Any], index: int) -> Dict[str, Any]:
    raw_time = mark.get("time")
    time_value = raw_time if isinstance(raw_time, datetime) else datetime.fromisoformat(str(raw_time).replace("Z", "+00:00"))
    question = str(mark.get("question") or "教师提问")
    terms = _extract_terms(question)
    return {
        "id": f"manual-{index}",
        "message_id": None,
        "time": _ensure_aware(time_value).isoformat(),
        "question": question,
        "source": "manual",
        "user_name": "手动标记",
        "evidence_ids": [],
        "_terms": terms,
        "_semantic_terms": _semantic_terms(question, terms),
        "_session_id": mark.get("session_id"),
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
                "_terms": event.terms,
                "_semantic_terms": event.semantic_terms or event.terms,
                "_session_id": event.session_id,
            }
        )
    for idx, mark in enumerate(teacher_marks or []):
        try:
            teacher_questions.append(_manual_teacher_event(mark, idx))
        except Exception:
            continue
    teacher_questions.sort(key=lambda item: item.get("time") or "")
    return teacher_questions


def _public_teacher_question(item: Dict[str, Any]) -> Dict[str, Any]:
    """Return the stable teacher-anchor contract without matching internals."""
    return {
        key: item.get(key)
        for key in ("id", "message_id", "time", "question", "source", "user_name")
        if key in item
    }


def _teacher_anchor_time_delta(
    event: ConversationEvent,
    teacher: Dict[str, Any],
    *,
    max_minutes: int,
) -> Optional[float]:
    try:
        teacher_time = datetime.fromisoformat(str(teacher.get("time")).replace("Z", "+00:00"))
    except Exception:
        return None

    delta = (event.created_at - _ensure_aware(teacher_time)).total_seconds()
    max_seconds = max(1, max_minutes * 60)
    if delta < -120 or delta > max_seconds:
        return None
    return delta


def _teacher_anchor_reasons(
    time_score: float,
    semantic_score: float,
    same_session: bool,
) -> List[str]:
    reasons: List[str] = []
    if time_score >= 0.5:
        reasons.append("时间接近")
    if semantic_score >= 0.2:
        reasons.append("语义词重合")
    if same_session:
        reasons.append("同一会话")
    if not reasons:
        reasons.append("仅按时间窗口匹配")
    return reasons


def _teacher_anchor_match_type(same_session: bool, semantic_score: float) -> str:
    if same_session and semantic_score >= 0.2:
        return "same_session_semantic"
    if semantic_score >= 0.2:
        return "semantic_time"
    if same_session:
        return "same_session_time"
    return "time_only"


def _teacher_anchor_candidate(
    event: ConversationEvent,
    teacher: Dict[str, Any],
    *,
    max_minutes: int,
) -> Optional[Dict[str, Any]]:
    """Score one teacher/student association using only explainable signals."""
    delta = _teacher_anchor_time_delta(event, teacher, max_minutes=max_minutes)
    if delta is None:
        return None

    max_seconds = max(1, max_minutes * 60)
    # 学生提问通常应发生在教师提问之后；保留 120 秒时钟误差窗口，但降低其分数。
    time_score = max(0.0, 1.0 - abs(delta) / max_seconds)
    if delta < 0:
        time_score *= 0.5

    # 相似度用「知识词」= 词法词 ∪ 语义别名，并剔除通用词：
    # 直接把 semantic_terms 整体比较会被词法词稀释，且"报错/调试"等通用词
    # 会让不同知识点的提问伪装成强关联（如"循环报错"误配"递归报错"）。
    # 并入并集可避免 jieba 分词差异导致的跨边界丢失（如"递归"与"递归函数"）。
    event_lexical = tuple(t for t in event.terms if t not in _CLUSTER_GENERIC_TERMS)
    teacher_lexical = tuple(
        t
        for t in (teacher.get("_terms") or teacher.get("terms") or ())
        if t not in _CLUSTER_GENERIC_TERMS
    )
    event_knowledge = (*event_lexical, *_semantic_labels(event))
    teacher_knowledge = (*teacher_lexical, *_teacher_semantic_labels(teacher))
    semantic_score = _term_similarity(event_knowledge, teacher_knowledge)
    same_session = bool(
        event.session_id
        and teacher.get("_session_id")
        and event.session_id == teacher.get("_session_id")
    )
    session_score = 1.0 if same_session else 0.0
    score = 0.55 * time_score + 0.30 * semantic_score + 0.15 * session_score

    reasons = _teacher_anchor_reasons(time_score, semantic_score, same_session)
    match_type = _teacher_anchor_match_type(same_session, semantic_score)

    confidence = "high" if score >= 0.70 else "medium" if score >= 0.45 else "low"
    result = dict(teacher)
    result.update(
        {
            "delay_seconds": int(delta),
            "anchor_score": round(max(0.0, min(1.0, score)), 4),
            "anchor_confidence": confidence,
            "anchor_match_type": match_type,
            "anchor_reason": reasons,
            "anchor_time_score": round(max(0.0, min(1.0, time_score)), 4),
            "anchor_semantic_score": round(max(0.0, min(1.0, semantic_score)), 4),
            "anchor_same_session": same_session,
        }
    )
    return result


def _nearest_teacher(
    event: ConversationEvent,
    teacher_questions: Sequence[Dict[str, Any]],
    *,
    max_minutes: int = 15,
) -> Optional[Dict[str, Any]]:
    candidates = [
        candidate
        for teacher in teacher_questions
        if (candidate := _teacher_anchor_candidate(event, teacher, max_minutes=max_minutes)) is not None
    ]
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda item: (
            float(item.get("anchor_score") or 0.0),
            1 if item.get("anchor_same_session") else 0,
            -abs(int(item.get("delay_seconds") or 0)),
        ),
    )


def _build_evidence_index(events: Sequence[ConversationEvent]) -> Dict[str, Dict[str, Any]]:
    return {str(event.message_id): _event_to_dict(event) for event in events}
