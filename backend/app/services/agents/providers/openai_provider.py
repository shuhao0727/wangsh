"""OpenAI-compatible Provider（覆盖 OpenAI / DeepSeek / SiliconFlow / OpenRouter / Aliyun / VolcEngine）"""

import json
from typing import Any, Dict, List, Optional

from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    """OpenAI 兼容协议 Provider"""

    def __init__(self, api_endpoint: str, api_key: str, *, is_openrouter: bool = False):
        super().__init__(api_endpoint, api_key)
        self.is_openrouter = is_openrouter

    def build_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def chat_url(self) -> str:
        base = self.api_endpoint
        if base.endswith("/chat/completions"):
            return base
        if self.is_openrouter:
            if base.endswith("/api/v1"):
                return f"{base}/chat/completions"
            return f"{base}/api/v1/chat/completions"
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"

    def build_stream_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        return {"model": model, "messages": messages, "stream": True}

    def build_blocking_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        return {"model": model, "messages": messages, "stream": False}

    def parse_stream_line(self, line: str) -> Optional[str]:
        line = line.strip()
        if not line.startswith("data:"):
            return None
        data_str = line[5:].strip()
        if not data_str or data_str == "[DONE]":
            return None
        try:
            obj = json.loads(data_str)
        except Exception:
            return None
        choices = obj.get("choices") or []
        if not choices:
            return None
        delta = choices[0].get("delta") or choices[0].get("message") or {}
        content = delta.get("content")
        return str(content) if content else None

    def is_stream_done(self, line: str) -> bool:
        return line.strip() == "data: [DONE]" or line.strip() == "[DONE]"

    def parse_blocking_response(self, data: Dict[str, Any]) -> str:
        choices = data.get("choices") or []
        if choices:
            msg = choices[0].get("message") or {}
            content = msg.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
            text = choices[0].get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()
        return json.dumps(data, ensure_ascii=False)[:4000]
