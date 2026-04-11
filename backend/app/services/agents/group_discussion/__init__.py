"""
Group Discussion 模块 - 兼容导出文件

此文件用于保持向后兼容，将所有函数从新模块重新导出。
实际实现已拆分到各个子模块中。
"""

# 导入所有函数，保持向后兼容
from .core import (
    _gd_key,
    _gd_metric_incr,
    _normalize_group_no,
    _normalize_class_name,
    _normalize_group_name,
    _display_name,
    resolve_target_class_name,
    ensure_session_view_access,
    admin_list_sessions,
    admin_delete_session,
    admin_delete_sessions,
    admin_list_analyses,
    admin_list_messages,
    admin_add_member,
    admin_remove_member,
    admin_list_members,
    list_classes,
)

from .session_service import (
    get_or_create_today_session,
    list_today_groups,
    set_group_name,
    enforce_join_lock,
    set_join_lock,
    list_messages,
    send_message,
    mute_member,
    unmute_member,
)

from .prompts import (
    _default_prompt,
    _default_compare_prompt,
    _student_profile_prompt,
    _cross_system_prompt,
)

from .analysis_service import (
    admin_analyze_session,
    admin_compare_analyze_sessions,
    admin_student_profile_analysis,
    admin_cross_system_analysis,
)

# 跨系统服务（当前为空，为未来扩展预留）
from .cross_system_service import *

# 导出所有函数
__all__ = [
    # 核心函数
    "_gd_key",
    "_gd_metric_incr",
    "_normalize_group_no",
    "_normalize_class_name",
    "_normalize_group_name",
    "_display_name",
    "resolve_target_class_name",
    "get_or_create_today_session",
    "ensure_session_view_access",
    "list_today_groups",
    "set_group_name",
    "enforce_join_lock",
    "set_join_lock",
    "list_messages",
    "send_message",
    "mute_member",
    "unmute_member",

    # 管理员函数
    "admin_list_sessions",
    "admin_delete_session",
    "admin_delete_sessions",
    "admin_list_analyses",
    "admin_list_messages",
    "admin_add_member",
    "admin_remove_member",
    "admin_list_members",
    "list_classes",

    # 提示词函数
    "_default_prompt",
    "_default_compare_prompt",
    "_student_profile_prompt",
    "_cross_system_prompt",

    # 分析函数
    "admin_analyze_session",
    "admin_compare_analyze_sessions",
    "admin_student_profile_analysis",
    "admin_cross_system_analysis",
]