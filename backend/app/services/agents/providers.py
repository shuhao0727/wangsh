import re
from typing import Dict


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

    return base

def detect_flags(api_endpoint: str) -> Dict[str, bool]:
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

def models_endpoint(flags: Dict[str, bool]) -> str:
    if flags.get("is_openai") or flags.get("is_deepseek") or flags.get("is_siliconflow") or flags.get("is_aliyun"):
        return "/v1/models"
    if flags.get("is_anthropic"):
        return "/v1/models"
    if flags.get("is_openrouter"):
        return "/api/v1/models"
    if flags.get("is_volcengine"):
        return "/api/v3/models"
    return "/v1/models"
