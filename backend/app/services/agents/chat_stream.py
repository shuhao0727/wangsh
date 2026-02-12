import json
import httpx
from typing import AsyncGenerator, Optional, Dict, Any

from app.services.agents.ai_agent import get_agent
from app.services.agents.providers import detect_flags, chat_completions_endpoint

async def stream_agent_chat(db, agent_id: int, message: str, user: Optional[str] = None, inputs: Optional[Dict[str, Any]] = None) -> AsyncGenerator[bytes, None]:
    agent = await get_agent(db, agent_id)
    if not agent or not agent.api_endpoint or not agent.api_key:
        yield b"event: error\ndata: {\"error\":\"invalid_agent\"}\n\n"
        return

    api_endpoint = agent.api_endpoint.strip().rstrip("/")
    is_dify = agent.agent_type == "dify"

    # 基础请求头构建：后续根据服务商类型微调
    flags = detect_flags(api_endpoint)
    is_anthropic = flags.get("is_anthropic", False)

    headers: Dict[str, str] = {}
    if agent.api_key:
        if is_dify:
            headers["Authorization"] = f"Bearer {agent.api_key}"
        elif is_anthropic:
            headers["x-api-key"] = agent.api_key
        else:
            headers["Authorization"] = f"Bearer {agent.api_key}"

    if is_dify:
        candidates = []
        base = api_endpoint
        if "/chat/" in base:
            candidates.append(base)
        else:
            if base.endswith("/v1"):
                candidates.extend([f"{base}/chat-messages"])
            else:
                candidates.extend([f"{base}/v1/chat-messages", f"{base}/chat-messages"])
        payload_primary = {
            "query": message,
            "user": user or "stream_user",
            "response_mode": "streaming",
            "inputs": inputs or {},
        }
        payload_fallback = {
            "query": message,
            "user": user or "stream_user",
            "inputs": inputs or {},
        }
        async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
            last_error = None
            for url in candidates:
                try:
                    try_payload = payload_primary if "/chat-messages" in url else payload_fallback
                    async with client.stream("POST", url, headers=headers, json=try_payload) as resp:
                        if resp.status_code != 200:
                            last_error = f"status_{resp.status_code}"
                            continue
                        buffer = ""
                        async for chunk in resp.aiter_bytes():
                            if not chunk:
                                continue
                            buffer += chunk.decode("utf-8", errors="ignore")
                            buffer = buffer.replace("\r\n", "\n")
                            parts = buffer.split("\n\n")
                            buffer = parts.pop() or ""
                            for part in parts:
                                if not part:
                                    continue
                                yield (part + "\n\n").encode("utf-8")
                        if buffer.strip():
                            yield (buffer.strip() + "\n\n").encode("utf-8")
                        return
                except Exception as e:
                    last_error = str(e)
                    continue
        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                url = candidates[0]
                r = await client.post(url, headers=headers, json=payload_fallback)
                data = r.text
                yield (f"data: {data}\n\n").encode("utf-8")
                return
        except Exception:
            yield b"event: error\ndata: {\"error\":\"stream_failed\"}\n\n"
            return

    # 非 Dify 智能体：根据服务商类型实现通用流式对话
    else:
        if not agent.model_name:
            err = {"error": "model_not_configured", "message": "智能体未配置模型名称"}
            yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode(
                "utf-8"
            )
            return

        chat_url = chat_completions_endpoint(api_endpoint, flags)

        payload: Dict[str, Any] = {
            "model": agent.model_name,
            "messages": [{"role": "user", "content": message}],
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
                async with client.stream(
                    "POST", chat_url, headers=headers, json=payload
                ) as resp:
                    if resp.status_code != 200:
                        body_bytes = await resp.aread()
                        body_text = body_bytes.decode("utf-8", errors="ignore")
                        err = {
                            "error": f"provider_status_{resp.status_code}",
                            "detail": body_text[:200],
                        }
                        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode(
                            "utf-8"
                        )
                        return

                    final_text = ""

                    async for raw_line in resp.aiter_lines():
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        if not line.startswith("data:"):
                            continue

                        data_str = line[len("data:") :].strip()
                        if not data_str:
                            continue
                        if data_str == "[DONE]":
                            break

                        try:
                            obj = json.loads(data_str)
                        except Exception:
                            continue

                        choices = obj.get("choices") or []
                        if not choices:
                            continue
                        choice0 = choices[0] or {}
                        delta = choice0.get("delta") or choice0.get("message") or {}
                        content = delta.get("content") or ""
                        if not content:
                            continue

                        final_text += str(content)
                        chunk = {"answer": str(content)}
                        yield f"event: message_delta\ndata: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode(
                            "utf-8"
                        )

                    if final_text:
                        end_payload = {"answer": final_text}
                        yield f"event: message_end\ndata: {json.dumps(end_payload, ensure_ascii=False)}\n\n".encode(
                            "utf-8"
                        )
                    return
        except Exception as e:
            err = {"error": "stream_failed", "detail": str(e)}
            yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n".encode(
                "utf-8"
            )
            return
