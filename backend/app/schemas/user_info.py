"""
用户信息类型定义
替代认证链路中的裸字典，提供类型安全
"""

from datetime import datetime
from typing import Optional
from typing_extensions import TypedDict, NotRequired


class UserInfo(TypedDict):
    """认证链路中传递的用户信息结构"""
    id: int
    role_code: str  # 'super_admin', 'admin', 'student', 'guest'
    username: NotRequired[Optional[str]]
    student_id: NotRequired[Optional[str]]
    full_name: str
    class_name: NotRequired[Optional[str]]
    study_year: NotRequired[Optional[str]]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RefreshTokenUserInfo(TypedDict):
    """刷新令牌验证返回的用户信息"""
    user_id: int
    role_code: str
    username: Optional[str]
    student_id: Optional[str]
    full_name: str
    class_name: NotRequired[Optional[str]]
    study_year: NotRequired[Optional[str]]
