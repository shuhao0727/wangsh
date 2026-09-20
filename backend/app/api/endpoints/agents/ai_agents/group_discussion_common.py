"""小组讨论公共定义：常量与权限辅助函数。

本模块只放被多个路由模块共享的常量与辅助逻辑，避免各路由文件重复定义。
注意：`_enforce_frontend_visibility` 等函数会被测试在 `group_discussion`
模块对象上 monkeypatch，因此 `group_discussion.py` 必须通过模块级 import
继续持有这些名字（路由函数体内的调用走模块全局查找才能被 patch 命中）。
"""
from typing import Any, Dict

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.agents.group_discussion_public_config import GroupDiscussionPublicConfigService

# 公共配置变更的 Redis 发布订阅频道
PUBLIC_CONFIG_CHANNEL = "znt:group_discussion:public_config"


def _require_discussion_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """校验当前用户具备访问小组讨论的角色。"""
    if user.get("role_code") not in ["student", "admin", "super_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问讨论组")
    return user


async def _enforce_frontend_visibility(db: AsyncSession, user: Dict[str, Any]) -> None:
    """学生端开关校验：小组讨论关闭时拒绝访问。"""
    role = str(user.get("role_code") or "")
    if role != "student":
        return
    enabled = await GroupDiscussionPublicConfigService.get_enabled(db)
    if not enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="小组讨论暂时关闭")
