import json
from typing import Any, Dict, Optional

import httpx

from app.services.agents.ai_agent import get_agent
from app.services.agents.providers import detect_flags, chat_completions_endpoint


async def run_agent_chat_blocking(
    db,
    *,
    agent_id: int,
    message: str,
    user: Optional[str] = None,
    inputs: Optional[Dict[str, Any]] = None,
) -> str:
    agent = await get_agent(db, agent_id)
    if not agent or not agent.api_endpoint or not agent.api_key:
        raise ValueError("invalid_agent")

    api_endpoint = agent.api_endpoint.strip().rstrip("/")
    is_dify = agent.agent_type == "dify"
    flags = detect_flags(api_endpoint)
    is_anthropic = flags.get("is_anthropic", False)

    headers: Dict[str, str] = {"Content-Type": "application/json"}
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
            raise ValueError(f"provider_status_{resp.status_code}")
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
