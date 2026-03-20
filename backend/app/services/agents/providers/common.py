"""公共工具函数 — 从 chat_stream/chat_blocking 提取的重复代码"""

import json
from typing import Dict, List, Optional

from app.core.config import settings
from app.utils.agent_secrets import try_decrypt_api_key


def resolve_credentials(agent):
    """解析 agent 的 endpoint 和 api_key，含 OpenRouter fallback"""
    api_endpoint = (agent.api_endpoint or "").strip().rstrip("/")
    api_key = try_decrypt_api_key(getattr(agent, "api_key_encrypted", None)) or getattr(agent, "api_key", None)
    if agent.agent_type != "dify":
        if not api_endpoint:
            api_endpoint = settings.OPENROUTER_API_URL.strip().rstrip("/")
        if not api_key:
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
