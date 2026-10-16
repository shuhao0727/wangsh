"""会话事件分类与回声检测辅助函数。

从 app/services/agents/agent_analysis_events.py 拆出的私有辅助：
文本归一化、词去重、提问类型/Bloom/意图规则分类、语义别名与任务单回声检测。
行为与原内联代码逐句等价；仅由 agent_analysis_events.py 引用。
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Iterable, List, Set, Tuple



def _normalize_text(value: str) -> str:
    text_value = re.sub(r"\s+", " ", (value or "").strip())
    text_value = re.sub(r"[？?。.!！；;]+$", "", text_value)
    return text_value.lower()


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
        # 带有明确疑问/报错信号的长文本通常是"引用任务单后提问"，仍保留为有效问题。
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
