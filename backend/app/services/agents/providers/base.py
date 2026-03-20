"""Provider 基类"""

from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict, List, Optional


class LLMProvider(ABC):
    """LLM Provider 抽象基类"""

    def __init__(self, api_endpoint: str, api_key: str):
        self.api_endpoint = api_endpoint.strip().rstrip("/")
        self.api_key = api_key

    @abstractmethod
    def build_headers(self) -> Dict[str, str]:
        """构建请求头"""
        ...

    @abstractmethod
    def build_stream_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        """构建流式请求 payload"""
        ...

    @abstractmethod
    def build_blocking_payload(self, messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
        """构建阻塞请求 payload"""
        ...

    @abstractmethod
    def chat_url(self) -> str:
        """返回 chat completions URL"""
        ...

    @abstractmethod
    def parse_stream_line(self, line: str) -> Optional[str]:
        """解析流式响应的一行，返回文本内容或 None"""
        ...

    @abstractmethod
    def parse_blocking_response(self, data: Dict[str, Any]) -> str:
        """解析阻塞响应，返回文本内容"""
        ...

    def is_stream_done(self, line: str) -> bool:
        """判断流式响应是否结束"""
        return line.strip() == "[DONE]"
