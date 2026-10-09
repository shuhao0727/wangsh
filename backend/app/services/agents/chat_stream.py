"""流式对话 — 使用 Provider 策略模式"""

import asyncio
import codecs
import json
from contextlib import suppress
from copy import deepcopy
from dataclasses import dataclass
from typing import AsyncGenerator, Optional, Dict, Any

import httpx
from loguru import logger

from app.services.agents.chat_common import prepare_chat_context
from app.services.agents.assistant_answer_sanitizer import (
    ReasoningContentFilter,
    sanitize_reasoning_strings,
)
from app.services.agents.providers import (
    provider_error_message,
    extract_provider_detail,
    openrouter_model_candidates,
    should_retry_openrouter_fallback,
)
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.circuit_breaker import breaker
from app.services.agents.dify_concurrency import (
    DifyConcurrencyBusy,
    DifyConcurrencyLease,
    DifyConcurrencyUnavailable,
)
from app.core.config import settings
from app.core.http_client import get_http_client

OUTPUT_LIMIT_REASONS = {"length", "max_tokens", "max_output_tokens"}
CONTEXT_LIMIT_REASONS = {"model_context_window_exceeded"}
SUCCESS_FINISH_REASONS = {None, "stop", "end_turn", "stop_sequence"}
POLICY_FINISH_REASONS = {"content_filter", "refusal"}
TOOL_FINISH_REASONS = {"tool_calls", "tool_use"}


def _sse_error(err) -> bytes:
    return f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")


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


def _finish_reason_error(finish_reason):
    """把结束原因映射为 (error_code, message)；正常结束返回 None。"""
    if finish_reason in OUTPUT_LIMIT_REASONS:
        return "output_limit_reached", "模型已达到输出长度上限，已保留生成内容；可以继续提问让模型接着回答"
    if finish_reason in CONTEXT_LIMIT_REASONS:
        return "context_limit_reached", "模型上下文窗口已满，已保留生成内容；请新建会话或减少历史消息"
    if finish_reason in POLICY_FINISH_REASONS:
        return "provider_rejected_output", "模型因安全策略未完成回答，已保留可用内容"
    if finish_reason in TOOL_FINISH_REASONS:
        return "tool_call_not_supported", "模型请求调用工具，但当前智能体未启用工具调用"
    if finish_reason not in SUCCESS_FINISH_REASONS:
        return "unsupported_finish_reason", "模型以未支持的状态结束，已保留生成内容"
    return None


def _provider_error_bytes(circuit_key, status_code, detail, candidate_model, idx, candidate_models) -> bytes:
    breaker.record_failure(circuit_key)
    err = {
        "error": f"provider_status_{status_code}",
        "message": provider_error_message(status_code),
        "provider_status": status_code,
        "detail": detail[:500],
        "attempted_model": candidate_model,
    }
    if idx < len(candidate_models) - 1:
        err["fallback_model"] = candidate_models[idx + 1]
    return _sse_error(err)


async def _iter_stream_events(provider, resp):
    """逐行解析上游 SSE，产出 (content, finish_reason, stream_done) 三元组。"""
    async for raw_line in resp.aiter_lines():
        if not raw_line:
            continue
        line = raw_line.strip()
        content = provider.parse_stream_line(line)
        finish_reason = None
        finish_reason_reader = getattr(provider, "stream_finish_reason", None)
        if finish_reason_reader is not None:
            line_finish_reason = finish_reason_reader(line)
            if line_finish_reason is not None:
                finish_reason = line_finish_reason
        stream_done = provider.is_stream_done(line)
        yield content, finish_reason, stream_done
        if stream_done:
            return


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
                    status_code = int(resp.status_code)
                    detail = extract_provider_detail(body_text)
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

                    yield _provider_error_bytes(
                        circuit_key, status_code, detail, candidate_model, idx, candidate_models
                    )
                    return

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

                if not stream_completed:
                    breaker.record_failure(circuit_key)
                    err = {"error": "stream_incomplete", "message": "上游流式响应提前结束，已保留已生成内容"}
                    yield _sse_error(err)
                    return

                finish_error = _finish_reason_error(finish_reason)
                if finish_error is not None:
                    breaker.record_failure(circuit_key)
                    error_code, error_message = finish_error
                    err = {"error": error_code, "message": error_message, "finish_reason": finish_reason}
                    yield _sse_error(err)
                    return

                if not final_text.strip():
                    breaker.record_failure(circuit_key)
                    yield _sse_error({
                        "error": "provider_empty_answer",
                        "message": "模型未返回可见内容，请稍后重试",
                    })
                    return

                breaker.record_success(circuit_key)
                end_payload = {"answer": final_text}
                if candidate_model != model:
                    end_payload["fallback_model_used"] = candidate_model
                yield f"event: message_end\ndata: {json.dumps(end_payload, ensure_ascii=False)}\n\n".encode("utf-8")
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


def _dify_event_type(event_block: str) -> Optional[str]:
    explicit_type = None
    data_lines = []
    for line in event_block.splitlines():
        if line.startswith("event:"):
            explicit_type = line[6:].strip()
        elif line.startswith("data:"):
            data_lines.append(line[5:].strip())
    if explicit_type:
        return explicit_type
    if not data_lines:
        return None
    try:
        payload = json.loads("\n".join(data_lines))
    except Exception:
        return None
    event_type = payload.get("event") if isinstance(payload, dict) else None
    return str(event_type) if event_type else None


def _consume_dify_events(buffer: str) -> tuple[list[str], str]:
    # Keep a trailing CR buffered so a CRLF pair split across network chunks is
    # normalized only after the LF arrives. Converting that CR immediately
    # would manufacture a blank line and split one valid SSE event in two.
    trailing_cr = buffer.endswith("\r")
    complete = buffer[:-1] if trailing_cr else buffer
    normalized = complete.replace("\r\n", "\n").replace("\r", "\n")
    if trailing_cr:
        normalized += "\r"
    blocks = normalized.split("\n\n")
    return blocks[:-1], blocks[-1]


def _dify_event_payload(event_block: str) -> Optional[dict]:
    data_lines = []
    for line in event_block.split("\n"):
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
    if not data_lines:
        return None
    try:
        payload = json.loads("\n".join(data_lines))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _replace_dify_event_payload(event_block: str, payload: dict) -> str:
    lines = event_block.split("\n")
    data_indexes = [index for index, line in enumerate(lines) if line.startswith("data:")]
    encoded = "data: " + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if not data_indexes:
        return event_block
    first_index = data_indexes[0]
    kept_lines = [line for index, line in enumerate(lines) if index not in data_indexes]
    kept_lines.insert(first_index, encoded)
    return "\n".join(kept_lines)


def _dify_answer_locations(payload: dict, event_type: Optional[str]) -> list[tuple[dict, str]]:
    """Return known user-visible answer fields in Dify event payloads.

    Chat messages normally use ``answer``/``data.answer`` while workflow
    completion events commonly put the final value under
    ``data.outputs.answer``. Keep this allow-list narrow so internal
    ``thought``/``reasoning`` fields can never become an answer by accident.
    """
    locations: list[tuple[dict, str]] = []
    if event_type == "text_chunk":
        data = payload.get("data")
        if isinstance(data, dict) and isinstance(data.get("text"), str):
            locations.append((data, "text"))
        if isinstance(payload.get("text"), str):
            locations.append((payload, "text"))
        return locations

    if isinstance(payload.get("answer"), str):
        locations.append((payload, "answer"))
    data = payload.get("data")
    if isinstance(data, dict):
        if isinstance(data.get("answer"), str):
            locations.append((data, "answer"))
        outputs = data.get("outputs")
        if isinstance(outputs, dict) and isinstance(outputs.get("answer"), str):
            locations.append((outputs, "answer"))
    outputs = payload.get("outputs")
    if isinstance(outputs, dict) and isinstance(outputs.get("answer"), str):
        locations.append((outputs, "answer"))
    return locations


def _set_dify_text_delta(payload: dict, event_type: Optional[str], value: str) -> bool:
    locations = _dify_answer_locations(payload, event_type)
    if not locations:
        return False
    for container, key in locations:
        container[key] = value
    return True


def _get_dify_text_delta(payload: dict, event_type: Optional[str]) -> Optional[str]:
    locations = _dify_answer_locations(payload, event_type)
    if not locations:
        return None
    return next((value for container, key in locations
                 if isinstance((value := container.get(key)), str)), None)


def _sanitize_dify_event_block(
    event_block: str,
    reasoning_filter: ReasoningContentFilter,
) -> Optional[str]:
    event_type = _dify_event_type(event_block)
    if event_type == "agent_thought":
        return None

    payload = _dify_event_payload(event_block)
    if payload is None:
        # Preserve comments/control fields, but never forward an unparseable
        # data payload because it may contain a truncated reasoning fragment.
        has_data = any(line.startswith("data:") for line in event_block.split("\n"))
        return None if has_data else event_block

    safe_payload = deepcopy(payload)
    if event_type in {"message_delta", "message", "agent_message", "text_chunk"}:
        delta = _get_dify_text_delta(safe_payload, event_type)
        if delta is not None:
            _set_dify_text_delta(
                safe_payload,
                event_type,
                reasoning_filter.push(delta),
            )
    else:
        safe_payload = sanitize_reasoning_strings(safe_payload)

    if _is_dify_terminal(event_type):
        reasoning_filter.finish()
    return _replace_dify_event_payload(event_block, safe_payload)


def _is_dify_terminal(event_type) -> bool:
    return event_type in {"message_end", "workflow_finished", "error"}


def _update_dify_answer_state(event_block: str, state: Dict[str, Any]) -> None:
    """Track visible answer text only; transport bytes/reasoning are not success."""
    event_type = _dify_event_type(event_block)
    if event_type:
        state["saw_event"] = True
    if event_type == "error":
        state["saw_provider_error"] = True
        payload = _dify_event_payload(event_block) or {}
        state["provider_error"] = str(
            payload.get("message") or payload.get("code") or payload.get("error") or "Dify 上游返回错误"
        )
        return

    payload = _dify_event_payload(event_block)
    if payload is None:
        return
    text = _get_dify_text_delta(payload, event_type)
    if isinstance(text, str) and text.strip():
        state["saw_answer_delta"] = True
        state["visible_answer_chars"] += len(text.strip())


def _update_dify_terminal_state(event_block: str, state: Dict[str, Any]) -> None:
    event_type = _dify_event_type(event_block)
    if event_type:
        state["saw_event"] = True
    if event_type == "error":
        state["saw_provider_error"] = True
        payload = _dify_event_payload(event_block) or {}
        state["provider_error"] = str(
            payload.get("message") or payload.get("code") or payload.get("error") or "Dify 上游返回错误"
        )
    if _is_dify_terminal(event_type):
        state["saw_terminal_event"] = True
        state["terminal_event_type"] = event_type


async def _nonempty_chunks(chunks):
    async for chunk in chunks:
        if chunk:
            yield chunk


async def _lease_checked_chunks(chunks, lease):
    """Read upstream bytes while stopping promptly if Redis lease is lost."""
    iterator = chunks.__aiter__()
    while True:
        if not lease.is_held():
            raise DifyConcurrencyUnavailable("Dify concurrency lease lost")
        next_task = asyncio.create_task(anext(iterator))
        lost_task = asyncio.create_task(lease.wait_lost())
        try:
            done, _ = await asyncio.wait(
                {next_task, lost_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if lost_task in done and lost_task.result():
                next_task.cancel()
                with suppress(asyncio.CancelledError, StopAsyncIteration):
                    await next_task
                raise DifyConcurrencyUnavailable("Dify concurrency lease lost")
            lost_task.cancel()
            with suppress(asyncio.CancelledError):
                await lost_task
            try:
                chunk = next_task.result()
            except StopAsyncIteration:
                return
            if chunk:
                yield chunk
        finally:
            for task in (next_task, lost_task):
                if not task.done():
                    task.cancel()
            for task in (next_task, lost_task):
                if task.done():
                    with suppress(asyncio.CancelledError, StopAsyncIteration):
                        task.result()


def _record_dify_result(terminal_event_type, circuit_key) -> None:
    if not circuit_key:
        return
    if terminal_event_type == "error":
        breaker.record_failure(circuit_key)
    else:
        breaker.record_success(circuit_key)


def _build_dify_payloads(provider, messages, model, user, inputs) -> tuple[dict, dict]:
    payload_primary = provider.build_stream_payload(messages, model)
    if user:
        payload_primary["user"] = user
    if inputs:
        payload_primary["inputs"] = inputs
    payload_fallback = dict(payload_primary)
    payload_fallback.pop("response_mode", None)
    return payload_primary, payload_fallback


def _dify_payload_for_url(payload_primary, payload_fallback, url) -> dict:
    return payload_primary if "/chat-messages" in url else payload_fallback


def _dify_error_from_payload(payload: Optional[dict]) -> dict:
    payload = payload or {}
    raw = str(payload.get("code") or payload.get("error") or payload.get("message") or "")
    normalized = raw.lower()
    error_code = (
        "dify_rate_limited"
        if "429" in normalized or "rate" in normalized or "limit" in normalized
        else "dify_upstream_error"
    )
    return {
        "error": error_code,
        "message": str(payload.get("message") or payload.get("error") or "Dify 上游返回错误")[:500],
        "detail": raw[:500],
    }


def _dify_final_error(last_error, state: Dict[str, Any], status_code: Optional[int] = None) -> dict:
    if state.get("saw_provider_error"):
        return {
            "error": "dify_upstream_error",
            "message": state.get("provider_error") or "Dify 上游返回错误",
        }
    if status_code == 429 or last_error == "rate_limited":
        return {
            "error": "dify_rate_limited",
            "message": "Dify 当前并发或调用额度已满，请稍后重试",
            "provider_status": 429,
        }
    if status_code is not None and status_code >= 500:
        return {
            "error": "dify_upstream_error",
            "message": "Dify 服务暂时不可用，请稍后重试",
            "provider_status": status_code,
        }
    if state.get("saw_answer_delta"):
        error_code = "dify_stream_incomplete" if last_error == "incomplete_stream" else "dify_stream_interrupted"
        return {
            "error": error_code,
            "message": "Dify 流式响应提前结束，已保留已生成内容",
            "detail": str(last_error)[:500],
        }
    if state.get("saw_transport_bytes"):
        return {
            "error": "dify_stream_incomplete",
            "message": "Dify 流式响应格式不完整，已拒绝空回答",
            "detail": str(last_error)[:500],
        }
    if state.get("saw_event"):
        return {
            "error": "dify_empty_answer",
            "message": "Dify 未返回可见回答，请稍后重试",
            "detail": str(last_error)[:500],
        }
    return {
        "error": "dify_upstream_error",
        "message": "Dify 没有返回有效响应，请稍后重试",
        "detail": str(last_error)[:500],
    }


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
    state = {}
    lease = DifyConcurrencyLease(circuit_key or provider.api_endpoint)

    try:
        try:
            await lease.acquire()
        except DifyConcurrencyBusy as exc:
            yield _sse_error({
                "error": "provider_busy",
                "message": "当前智能体正在处理较多请求，请稍后重试",
                "retry_after": exc.retry_after,
            })
            return
        except DifyConcurrencyUnavailable:
            yield _sse_error({
                "error": "concurrency_unavailable",
                "message": "当前服务繁忙，暂时无法建立对话，请稍后重试",
                "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
            })
            return

        if not lease.is_held():
            yield _sse_error({
                "error": "concurrency_unavailable",
                "message": "并发保护租约已失效，已拒绝发起上游请求，请稍后重试",
                "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
            })
            return

        for url in candidates:
            state = {
                "saw_answer_delta": False,
                "visible_answer_chars": 0,
                "saw_terminal_event": False,
                "terminal_event_type": None,
                "saw_provider_error": False,
                "provider_error": None,
                "saw_event": False,
                "saw_transport_bytes": False,
            }
            decoder = codecs.getincrementaldecoder("utf-8")()
            event_buffer = ""
            reasoning_filter = ReasoningContentFilter()
            try:
                try_payload = _dify_payload_for_url(payload_primary, payload_fallback, url)

                async with client.stream("POST", url, headers=headers, json=try_payload) as resp:
                    if resp.status_code != 200:
                        last_status = int(resp.status_code)
                        last_error = "rate_limited" if last_status == 429 else f"status_{last_status}"
                        continue

                    async for chunk in _lease_checked_chunks(resp.aiter_bytes(), lease):
                        state["saw_transport_bytes"] = True
                        event_buffer += decoder.decode(chunk)
                        event_blocks, event_buffer = _consume_dify_events(event_buffer)
                        for event_block in event_blocks:
                            event_type = _dify_event_type(event_block)
                            _update_dify_terminal_state(event_block, state)
                            safe_block = _sanitize_dify_event_block(event_block, reasoning_filter)
                            if event_type == "error":
                                _record_dify_result("error", circuit_key)
                                yield _sse_error(_dify_error_from_payload(_dify_event_payload(event_block)))
                                return
                            if safe_block is not None:
                                _update_dify_answer_state(safe_block, state)
                                yield (safe_block + "\n\n").encode("utf-8")

                    event_buffer += decoder.decode(b"", final=True)
                    if event_buffer:
                        event_type = _dify_event_type(event_buffer)
                        _update_dify_terminal_state(event_buffer, state)
                        safe_block = _sanitize_dify_event_block(event_buffer, reasoning_filter)
                        if event_type == "error":
                            _record_dify_result("error", circuit_key)
                            yield _sse_error(_dify_error_from_payload(_dify_event_payload(event_buffer)))
                            return
                        if safe_block is not None:
                            _update_dify_answer_state(safe_block, state)
                            yield (safe_block + "\n\n").encode("utf-8")
                    else:
                        reasoning_filter.finish()

                    if not lease.is_held():
                        yield _sse_error({
                            "error": "concurrency_unavailable",
                            "message": "并发保护租约已失效，已拒绝把本次响应标记为成功，请稍后重试",
                            "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
                        })
                        return

                    if state["saw_terminal_event"]:
                        if state["terminal_event_type"] == "error":
                            _record_dify_result("error", circuit_key)
                            yield _sse_error(_dify_error_from_payload({"message": state.get("provider_error")}))
                            return
                        if state["visible_answer_chars"] > 0:
                            _record_dify_result(state["terminal_event_type"], circuit_key)
                            return
                        _record_dify_result("error", circuit_key)
                        yield _sse_error({
                            "error": "dify_empty_answer",
                            "message": "Dify 已结束但没有返回可见回答，请稍后重试",
                        })
                        return

                    if state["saw_answer_delta"] or state["saw_event"]:
                        last_error = "incomplete_stream"
                        break
                    last_error = "empty_stream"
            except DifyConcurrencyUnavailable:
                yield _sse_error({
                    "error": "concurrency_unavailable",
                    "message": "并发保护租约已失效，已停止本次上游请求，请稍后重试",
                    "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
                })
                return
            except (httpx.TimeoutException, TimeoutError):
                last_error = "timeout"
                if state["saw_answer_delta"] or state["saw_event"]:
                    break
                continue
            except Exception as exc:
                last_error = str(exc)
                if state["saw_answer_delta"] or state["saw_event"]:
                    break
                continue

        err = _dify_final_error(last_error, state, last_status)
        _record_dify_result("error", circuit_key)
        yield _sse_error(err)
    finally:
        await lease.release()
