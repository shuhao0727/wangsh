"""流式对话 — 使用 Provider 策略模式"""

import codecs
import json
from typing import AsyncGenerator, Optional, Dict, Any

import httpx
from loguru import logger

from app.services.agents.ai_agent import get_agent
from app.services.agents.providers import (
    get_provider,
    provider_error_message,
    extract_provider_detail,
    resolve_credentials,
    build_messages,
    openrouter_model_candidates,
    should_retry_openrouter_fallback,
)
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.circuit_breaker import breaker
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


async def _prepare_stream(db, agent_id: int, message: str, history):
    """加载智能体与 Provider 并完成前置校验；失败时抛出 _StreamSetupError。"""
    try:
        agent = await get_agent(db, agent_id)
    except Exception as e:
        raise _StreamSetupError(
            {"error": "stream_failed", "message": "读取智能体配置失败", "detail": str(e)[:500]}
        )
    if not agent:
        raise _StreamSetupError({"error": "invalid_agent"})
    if not getattr(agent, "is_active", True):
        raise _StreamSetupError({"error": "agent_inactive", "message": "该智能体已停用"})

    try:
        api_endpoint, api_key = resolve_credentials(agent)
    except Exception:
        logger.exception("初始化智能体流失败: agent_id={}", agent_id)
        raise _StreamSetupError(
            {"error": "stream_setup_failed", "message": "初始化智能体请求失败，请稍后重试"}
        )

    try:
        provider = get_provider(agent.agent_type, api_endpoint, api_key)
        provider_name = type(provider).__name__
        circuit_key = f"{provider_name}:agent:{agent_id}"
        chat_messages = build_messages(agent, message, history)
        model = agent.model_name or ""
    except Exception:
        logger.exception("构建智能体 Provider 失败: agent_id={}", agent_id)
        raise _StreamSetupError(
            {"error": "stream_setup_failed", "message": "初始化智能体请求失败，请稍后重试"}
        )

    if not api_endpoint:
        raise _StreamSetupError(
            {"error": "missing_endpoint", "message": "该智能体未配置API地址，请在管理后台设置"}
        )
    if not api_key:
        raise _StreamSetupError(
            {"error": "missing_api_key", "message": "该智能体未配置API密钥，请在管理后台设置"}
        )
    if breaker.is_open(circuit_key):
        raise _StreamSetupError(
            {"error": "circuit_open", "message": "该服务暂时不可用（连续失败过多），请稍后重试"}
        )

    return provider, circuit_key, chat_messages, model


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


async def stream_agent_chat(db, agent_id: int, message: str, user: Optional[str] = None, inputs: Optional[Dict[str, Any]] = None, *, history: Optional[list] = None) -> AsyncGenerator[bytes, None]:
    try:
        provider, circuit_key, chat_messages, model = await _prepare_stream(db, agent_id, message, history)
    except _StreamSetupError as exc:
        yield _sse_error(exc.err)
        return

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

                breaker.record_success(circuit_key)
                finish_error = _finish_reason_error(finish_reason)
                if finish_error is not None:
                    error_code, error_message = finish_error
                    err = {"error": error_code, "message": error_message, "finish_reason": finish_reason}
                    yield _sse_error(err)
                    return

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
    except Exception as e:
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
    normalized = buffer.replace("\r\n", "\n").replace("\r", "\n")
    blocks = normalized.split("\n\n")
    return blocks[:-1], blocks[-1]


def _is_dify_terminal(event_type) -> bool:
    return event_type in {"message_end", "workflow_finished", "error"}


def _scan_dify_event_blocks(event_blocks) -> tuple[bool, Optional[str]]:
    completed = False
    terminal_event_type = None
    for event_block in event_blocks:
        event_type = _dify_event_type(event_block)
        if _is_dify_terminal(event_type):
            completed = True
            terminal_event_type = event_type
    return completed, terminal_event_type


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


def _dify_final_error(last_error, emitted_any) -> dict:
    if emitted_any:
        error_code = "dify_stream_incomplete" if last_error == "incomplete_stream" else "dify_stream_interrupted"
        return {
            "error": error_code,
            "message": "Dify 流式响应提前结束，已保留已生成内容",
            "detail": str(last_error)[:500],
        }
    return {
        "error": "dify_all_candidates_failed",
        "message": f"Dify 所有候选地址均失败: {last_error}",
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
    """Dify 流式：多候选 URL + SSE 透传"""
    headers = provider.build_headers()
    payload_primary, payload_fallback = _build_dify_payloads(provider, messages, model, user, inputs)
    candidates = provider.candidate_urls()
    client = get_http_client()
    last_error = None
    emitted_any = False

    for url in candidates:
        candidate_emitted = False
        candidate_completed = False
        terminal_event_type = None
        decoder = codecs.getincrementaldecoder("utf-8")()
        event_buffer = ""
        try:
            try_payload = _dify_payload_for_url(payload_primary, payload_fallback, url)

            async with client.stream("POST", url, headers=headers, json=try_payload) as resp:
                if resp.status_code != 200:
                    last_error = f"status_{resp.status_code}"
                    continue

                async for chunk in resp.aiter_bytes():
                    if chunk:
                        candidate_emitted = True
                        emitted_any = True
                        event_buffer += decoder.decode(chunk)
                        event_blocks, event_buffer = _consume_dify_events(event_buffer)
                        scan_completed, scan_terminal = _scan_dify_event_blocks(event_blocks)
                        if scan_completed:
                            candidate_completed = True
                            terminal_event_type = scan_terminal
                        yield chunk
                event_buffer += decoder.decode(b"", final=True)
                trailing_event_type = _dify_event_type(event_buffer) if event_buffer else None
                if _is_dify_terminal(trailing_event_type):
                    candidate_completed = True
                    terminal_event_type = trailing_event_type
                if candidate_completed:
                    _record_dify_result(terminal_event_type, circuit_key)
                    return
                if candidate_emitted:
                    last_error = "incomplete_stream"
                    break
                last_error = "empty_stream"
        except Exception as e:
            last_error = str(e)
            if candidate_completed:
                _record_dify_result(terminal_event_type, circuit_key)
                return
            if emitted_any:
                break
            continue

    err = _dify_final_error(last_error, emitted_any)
    _record_dify_result("error", circuit_key)
    yield _sse_error(err)
