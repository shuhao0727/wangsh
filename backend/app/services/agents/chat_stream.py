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


async def stream_agent_chat(db, agent_id: int, message: str, user: Optional[str] = None, inputs: Optional[Dict[str, Any]] = None, *, history: Optional[list] = None) -> AsyncGenerator[bytes, None]:
    try:
        agent = await get_agent(db, agent_id)
    except Exception as e:
        err = {"error": "stream_failed", "message": "读取智能体配置失败", "detail": str(e)[:500]}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    if not agent:
        yield b"event: error\ndata: {\"error\":\"invalid_agent\"}\n\n"
        return
    if not getattr(agent, "is_active", True):
        err = {"error": "agent_inactive", "message": "该智能体已停用"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    try:
        api_endpoint, api_key = resolve_credentials(agent)
    except Exception:
        logger.exception("初始化智能体流失败: agent_id={}", agent_id)
        err = {"error": "stream_setup_failed", "message": "初始化智能体请求失败，请稍后重试"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    try:
        provider = get_provider(agent.agent_type, api_endpoint, api_key)
        provider_name = type(provider).__name__
        circuit_key = f"{provider_name}:agent:{agent_id}"
        chat_messages = build_messages(agent, message, history)
        model = agent.model_name or ""
    except Exception:
        logger.exception("构建智能体 Provider 失败: agent_id={}", agent_id)
        err = {"error": "stream_setup_failed", "message": "初始化智能体请求失败，请稍后重试"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    if not api_endpoint:
        err = {"error": "missing_endpoint", "message": "该智能体未配置API地址，请在管理后台设置"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return
    if not api_key:
        err = {"error": "missing_api_key", "message": "该智能体未配置API密钥，请在管理后台设置"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    # 熔断检查
    if breaker.is_open(circuit_key):
        err = {"error": "circuit_open", "message": "该服务暂时不可用（连续失败过多），请稍后重试"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
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
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
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
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                    return

                final_text = ""
                stream_completed = False
                finish_reason = None
                async for raw_line in resp.aiter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.strip()
                    content = provider.parse_stream_line(line)
                    if content:
                        final_text += content
                        chunk = {"answer": content}
                        yield f"event: message_delta\ndata: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode("utf-8")
                    finish_reason_reader = getattr(provider, "stream_finish_reason", None)
                    if finish_reason_reader is not None:
                        line_finish_reason = finish_reason_reader(line)
                        if line_finish_reason is not None:
                            finish_reason = line_finish_reason
                    if provider.is_stream_done(line):
                        stream_completed = True
                        break

                if not stream_completed:
                    breaker.record_failure(circuit_key)
                    err = {
                        "error": "stream_incomplete",
                        "message": "上游流式响应提前结束，已保留已生成内容",
                    }
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                    return

                breaker.record_success(circuit_key)
                if finish_reason in OUTPUT_LIMIT_REASONS:
                    err = {
                        "error": "output_limit_reached",
                        "message": "模型已达到输出长度上限，已保留生成内容；可以继续提问让模型接着回答",
                        "finish_reason": finish_reason,
                    }
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                    return
                if finish_reason in CONTEXT_LIMIT_REASONS:
                    err = {
                        "error": "context_limit_reached",
                        "message": "模型上下文窗口已满，已保留生成内容；请新建会话或减少历史消息",
                        "finish_reason": finish_reason,
                    }
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                    return
                if finish_reason in POLICY_FINISH_REASONS:
                    err = {
                        "error": "provider_rejected_output",
                        "message": "模型因安全策略未完成回答，已保留可用内容",
                        "finish_reason": finish_reason,
                    }
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                    return
                if finish_reason in TOOL_FINISH_REASONS:
                    err = {
                        "error": "tool_call_not_supported",
                        "message": "模型请求调用工具，但当前智能体未启用工具调用",
                        "finish_reason": finish_reason,
                    }
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                    return
                if finish_reason not in SUCCESS_FINISH_REASONS:
                    err = {
                        "error": "unsupported_finish_reason",
                        "message": "模型以未支持的状态结束，已保留生成内容",
                        "finish_reason": finish_reason,
                    }
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
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
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return
    except Exception as e:
        breaker.record_failure(circuit_key)
        logger.exception("智能体流式请求失败: agent_id={}", agent_id)
        err = {"error": "stream_failed", "message": "智能体流式请求失败，请稍后重试"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
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
    payload_primary = provider.build_stream_payload(messages, model)
    if user:
        payload_primary["user"] = user
    if inputs:
        payload_primary["inputs"] = inputs
    payload_fallback = dict(payload_primary)
    payload_fallback.pop("response_mode", None)

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
            try_payload = payload_primary if "/chat-messages" in url else payload_fallback

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
                        for event_block in event_blocks:
                            event_type = _dify_event_type(event_block)
                            if event_type in {"message_end", "workflow_finished", "error"}:
                                candidate_completed = True
                                terminal_event_type = event_type
                        yield chunk
                event_buffer += decoder.decode(b"", final=True)
                trailing_event_type = _dify_event_type(event_buffer) if event_buffer else None
                if trailing_event_type in {"message_end", "workflow_finished", "error"}:
                    candidate_completed = True
                    terminal_event_type = trailing_event_type
                if candidate_completed:
                    if circuit_key:
                        if terminal_event_type == "error":
                            breaker.record_failure(circuit_key)
                        else:
                            breaker.record_success(circuit_key)
                    return
                if candidate_emitted:
                    last_error = "incomplete_stream"
                    break
                last_error = "empty_stream"
        except Exception as e:
            last_error = str(e)
            if candidate_completed:
                if circuit_key:
                    if terminal_event_type == "error":
                        breaker.record_failure(circuit_key)
                    else:
                        breaker.record_success(circuit_key)
                return
            if emitted_any:
                break
            continue

    if emitted_any:
        error_code = "dify_stream_incomplete" if last_error == "incomplete_stream" else "dify_stream_interrupted"
        err = {
            "error": error_code,
            "message": "Dify 流式响应提前结束，已保留已生成内容",
            "detail": str(last_error)[:500],
        }
    else:
        err = {
            "error": "dify_all_candidates_failed",
            "message": f"Dify 所有候选地址均失败: {last_error}",
        }
    if circuit_key:
        breaker.record_failure(circuit_key)
    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
