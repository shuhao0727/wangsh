"""Conversation event primitives and database loading for deep analysis."""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, replace
from difflib import SequenceMatcher
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

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

# 质量标签只描述“是否进入热点主统计”，不会删除原始消息。
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


def _normalize_text(value: str) -> str:
    text_value = re.sub(r"\s+", " ", (value or "").strip())
    text_value = re.sub(r"[？?。.!！；;]+$", "", text_value)
    return text_value.lower()


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


def _dedupe_terms(terms: Iterable[str], limit: int) -> Tuple[str, ...]:
    """去重并截断到 limit 个词，保持首次出现顺序。"""
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


# 提问方式类通用词：它们表达“怎么问”而不是“问什么”，不区分知识点。
# 若参与聚类，会把“循环报错怎么调试”和“递归报错怎么调试”这类不同主题合并，
# 因此聚类时剔除；展示/词云仍保留原始词。
_CLUSTER_GENERIC_TERMS = frozenset({
    "报错", "错误", "异常", "调试", "怎么", "怎样", "如何", "为什么", "什么",
    "哪里", "哪些", "哪个", "可以", "能不能", "是否", "应该", "需要", "必须",
    "区别", "关系", "原理", "本质", "对比", "更好", "合理", "判断", "评价",
    "帮我", "请", "一下", "还是", "或者", "以及", "关于", "这个", "那个",
})


def cluster_terms(event: "ConversationEvent") -> Tuple[str, ...]:
    """聚类专用词集：去掉通用提问词后的词法词 + 语义别名。

    与 ``_event_terms`` 的区别：``_event_terms`` 用于展示（保留全部原词），
    本函数用于相似度判定（剔除不区分知识点的提问方式词）。
    """
    lexical = tuple(term for term in event.terms if term not in _CLUSTER_GENERIC_TERMS)
    semantic = _semantic_labels(event)
    return (*lexical, *semantic)


def _semantic_labels(event: "ConversationEvent") -> Tuple[str, ...]:
    """取事件命中的语义别名，并剔除通用词（如“错误”本身不区分知识点）。"""
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
      - 语义分：同义问法（如“取不到”与“不包含最后”都命中“边界”）
      - 词法分：共享知识点词（如 range、递归）
    权重 0.5/0.5：任一维度强匹配即可跨过阈值，同时要求两者都不弱；
    不同主题的报错问题因通用词（报错/调试）被剔除，词法分归零，不再误并。
    """
    left_lexical = tuple(term for term in left_event.terms if term not in _CLUSTER_GENERIC_TERMS)
    right_lexical = tuple(term for term in right_event.terms if term not in _CLUSTER_GENERIC_TERMS)
    semantic_score = _term_similarity(_semantic_labels(left_event), _semantic_labels(right_event))
    lexical_score = _term_similarity(left_lexical, right_lexical)
    return 0.5 * semantic_score + 0.5 * lexical_score


def _detect_question_type(text_value: str) -> str:
    t = _normalize_text(text_value)
    if re.fullmatch(r"(?:你好|嗨|hi|hello|test|测试|在吗|ok|好的|谢谢|哈哈+|萌萌|tv|gv|滚回)[\s，,。.!！?？~～]*", t, re.I):
        return "off_track"
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


_SEMANTIC_TERM_RULES: Tuple[Tuple[str, str], ...] = (
    (r"结束值|终止值|最后一个数|上界|下界|边界|包含最后|取不到", "边界"),
    (r"报错|错误|异常|exception|traceback|error", "错误"),
    (r"递归|自调用|调用自己", "递归"),
    (r"循环|迭代|for\s*循环|while\s*循环", "循环"),
    (r"参数|形参|实参", "参数"),
    (r"函数|方法", "函数"),
    (r"列表|数组|集合", "序列"),
)


def _semantic_terms(text_value: str, terms: Iterable[str], *, limit: int = 16) -> Tuple[str, ...]:
    """给词法词补充少量稳定的语义别名，避免同义问法被拆散。"""
    aliases = [alias for pattern, alias in _SEMANTIC_TERM_RULES if re.search(pattern, text_value, re.I)]
    return _dedupe_terms((*terms, *aliases), limit)


def _detect_question_intent(text_value: str, question_type: str) -> str:
    """用可解释的规则识别提问意图；这是聚类的辅助信号，不替代原始问题。"""
    t = _normalize_text(text_value)
    if question_type == "off_track":
        return "other"
    if question_type == "debug" or re.search(r"报错|错误|异常|无法运行|运行不了|bug|debug|调试|traceback|exception", t, re.I):
        return "runtime_debug"
    if re.search(r"结束值|终止值|最后一个数|上界|下界|边界|包含不包含|取不到|越界|范围", t, re.I):
        return "boundary_condition"
    if re.search(r"区别|对比|哪个更好|哪个更合适|还是|优缺点|比较", t, re.I):
        return "comparison_choice"
    if re.search(r"为什么|为何|原因|原理|本质|怎么会", t, re.I):
        return "mechanism_reason"
    if question_type == "transfer" or re.search(r"如果|换成|迁移|改成|其他场景|别的情况|能不能用在", t, re.I):
        return "transfer_application"
    if question_type == "extend" or re.search(r"进一步|进阶|拓展|扩展|还能不能|设计|改造", t, re.I):
        return "extension_design"
    if question_type == "apply" or re.search(r"怎么写|如何实现|怎样实现|帮我写|实现|使用|怎么做", t, re.I):
        return "implementation_howto"
    if re.search(r"是什么|什么意思|定义|概念|指什么|解释|说明|举例|例子|示例", t, re.I):
        return "concept_definition"
    return "other"



def _compact_for_match(value: str) -> str:
    """压缩空白和标点，供任务单回声检测使用。"""
    return re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", "", _normalize_text(value))


def _has_question_signal(value: str) -> bool:
    return bool(
        re.search(
            r"[?？]|为什么|怎么|如何|能否|是否|能不能|可不可以|区别|原理|原因|报错|错误|不会|不懂|什么意思|怎么办",
            value,
            re.I,
        )
    )


def _prompt_echo_score(content: str, task_sheet: str) -> float:
    """返回内容与任务单的粗粒度相似度，数值仅用于确定性过滤。"""
    compact_content = _compact_for_match(content)
    compact_task = _compact_for_match(task_sheet)
    if not compact_content or not compact_task or len(compact_content) < 16:
        return 0.0
    if compact_content == compact_task:
        return 1.0
    if compact_content in compact_task or compact_task in compact_content:
        shorter = min(len(compact_content), len(compact_task))
        longer = max(len(compact_content), len(compact_task))
        return min(0.98, shorter / max(1, longer) + 0.25)
    ratio = SequenceMatcher(None, compact_content, compact_task).ratio()
    # 任务单较长时，字符级 ratio 会被少量学生改写稀释；再补一个有序词片段信号。
    content_ngrams = {compact_content[i : i + 3] for i in range(max(0, len(compact_content) - 2))}
    task_ngrams = {compact_task[i : i + 3] for i in range(max(0, len(compact_task) - 2))}
    ngram_overlap = len(content_ngrams & task_ngrams) / max(1, min(len(content_ngrams), len(task_ngrams)))
    return max(ratio, ngram_overlap * 0.85)


def _looks_like_prompt_echo(event: ConversationEvent, task_sheet: str) -> bool:
    text_value = event.content
    compact = _compact_for_match(text_value)
    if len(compact) < 30:
        return False
    if task_sheet and _prompt_echo_score(text_value, task_sheet) >= 0.55:
        # 带有明确疑问/报错信号的长文本通常是“引用任务单后提问”，仍保留为有效问题。
        if not _has_question_signal(text_value):
            return True
        # 任务单几乎原样粘贴，且问题信号只出现在复制的题干中，也按回声处理。
        if _prompt_echo_score(text_value, task_sheet) >= 0.82:
            return True
    prompt_markers = r"任务单|题目|练习|要求|请完成|输入|输出|示例|编写|实现以下|代码如下"
    if len(compact) >= 140 and re.search(prompt_markers, text_value, re.I) and not _has_question_signal(text_value):
        return True
    if "```" in text_value and len(compact) >= 120 and not _has_question_signal(text_value):
        return True
    return False


def _looks_off_track(event: ConversationEvent, task_sheet: str) -> bool:
    if event.question_type == QUALITY_OFF_TRACK:
        return True
    if event.is_code_related or event.is_error_related:
        return False
    # 关键词不重合只能作为弱信号，不能单独把“range 结束值为什么取不到”这类
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


def _teacher_anchor_candidate(
    event: ConversationEvent,
    teacher: Dict[str, Any],
    *,
    max_minutes: int,
) -> Optional[Dict[str, Any]]:
    """Score one teacher/student association using only explainable signals."""
    try:
        teacher_time = datetime.fromisoformat(str(teacher.get("time")).replace("Z", "+00:00"))
    except Exception:
        return None

    delta = (event.created_at - _ensure_aware(teacher_time)).total_seconds()
    max_seconds = max(1, max_minutes * 60)
    if delta < -120 or delta > max_seconds:
        return None

    # 学生提问通常应发生在教师提问之后；保留 120 秒时钟误差窗口，但降低其分数。
    time_score = max(0.0, 1.0 - abs(delta) / max_seconds)
    if delta < 0:
        time_score *= 0.5

    # 相似度用「知识词」= 词法词 ∪ 语义别名，并剔除通用词：
    # 直接把 semantic_terms 整体比较会被词法词稀释，且“报错/调试”等通用词
    # 会让不同知识点的提问伪装成强关联（如“循环报错”误配“递归报错”）。
    # 并入并集可避免 jieba 分词差异导致的跨边界丢失（如“递归”与“递归函数”）。
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

    reasons: List[str] = []
    if time_score >= 0.5:
        reasons.append("时间接近")
    if semantic_score >= 0.2:
        reasons.append("语义词重合")
    if same_session:
        reasons.append("同一会话")
    if not reasons:
        reasons.append("仅按时间窗口匹配")

    if same_session and semantic_score >= 0.2:
        match_type = "same_session_semantic"
    elif semantic_score >= 0.2:
        match_type = "semantic_time"
    elif same_session:
        match_type = "same_session_time"
    else:
        match_type = "time_only"

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
