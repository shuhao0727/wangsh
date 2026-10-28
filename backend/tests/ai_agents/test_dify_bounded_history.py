"""Dify 阶段一止血：有界历史重放（bounded replay）测试

覆盖 docs/docker/plans/2026-10-28-DIFY-DEFECT-FIX-PLAN.md「阶段一」的边界要求：
- 单轮不加前缀
- 多轮带历史且顺序正确
- 轮次上限 4 轮
- 字符上限 3000，且丢弃以「整轮」为单位
- 当前消息自身超长时历史为空
- system 消息被跳过
- 评分路径（build_blocking_payload）保持无状态
"""

from app.services.agents.providers.dify_provider import (
    DIFY_HISTORY_MAX_CHARS,
    DIFY_HISTORY_MAX_TURNS,
    DifyProvider,
    build_bounded_query,
)

PROVIDER = DifyProvider("https://dify.example/v1", "app-key")


def _turn(i: int, question: str | None = None, answer: str | None = None):
    """构造一轮「用户问 + 助手答」"""
    return [
        {"role": "user", "content": question or f"问题{i}"},
        {"role": "assistant", "content": answer or f"回答{i}"},
    ]


def test_single_turn_has_no_history_prefix():
    """单轮：query 就是当前消息，不带任何前缀"""
    messages = [{"role": "user", "content": "什么是链表？"}]

    payload = PROVIDER.build_stream_payload(messages, "dify-model")

    assert payload["query"] == "什么是链表？"
    assert "[历史对话]" not in payload["query"]
    assert "[当前问题]" not in payload["query"]


def test_single_turn_with_system_prompt_has_no_history_prefix():
    """带 system prompt 但没有历史：同样不加前缀（system 不算历史）"""
    messages = [
        {"role": "system", "content": "你是一名信息技术老师"},
        {"role": "user", "content": "什么是链表？"},
    ]

    payload = PROVIDER.build_stream_payload(messages, "dify-model")

    assert payload["query"] == "什么是链表？"
    assert "[历史对话]" not in payload["query"]


def test_two_turn_history_is_included_in_order():
    """2 轮历史：历史被带入，且用户/助手标注与顺序正确"""
    messages = [
        *_turn(1, "解释一下KNN", "KNN 是 K 近邻算法"),
        *_turn(2, "那循环遍历样本是为什么？", "因为要逐个计算距离"),
        {"role": "user", "content": "本轮练习编号第几位是四位数字？"},
    ]

    query = PROVIDER.build_stream_payload(messages, "dify-model")["query"]

    assert "[历史对话]" in query
    assert "[当前问题]" in query
    # 顺序：先第一轮，再第二轮，最后当前问题
    assert query.index("解释一下KNN") < query.index("那循环遍历样本是为什么")
    assert query.index("那循环遍历样本是为什么") < query.index("本轮练习编号")
    # 角色标注：assistant 的话必须以「助手:」出现，不能冒充用户
    assert "用户: 解释一下KNN" in query
    assert "助手: KNN 是 K 近邻算法" in query
    # 当前问题只出现一次，且在最后
    assert query.count("本轮练习编号第几位是四位数字？") == 1
    assert query.rstrip().endswith("本轮练习编号第几位是四位数字？")


def test_only_last_four_turns_are_kept():
    """5 轮历史：只保留最近 4 轮，最早一轮整轮丢弃"""
    messages = []
    for i in range(1, 6):
        messages.extend(_turn(i, f"第{i}轮问题", f"第{i}轮回答"))
    messages.append({"role": "user", "content": "当前问题"})

    query = PROVIDER.build_stream_payload(messages, "dify-model")["query"]

    assert DIFY_HISTORY_MAX_TURNS == 4
    # 第 1 轮整轮被丢弃：问题和回答都不应出现
    assert "第1轮问题" not in query
    assert "第1轮回答" not in query
    # 最近 4 轮都在，且顺序保持
    for i in range(2, 6):
        assert f"第{i}轮问题" in query
        assert f"第{i}轮回答" in query
    assert query.index("第2轮问题") < query.index("第5轮问题")
    assert query.index("第5轮问题") < query.index("当前问题")


def test_long_history_drops_whole_turns_and_stays_under_char_limit():
    """超长历史：总长不超 3000，且被保留的轮次都是完整的（无半截）"""
    # 每轮内容约 900 字符，4 轮约 3600+，必然超上限
    pad = "细" * 400  # 400 汉字
    messages = []
    long_turns = []
    for i in range(1, 5):
        q = f"第{i}轮问题开头{pad}第{i}轮问题结尾"
        a = f"第{i}轮回答开头{pad}第{i}轮回答结尾"
        long_turns.append((q, a))
        messages.extend(_turn(i, q, a))
    messages.append({"role": "user", "content": "当前问题"})

    query = PROVIDER.build_stream_payload(messages, "dify-model")["query"]

    assert len(query) <= DIFY_HISTORY_MAX_CHARS
    # 至少丢掉了最早的一轮
    assert long_turns[0][0] not in query
    # 所有「出现」的轮次必须首尾完整，不存在被从中间切断的轮次
    for q, a in long_turns:
        if q in query:
            assert a in query, "一到被保留就必须整轮保留"
    # 当前问题始终完整保留
    assert query.rstrip().endswith("当前问题")


def test_current_message_longer_than_limit_drops_all_history():
    """当前消息自身超过 3000 字符：不截断当前消息，历史为空"""
    huge = "大" * (DIFY_HISTORY_MAX_CHARS + 100)
    messages = [
        *_turn(1, "上一轮问题", "上一轮回答"),
        {"role": "user", "content": huge},
    ]

    query = PROVIDER.build_stream_payload(messages, "dify-model")["query"]

    assert query == huge
    assert "上一轮问题" not in query
    assert "[历史对话]" not in query


def test_system_messages_are_skipped_in_history():
    """历史里的 system 消息必须被跳过，不出现在 query 中"""
    messages = [
        {"role": "system", "content": "旧的系统提示词不应出现"},
        {"role": "user", "content": "第一轮问题"},
        {"role": "assistant", "content": "第一轮回答"},
        {"role": "system", "content": "另一个系统提示词也不应出现"},
        {"role": "user", "content": "当前问题"},
    ]

    query = PROVIDER.build_stream_payload(messages, "dify-model")["query"]

    assert "旧的系统提示词不应出现" not in query
    assert "另一个系统提示词也不应出现" not in query
    assert "第一轮问题" in query
    assert "第一轮回答" in query


def test_empty_messages_returns_empty_query():
    """空 messages：保持原有行为（空 query，不抛异常）"""
    assert build_bounded_query([]) == ""
    assert PROVIDER.build_stream_payload([], "dify-model")["query"] == ""


def test_blocking_payload_stays_stateless_for_evaluation():
    """评分路径必须无状态：build_blocking_payload 不拼历史"""
    messages = [
        {"role": "system", "content": "评分系统提示词"},
        {"role": "user", "content": "上一轮学生证据"},
        {"role": "assistant", "content": "上一轮评分结论"},
        {"role": "user", "content": "本轮学生证据JSON"},
    ]

    payload = PROVIDER.build_blocking_payload(messages, "")

    assert payload["query"] == "本轮学生证据JSON"
    assert "[历史对话]" not in payload["query"]
    assert "上一轮学生证据" not in payload["query"]
    assert payload["response_mode"] == "blocking"


def test_stream_payload_keeps_existing_contract_fields():
    """回归：原有字段不能丢"""
    messages = [*_turn(1), {"role": "user", "content": "当前问题"}]

    payload = PROVIDER.build_stream_payload(messages, "dify-model")

    assert payload["user"] == "stream_user"
    assert payload["response_mode"] == "streaming"
    assert payload["inputs"] == {}
    assert "conversation_id" not in payload  # 阶段一不绑定会话
