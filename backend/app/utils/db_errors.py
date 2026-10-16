"""
数据库错误处理工具

统一处理数据库提交时的 IntegrityError 和其他常见异常。
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.errors import safe_error_detail


@asynccontextmanager
async def handle_db_commit(
    db: AsyncSession,
    *,
    integrity_error_detail: str = "数据库约束冲突，请检查数据唯一性",
    integrity_error_status: int = 409,
    error_detail: Optional[str] = None,
) -> AsyncGenerator[None, None]:
    """
    统一处理数据库提交的上下文管理器

    使用示例:
        async with handle_db_commit(db, integrity_error_detail="学生已存在"):
            db.add(new_obj)
            await db.commit()

        async with handle_db_commit(db, error_detail="保存章节失败"):
            await db.commit()

    Args:
        db: 数据库会话
        integrity_error_detail: IntegrityError 错误信息
        integrity_error_status: IntegrityError 状态码
        error_detail: 非 IntegrityError 的 SQLAlchemyError 返回给客户端的业务
            前缀；省略时退化为通用文案。异常细节仍经 safe_error_detail 脱敏，
            避免把 SQL 结构泄露给调用方。

    Raises:
        HTTPException: IntegrityError 或其他数据库错误时
    """
    try:
        yield
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=integrity_error_status,
            detail=integrity_error_detail,
        )
    except SQLAlchemyError as e:
        await db.rollback()
        detail = error_detail or "数据库操作失败"
        raise HTTPException(
            status_code=500,
            detail=safe_error_detail(detail, e),
        )
    except Exception:
        await db.rollback()
        raise
