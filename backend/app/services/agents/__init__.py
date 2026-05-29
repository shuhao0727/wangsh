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
)

from .agent_usage import (
    create_agent_usage,
    get_agent_usage_list,
    get_agent_usage_statistics,
)

from .agent_conversations import (
    list_user_conversations,
    get_conversation_messages,
    get_conversation_messages_admin,
)

from .agent_analysis import (
    analyze_hot_questions,
    analyze_student_chains,
    analyze_task_sheet,
    stream_task_sheet_analysis,
)

from .agent_deep_analysis import (
    analyze_hot_questions_v2,
    analyze_student_chains_v2,
    summarize_hot_list_item,
    summarize_chain_list_item,
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
    "analyze_task_sheet",
    "stream_task_sheet_analysis",
    "analyze_hot_questions_v2",
    "analyze_student_chains_v2",
    "summarize_hot_list_item",
    "summarize_chain_list_item",
    # 模型发现服务
    "discover_models_service",
    "get_preset_models_service",
]
