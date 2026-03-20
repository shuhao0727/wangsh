"""Anthropic Provider"""

import json
from typing import Any, Dict, List, Optional

from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API Provider"""

    def build_headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

    def chat_url(self) -> str:
        base = self.api_endpoint
        if base.endswith("/messages"):
            return base
        if base.endswith("/v1"):
            return f"{base}/messages"
        return f"{base}/v1/messages"

    def _split_system(self, messages: List[Dict[str, str]]):
        """Anthropic 的 system 不在 messages 里，需要单独提取"""
        system_text = ""
        chat_msgs = []
        for m in messages:
            if m["role"] == "system":
                system_text += m["content"] + "\n"
            else:
                chat_msgs.append(m)
        return system_text.strip(), chat_msgs

    def build_stream_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        system_text, chat_msgs = self._split_system(messages)
        payload: Dict[str, Any] = {
            "model": model,
            "messages": chat_msgs,
            "max_tokens": 4096,
            "stream": True,
        }
        if system_text:
            payload["system"] = system_text
        return payload

    def build_blocking_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        system_text, chat_msgs = self._split_system(messages)
        payload: Dict[str, Any] = {
            "model": model,
            "messages": chat_msgs,
            "max_tokens": 4096,
        }
        if system_text:
            payload["system"] = system_text
        return payload

    def parse_stream_line(self, line: str) -> Optional[str]:
        line = line.strip()
        if not line.startswith("data:"):
            return None
        data_str = line[5:].strip()
        if not data_str:
            return None
        try:
            obj = json.loads(data_str)
        except Exception:
            return None
        # Anthropic streaming: content_block_delta event
        if obj.get("type") == "content_block_delta":
            delta = obj.get("delta") or {}
            return delta.get("text")
        return None

    def is_stream_done(self, line: str) -> bool:
        line = line.strip()
        if not line.startswith("data:"):
            return False
        try:
            obj = json.loads(line[5:].strip())
            return obj.get("type") == "message_stop"
        except Exception:
            return False

    def parse_blocking_response(self, data: Dict[str, Any]) -> str:
        content = data.get("content") or []
        texts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                texts.append(block.get("text", ""))
        if texts:
            return "\n".join(texts).strip()
        return json.dumps(data, ensure_ascii=False)[:4000]
