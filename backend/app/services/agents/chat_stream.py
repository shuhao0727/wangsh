"""流式对话 — 使用 Provider 策略模式"""

import codecs
import json
from dataclasses import dataclass
from typing import AsyncGenerator, Optional, Dict, Any

import httpx
from loguru import logger

from app.core.config import settings
from app.core.http_client import get_http_client
from app.services.agents.chat_common import prepare_chat_context
from app.services.agents.providers import openrouter_model_candidates
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.circuit_breaker import breaker
from app.services.agents.dify_concurrency import DifyConcurrencyLease
from app.services.agents.assistant_answer_sanitizer import ReasoningContentFilter

from app.services.agents.chat_stream_helpers import (
    _iter_stream_events,
    _message_end_frame,
    _provider_error_frame,
    _sse_error,
    _stream_completion_error,
)
from app.services.agents.chat_stream_dify_helpers import (
    _build_dify_payloads,
    _dify_final_error,
    _dify_payload_for_url,
    _ensure_dify_lease,
    _new_dify_candidate_state,
    _record_dify_result,
    _stream_dify_candidate,
)


class _StreamSetupError(Exception):
    def __init__(self, err: dict):
        super().__init__(err)
        self.err = err


@dataclass(frozen=True)
class PreparedAgentStream:
    """Provider and immutable request data prepared before a long SSE response."""

    provider: Any
    circuit_key: str
    chat_messages: list[dict[str, str]]
    model: str


async def _prepare_stream(db, agent_id: int, message: str, history):
    """加载智能体与 Provider 并完成前置校验；失败时抛出 _StreamSetupError。"""
    try:
        ctx = await prepare_chat_context(db, agent_id, message, history, use_cache=True)
    except ValueError as e:
        error_msg = str(e)
        if "不存在或已删除" in error_msg:
            raise _StreamSetupError({"error": "invalid_agent"})
        if "agent_inactive" in error_msg:
            raise _StreamSetupError({"error": "agent_inactive", "message": "该智能体已停用"})
        # 其他 ValueError 是配置问题
        raise _StreamSetupError(
            {"error": "stream_setup_failed", "message": "初始化智能体请求失败，请稍后重试"}
        )
    except Exception as e:
        logger.exception("初始化智能体流失败: agent_id={}", agent_id)
        # RuntimeError 或其他异常通常是基础设施问题（数据库、网络等）
        raise _StreamSetupError(
            {"error": "stream_failed", "message": "读取智能体配置失败", "detail": str(e)[:500]}
        )

    if not ctx.api_endpoint:
        raise _StreamSetupError(
            {"error": "missing_endpoint", "message": "该智能体未配置API地址，请在管理后台设置"}
        )
    if not ctx.api_key:
        raise _StreamSetupError(
            {"error": "missing_api_key", "message": "该智能体未配置API密钥，请在管理后台设置"}
        )
    if breaker.is_open(ctx.circuit_key):
        raise _StreamSetupError(
            {"error": "circuit_open", "message": "该服务暂时不可用（连续失败过多），请稍后重试"}
        )

    return PreparedAgentStream(
        provider=ctx.provider,
        circuit_key=ctx.circuit_key,
        chat_messages=ctx.chat_messages,
        model=ctx.model,
    )


async def prepare_agent_stream(db, agent_id: int, message: str, *, history: Optional[list] = None) -> PreparedAgentStream:
    """Prepare all DB-backed stream state before the response starts."""
    return await _prepare_stream(db, agent_id, message, history)


async def stream_agent_chat(
    db,
    agent_id: int,
    message: str,
    user: Optional[str] = None,
    inputs: Optional[Dict[str, Any]] = None,
    *,
    history: Optional[list] = None,
    prepared: Optional[PreparedAgentStream] = None,
) -> AsyncGenerator[bytes, None]:
    if prepared is None:
        try:
            prepared = await _prepare_stream(db, agent_id, message, history)
        except _StreamSetupError as exc:
            yield _sse_error(exc.err)
            return

    provider = prepared.provider
    circuit_key = prepared.circuit_key
    chat_messages = prepared.chat_messages
    model = prepared.model

    # Dify: 特殊处理（多候选 URL + SSE 透传）
    if isinstance(provider, DifyProvider):
        async for chunk in _stream_dify(
            provider,
            chat_messages,
            model,
            user,
            inputs,
            circuit_key=circuit_key,
        ):
            yield chunk
        return

    # 非 Dify: 通用 OpenAI/Anthropic 流式
    if not model:
        err = {"error": "model_not_configured", "message": "智能体未配置模型名称"}
        yield _sse_error(err)
        return

    headers = provider.build_headers()
    chat_url = provider.chat_url()
    candidate_models = [model]
    if getattr(provider, "is_openrouter", False):
        candidate_models = openrouter_model_candidates(model) or [model]

    try:
        client = get_http_client()
        for idx, candidate_model in enumerate(candidate_models):
            payload = provider.build_stream_payload(chat_messages, candidate_model)
            async with client.stream("POST", chat_url, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    body_bytes = await resp.aread()
                    body_text = body_bytes.decode("utf-8", errors="ignore")
                    error_frame = _provider_error_frame(
                        circuit_key, resp.status_code, body_text, idx, candidate_model, candidate_models
                    )
                    if error_frame is not None:
                        yield error_frame
                        return
                    continue

                final_text = ""
                stream_completed = False
                finish_reason = None
                async for content, line_finish_reason, stream_done in _iter_stream_events(provider, resp):
                    if content:
                        final_text += content
                        chunk = {"answer": content}
                        yield f"event: message_delta\ndata: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode("utf-8")
                    if line_finish_reason is not None:
                        finish_reason = line_finish_reason
                    if stream_done:
                        stream_completed = True
                        break

                completion_error = _stream_completion_error(
                    circuit_key, stream_completed, finish_reason, final_text
                )
                if completion_error is not None:
                    yield completion_error
                    return

                breaker.record_success(circuit_key)
                yield _message_end_frame(final_text, candidate_model, model)
                return

    except (httpx.TimeoutException, TimeoutError):
        breaker.record_failure(circuit_key)
        err = {
            "error": "stream_timeout",
            "message": f"上游服务连续 {settings.HTTPX_TIMEOUT:g} 秒没有返回新内容，请稍后重试",
        }
        yield _sse_error(err)
        return
    except Exception:
        breaker.record_failure(circuit_key)
        logger.exception("智能体流式请求失败: agent_id={}", agent_id)
        err = {"error": "stream_failed", "message": "智能体流式请求失败，请稍后重试"}
        yield _sse_error(err)
        return



async def _stream_dify(
    provider: DifyProvider,
    messages,
    model,
    user,
    inputs,
    *,
    circuit_key: Optional[str] = None,
) -> AsyncGenerator[bytes, None]:
    """Dify stream with strict answer validation and bounded fallback."""
    headers = provider.build_headers()
    payload_primary, payload_fallback = _build_dify_payloads(provider, messages, model, user, inputs)
    candidates = provider.candidate_urls()
    client = get_http_client()
    last_error = None
    last_status = None
    state: Dict[str, Any] = {}
    lease = DifyConcurrencyLease(circuit_key or provider.api_endpoint)

    try:
        lease_error = await _ensure_dify_lease(lease)
        if lease_error is not None:
            yield lease_error
            return

        for url in candidates:
            state = _new_dify_candidate_state()
            decoder = codecs.getincrementaldecoder("utf-8")()
            reasoning_filter = ReasoningContentFilter()
            try_payload = _dify_payload_for_url(payload_primary, payload_fallback, url)
            driver = _stream_dify_candidate(
                client, url, headers, try_payload, lease, circuit_key,
                state, decoder, reasoning_filter,
            )
            while True:
                try:
                    frame = await anext(driver)
                except StopAsyncIteration:
                    action = "stop"
                    candidate_error = None
                    candidate_status = None
                    break
                if isinstance(frame, tuple):
                    action, candidate_error, candidate_status = frame
                    break
                yield frame
            if candidate_error is not None:
                last_error = candidate_error
            if candidate_status is not None:
                last_status = candidate_status
            if action == "stop":
                return
            if action == "done":
                return
            if action == "break":
                break

        err = _dify_final_error(last_error, state, last_status)
        _record_dify_result("error", circuit_key)
        yield _sse_error(err)
    finally:
        await lease.release()
