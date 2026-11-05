"""智能体连接测试的辅助函数。

从 `ai_agent.py` 拆出，保持原有私有名称与行为；`ai_agent` 以旧名重新导出，
调用方无需改动。
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

from app.core.config import settings
from app.models.agents import AIAgent
from app.schemas.agents import COMMON_MODEL_PRESETS, AgentTestRequest, AgentTestResponse
from app.utils.agent_secrets import try_decrypt_api_key


@dataclass
class AgentProviderContext:
    api_endpoint: str
    flags: Dict[str, bool]
    is_dify: bool


def resolved_agent_api_key(agent: AIAgent, *, is_openrouter: bool) -> Optional[str]:
    value = try_decrypt_api_key(getattr(agent, "api_key_encrypted", None))
    if value:
        return value
    legacy = (getattr(agent, "api_key", None) or "").strip()
    if legacy:
        return legacy
    if is_openrouter and settings.OPENROUTER_API_KEY:
        return settings.OPENROUTER_API_KEY
    return None


def model_display_name(model_id: Optional[str]) -> Optional[str]:
    if not model_id:
        return model_id
    try:
        for models in COMMON_MODEL_PRESETS.values():
            for item in models:
                if item.id == model_id:
                    return item.name
    except Exception:
        pass
    name = model_id.replace("-", " ").replace("_", " ").title()
    return name.replace("Gpt", "GPT")


def build_provider_context(agent: AIAgent) -> AgentProviderContext:
    from app.services.agents.providers import detect_flags

    api_endpoint = (agent.api_endpoint or "").strip()
    return AgentProviderContext(
        api_endpoint=api_endpoint,
        flags=detect_flags(api_endpoint),
        is_dify=agent.agent_type == "dify",
    )


def build_test_headers(agent: AIAgent, ctx: AgentProviderContext) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    api_key = resolved_agent_api_key(agent, is_openrouter=ctx.flags["is_openrouter"])
    if api_key:
        if ctx.is_dify or not ctx.flags["is_anthropic"]:
            headers["Authorization"] = f"Bearer {api_key}"
        else:
            headers["x-api-key"] = api_key
    if ctx.flags["is_openrouter"]:
        headers["HTTP-Referer"] = "https://github.com/wangsh"
        headers["X-Title"] = "WangSh AI"
    return headers


def resolve_provider_type(flags: Dict[str, bool]) -> str:
    for key, label in (
        ("is_deepseek", "DeepSeek"),
        ("is_openai", "OpenAI"),
        ("is_anthropic", "Anthropic"),
        ("is_openrouter", "OpenRouter"),
        ("is_siliconflow", "SiliconFlow"),
        ("is_volcengine", "Volcengine"),
        ("is_aliyun", "Aliyun"),
    ):
        if flags.get(key):
            return label
    return "AI服务"


def resolve_test_endpoint(ctx: AgentProviderContext) -> Optional[str]:
    from app.services.agents.providers import models_endpoint

    if ctx.is_dify:
        return "/v1/chat/completions"
    return models_endpoint(ctx.flags)


def join_api_url(base: str, path: str) -> str:
    base_clean = (base or "").strip().rstrip("/")
    if base_clean.endswith("/chat/completions"):
        base_clean = base_clean[: -len("/chat/completions")]
    path_clean = path if path.startswith("/") else f"/{path}"
    for prefix in ("/v1", "/api/v1", "/api/v3"):
        if base_clean.endswith(prefix) and path_clean.startswith(f"{prefix}/"):
            path_clean = path_clean[len(prefix):]
    return f"{base_clean}{path_clean}"


def elapsed_ms(start_time: float, time_module) -> float:
    return (time_module.time() - start_time) * 1000


def display_test_message(test_message: str) -> str:
    return test_message[:50] + "..." if len(test_message) > 50 else test_message


async def perform_chat_test(
    client,
    agent: AIAgent,
    test_message: str,
    headers: Dict[str, str],
    ctx: AgentProviderContext,
) -> str:
    from app.services.agents.providers import chat_completions_endpoint

    try:
        payload = {
            "model": agent.model_name,
            "messages": [{"role": "user", "content": test_message}],
            "max_tokens": 10,
        }
        response = await client.post(
            chat_completions_endpoint(ctx.api_endpoint, ctx.flags),
            headers=headers,
            json=payload,
            timeout=30.0,
        )
        if response.status_code == 200:
            return f"\n🧠 聊天测试: ✅ 成功 (使用模型: {model_display_name(agent.model_name)})"
        return f"\n🧠 聊天测试: ⚠️ 模型调用失败 (状态码: {response.status_code})"
    except Exception as error:
        return f"\n🧠 聊天测试: ⚠️ 模型调用错误 ({str(error)[:50]})"


def redirect_rejected_message(status_code: int) -> str:
    """智能体出站一律不跟随重定向：出站硬校验只覆盖首个 URL，跟随 3xx 会绕过 SSRF 防护。"""
    return f"上游返回重定向（HTTP {status_code}），已拒绝跟随，请填写最终地址"


def _status_hint(status_code: int) -> str:
    if 300 <= status_code < 400:
        return f"\n↪️ 错误原因: {redirect_rejected_message(status_code)}"
    return {
        401: "\n🔒 错误原因: 认证失败 (API Key 无效或过期)",
        403: "\n🚫 错误原因: 拒绝访问 (权限不足)",
        404: "\n🔍 错误原因: 端点不存在 (请检查URL)",
        429: "\n⏳ 错误原因: 请求过多 (触发限流)",
    }.get(status_code, "")


async def test_models_endpoint(
    client,
    agent: AIAgent,
    test_request: AgentTestRequest,
    headers: Dict[str, str],
    ctx: AgentProviderContext,
    start_time: float,
    time_module,
) -> AgentTestResponse:
    response = await client.get(
        join_api_url(ctx.api_endpoint, resolve_test_endpoint(ctx) or ""),
        headers=headers,
    )
    response_time = elapsed_ms(start_time, time_module)
    if response.status_code == 200:
        models_count = len(response.json().get("data", []))
        chat_result = ""
        if agent.model_name and test_request.test_message:
            chat_result = await perform_chat_test(
                client=client,
                agent=agent,
                test_message=test_request.test_message,
                headers=headers,
                ctx=ctx,
            )
        return AgentTestResponse(
            success=True,
            message=(
                f"✅ {resolve_provider_type(ctx.flags)} 智能体 '{agent.name}' 测试成功\n\n"
                f"📋 类型: {agent.agent_type}\n🔗 端点: {ctx.api_endpoint}\n"
                f"📊 发现模型: {models_count} 个{chat_result}\n"
                f"💬 测试消息: {display_test_message(test_request.test_message)}"
            ),
            response_time=response_time,
            timestamp=datetime.now(),
        )

    # 3xx 不回显响应体：重定向响应只用于提示改填最终地址。
    body_preview = "" if 300 <= response.status_code < 400 else f"\n📄 响应: {response.text[:500]}"
    error_message = (
        f"❌ API连接测试失败\n\n📋 类型: {agent.agent_type}\n"
        f"🔗 端点: {ctx.api_endpoint}\n🛑 状态码: {response.status_code}"
        f"{_status_hint(response.status_code)}{body_preview}"
    )
    return AgentTestResponse(
        success=False,
        message=error_message,
        response_time=response_time,
        timestamp=datetime.now(),
    )


async def test_basic_endpoint(
    client,
    agent: AIAgent,
    test_request: AgentTestRequest,
    headers: Dict[str, str],
    ctx: AgentProviderContext,
    start_time: float,
    time_module,
) -> AgentTestResponse:
    try:
        response = await client.get(ctx.api_endpoint, headers=headers, timeout=30.0)
        response_time = elapsed_ms(start_time, time_module)
        if response.status_code < 300:
            return AgentTestResponse(
                success=True,
                message=(
                    f"✅ 智能体 '{agent.name}' 基本连接测试成功\n\n"
                    f"📋 类型: {agent.agent_type}\n🔗 端点: {ctx.api_endpoint}\n"
                    f"💬 测试消息: {display_test_message(test_request.test_message)}"
                ),
                response_time=response_time,
                timestamp=datetime.now(),
            )
        return AgentTestResponse(
            success=False,
            message=(
                f"❌ 基本连接测试失败\n\n📋 类型: {agent.agent_type}\n"
                f"🔗 端点: {ctx.api_endpoint}\n🛑 状态码: {response.status_code}"
            ),
            response_time=response_time,
            timestamp=datetime.now(),
        )
    except Exception as error:
        return AgentTestResponse(
            success=False,
            message=(
                f"❌ 连接测试异常\n\n📋 类型: {agent.agent_type}\n"
                f"🔗 端点: {ctx.api_endpoint}\n🛑 错误: {str(error)[:100]}"
            ),
            response_time=elapsed_ms(start_time, time_module),
            timestamp=datetime.now(),
        )
