"""Dify Provider"""

import json
from typing import Any, Dict, List, Optional

from .base import LLMProvider

# ---------------------------------------------------------------------------
# 阶段一止血：有界历史重放（bounded replay）
#
# 背景：Dify 的 /chat-messages 只接收单条 query，本项目此前只把「最后一条 user
# 消息」当 query 发出去，导致多轮连续对话的第二轮上下文全丢（2.2.1 的 P0）。
#
# 为什么必须「有界」：
#   把历史拼进 query 后，query 长度会随对话轮数线性膨胀，最终撞上模型/Dify 的
#   上下文长度上限（表现为 400 或静默截断），所以必须有轮次 + 字符双重上限。
#
# 为什么这只是阶段一而不是终态：
#   每次请求都是「全新的 query、不带 conversation_id」，Dify 侧会把这些请求算成
#   一个个互不相关的独立会话——后台会话列表/统计会碎。
#   终态方案（conversation_id 绑定 + znt_agent_conversations 表）见
#   docs/docker/plans/2026-10-28-DIFY-DEFECT-FIX-PLAN.md 的「阶段二」。
# ---------------------------------------------------------------------------

# 历史最多保留的轮数（1 轮 = 一问一答 = 2 条消息），即最多 8 条消息
DIFY_HISTORY_MAX_TURNS = 4
# 拼接后 query 的总字符上限（含标题行与当前问题），超出则从最早的一轮开始整轮丢弃
DIFY_HISTORY_MAX_CHARS = 3000

# 标题行：让模型能把「历史」和「当前问题」明确区分开，不至于把 assistant 说过的话
# 当成用户说的
_HISTORY_HEADER = "[历史对话]"
_CURRENT_HEADER = "[当前问题]"
# 角色标签：显式标出说话人，避免 user/assistant 混淆
_ROLE_LABELS = {"user": "用户", "assistant": "助手"}


def _split_history_turns(history: List[Dict[str, str]]) -> List[List[Dict[str, str]]]:
    """把历史消息按「轮」切分。

    一轮以一条 user 消息开始，直到下一条 user 消息之前的所有 assistant 消息为止。
    这样即使上游给的序列不是严格 user/assistant 交替（例如连续两条 user），
    也只会整轮丢弃，绝不会把某一轮切成半句。
    """
    turns: List[List[Dict[str, str]]] = []
    current_turn: List[Dict[str, str]] = []
    for msg in history:
        if msg["role"] == "user" and current_turn:
            turns.append(current_turn)
            current_turn = []
        current_turn.append(msg)
    if current_turn:
        turns.append(current_turn)
    return turns


def _render_turns(turns: List[List[Dict[str, str]]]) -> str:
    """把若干轮历史渲染成纯文本，每条消息用「用户: / 助手:」标注。"""
    lines: List[str] = []
    for turn in turns:
        for msg in turn:
            label = _ROLE_LABELS[msg["role"]]
            lines.append(f"{label}: {msg['content']}")
    return "\n".join(lines)


def build_bounded_query(messages: List[Dict[str, str]]) -> str:
    """把多轮 messages 折叠成一条带「有界历史」的 query。

    规则：
    1. 只取 user / assistant 两种角色，system 消息一律跳过（Dify 聊天应用自带
       system prompt，混进来会重复甚至冲突）；
    2. 历史最多取最近 DIFY_HISTORY_MAX_TURNS 轮；
    3. 整条 query（历史 + 标题行 + 当前问题）总长不超过 DIFY_HISTORY_MAX_CHARS，
       超出时**从最早的一轮整轮丢弃**（不是截字符，避免出现半截的轮次）；
    4. 没有历史（或历史怎么丢都放不下）时，原样返回当前消息，**不加任何前缀**；
    5. 当前消息自身超长时不截断它，而是丢弃全部历史、只传当前消息。

    评分路径（ai_partner_evaluation）不使用本函数的说明见 build_blocking_payload。
    """
    # 找到「当前问题」：最后一条 user 消息
    current_index = -1
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].get("role") == "user":
            current_index = i
            break
    if current_index == -1:
        # 没有任何 user 消息，保持原有行为（空 query）
        return ""

    current_content = messages[current_index].get("content")
    current = current_content if isinstance(current_content, str) else ""

    # 当前问题之前的消息里，只保留 user / assistant，system 跳过
    history: List[Dict[str, str]] = []
    for msg in messages[:current_index]:
        role = msg.get("role")
        content = msg.get("content")
        if role in _ROLE_LABELS and isinstance(content, str) and content:
            history.append({"role": role, "content": content})

    if not history:
        # 单轮对话：不加任何前缀，保持原样
        return current

    if len(current) > DIFY_HISTORY_MAX_CHARS:
        # 当前消息自身已超上限：不截断它（截断等于把用户问题切坏），
        # 直接丢弃全部历史，只传当前消息
        return current

    # 只保留最近 N 轮
    turns = _split_history_turns(history)[-DIFY_HISTORY_MAX_TURNS:]

    # 从最早的一轮开始整轮丢弃，直到总长进入上限
    while turns:
        history_text = _render_turns(turns)
        prefix = f"{_HISTORY_HEADER}\n{history_text}\n{_CURRENT_HEADER}\n{_ROLE_LABELS['user']}: "
        if len(prefix) + len(current) <= DIFY_HISTORY_MAX_CHARS:
            return prefix + current
        turns.pop(0)

    # 历史全部丢光仍放不下（或本来就放不下），退回单条当前消息
    return current


class DifyProvider(LLMProvider):
    """Dify 工作流/对话 Provider"""

    def build_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def chat_url(self) -> str:
        base = self.api_endpoint
        if base.endswith("/chat-messages") or "/chat/" in base:
            return base
        if base.endswith("/v1"):
            return f"{base}/chat-messages"
        return f"{base}/v1/chat-messages"

    def candidate_urls(self) -> List[str]:
        """Dify 可能有多个候选 URL"""
        base = self.api_endpoint
        if base.endswith("/chat-messages") or "/chat/" in base:
            return [base]
        candidates = []
        if base.endswith("/v1"):
            candidates.append(f"{base}/chat-messages")
        else:
            candidates.extend([f"{base}/v1/chat-messages", f"{base}/chat-messages"])
        return candidates

    def build_stream_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        # 阶段一止血：把有界历史折叠进 query（见文件顶部的说明）。
        # 单轮时等价于「取最后一条 user 消息」，行为与改动前完全一致。
        query = build_bounded_query(messages)
        return {
            "query": query,
            "user": "stream_user",
            "response_mode": "streaming",
            "inputs": {},
        }

    def build_blocking_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        # 故意不做历史重放：
        #   1. 这个 payload 被 AI 伙伴评分（ai_partner_evaluation）复用，评分必须
        #      每轮每用户独立、无状态，一旦拼入历史就可能把上一次的证据带进本次评分；
        #   2. 目前所有 blocking 调用方（评分、课堂分析、小组讨论、画像生成）都是
        #      单次独立请求，不传 history，build_messages 只会产出「system + 当前消息」。
        # 若将来确实需要「阻塞式多轮对话」，请勿直接改这里，而是给 blocking 路径
        # 单独加开关或另开方法，避免误伤评分。
        query = ""
        for m in reversed(messages):
            if m["role"] == "user":
                query = m["content"]
                break
        return {
            "query": query,
            "user": "discussion_user",
            "response_mode": "blocking",
            "inputs": {},
        }

    def parse_stream_line(self, line: str) -> Optional[str]:
        # Dify SSE 直接透传，不需要逐行解析
        return None

    def is_stream_done(self, line: str) -> bool:
        return False

    def parse_blocking_response(self, data: Dict[str, Any]) -> str:
        if isinstance(data, dict):
            if isinstance(data.get("answer"), str) and data["answer"].strip():
                return data["answer"].strip()
            nested = data.get("data")
            if isinstance(nested, dict) and isinstance(nested.get("answer"), str) and nested["answer"].strip():
                return nested["answer"].strip()
            if isinstance(data.get("message"), str) and data["message"].strip():
                return data["message"].strip()
        return json.dumps(data, ensure_ascii=False)[:4000]
