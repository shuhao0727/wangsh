"""阻塞式对话 — 使用 Provider 策略模式"""

import asyncio
from typing import Any, Dict, Optional

from app.services.agents.chat_common import prepare_chat_context
from app.services.agents.providers import (
    provider_error_message,
    extract_provider_detail,
    openrouter_model_candidates,
    should_retry_openrouter_fallback,
)
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.circuit_breaker import breaker
from app.core.config import settings

import httpx


async def _post_with_retry(
    client: httpx.AsyncClient,
    chat_url: str,
    headers: dict,
    payload: dict,
) -> Optional[httpx.Response]:
    """POST 重试：200 直接返回；429/502/503/504 指数退避重试，最多 3 次。"""
    resp = None
    for attempt in range(3):
        resp = await client.post(chat_url, headers=headers, json=payload)
        if resp.status_code == 200:
            break
        if resp.status_code in (429, 502, 503, 504) and attempt < 2:
            await asyncio.sleep(1.5 * (2 ** attempt))
            continue
        break
    return resp


async def run_agent_chat_blocking(
    db,
    *,
    agent_id: int,
    message: str,
    user: Optional[str] = None,
    inputs: Optional[Dict[str, Any]] = None,
    history: Optional[list] = None,
) -> str:
    ctx = await prepare_chat_context(db, agent_id, message, history, use_cache=False)

    if not ctx.api_endpoint or not ctx.api_key:
        raise ValueError(f"智能体(id={agent_id})未配置API地址或密钥")

    # 熔断检查
    if breaker.is_open(ctx.circuit_key):
        raise ValueError("circuit_open: 该服务暂时不可用（连续失败过多），请稍后重试")

    # Dify 阻塞式
    if isinstance(ctx.provider, DifyProvider):
        try:
            result = await _blocking_dify(ctx.provider, ctx.chat_messages, ctx.model, user, inputs)
        except Exception:
            breaker.record_failure(ctx.circuit_key)
            raise
        breaker.record_success(ctx.circuit_key)
        return result

    # 非 Dify
    if not ctx.model:
        raise ValueError("model_not_configured")

    headers = ctx.provider.build_headers()
    chat_url = ctx.provider.chat_url()
    candidate_models = [ctx.model]
    if getattr(ctx.provider, "is_openrouter", False):
        candidate_models = openrouter_model_candidates(ctx.model) or [ctx.model]

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        last_error: Optional[str] = None
        for idx, candidate_model in enumerate(candidate_models):
            payload = ctx.provider.build_blocking_payload(ctx.chat_messages, candidate_model)
            resp = await _post_with_retry(client, chat_url, headers, payload)

            if resp and resp.status_code == 200:
                breaker.record_success(ctx.circuit_key)
                return ctx.provider.parse_blocking_response(resp.json())

            status_code = int(resp.status_code) if resp else 0
            msg = provider_error_message(status_code)
            detail = extract_provider_detail(resp.text if resp else "")
            can_fallback = (
                idx < len(candidate_models) - 1
                and should_retry_openrouter_fallback(
                    status_code,
                    detail,
                    candidate_model,
                    candidate_models[idx + 1],
                )
            )
            if can_fallback:
                continue

            suffix = f" - {detail}" if detail else ""
            last_error = f"provider_status_{status_code}: {msg}{suffix}"
            break

        breaker.record_failure(ctx.circuit_key)
        raise ValueError(last_error or "provider_request_failed")


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
