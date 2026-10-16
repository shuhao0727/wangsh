"""
智能体分析服务辅助函数

从 app/services/agents/agent_analysis.py 拆出的私有辅助函数：
中文停用词与关键词分词、提问去重与频次文本、会话行分组。
仅供 agent_analysis.py 引用，不对外导出；行为与原内联代码逐句等价。
"""

import re
from typing import Any, Dict, List

# 中文停用词表（精简版）
_STOP_WORDS = set(
    "的 了 是 吗 呢 吧 啊 呀 么 有 在 也 不 都 就 和 与 或 但 而 还 又 很 太 更 最 要 会 能 可以 应该 "
    "必须 需要 让 把 被 对 从 到 向 以 用 为 因为 所以 虽然 如果 但是 然而 因此 这个 那个 这些 那些 "
    "什么 怎么 怎样 为什么 哪 哪里 谁 多少 几 第一 第二 一个 一种 这个 那个 方面 "
    "请 请问 帮我 一下 一下吗 能否 可以吗 如何 怎么样".split()
)


def _segment_keywords(text: str, top_n: int = 50) -> List[Dict[str, Any]]:
    """提取关键词；优先使用 jieba，未安装时使用内置轻量分词兜底。"""
    freq: Dict[str, int] = {}

    try:
        import jieba
        words = jieba.lcut(text)
    except ImportError:
        latin_words = re.findall(r"[A-Za-z][A-Za-z0-9_+#-]{1,}", text)
        chinese_text = re.sub(r"[A-Za-z0-9_+#-]+", " ", text)
        chinese_words: List[str] = []
        for chunk in re.findall(r"[一-鿿]{2,}", chinese_text):
            for size in (4, 3, 2):
                for i in range(0, max(len(chunk) - size + 1, 0)):
                    chinese_words.append(chunk[i:i + size])
        words = latin_words + chinese_words

    for w in words:
        w = w.strip().lower()
        if len(w) < 2 or w in _STOP_WORDS:
            continue
        freq[w] = freq.get(w, 0) + 1

    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [{"word": w, "count": c} for w, c in sorted_words[:top_n]]


def _dedupe_question_freq(questions: List[str]) -> str:
    """去重 + 按频次排序，输出带次数的提问文本。"""
    freq: Dict[str, int] = {}
    for q in questions:
        q = q.strip()
        if not q:
            continue
        # Normalize: lowercase, trim
        normalized = q.lower().rstrip("？?。.")
        freq[normalized] = freq.get(normalized, 0) + 1

    # Sort by frequency, format with count
    sorted_qs = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:300]
    return "\n".join(f"{q}（{c}次）" for q, c in sorted_qs)


def _group_chain_rows(
    all_rows: List[Dict[str, Any]],
) -> tuple[Dict[str, Dict[str, Any]], List[str]]:
    """把扁平消息行按 session_id 分组为有序会话列表。"""
    by_session: Dict[str, Dict[str, Any]] = {}
    session_order: List[str] = []
    for r in all_rows:
        sid = r.get("session_id")
        if not sid:
            continue
        if sid not in by_session:
            session_order.append(sid)
            by_session[sid] = {
                "session_id": sid,
                "last_at": r.get("last_at"),
                "turns": int(r.get("turns") or 0),
                "student_id": r.get("student_id"),
                "user_name": r.get("user_name"),
                "class_name": r.get("class_name"),
                "messages": [],
            }
        msg_id = r.get("msg_id")
        if msg_id is not None:
            by_session[sid]["messages"].append(
                {
                    "id": int(msg_id),
                    "message_type": r.get("msg_type"),
                    "content": r.get("msg_content"),
                    "created_at": r.get("msg_created_at"),
                }
            )
    return by_session, session_order
