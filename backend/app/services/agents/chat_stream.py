"""流式对话 — 使用 Provider 策略模式"""

import asyncio
import json
from typing import AsyncGenerator, Optional, Dict, Any

STREAM_TIMEOUT_SECONDS = 120

from app.services.agents.ai_agent import get_agent
from app.services.agents.providers import get_provider, provider_error_message, extract_provider_detail, resolve_credentials, build_messages
from app.services.agents.providers.dify_provider import DifyProvider
from app.services.agents.providers.circuit_breaker import breaker
from app.core.config import settings
from app.core.http_client import get_http_client


async def stream_agent_chat(db, agent_id: int, message: str, user: Optional[str] = None, inputs: Optional[Dict[str, Any]] = None, *, history: Optional[list] = None) -> AsyncGenerator[bytes, None]:
    agent = await get_agent(db, agent_id)
    if not agent:
        yield b"event: error\ndata: {\"error\":\"invalid_agent\"}\n\n"
        return

    api_endpoint, api_key = resolve_credentials(agent)
    if not api_endpoint:
        err = {"error": "missing_endpoint", "message": "该智能体未配置API地址，请在管理后台设置"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return
    if not api_key:
        err = {"error": "missing_api_key", "message": "该智能体未配置API密钥，请在管理后台设置"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    provider = get_provider(agent.agent_type, api_endpoint, api_key)
    provider_name = type(provider).__name__
    chat_messages = build_messages(agent, message, history)
    model = agent.model_name or ""

    # 熔断检查
    if breaker.is_open(provider_name):
        err = {"error": "circuit_open", "message": "该服务暂时不可用（连续失败过多），请稍后重试"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    # Dify: 特殊处理（多候选 URL + SSE 透传）
    if isinstance(provider, DifyProvider):
        async for chunk in _stream_dify(provider, chat_messages, model, user, inputs):
            yield chunk
        return

    # 非 Dify: 通用 OpenAI/Anthropic 流式
    if not model:
        err = {"error": "model_not_configured", "message": "智能体未配置模型名称"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return

    headers = provider.build_headers()
    payload = provider.build_stream_payload(chat_messages, model)
    chat_url = provider.chat_url()

    try:
        client = get_http_client()
        async with asyncio.timeout(STREAM_TIMEOUT_SECONDS):
            async with client.stream("POST", chat_url, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    breaker.record_failure(provider_name)
                    body_bytes = await resp.aread()
                    body_text = body_bytes.decode("utf-8", errors="ignore")
                    status_code = int(resp.status_code)
                    detail = extract_provider_detail(body_text)
                    err = {
                        "error": f"provider_status_{status_code}",
                        "message": provider_error_message(status_code),
                        "provider_status": status_code,
                        "detail": detail[:500],
                    }
                    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                    return

                final_text = ""
                async for raw_line in resp.aiter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.strip()
                    if provider.is_stream_done(line):
                        break
                    content = provider.parse_stream_line(line)
                    if not content:
                        continue
                    final_text += content
                    chunk = {"answer": content}
                    yield f"event: message_delta\ndata: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode("utf-8")

                if final_text:
                    breaker.record_success(provider_name)
                    end_payload = {"answer": final_text}
                    yield f"event: message_end\ndata: {json.dumps(end_payload, ensure_ascii=False)}\n\n".encode("utf-8")
                return

    except asyncio.TimeoutError:
        breaker.record_failure(provider_name)
        err = {"error": "stream_timeout", "message": f"请求超时（{STREAM_TIMEOUT_SECONDS}秒），请稍后重试"}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return
    except Exception as e:
        breaker.record_failure(provider_name)
        err = {"error": "stream_failed", "detail": str(e)}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        return


async def _stream_dify(provider: DifyProvider, messages, model, user, inputs) -> AsyncGenerator[bytes, None]:
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

    for url in candidates:
        try:
            try_payload = payload_primary if "/chat-messages" in url else payload_fallback
            async with client.stream("POST", url, headers=headers, json=try_payload) as resp:
                if resp.status_code != 200:
                    last_error = f"status_{resp.status_code}"
                    continue

                # 使用 aiter_lines() 避免数据截断
                async for line in resp.aiter_lines():
                    if not line:
                        # 空行表示事件结束，输出双换行
                        yield b"\n"
                        continue
                    # 输出行 + 单换行
                    yield (line + "\n").encode("utf-8")

                return
        except Exception as e:
            last_error = str(e)
            continue

    # 所有候选 URL 失败，返回错误
    err = {"error": "dify_all_candidates_failed", "message": f"Dify 所有候选地址均失败: {last_error}"}
    yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
