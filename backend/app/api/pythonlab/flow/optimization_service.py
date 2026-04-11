"""
Flow 优化服务模块

包含优化日志管理功能。
"""

import json
from typing import Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.agents.optimization import OptimizeLog

from .constants import OPTIMIZATION_STATUS, LOG_TYPES
from .exceptions import NotFoundError


async def apply_optimization_internal(
    log_id: int,
    db: AsyncSession
) -> Dict[str, Any]:
    """内部应用优化函数"""
    query = select(OptimizeLog).where(OptimizeLog.id == log_id)
    result = await db.execute(query)
    log_entry = result.scalar_one_or_none()

    if not log_entry:
        raise NotFoundError("Log not found", resource_type="optimization_log")

    log_entry.status = OPTIMIZATION_STATUS["APPLIED"]
    await db.commit()
    return {"success": True}


async def rollback_optimization_internal(
    log_id: int,
    db: AsyncSession
) -> Dict[str, Any]:
    """内部回滚优化函数"""
    query = select(OptimizeLog).where(OptimizeLog.id == log_id)
    result = await db.execute(query)
    log_entry = result.scalar_one_or_none()

    if not log_entry:
        raise NotFoundError("Log not found", resource_type="optimization_log")

    content = log_entry.original_content
    if log_entry.type == LOG_TYPES["FLOW"]:
        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            pass

    return {"original_content": content, "type": log_entry.type}