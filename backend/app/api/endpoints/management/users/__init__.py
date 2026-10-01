"""
用户管理模块 API 端点
"""

from fastapi import APIRouter
from .users import router as users_router
from .privacy import router as privacy_router

# 创建主路由
router = APIRouter()

# 注册子路由
router.include_router(users_router)
router.include_router(privacy_router, prefix="/privacy", tags=["user-privacy"])

__all__ = ["router"]