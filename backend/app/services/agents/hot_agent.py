"""热点问题归类智能体。

热点问题只关注一件事：教师提问附近，学生是在回应教师，还是生成了教师没问过的
新问题。LLM 只负责逐条判断类别（语义判断），计数与时间分桶全部由程序完成，避免
让模型数数出错。指令说明见 docs/features/assessment/hot_agent.md。
"""

from __future__ import annotations

import json
from datetime import datetime
from collections import Counter
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .llm_agent_base import call_llm

# 每批交给 LLM 的问题条数：太大容易截断 JSON，太小调用次数过多。
BATCH_SIZE = 60
# 每条问题重复判定几次后取多数。上游对 temperature 执行不严格，单次结果会波动。
VOTE_ROUNDS = 3
# 多数判定：一致票数不足该比例时标记为“待确认”，不硬猜。
CONFIDENT_SHARE = 2 / 3
# 投票轮数上限，避免误配置导致调用次数失控
MAX_VOTE_ROUNDS = 5
# 手填标记与自动识别的教师提问视为同一条的时间容差：
# 自动识别带毫秒、手填只到分钟，老师手填的时间常比真实时刻晚十几秒到一分钟。
MANUAL_MERGE_SECONDS = 120
TASK_SHEET_LIMIT = 3000

# 归类体系：大类 -> 细分 -> 中文名。回应型必须指向某个教师提问 Tn。
CATEGORY_LABELS = {"response": "回应型", "generative": "生成性", "unrelated": "无关"}
SUBTYPE_LABELS = {
    "clarify": "理解追问",
    "apply": "尝试应用",
    "debug": "调试求助",
    "verify": "核对确认",
    "principle": "原理深挖",
    "transfer": "迁移拓展",
    "new_confusion": "新的困惑",
}
SUBTYPES_BY_CATEGORY = {
    "response": ("clarify", "apply", "debug", "verify"),
    "generative": ("principle", "transfer", "new_confusion"),
    "unrelated": (),
}

_SYSTEM_PROMPT = """你是一位课堂提问分析助手。教师在课上提出若干问题（T1、T2……），学生随后向 AI 智能体提问。
请逐条判断每个学生问题属于哪一类。只做归类：不要写教学建议、认知分层或诊断结论，也不要自己统计数量——计数由程序完成。

## 三个大类
1. response（回应型）：学生在回应某个教师提问。必须给出对应的教师提问编号 teacher_ref（如 "T2"）。
2. generative（生成性）：与本节课内容有关，但不是在回应任何一个教师提问——是学生自己生成的问题。teacher_ref 填 null。
3. unrelated（无关）：闲聊、测试、问候，或与本节课内容无关。teacher_ref 填 null。

## 细分 subtype
- response 下：
  - clarify 理解追问：没理解教师的问题，在问概念、问意思
  - apply 尝试应用：按教师的问题动手写代码、套用方法
  - debug 调试求助：照着做出了错，在问报错或结果不对
  - verify 核对确认：已有答案，在确认对不对
- generative 下：
  - principle 原理深挖：追问为什么、背后的原理或机制
  - transfer 迁移拓展：换场景、换数据、推广到别的情况
  - new_confusion 新的困惑：暴露出教学设计没覆盖到的卡点或误解
- unrelated 下：subtype 填 null

## 判断原则
- **先看内容，再看时间。** 判断的唯一依据是"这个问题的内容，是不是在完成某个教师提问所要求的事"。时间接近本身**不构成**回应关系。
- 判定 response 前必须能说清：学生问的这一点，教师提问里是否明确要求过。**只要教师提问没有涉及，即使时间上紧接着该提问，也必须归为 generative。**
- 以教学设计和教师提问的语义为准，不要只看关键词。问题里没有"如果、拓展"等词，也可能是生成性问题。
- 学生在 T2 之后问的，仍可能是在回应更早的 T1：按内容指向哪个 T 决定 teacher_ref，不要默认最近的提问。
- 与本节课内容相关、但对应不上任何教师提问 → generative。与本节课无关（闲聊、问设备、问食堂）→ unrelated。
- 拿不准 response 与 generative 时，选 generative：把教师没讲到的疑问误判成"在回应教师"，会让老师看不到学生的真实盲区，代价更高。
- reason 用一句中文说明依据，不超过 30 字。

## 反例（都是从真实误判中总结的，务必避免）
教师 T1："请把 S07 的六项每周天数按固定顺序存成一个列表。" T2："第三项的下标是几？请用 a[?] 读出来。"
- "为什么下标从 0 开始不是从 1 开始？" → generative / principle。T2 只要求读出 a[2] 的值，**没有问下标为什么从 0 开始**。不能因为它在 T2 之后就算回应。
- "列表里的数可以是小数或者负数吗？" → generative / transfer。T1 只要求把给定数据存成列表，没有讨论元素类型。
- "为什么报错说 range 不包含上界？" → 若教师提问只要求用 for 遍历列表求和、从未提 range → generative / principle；只有教师明确要求用 range 时才算 response / debug。
- "我写成 a = (6,3,4) 用圆括号可以吗？" → response / clarify（T1 要求写出列表，这是在确认列表写法）。
- "我的结果是 29，少了哪一个？" → response / debug（这正是 T3 求和任务的执行结果）。

## 输出格式（只输出 JSON，不要 markdown 代码块）
{"items": [{"id": "问题编号", "category": "response|generative|unrelated", "subtype": "见上", "teacher_ref": "T1 或 null", "reason": "依据"}]}
必须为输入中的每一个问题都输出一条，id 与输入一致。"""


def _timestamp(value: Any) -> Optional[datetime]:
    """解析带时区时间；无法解析时返回 None（不参与就近去重）。"""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _clock(value: Any) -> str:
    """把时间统一成 HH:MM:SS，方便模型比较先后。"""
    text = str(value or "")
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).strftime("%H:%M:%S")
    except ValueError:
        return text[11:19] if len(text) >= 19 else text


def label_teacher_questions(teacher_questions: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """按时间先后给教师提问编号 T1、T2……，编号是前后端共同的引用键。

    教师账号的提问会被自动识别，老师又常在生成分析时手填一遍同样的内容。
    两条都计数会把学生的回应拆到两个 Tn 上，因此：
    - 同一 ``message_id`` 只保留一条；
    - 手填标记（无 ``message_id``）与自动识别内容相同、时间相差不超过
      ``MANUAL_MERGE_SECONDS`` 时视为同一条，保留自动识别那条；
    - 两份手填内容相同且时间相近也只留一条。
    """
    automatic: list[Dict[str, Any]] = []
    manual: list[Dict[str, Any]] = []
    seen_ids: set[Any] = set()
    for item in teacher_questions:
        text = str(item.get("question") or "").strip()
        if not text:
            continue
        message_id = item.get("message_id")
        entry = {"item": item, "question": text, "moment": _timestamp(item.get("time"))}
        if message_id is None:
            manual.append(entry)
            continue
        if message_id in seen_ids:
            continue
        seen_ids.add(message_id)
        automatic.append(entry)

    def too_close(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
        """内容相同且时间相近。任一侧时间缺失时无法比较，按不同条目处理。"""
        if a["question"] != b["question"] or a["moment"] is None or b["moment"] is None:
            return False
        return abs((a["moment"] - b["moment"]).total_seconds()) <= MANUAL_MERGE_SECONDS

    kept = list(automatic)
    for entry in manual:
        # 手填只是自动识别的重复，丢弃手填那条，保留带 message_id 的自动记录
        if not any(too_close(entry, existing) for existing in kept):
            kept.append(entry)

    ordered = sorted(kept, key=lambda e: str(e["item"].get("time") or ""))
    return [
        {
            "ref": f"T{index}",
            "time": entry["item"].get("time"),
            "question": entry["question"],
            # 供前端在时间线上定位；手动标记没有消息 id，按时间匹配
            "message_id": entry["item"].get("message_id"),
        }
        for index, entry in enumerate(ordered, 1)
    ]


def _classifiable_events(events: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """只归类通过质量筛选、且有稳定编号与文本的学生提问。"""
    result = []
    for event in events:
        text = str(event.get("content") or event.get("question") or "").strip()
        if not text or event.get("message_id") is None:
            continue
        if event.get("included_in_analysis") is False:
            continue
        result.append({"id": str(event["message_id"]), "time": _clock(event.get("created_at")), "question": text[:300]})
    return result


def build_classification_prompt(
    task_sheet: str,
    teachers: Sequence[Dict[str, Any]],
    batch: Sequence[Dict[str, Any]],
    custom_prompt: Optional[str] = None,
) -> str:
    """组装一批问题的完整提示词。"""
    teacher_lines = "\n".join(f"{t['ref']}（{_clock(t['time'])}）：{t['question']}" for t in teachers) or "（本节课未录入教师提问）"
    parts = [
        _SYSTEM_PROMPT,
        "## 教学设计 / 任务单\n" + (task_sheet.strip()[:TASK_SHEET_LIMIT] or "（未提供）"),
        "## 教师提问\n" + teacher_lines,
        "## 待归类的学生问题\n" + json.dumps(list(batch), ensure_ascii=False),
    ]
    if custom_prompt and custom_prompt.strip():
        parts.append("## 教师补充说明\n" + custom_prompt.strip())
    return "\n\n".join(parts)


def _validate_item(raw: Any, teacher_refs: set[str]) -> Optional[Dict[str, Any]]:
    """校验单条归类；不合法的组合直接丢弃，交给“未归类”兜底，不猜测修补。"""
    if not isinstance(raw, dict):
        return None
    category = raw.get("category")
    subtype = raw.get("subtype") or None
    teacher_ref = raw.get("teacher_ref") or None
    if category not in SUBTYPES_BY_CATEGORY:
        return None
    if category == "unrelated":
        subtype, teacher_ref = None, None
    elif subtype not in SUBTYPES_BY_CATEGORY[category]:
        return None
    if category == "response" and teacher_ref not in teacher_refs:
        return None
    if category != "response":
        teacher_ref = None
    return {
        "category": category,
        "subtype": subtype,
        "teacher_ref": teacher_ref,
        "reason": str(raw.get("reason") or "").strip()[:60],
    }


def parse_classification(payload: Any, batch: Sequence[Dict[str, Any]], teacher_refs: set[str]) -> Dict[str, Dict[str, Any]]:
    """把 LLM 返回的一批结果按问题编号整理；只接受本批中存在的编号。"""
    expected = {item["id"] for item in batch}
    items = payload.get("items") if isinstance(payload, dict) else None
    result: Dict[str, Dict[str, Any]] = {}
    for raw in items if isinstance(items, list) else []:
        key = str(raw.get("id")) if isinstance(raw, dict) else ""
        if key in expected and key not in result and (item := _validate_item(raw, teacher_refs)):
            result[key] = item
    return result



def _majority(counter: Counter) -> Tuple[Any, int]:
    """返回出现最多的取值与次数；空时返回 (None, 0)。

    最高票并列时返回 (None, 票数)：平票说明没有共识，不能按插入顺序任选一个。
    """
    if not counter:
        return None, 0
    ranked = counter.most_common()
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return None, ranked[0][1]
    return ranked[0]


def merge_votes(votes: Sequence[Dict[str, Dict[str, Any]]]) -> Dict[str, Dict[str, Any]]:
    """把同一问题的多轮判定合并为一条。

    大类取多数票：一致票数达到 CONFIDENT_SHARE 才算确定，否则标记 ambiguous，
    不为了凑出结论而硬选一个。细分在“确定的同一大类”内取多数，只作参考不参与判定。
    教师提问引用同样取多数；生成性与无关的引用一律置空。
    """
    merged: Dict[str, Dict[str, Any]] = {}
    keys = {key for vote in votes for key in vote}
    for key in keys:
        picked = [vote[key] for vote in votes if key in vote]
        if picked:
            merged[key] = _merge_one(picked, len(votes))
    return merged


def _merge_one(picked: List[Dict[str, Any]], rounds: int) -> Dict[str, Any]:
    """合并单条问题在各轮的判定结果。"""
    category, top = _majority(Counter(item["category"] for item in picked))
    same = [item for item in picked if item["category"] == category]
    subtype, _ = _majority(Counter(item["subtype"] for item in same if item["subtype"]))
    teacher_ref, _ = _majority(Counter(item["teacher_ref"] for item in same if item["teacher_ref"]))
    reasons = [item["reason"] for item in same if item["reason"]]
    agreed = top / rounds
    return {
        "category": category,
        "subtype": subtype,
        "teacher_ref": teacher_ref,
        "reason": max(reasons, key=len) if reasons else "",
        # 多轮一致程度：1.0 表示每轮相同；低于阈值的条目需要老师复核
        "agreement": round(agreed, 2),
        "ambiguous": agreed < CONFIDENT_SHARE,
        "votes": rounds,
    }


def _empty_counts() -> Dict[str, int]:
    return {"response": 0, "generative": 0, "unrelated": 0, "unclassified": 0}


def aggregate_classification(
    events: Sequence[Dict[str, Any]],
    labels: Dict[str, Dict[str, Any]],
    teachers: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    """按教师提问和细分类别计数；计数全部由程序完成。"""
    totals = _empty_counts()
    # 待确认（多轮无共识）与未归类（模型没给结果）是两件事，分别统计
    ambiguous_total = 0
    subtypes = {key: 0 for key in SUBTYPE_LABELS}
    per_teacher = {t["ref"]: {key: 0 for key in SUBTYPES_BY_CATEGORY["response"]} for t in teachers}
    # 回应总数单独计数：细分缺失的条目也算进该 Tn 的回应，但不归属任何细分
    response_per_teacher: Dict[str, int] = {}
    for event in events:
        label = labels.get(event["id"])
        if label is None or label.get("ambiguous"):
            totals["unclassified"] += 1
            ambiguous_total += 1 if label is not None else 0
            continue
        totals[label["category"]] += 1
        subtype = label["subtype"]
        if subtype:
            subtypes[subtype] += 1
        # 细分在投票里平票时会是 None：只计回应总数，不塞进任何细分子项，
        # 否则 per_teacher 会多出一个 None 键，与前端各细分之和对不上。
        if label["teacher_ref"]:
            buckets = per_teacher[label["teacher_ref"]]
            if subtype:
                buckets[subtype] += 1
            response_per_teacher[label["teacher_ref"]] = response_per_teacher.get(label["teacher_ref"], 0) + 1
    return {
        "totals": totals,
        "ambiguous_count": ambiguous_total,
        "unlabelled_count": totals["unclassified"] - ambiguous_total,
        "subtypes": subtypes,
        "teachers": [
            {**t, "subtypes": per_teacher[t["ref"]], "response_count": response_per_teacher.get(t["ref"], 0)}
            for t in teachers
        ],
    }


async def classify_hot_questions(
    *,
    task_sheet: str,
    teacher_questions: Sequence[Dict[str, Any]],
    student_events: Sequence[Dict[str, Any]],
    custom_prompt: Optional[str] = None,
    api_endpoint: str = "",
    api_key: str = "",
    agent_type: str = "",
    agent_model: str = "",
    vote_rounds: int = VOTE_ROUNDS,
) -> Dict[str, Any]:
    """逐批、多轮调用 LLM 归类学生提问，按多数票合并后返回标签与程序统计。

    单次调用会因上游随机性而波动，默认每批判 VOTE_ROUNDS 次；票数不足 CONFIDENT_SHARE
    的条目标记为 ambiguous，不计入任何类别。
    """
    teachers = label_teacher_questions(teacher_questions)
    teacher_refs = {t["ref"] for t in teachers}
    events = _classifiable_events(student_events)
    labels: Dict[str, Dict[str, Any]] = {}
    failed_batches = 0
    votes = max(1, min(int(vote_rounds or 1), MAX_VOTE_ROUNDS))
    for offset in range(0, len(events), BATCH_SIZE):
        batch = events[offset:offset + BATCH_SIZE]
        prompt = build_classification_prompt(task_sheet, teachers, batch, custom_prompt)
        rounds: List[Dict[str, Dict[str, Any]]] = []
        for _ in range(votes):
            payload = await call_llm(
                prompt=prompt,
                api_endpoint=api_endpoint,
                api_key=api_key,
                agent_type=agent_type,
                agent_model=agent_model,
                response_format="json",
                timeout=180.0,
                temperature=0,  # 归类是判定题，尽量消除随机性（上游支持程度不一）
            )
            rounds.append(parse_classification(payload, batch, teacher_refs))
        if not any(rounds):
            failed_batches += 1
            continue
        labels.update(merge_votes(rounds))
    return {
        "version": "hot_classify_v1",
        # 去重后的教师提问清单（含 Tn 编号），前端据此编号，不自行按原始列表重编
        "teacher_refs": [{"ref": t["ref"], "time": t["time"], "question": t["question"], "message_id": t["message_id"]} for t in teachers],
        "category_labels": CATEGORY_LABELS,
        "subtype_labels": SUBTYPE_LABELS,
        "subtypes_by_category": {key: list(value) for key, value in SUBTYPES_BY_CATEGORY.items()},
        "items": {key: value for key, value in labels.items()},
        "vote_rounds": votes,
        "batch_count": -(-len(events) // BATCH_SIZE) if events else 0,
        "failed_batch_count": failed_batches,
        **aggregate_classification(events, labels, teachers),
    }


def classification_status(result: Dict[str, Any]) -> Tuple[str, Optional[str]]:
    """判定归类是否可用：全部失败为 empty，部分失败为 partial。"""
    totals = result.get("totals") or {}
    classified = sum(totals.get(key, 0) for key in ("response", "generative", "unrelated"))
    if classified == 0:
        return "empty", "分析智能体未返回可解析的归类结果"
    if totals.get("unclassified"):
        return "partial", f"{totals['unclassified']} 条问题未能归类"
    return "completed", None
