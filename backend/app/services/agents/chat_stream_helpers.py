"""通用 Provider 流式辅助函数。

从 app/services/agents/chat_stream.py 拆出的私有辅助：SSE 帧构造、
结束原因映射、Provider 状态码错误与 OpenAI 兼容流解析。
行为与原内联代码逐句等价；仅由 chat_stream.py 引用。
"""

import json
from typing import AsyncGenerator, Optional, Dict, Any

from app.services.agents.providers import (
    provider_error_message,
    extract_provider_detail,
    should_retry_openrouter_fallback,
)
from app.services.agents.providers.circuit_breaker import breaker



OUTPUT_LIMIT_REASONS = {"length", "max_tokens", "max_output_tokens"}
CONTEXT_LIMIT_REASONS = {"model_context_window_exceeded"}
SUCCESS_FINISH_REASONS = {None, "stop", "end_turn", "stop_sequence"}
POLICY_FINISH_REASONS = {"content_filter", "refusal"}
TOOL_FINISH_REASONS = {"tool_calls", "tool_use"}


def _sse_error(err) -> bytes:
    return f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")


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


def _provider_error_frame(circuit_key, resp_status, body_text, idx, candidate_model, candidate_models) -> Optional[bytes]:
    status_code = int(resp_status)
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
        return None
    return _provider_error_bytes(
        circuit_key, status_code, detail, candidate_model, idx, candidate_models
    )


def _stream_completion_error(circuit_key, stream_completed, finish_reason, final_text) -> Optional[bytes]:
    if not stream_completed:
        breaker.record_failure(circuit_key)
        return _sse_error({"error": "stream_incomplete", "message": "上游流式响应提前结束，已保留已生成内容"})
    finish_error = _finish_reason_error(finish_reason)
    if finish_error is not None:
        breaker.record_failure(circuit_key)
        error_code, error_message = finish_error
        return _sse_error({"error": error_code, "message": error_message, "finish_reason": finish_reason})
    if not final_text.strip():
        breaker.record_failure(circuit_key)
        return _sse_error({
            "error": "provider_empty_answer",
            "message": "模型未返回可见内容，请稍后重试",
        })
    return None


def _message_end_frame(final_text: str, candidate_model, model) -> bytes:
    end_payload = {"answer": final_text}
    if candidate_model != model:
        end_payload["fallback_model_used"] = candidate_model
    return f"event: message_end\ndata: {json.dumps(end_payload, ensure_ascii=False)}\n\n".encode("utf-8")
