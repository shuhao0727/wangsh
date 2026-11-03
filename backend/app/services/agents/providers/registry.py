"""Provider 注册表 — 根据 agent 配置返回对应的 Provider 实例。

同时提供按 API Endpoint 判断厂商协议、推导测试端点的工具：智能体连接测试
需要在不构造 Provider 实例的情况下探测 /models 与 /chat/completions。
"""

import re
from typing import Dict

from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .dify_provider import DifyProvider


def get_provider(agent_type: str, api_endpoint: str, api_key: str) -> LLMProvider:
    """根据 agent 类型和 endpoint 自动选择 Provider"""
    if agent_type == "dify":
        return DifyProvider(api_endpoint, api_key)

    ep = api_endpoint or ""

    if re.search(r"api\.anthropic\.com|anthropic\.com", ep, re.IGNORECASE) or re.search(
        r"/anthropic(?:/|$)", ep, re.IGNORECASE
    ):
        return AnthropicProvider(api_endpoint, api_key)

    is_openrouter = bool(re.search(r"openrouter\.ai", ep, re.IGNORECASE))

    # 所有其他 provider 都兼容 OpenAI 协议
    return OpenAIProvider(api_endpoint, api_key, is_openrouter=is_openrouter)


def detect_flags(api_endpoint: str) -> Dict[str, bool]:
    """按 Endpoint 推断厂商，供连接测试展示与端点推导使用。"""
    ep = api_endpoint or ""
    return {
        "is_openai": bool(re.search(r"api\.openai\.com|openai\.com", ep, re.IGNORECASE)),
        "is_deepseek": bool(re.search(r"api\.deepseek\.com|deepseek\.com", ep, re.IGNORECASE)),
        "is_anthropic": bool(re.search(r"api\.anthropic\.com|anthropic\.com", ep, re.IGNORECASE)),
        "is_openrouter": bool(re.search(r"openrouter\.ai", ep, re.IGNORECASE)),
        "is_siliconflow": bool(re.search(r"api\.siliconflow\.cn|siliconflow\.cn", ep, re.IGNORECASE)),
        "is_volcengine": bool(re.search(r"ark\.cn-beijing\.volces\.com|volcengine\.com", ep, re.IGNORECASE)),
        "is_aliyun": bool(re.search(r"dashscope\.aliyuncs\.com|aliyun\.com", ep, re.IGNORECASE)),
    }


def chat_completions_endpoint(api_endpoint: str, flags: Dict[str, bool]) -> str:
    base = (api_endpoint or "").strip().rstrip("/")
    if not base:
        return base
    if base.endswith("/chat/completions"):
        return base
    if flags.get("is_openrouter"):
        if base.endswith("/api/v1"):
            return f"{base}/chat/completions"
        return f"{base}/api/v1/chat/completions"
    if flags.get("is_openai") or flags.get("is_deepseek") or flags.get("is_siliconflow") or flags.get("is_aliyun"):
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"
    # 未知域名但 URL 以 /v1 结尾，默认按 OpenAI 兼容中转站处理
    if base.endswith("/v1"):
        return f"{base}/chat/completions"
    return base


def models_endpoint(flags: Dict[str, bool]) -> str:
    if flags.get("is_openrouter"):
        return "/api/v1/models"
    if flags.get("is_volcengine"):
        return "/api/v3/models"
    return "/v1/models"
