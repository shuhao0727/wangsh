"""
AI智能体服务模块
"""

from .ai_agent import (
    create_agent,
    get_agent,
    get_agents,
    update_agent,
    delete_agent,
    test_agent,
    get_agent_statistics,
    get_active_agents,
    create_agent_usage,
    get_agent_usage_list,
    get_agent_usage_statistics,
    list_user_conversations,
    get_conversation_messages,
    get_conversation_messages_admin,
    analyze_hot_questions,
    analyze_student_chains,
)

from .model_discovery import (
    discover_models_service,
    get_preset_models_service,
)

__all__ = [
    "create_agent",
    "get_agent",
    "get_agents",
    "update_agent",
    "delete_agent",
    "test_agent",
    "get_agent_statistics",
    "get_active_agents",
    "create_agent_usage",
    "get_agent_usage_list",
    "get_agent_usage_statistics",
    "list_user_conversations",
    "get_conversation_messages",
    "get_conversation_messages_admin",
    "analyze_hot_questions",
    "analyze_student_chains",
    # 模型发现服务
    "discover_models_service",
    "get_preset_models_service",
]
