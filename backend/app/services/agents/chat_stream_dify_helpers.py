"""Dify 流式解析、状态跟踪与候选请求辅助函数（从 chat_stream.py 平移，行为逐句等价）。"""

import asyncio
import json
from contextlib import suppress
from copy import deepcopy
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.services.agents.assistant_answer_sanitizer import (
    ReasoningContentFilter,
    sanitize_reasoning_strings,
)
from app.services.agents.providers.circuit_breaker import breaker
from app.services.agents.dify_concurrency import (
    DifyConcurrencyBusy,
    DifyConcurrencyUnavailable,
)
from app.services.agents.chat_stream_helpers import _sse_error



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


async def _ensure_dify_lease(lease) -> Optional[bytes]:
    """获取并发租约；失败时返回需要透传的错误帧（None 表示成功）。"""
    try:
        await lease.acquire()
    except DifyConcurrencyBusy as exc:
        return _sse_error({
            "error": "provider_busy",
            "message": "当前智能体正在处理较多请求，请稍后重试",
            "retry_after": exc.retry_after,
        })
    except DifyConcurrencyUnavailable:
        return _sse_error({
            "error": "concurrency_unavailable",
            "message": "当前服务繁忙，暂时无法建立对话，请稍后重试",
            "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
        })
    if not lease.is_held():
        return _sse_error({
            "error": "concurrency_unavailable",
            "message": "并发保护租约已失效，已拒绝发起上游请求，请稍后重试",
            "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
        })
    return None


def _dify_status_error(status_code: int) -> tuple[str, int]:
    last_status = int(status_code)
    last_error = "rate_limited" if last_status == 429 else f"status_{last_status}"
    return last_error, last_status


def _new_dify_candidate_state() -> Dict[str, Any]:
    return {
        "saw_answer_delta": False,
        "visible_answer_chars": 0,
        "saw_terminal_event": False,
        "terminal_event_type": None,
        "saw_provider_error": False,
        "provider_error": None,
        "saw_event": False,
        "saw_transport_bytes": False,
    }


def _candidate_has_content(state: Dict[str, Any]) -> bool:
    return state["saw_answer_delta"] or state["saw_event"]


def _process_dify_event_blocks(
    event_blocks,
    state: Dict[str, Any],
    reasoning_filter,
    circuit_key,
) -> tuple[List[bytes], Optional[bytes]]:
    """按顺序处理一个 SSE 批次；返回 (待透传帧, 致命错误帧或 None)。"""
    frames: List[bytes] = []
    for event_block in event_blocks:
        event_type = _dify_event_type(event_block)
        _update_dify_terminal_state(event_block, state)
        safe_block = _sanitize_dify_event_block(event_block, reasoning_filter)
        if event_type == "error":
            _record_dify_result("error", circuit_key)
            return frames, _sse_error(_dify_error_from_payload(_dify_event_payload(event_block)))
        if safe_block is not None:
            _update_dify_answer_state(safe_block, state)
            frames.append((safe_block + "\n\n").encode("utf-8"))
    return frames, None


def _flush_dify_buffer(event_buffer: str, state: Dict[str, Any], reasoning_filter, circuit_key):
    """冲刷解码缓冲区；返回 (待透传帧或 None, 致命错误帧或 None)。"""
    if not event_buffer:
        reasoning_filter.finish()
        return None, None
    frames, fatal = _process_dify_event_blocks([event_buffer], state, reasoning_filter, circuit_key)
    return (frames[0] if frames else None), fatal


def _finish_dify_candidate(lease, state: Dict[str, Any], circuit_key) -> tuple[str, Optional[bytes]]:
    """候选流结束后的租约/终止检查；返回 (动作, 帧或 None)。"""
    if not lease.is_held():
        return ("stop", _sse_error({
            "error": "concurrency_unavailable",
            "message": "并发保护租约已失效，已拒绝把本次响应标记为成功，请稍后重试",
            "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
        }))
    if not state["saw_terminal_event"]:
        return ("continue", None)
    if state["terminal_event_type"] == "error":
        _record_dify_result("error", circuit_key)
        return ("stop", _sse_error(_dify_error_from_payload({"message": state.get("provider_error")})))
    if state["visible_answer_chars"] > 0:
        _record_dify_result(state["terminal_event_type"], circuit_key)
        return ("done", None)
    _record_dify_result("error", circuit_key)
    return ("stop", _sse_error({
        "error": "dify_empty_answer",
        "message": "Dify 已结束但没有返回可见回答，请稍后重试",
    }))


def _candidate_exception_outcome(state: Dict[str, Any], last_error: str):
    if _candidate_has_content(state):
        return ("break", last_error, None)
    return ("retry", last_error, None)


async def _stream_dify_candidate(
    client, url, headers, try_payload, lease, circuit_key, state, decoder, reasoning_filter,
):
    """流式请求单个候选 URL；产出 SSE 帧，最后产出控制元组 (动作, last_error, last_status)。"""
    try:
        async with client.stream("POST", url, headers=headers, json=try_payload) as resp:
            if resp.status_code != 200:
                yield ("retry", *_dify_status_error(resp.status_code))
                return

            event_buffer = ""
            async for chunk in _lease_checked_chunks(resp.aiter_bytes(), lease):
                state["saw_transport_bytes"] = True
                event_buffer += decoder.decode(chunk)
                event_blocks, event_buffer = _consume_dify_events(event_buffer)
                batch_frames, fatal = _process_dify_event_blocks(event_blocks, state, reasoning_filter, circuit_key)
                for frame in batch_frames:
                    yield frame
                if fatal is not None:
                    yield fatal
                    yield ("stop", None, None)
                    return

            flush_frame, flush_fatal = _flush_dify_buffer(event_buffer, state, reasoning_filter, circuit_key)
            if flush_frame is not None:
                yield flush_frame
            if flush_fatal is not None:
                yield flush_fatal
                yield ("stop", None, None)
                return
            post_action, post_frame = _finish_dify_candidate(lease, state, circuit_key)
            if post_action == "stop":
                yield post_frame
                yield ("stop", None, None)
                return
            if post_action == "done":
                yield ("done", None, None)
                return
            if _candidate_has_content(state):
                yield ("break", "incomplete_stream", None)
                return
            yield ("retry", "empty_stream", None)
    except DifyConcurrencyUnavailable:
        yield _sse_error({
            "error": "concurrency_unavailable",
            "message": "并发保护租约已失效，已停止本次上游请求，请稍后重试",
            "retry_after": max(1, int(settings.DIFY_CONCURRENCY_WAIT_SECONDS or 1)),
        })
        yield ("stop", None, None)
    except (httpx.TimeoutException, TimeoutError):
        yield _candidate_exception_outcome(state, "timeout")
    except Exception as exc:
        yield _candidate_exception_outcome(state, str(exc))
