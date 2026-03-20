"""
自主检测服务模块
"""

from .config_service import (
    create_config,
    get_config,
    get_configs,
    update_config,
    delete_config,
    toggle_config,
    get_config_question_count,
    get_config_session_count,
)
from .question_service import (
    create_question,
    get_questions,
    get_question,
    update_question,
    delete_question,
    generate_questions,
)
from .session_service import (
    get_available_configs,
    start_session,
    get_session_questions,
    submit_answer,
    submit_session,
    get_session_result,
    get_config_sessions,
    get_config_statistics,
    allow_retest,
    batch_allow_retest,
)
from .basic_profile_service import (
    generate_basic_profile,
    get_basic_profile,
)
from .profile_service import (
    generate_profile,
    batch_generate_profiles,
    get_profiles,
    get_profile,
    delete_profile,
    get_my_profiles,
)

__all__ = [
    "create_config",
    "get_config",
    "get_configs",
    "update_config",
    "delete_config",
    "toggle_config",
    "get_config_question_count",
    "get_config_session_count",
    "create_question",
    "get_questions",
    "get_question",
    "update_question",
    "delete_question",
    "generate_questions",
    "get_available_configs",
    "start_session",
    "get_session_questions",
    "submit_answer",
    "submit_session",
    "get_session_result",
    "get_config_sessions",
    "get_config_statistics",
    "allow_retest",
    "batch_allow_retest",
    "generate_basic_profile",
    "get_basic_profile",
    "generate_profile",
    "batch_generate_profiles",
    "get_profiles",
    "get_profile",
    "delete_profile",
    "get_my_profiles",
]
