"""
Group Discussion 模块 - 向后兼容层

此文件已重构为模块化结构。所有函数已迁移到相应的子模块中。
此文件仅作为向后兼容层存在，实际实现请参考新的模块结构。

新模块结构：
- core.py: 工具函数和核心业务逻辑
- prompts.py: 提示词生成函数
- session_service.py: 会话管理函数
- analysis_service.py: 分析相关函数
- cross_system_service.py: 跨系统数据拼接（预留）

为了保持向后兼容，此文件重新导出所有函数。
"""

# 重新导出所有函数，保持向后兼容
from .group_discussion import (
    # 核心函数
    _gd_key,
    _gd_metric_incr,
    _normalize_group_no,
    _normalize_class_name,
    _normalize_group_name,
    _display_name,
    resolve_target_class_name,
    get_or_create_today_session,
    ensure_session_view_access,
    list_today_groups,
    set_group_name,
    enforce_join_lock,
    set_join_lock,
    list_messages,
    send_message,
    mute_member,
    unmute_member,

    # 管理员函数
    admin_list_sessions,
    admin_delete_session,
    admin_delete_sessions,
    admin_list_analyses,
    admin_list_messages,
    admin_add_member,
    admin_remove_member,
    admin_list_members,
    list_classes,

    # 提示词函数
    _default_prompt,
    _default_compare_prompt,
    _student_profile_prompt,
    _cross_system_prompt,

    # 分析函数
    admin_analyze_session,
    admin_compare_analyze_sessions,
    admin_student_profile_analysis,
    admin_cross_system_analysis,
)