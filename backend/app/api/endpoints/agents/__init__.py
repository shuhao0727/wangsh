"""
智能体管理 API 端点模块
"""

from .ai_agents import router as ai_agents_router
from .model_discovery import router as model_discovery_router

__all__ = [
    "ai_agents_router",
    "model_discovery_router",
]