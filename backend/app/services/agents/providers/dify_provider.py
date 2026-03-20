"""Dify Provider"""

import json
from typing import Any, Dict, List, Optional

from .base import LLMProvider


class DifyProvider(LLMProvider):
    """Dify 工作流/对话 Provider"""

    def build_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def chat_url(self) -> str:
        base = self.api_endpoint
        if "/chat/" in base:
            return base
        if base.endswith("/v1"):
            return f"{base}/chat-messages"
        return f"{base}/v1/chat-messages"

    def candidate_urls(self) -> List[str]:
        """Dify 可能有多个候选 URL"""
        base = self.api_endpoint
        if "/chat/" in base:
            return [base]
        candidates = []
        if base.endswith("/v1"):
            candidates.append(f"{base}/chat-messages")
        else:
            candidates.extend([f"{base}/v1/chat-messages", f"{base}/chat-messages"])
        return candidates

    def build_stream_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        # Dify 只用最后一条 user 消息作为 query
        query = ""
        for m in reversed(messages):
            if m["role"] == "user":
                query = m["content"]
                break
        return {
            "query": query,
            "user": "stream_user",
            "response_mode": "streaming",
            "inputs": {},
        }

    def build_blocking_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
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
