"""
共享 LLM agent 调用辅助函数

提炼 agent_analysis.py 中的 _call_llm_analysis，使其可被多个 agent 复用。
"""

from __future__ import annotations

import json
import re
from typing import Any, AsyncGenerator, Dict, Optional

import httpx
from loguru import logger


async def call_llm(
    *,
    prompt: str,
    api_endpoint: str,
    api_key: str,
    agent_type: str = "",
    agent_model: str = "",
    response_format: str = "json",
    timeout: float = 180.0,
) -> Dict[str, Any]:
    """调用 LLM（支持 Dify / OpenAI 兼容 / DeepSeek 等），返回解析后的 dict。

    若 response_format == "json" 则自动从回复中提取 JSON 块（支持修补尾部截断）。
    """
    if not api_key or not prompt.strip():
        return {}

    try:
        answer: str = ""
        if agent_type == "dify":
            answer = await _call_dify(api_endpoint, api_key, prompt, timeout)
        else:
            answer = await _call_openai_compatible(api_endpoint, api_key, prompt, agent_model, timeout, agent_type)

        if response_format == "json":
            return _extract_json(answer)
        return {"raw": answer}
    except Exception:
        logger.exception("LLM 调用失败")
        return {}


async def call_llm_stream(
    *,
    prompt: str,
    api_endpoint: str,
    api_key: str,
    agent_type: str = "",
    agent_model: str = "",
    timeout: float = 180.0,
) -> AsyncGenerator[str, None]:
    """流式调用 LLM，yield 文本块。"""
    if not api_key or not prompt.strip():
        return

    try:
        if agent_type == "dify":
            async for chunk in _call_dify_stream(api_endpoint, api_key, prompt, timeout):
                yield chunk
        else:
            async for chunk in _call_openai_compatible_stream(api_endpoint, api_key, prompt, agent_model, timeout, agent_type):
                yield chunk
    except Exception:
        logger.exception("LLM 流式调用失败")


# ── helpers ────────────────────────────────────────


async def _call_dify(endpoint: str, api_key: str, prompt: str, timeout: float) -> str:
    base = endpoint.rstrip("/")
    url = f"{base}/v1/chat-messages" if "/v1" not in base else f"{base}/chat-messages"
    payload = {"query": prompt, "user": "analysis_agent", "response_mode": "blocking", "inputs": {}}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            body = resp.json()
            return body.get("answer", "")
        logger.error(f"Dify LLM failed: {resp.status_code}")
        return ""


def _is_anthropic_endpoint(base: str, agent_type: str = "") -> bool:
    lowered = base.lower()
    return (
        agent_type.lower() == "anthropic"
        or "api.anthropic.com" in lowered
        or lowered.endswith("/anthropic")
        or "/anthropic/" in lowered
    )


def _anthropic_messages_url(base: str) -> str:
    if base.endswith("/v1/messages"):
        return base
    if base.endswith("/v1"):
        return f"{base}/messages"
    return f"{base}/v1/messages"


async def _call_openai_compatible(
    endpoint: str,
    api_key: str,
    prompt: str,
    model: str,
    timeout: float,
    agent_type: str = "",
) -> str:
    base = endpoint.rstrip("/")

    is_anthropic = _is_anthropic_endpoint(base, agent_type)

    if is_anthropic:
        url = _anthropic_messages_url(base)
        payload: Dict[str, Any] = {
            "model": model or "claude-3-5-sonnet-latest",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    else:
        # OpenAI-compatible
        if "/v1" in base:
            url = f"{base}/chat/completions"
        else:
            url = f"{base}/v1/chat/completions"
        payload: Dict[str, Any] = {
            "model": model or "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
        if "deepseek" in (model or "").lower() or "gpt" in (model or "").lower():
            payload["response_format"] = {"type": "json_object"}
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            body = resp.json()
            if is_anthropic:
                texts = body.get("content", [])
                return "".join(t.get("text", "") for t in texts if isinstance(t, dict))
            return body.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.error(f"LLM failed ({resp.status_code}): {resp.text[:300]}")
        return ""


async def _call_dify_stream(endpoint: str, api_key: str, prompt: str, timeout: float) -> AsyncGenerator[str, None]:
    base = endpoint.rstrip("/")
    url = f"{base}/v1/chat-messages" if "/v1" not in base else f"{base}/chat-messages"
    payload = {"query": prompt, "user": "analysis_agent", "response_mode": "streaming", "inputs": {}}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            if resp.status_code != 200:
                logger.error(f"Dify stream failed: {resp.status_code}")
                return
            async for line in resp.aiter_lines():
                if line.startswith("data:"):
                    try:
                        data = json.loads(line[5:].strip())
                        if data.get("event") == "message" and data.get("answer"):
                            yield data["answer"]
                    except Exception:
                        pass


async def _call_openai_compatible_stream(
    endpoint: str,
    api_key: str,
    prompt: str,
    model: str,
    timeout: float,
    agent_type: str = "",
) -> AsyncGenerator[str, None]:
    base = endpoint.rstrip("/")
    is_anthropic = _is_anthropic_endpoint(base, agent_type)
    if is_anthropic:
        url = _anthropic_messages_url(base)
        payload: Dict[str, Any] = {
            "model": model or "claude-3-5-sonnet-latest",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
        }
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    else:
        if "/v1" in base:
            url = f"{base}/chat/completions"
        else:
            url = f"{base}/v1/chat/completions"
        payload = {
            "model": model or "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            if resp.status_code != 200:
                logger.error(f"LLM stream failed: {resp.status_code}")
                return
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        return
                    try:
                        data = json.loads(data_str)
                        if is_anthropic:
                            if data.get("type") == "content_block_delta":
                                text = (data.get("delta") or {}).get("text", "")
                                if text:
                                    yield text
                            continue
                        delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        pass


def _extract_json(text: str) -> Dict[str, Any]:
    """从 LLM 回复中提取 JSON 块，兼容 markdown 代码块包裹和尾部截断。"""
    # 尝试直接解析
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 去掉 markdown 代码块标记
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text.strip(), flags=re.MULTILINE)

    # 找 JSON 对象边界
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        candidate = text[start:end]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 尝试修补尾部截断：补闭合括号
    candidate = text[start:] if start >= 0 else text
    open_braces = candidate.count("{") - candidate.count("}")
    open_brackets = candidate.count("[") - candidate.count("]")
    if open_braces > 0 or open_brackets > 0:
        candidate += "]" * max(0, open_brackets) + "}" * max(0, open_braces)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    logger.warning("无法从 LLM 回复中提取有效 JSON，返回空 dict")
    return {}
