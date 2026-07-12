"""用户管理角色策略。"""

from typing import Any, Dict, List

from fastapi import HTTPException, status

from app.models import User

ADMIN_MANAGEABLE_ROLES = {"student", "teacher"}
PRIVILEGED_ROLES = {"admin", "super_admin"}


def is_plain_admin(current_user: Dict[str, Any]) -> bool:
    return current_user.get("role_code") == "admin"


def assert_role_assignment_allowed(
    current_user: Dict[str, Any],
    role_code: str,
) -> None:
    if is_plain_admin(current_user) and role_code not in ADMIN_MANAGEABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员只能设置学生或教师角色",
        )


def assert_users_deletable(
    current_user: Dict[str, Any],
    users: List[User],
    *,
    detail: str = "无权删除管理员或超级管理员",
) -> None:
    if is_plain_admin(current_user) and any(
        user.role_code in PRIVILEGED_ROLES for user in users
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


def assert_users_mutable(
    current_user: Dict[str, Any],
    users: List[User],
) -> None:
    if is_plain_admin(current_user) and any(
        user.role_code in PRIVILEGED_ROLES for user in users
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权修改管理员或超级管理员",
        )
