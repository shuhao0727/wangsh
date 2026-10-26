"""热点问题归类：校验、分批与程序统计（LLM 用假实现，不发起真实调用）。"""
import asyncio
import json

from app.services.agents import hot_agent

TEACHERS = [
    {"time": "2026-10-22T09:10:00+08:00", "question": "第三项的下标是多少？"},
    {"time": "2026-10-22T09:05:00+08:00", "question": "如何把六项数据存进列表？"},
]


def event(mid, text, **extra):
    return {"message_id": mid, "content": text, "created_at": "2026-10-22T09:12:00+08:00", **extra}


def test_teacher_questions_numbered_by_time():
    refs = hot_agent.label_teacher_questions(TEACHERS)
    assert [(t["ref"], t["question"]) for t in refs] == [
        ("T1", "如何把六项数据存进列表？"),
        ("T2", "第三项的下标是多少？"),
    ]


def test_duplicate_teacher_questions_are_merged_before_numbering():
    # 自动识别的教师提问与手填标记时间内容相同，只能占一个编号
    refs = hot_agent.label_teacher_questions([
        {"time": "2026-10-22T09:05:00+08:00", "question": "如何把六项数据存进列表？", "source": "auto"},
        {"time": "2026-10-22T09:10:00+08:00", "question": "第三项的下标是多少？", "source": "manual"},
        # 自动识别的消息带毫秒、手填标记只到分钟：同一内容在 30 秒内视为同一条
        {"time": "2026-10-22T09:05:00.123+08:00", "question": " 如何把六项数据存进列表？ ", "source": "manual"},
        # 同一消息 id 只计一次
        {"time": "2026-10-22T09:10:00+08:00", "question": "第三项的下标是多少？", "message_id": 9},
        # 时间相近但内容不同的教师提问必须保留
        {"time": "2026-10-22T09:06:00+08:00", "question": "列表和元组有什么区别？", "message_id": 10},
    ])
    assert [(t["ref"], t["question"]) for t in refs] == [
        ("T1", "如何把六项数据存进列表？"),
        ("T2", "列表和元组有什么区别？"),
        ("T3", "第三项的下标是多少？"),
    ]


def test_invalid_combinations_are_dropped_not_repaired():
    batch = [{"id": str(i)} for i in range(1, 7)]
    payload = {"items": [
        {"id": "1", "category": "response", "subtype": "clarify", "teacher_ref": "T1", "reason": "问概念"},
        {"id": "2", "category": "response", "subtype": "clarify", "teacher_ref": "T9"},   # 不存在的教师提问
        {"id": "3", "category": "generative", "subtype": "clarify", "teacher_ref": None},  # 细分不属于该大类
        {"id": "4", "category": "generative", "subtype": "transfer", "teacher_ref": "T1", "reason": "换场景"},
        {"id": "5", "category": "unrelated", "subtype": "debug", "teacher_ref": "T2"},
        {"id": "99", "category": "unrelated"},                                            # 不在本批
        {"id": "1", "category": "unrelated"},                                             # 重复编号只取第一条
    ]}
    parsed = hot_agent.parse_classification(payload, batch, {"T1", "T2"})
    assert set(parsed) == {"1", "4", "5"}
    assert parsed["4"]["teacher_ref"] is None  # 生成性不挂教师提问
    assert parsed["5"] == {"category": "unrelated", "subtype": None, "teacher_ref": None, "reason": ""}


def test_counts_come_from_program_not_model(monkeypatch):
    calls = []

    async def fake_llm(**kwargs):
        calls.append(kwargs["prompt"])
        return {"items": [
            {"id": "1", "category": "response", "subtype": "apply", "teacher_ref": "T1", "reason": "照做"},
            {"id": "2", "category": "response", "subtype": "debug", "teacher_ref": "T1", "reason": "报错"},
            {"id": "3", "category": "generative", "subtype": "principle", "teacher_ref": None, "reason": "问原理"},
            {"id": "4", "category": "unrelated", "subtype": None, "teacher_ref": None, "reason": "闲聊"},
        ]}

    monkeypatch.setattr(hot_agent, "call_llm", fake_llm)
    events = [
        event(1, "a = [6,3,4] 这样写对吗"),
        event(2, "报错 IndexError"),
        event(3, "为什么下标从 0 开始"),
        event(4, "你好"),
        event(5, "被筛掉的", included_in_analysis=False),
        {"content": "没有编号的问题"},
        event(6, "模型漏掉的一条"),
    ]
    result = asyncio.run(hot_agent.classify_hot_questions(
        task_sheet="列表与 for", teacher_questions=TEACHERS, student_events=events, api_key="k",
    ))
    # 每批默认判定多轮，同一条问题按多数票合并
    assert len(calls) == hot_agent.VOTE_ROUNDS
    assert result["totals"] == {"response": 2, "generative": 1, "unrelated": 1, "unclassified": 1}
    t1 = next(t for t in result["teachers"] if t["ref"] == "T1")
    assert t1["response_count"] == 2 and t1["subtypes"]["apply"] == 1 and t1["subtypes"]["debug"] == 1
    assert result["subtypes"]["principle"] == 1
    assert hot_agent.classification_status(result) == ("partial", "1 条问题未能归类")


def test_large_input_is_split_into_batches(monkeypatch):
    seen = []

    async def fake_llm(**kwargs):
        # 只数“待归类的学生问题”段落里的 JSON 条数，模板说明本身也含 "id"
        section = kwargs["prompt"].split("## 待归类的学生问题\n", 1)[1].split("\n\n", 1)[0]
        seen.append(len(json.loads(section)))
        return {}

    monkeypatch.setattr(hot_agent, "call_llm", fake_llm)
    events = [event(i, f"问题 {i}") for i in range(1, 131)]
    result = asyncio.run(hot_agent.classify_hot_questions(
        task_sheet="", teacher_questions=[], student_events=events, api_key="k",
    ))
    # 逐批进行：同一批先判定 VOTE_ROUNDS 轮，再处理下一批
    assert seen == [size for size in (60, 60, 10) for _ in range(hot_agent.VOTE_ROUNDS)]
    assert result["batch_count"] == 3 and result["failed_batch_count"] == 3
    assert hot_agent.classification_status(result)[0] == "empty"


def test_prompt_carries_task_sheet_and_teacher_refs():
    teachers = hot_agent.label_teacher_questions(TEACHERS)
    prompt = hot_agent.build_classification_prompt("教学设计：列表与 for", teachers, [{"id": "1", "time": "09:12:00", "question": "q"}])
    assert "教学设计：列表与 for" in prompt
    assert "T1（09:05:00）：如何把六项数据存进列表？" in prompt
    # 只做归类：明确禁止教学建议、认知分层与自行计数
    assert "不要写教学建议" in prompt
    assert "不要自己统计数量" in prompt
    assert "Bloom" not in prompt


def test_vote_merge_takes_majority_and_flags_split():
    rounds = [
        {"1": {"category": "response", "subtype": "apply", "teacher_ref": "T1", "reason": "a"},
         "2": {"category": "generative", "subtype": "transfer", "teacher_ref": None, "reason": "b"},
         "3": {"category": "generative", "subtype": "principle", "teacher_ref": None, "reason": "c"}},
        {"1": {"category": "response", "subtype": "debug", "teacher_ref": "T1", "reason": "d"},
         "2": {"category": "generative", "subtype": "transfer", "teacher_ref": None, "reason": "e"},
         "3": {"category": "response", "subtype": "clarify", "teacher_ref": "T2", "reason": "f"}},
        {"1": {"category": "response", "subtype": "apply", "teacher_ref": "T1", "reason": "g"},
         "2": {"category": "generative", "subtype": "transfer", "teacher_ref": None, "reason": "h"},
         "3": {"category": "unrelated", "subtype": None, "teacher_ref": None, "reason": "i"}},
    ]
    merged = hot_agent.merge_votes(rounds)
    # 1：三轮都判回应 T1，细分取多数 apply
    assert merged["1"]["category"] == "response" and merged["1"]["teacher_ref"] == "T1"
    assert merged["1"]["subtype"] == "apply" and merged["1"]["agreement"] == 1.0 and merged["1"]["ambiguous"] is False
    # 2：三轮一致生成性
    assert merged["2"]["category"] == "generative" and merged["2"]["agreement"] == 1.0
    # 3：三类各一票，没有多数，标记待确认而不是硬选
    assert merged["3"]["ambiguous"] is True and merged["3"]["agreement"] < hot_agent.CONFIDENT_SHARE


def test_ambiguous_items_are_excluded_from_counts(monkeypatch):
    rounds = iter([
        {"items": [{"id": "1", "category": "response", "subtype": "apply", "teacher_ref": "T1"},
                   {"id": "2", "category": "generative", "subtype": "transfer", "teacher_ref": None}]},
        {"items": [{"id": "1", "category": "response", "subtype": "apply", "teacher_ref": "T1"},
                   {"id": "2", "category": "response", "subtype": "clarify", "teacher_ref": "T1"}]},
        {"items": [{"id": "1", "category": "response", "subtype": "verify", "teacher_ref": "T1"},
                   {"id": "2", "category": "unrelated", "subtype": None, "teacher_ref": None}]},
    ])

    async def fake_llm(**_kwargs):
        return next(rounds)

    monkeypatch.setattr(hot_agent, "call_llm", fake_llm)
    events = [event(1, "写对了吗"), event(2, "圆括号可以吗")]
    result = asyncio.run(hot_agent.classify_hot_questions(
        task_sheet="", teacher_questions=[{"time": "2026-10-22T09:00:00+08:00", "question": "建列表"}],
        student_events=events, api_key="k", vote_rounds=3,
    ))
    assert result["vote_rounds"] == 3
    assert result["totals"] == {"response": 1, "generative": 0, "unrelated": 0, "unclassified": 1}
    assert result["ambiguous_count"] == 1
    assert result["unlabelled_count"] == 0
    assert result["items"]["1"]["category"] == "response" and result["items"]["1"]["ambiguous"] is False
    assert result["items"]["2"]["ambiguous"] is True


def test_vote_rounds_are_bounded(monkeypatch):
    calls = []

    async def fake_llm(**_kwargs):
        calls.append(1)
        return {}

    monkeypatch.setattr(hot_agent, "call_llm", fake_llm)
    asyncio.run(hot_agent.classify_hot_questions(
        task_sheet="", teacher_questions=[], student_events=[event(1, "问题")], api_key="k", vote_rounds=99,
    ))
    assert len(calls) == hot_agent.MAX_VOTE_ROUNDS


def test_majority_does_not_pick_between_tied_options():
    """平票时不能按插入顺序任选：区分度靠多数票，没有多数就不给结论。"""
    from collections import Counter
    assert hot_agent._majority(Counter(["apply", "debug"])) == (None, 1)
    assert hot_agent._majority(Counter(["debug", "apply"])) == (None, 1)
    assert hot_agent._majority(Counter(["apply", "apply", "debug"])) == ("apply", 2)
    assert hot_agent._majority(Counter()) == (None, 0)


def test_tied_subtype_yields_no_subtype_but_keeps_category():
    def label(category, subtype, ref="T1"):
        return {"category": category, "subtype": subtype, "teacher_ref": ref, "reason": "r"}
    merged = hot_agent.merge_votes([
        {"1": label("response", "apply")},
        {"1": label("response", "debug")},
        {"1": label("generative", "transfer", None)},
    ])["1"]
    # 大类仍以 2:1 确定，细分 1:1 不给结论
    assert merged["category"] == "response" and merged["subtype"] is None and merged["ambiguous"] is False
