"""
数据库辅助工具

统一处理常见的数据库查询模式，如 404 检查。
"""

from typing import Optional, Type, TypeVar, Any

from fastapi import HTTPException
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


async def get_or_404(
    db: AsyncSession,
    stmt: Select[tuple[T]],
    *,
    detail: str = "资源不存在",
    status_code: int = 404,
) -> T:
    """
    执行查询并在结果为 None 时抛出 404

    使用示例:
        stmt = select(User).where(User.id == user_id)
        user = await get_or_404(db, stmt, detail="用户不存在")

    Args:
        db: 数据库会话
        stmt: SQLAlchemy select 语句
        detail: 404 错误信息
        status_code: HTTP 状态码，默认 404

    Returns:
        查询结果对象

    Raises:
        HTTPException: 当查询结果为 None 时
    """
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status_code, detail=detail)
    return obj


async def get_or_none(
    db: AsyncSession,
    stmt: Select[tuple[T]],
) -> Optional[T]:
    """
    执行查询并返回结果或 None（不抛出异常）

    使用示例:
        stmt = select(User).where(User.id == user_id)
        user = await get_or_none(db, stmt)
        if user is None:
            # 自定义处理逻辑
            pass

    Args:
        db: 数据库会话
        stmt: SQLAlchemy select 语句

    Returns:
        查询结果对象或 None
    """
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
