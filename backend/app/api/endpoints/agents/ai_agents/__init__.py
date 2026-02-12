"""
AI智能体管理模块 API 端点
"""

from fastapi import APIRouter
from .ai_agents import router as ai_agents_router

router = APIRouter()
router.include_router(ai_agents_router, tags=["ai-agents"])

__all__ = ["router"]