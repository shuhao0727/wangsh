"""AI Agent 对话的共享准备逻辑"""
from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.agents.ai_agent import get_agent
from app.services.agents.providers import (
    get_provider,
    resolve_credentials,
    build_messages,
)


@dataclass(frozen=True)
class PreparedChatContext:
    """预处理的对话上下文"""
    agent: Any
    provider: Any
    circuit_key: str
    chat_messages: list[dict]
    model: str
    api_endpoint: str
    api_key: str


async def prepare_chat_context(
    db: AsyncSession,
    agent_id: int,
    message: str,
    history: Optional[list] = None,
    *,
    use_cache: bool = True,
) -> PreparedChatContext:
    """统一的对话准备逻辑

    Args:
        db: 数据库会话
        agent_id: Agent ID
        message: 用户消息
        history: 对话历史
        use_cache: 是否使用缓存（chat_blocking 传 False）

    Returns:
        PreparedChatContext: 准备好的上下文

    Raises:
        ValueError: Agent 无效、不活跃或配置错误
    """
    agent = await get_agent(db, agent_id, use_cache=use_cache)
    if not agent:
        raise ValueError(f"智能体(id={agent_id})不存在或已删除")
    if not getattr(agent, "is_active", True):
        raise ValueError(f"agent_inactive: 智能体(id={agent_id})已停用")

    try:
        api_endpoint, api_key = resolve_credentials(agent)
        provider = get_provider(agent.agent_type, api_endpoint, api_key)
    except Exception as e:
        # 配置或 provider 创建错误，转为 ValueError 以便上层统一处理
        raise ValueError(f"智能体配置错误: {str(e)}") from e

    provider_name = type(provider).__name__
    circuit_key = f"{provider_name}:agent:{agent_id}"
    chat_messages = build_messages(agent, message, history or [])
    model = agent.model_name or ""

    return PreparedChatContext(
        agent=agent,
        provider=provider,
        circuit_key=circuit_key,
        chat_messages=chat_messages,
        model=model,
        api_endpoint=api_endpoint,
        api_key=api_key,
    )
