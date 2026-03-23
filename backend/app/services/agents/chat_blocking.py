"""阻塞式对话 — 使用 Provider 策略模式"""

import asyncio
import json
from typing import Any, Dict, Optional

from app.services.agents.ai_agent import get_agent
from app.services.agents.providers import get_provider, provider_error_message, extract_provider_detail, resolve_credentials, build_messages
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.circuit_breaker import breaker
from app.core.config import settings

import httpx


async def run_agent_chat_blocking(
    db,
    *,
    agent_id: int,
    message: str,
    user: Optional[str] = None,
    inputs: Optional[Dict[str, Any]] = None,
    history: Optional[list] = None,
) -> str:
    agent = await get_agent(db, agent_id, use_cache=False)
    if not agent:
        raise ValueError(f"智能体(id={agent_id})不存在或已删除")

    api_endpoint, api_key = resolve_credentials(agent)

    # Debug stub 模式
    allow_stub = bool(settings.DEBUG) or str(getattr(settings, "REACT_APP_ENV", "") or "").lower() not in {
        "production", "prod",
    }
    if allow_stub and (
        not api_endpoint or not api_key or (agent.agent_type != "dify" and not agent.model_name)
    ):
        msg = (message or "").strip()
        return f"debug_stub: {msg[:800]}"

    if not api_endpoint or not api_key:
        raise ValueError(f"智能体(id={agent_id})未配置API地址或密钥")

    provider = get_provider(agent.agent_type, api_endpoint, api_key)
    provider_name = type(provider).__name__
    chat_messages = build_messages(agent, message, history)
    model = agent.model_name or ""

    # 熔断检查
    if breaker.is_open(provider_name):
        raise ValueError("circuit_open: 该服务暂时不可用（连续失败过多），请稍后重试")

    # Dify 阻塞式
    if isinstance(provider, DifyProvider):
        return await _blocking_dify(provider, chat_messages, model, user, inputs)

    # 非 Dify
    if not model:
        raise ValueError("model_not_configured")

    headers = provider.build_headers()
    payload = provider.build_blocking_payload(chat_messages, model)
    chat_url = provider.chat_url()

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = None
        for attempt in range(3):
            resp = await client.post(chat_url, headers=headers, json=payload)
            if resp.status_code == 200:
                break
            if resp.status_code in (429, 502, 503, 504) and attempt < 2:
                await asyncio.sleep(1.5 * (2 ** attempt))
                continue
            break

        if not resp or resp.status_code != 200:
            breaker.record_failure(provider_name)
            status_code = int(resp.status_code) if resp else 0
            msg = provider_error_message(status_code)
            detail = extract_provider_detail(resp.text if resp else "")
            suffix = f" - {detail}" if detail else ""
            raise ValueError(f"provider_status_{status_code}: {msg}{suffix}")

        breaker.record_success(provider_name)
        return provider.parse_blocking_response(resp.json())


async def _blocking_dify(provider: DifyProvider, messages, model, user, inputs) -> str:
    """Dify 阻塞式：多候选 URL"""
    headers = provider.build_headers()
    payload = provider.build_blocking_payload(messages, model)
    if user:
        payload["user"] = user
    if inputs:
        payload["inputs"] = inputs

    candidates = provider.candidate_urls()
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        last_err = None
        for url in candidates:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code != 200:
                    last_err = f"status_{resp.status_code}"
                    continue
                return provider.parse_blocking_response(resp.json())
            except Exception as e:
                last_err = str(e)
                continue
    raise ValueError(last_err or "dify_failed")
