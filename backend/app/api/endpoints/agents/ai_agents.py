"""
AI智能体管理模块 API 端点 - 代理模块
由于原目录名包含连字符导致导入问题，现目录已重命名为 ai_agents
导入 ai_agents 包中的 router（来自 __init__.py）
"""

from .ai_agents import router

__all__ = ["router"]