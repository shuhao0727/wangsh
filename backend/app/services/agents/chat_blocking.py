import json
from typing import Any, Dict, Optional

import httpx

from app.services.agents.ai_agent import get_agent
from app.services.agents.providers import detect_flags, chat_completions_endpoint
from app.core.config import settings


def _provider_error_message(status_code: int) -> str:
    if status_code == 401 or status_code == 403:
        return "上游服务鉴权失败（请检查 API Key 是否正确、是否有权限访问该模型）"
    if status_code == 404:
        return "上游服务接口或模型不存在（请检查 API Endpoint 与模型名）"
    if status_code == 429:
        return "上游服务返回 429（限流/额度不足）。请稍后重试，或更换 API Key/提升额度"
    if status_code == 402:
        return "上游服务余额不足或需要付费（请检查账号额度/账单）"
    if 500 <= status_code <= 599:
        return "上游服务异常（5xx）。请稍后重试"
    return "上游服务请求失败"


async def run_agent_chat_blocking(
    db,
    *,
    agent_id: int,
    message: str,
    user: Optional[str] = None,
    inputs: Optional[Dict[str, Any]] = None,
) -> str:
    agent = await get_agent(db, agent_id)
    if not agent:
        raise ValueError("invalid_agent")

    api_endpoint = (agent.api_endpoint or "").strip().rstrip("/")
    api_key = agent.api_key
    if agent.agent_type != "dify":
        if not api_endpoint:
            api_endpoint = settings.OPENROUTER_API_URL.strip().rstrip("/")
        if not api_key:
            api_key = settings.OPENROUTER_API_KEY
    if not api_endpoint or not api_key:
        raise ValueError("invalid_agent")
    is_dify = agent.agent_type == "dify"
    flags = detect_flags(api_endpoint)
    is_anthropic = flags.get("is_anthropic", False)

    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        if is_dify:
            headers["Authorization"] = f"Bearer {api_key}"
        elif is_anthropic:
            headers["x-api-key"] = api_key
        else:
            headers["Authorization"] = f"Bearer {api_key}"

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

        payload = {
            "query": message,
            "user": user or "discussion_user",
            "response_mode": "blocking",
            "inputs": inputs or {},
        }
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            last_err = None
            for url in candidates:
                try:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code != 200:
                        last_err = f"status_{resp.status_code}"
                        continue
                    data = resp.json()
                    if isinstance(data, dict):
                        if isinstance(data.get("answer"), str) and data["answer"].strip():
                            return data["answer"].strip()
                        nested = data.get("data")
                        if isinstance(nested, dict) and isinstance(nested.get("answer"), str) and nested["answer"].strip():
                            return nested["answer"].strip()
                        if isinstance(data.get("message"), str) and data["message"].strip():
                            return data["message"].strip()
                    return json.dumps(data, ensure_ascii=False)[:4000]
                except Exception as e:
                    last_err = str(e)
                    continue
        raise ValueError(last_err or "dify_failed")

    if not agent.model_name:
        raise ValueError("model_not_configured")

    chat_url = chat_completions_endpoint(api_endpoint, flags)

    payload = {
        "model": agent.model_name,
        "messages": [{"role": "user", "content": message}],
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.post(chat_url, headers=headers, json=payload)
        if resp.status_code != 200:
            msg = _provider_error_message(int(resp.status_code))
            raise ValueError(f"provider_status_{resp.status_code}: {msg}")
        data = resp.json()
        try:
            choices = data.get("choices") or []
            if choices:
                msg = choices[0].get("message") or {}
                content = msg.get("content")
                if isinstance(content, str) and content.strip():
                    return content.strip()
                text = choices[0].get("text")
                if isinstance(text, str) and text.strip():
                    return text.strip()
        except Exception:
            pass
        return json.dumps(data, ensure_ascii=False)[:4000]
