"""Provider 注册表 — 根据 agent 配置返回对应的 Provider 实例"""

import re
from typing import Optional

from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .dify_provider import DifyProvider


def get_provider(agent_type: str, api_endpoint: str, api_key: str) -> LLMProvider:
    """根据 agent 类型和 endpoint 自动选择 Provider"""
    if agent_type == "dify":
        return DifyProvider(api_endpoint, api_key)

    ep = api_endpoint or ""

    if re.search(r"api\.anthropic\.com|anthropic\.com", ep, re.IGNORECASE):
        return AnthropicProvider(api_endpoint, api_key)

    is_openrouter = bool(re.search(r"openrouter\.ai", ep, re.IGNORECASE))

    # 所有其他 provider 都兼容 OpenAI 协议
    return OpenAIProvider(api_endpoint, api_key, is_openrouter=is_openrouter)
