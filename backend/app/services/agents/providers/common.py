"""公共工具函数 — 从 chat_stream/chat_blocking 提取的重复代码"""

import json
from typing import Dict, List, Optional

from app.core.config import settings
from app.utils.agent_secrets import try_decrypt_api_key


OPENROUTER_FREE_SUFFIX = ":free"


def resolve_credentials(agent):
    """解析 agent 的 endpoint 和 api_key，含 OpenRouter fallback"""
    api_endpoint = (agent.api_endpoint or "").strip().rstrip("/")
    api_key = try_decrypt_api_key(getattr(agent, "api_key_encrypted", None)) or getattr(agent, "api_key", None)
    if agent.agent_type != "dify":
        if not api_endpoint:
            api_endpoint = settings.OPENROUTER_API_URL.strip().rstrip("/")
        is_openrouter_endpoint = "openrouter.ai" in (api_endpoint or "").lower()
        if not api_key and is_openrouter_endpoint:
            api_key = settings.OPENROUTER_API_KEY
    return api_endpoint, api_key


def build_messages(agent, message: str, history: Optional[list] = None) -> List[Dict[str, str]]:
    """构建多轮对话 messages，含 system prompt"""
    chat_messages: List[Dict[str, str]] = []
    sys_prompt = (getattr(agent, "system_prompt", None) or "").strip()
    if sys_prompt:
        chat_messages.append({"role": "system", "content": sys_prompt})
    if history:
        chat_messages.extend(history)
    else:
        chat_messages.append({"role": "user", "content": message})
    return chat_messages


def provider_error_message(status_code: int) -> str:
    if status_code == 401 or status_code == 403:
        return "上游服务鉴权失败（请检查 API Key 是否正确、是否有权限访问该模型）"
    if status_code == 404:
        return "上游服务接口或模型不存在（请检查 API Endpoint 与模型名）"
    if status_code == 429:
        return "上游服务返回 429（限流/额度不足）。请稍后重试，或更换 API Key/提升额度"
    if status_code == 402:
        return "上游服务余额不足或需要付费（请检查账号额度/账单）"
    if 500 <= status_code <= 599:
        return "上游服务异常（5xx）。请稍后重试"
    return "上游服务请求失败"


def extract_provider_detail(body_text: str) -> str:
    t = (body_text or "").strip()
    if not t:
        return ""
    try:
        data = json.loads(t)
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict):
                msg = err.get("message") or err.get("error") or err.get("type")
                if msg:
                    return str(msg)[:500]
            if isinstance(err, str) and err.strip():
                return err.strip()[:500]
            msg = data.get("message")
            if isinstance(msg, str) and msg.strip():
                return msg.strip()[:500]
    except Exception:
        pass
    return t[:500]


def openrouter_fallback_model(model: str) -> Optional[str]:
    """OpenRouter free 模型回退：xxx:free -> xxx"""
    m = (model or "").strip()
    suffix = OPENROUTER_FREE_SUFFIX
    if m.endswith(suffix) and len(m) > len(suffix):
        return m[: -len(suffix)]
    return None


def openrouter_free_model(model: str) -> Optional[str]:
    """OpenRouter free 模型补全：xxx -> xxx:free"""
    m = (model or "").strip()
    suffix = OPENROUTER_FREE_SUFFIX
    if not m or m.endswith(suffix):
        return None
    return f"{m}{suffix}"


def openrouter_model_candidates(model: str) -> List[str]:
    """
    生成 OpenRouter 候选模型：
    - xxx:free -> [xxx:free, xxx]
    - xxx -> [xxx, xxx:free]
    """
    m = (model or "").strip()
    if not m:
        return []

    candidates = [m]
    if m.endswith(OPENROUTER_FREE_SUFFIX):
        fallback = openrouter_fallback_model(m)
    else:
        fallback = openrouter_free_model(m)

    if fallback and fallback not in candidates:
        candidates.append(fallback)
    return candidates


def _looks_like_model_not_found(detail: str) -> bool:
    d = (detail or "").strip().lower()
    if not d:
        return True
    patterns = (
        "model not found",
        "unknown model",
        "no such model",
        "does not exist",
        "invalid model",
        "no endpoints available",
        "no endpoint available",
        "模型不存在",
        "模型不可用",
    )
    return any(p in d for p in patterns)


def should_retry_openrouter_fallback(status_code: int, detail: str, model: str, fallback_model: Optional[str] = None) -> bool:
    """
    是否触发 OpenRouter 模型名回退重试。
    - xxx:free -> xxx
    - xxx -> xxx:free（用于仅有 free 别名的模型）
    """
    current = (model or "").strip()
    if not current:
        return False

    fallback = (fallback_model or "").strip()
    if not fallback:
        if current.endswith(OPENROUTER_FREE_SUFFIX):
            fallback = openrouter_fallback_model(current) or ""
        else:
            fallback = openrouter_free_model(current) or ""

    if not fallback or fallback == current:
        return False

    # 鉴权/计费错误不做模型名回退，避免掩盖真实问题。
    if status_code in (401, 402, 403):
        return False

    free_to_non_free = current.endswith(OPENROUTER_FREE_SUFFIX) and (not fallback.endswith(OPENROUTER_FREE_SUFFIX))
    non_free_to_free = (not current.endswith(OPENROUTER_FREE_SUFFIX)) and fallback.endswith(OPENROUTER_FREE_SUFFIX)

    # 404 常见于 guardrail/data policy 路由不到可用 endpoint；
    # 429/5xx 常见于拥塞，回退到非 free 往往可恢复。
    if free_to_non_free:
        return status_code in (404, 429, 500, 502, 503, 504)

    # 一些模型只存在 :free 别名，non-free 404 时可尝试加 :free。
    if non_free_to_free:
        if status_code in (429, 500, 502, 503, 504):
            return True
        if status_code == 404:
            return _looks_like_model_not_found(detail)

    return False
