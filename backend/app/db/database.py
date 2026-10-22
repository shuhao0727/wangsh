"""
数据库配置和连接管理
SQLAlchemy 异步引擎和会话管理
"""

from typing import AsyncGenerator
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy 基类"""
    pass


# 确保 DATABASE_URL 不为 None
if not settings.DATABASE_URL:
    raise ValueError("DATABASE_URL 未配置。请检查 .env 文件中的数据库配置。")

# 创建异步引擎
engine = create_async_engine(
    str(settings.DATABASE_URL),  # 确保是字符串类型
    echo=settings.SQLALCHEMY_ECHO,
    pool_size=settings.POSTGRES_MAX_CONNECTIONS,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
    pool_pre_ping=True,
    pool_recycle=3600,
    # 添加编码配置，确保支持中文
    connect_args={
        "server_settings": {
            "client_encoding": "utf8",
            "statement_timeout": str(settings.POSTGRES_STATEMENT_TIMEOUT),
        }
    },
)

# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取数据库会话的依赖函数
    在 FastAPI 依赖注入中使用

    请求结束时回滚任何未提交事务。认证守卫等只读查询会隐式开启事务，
    而 SSE 长连接会持续数分钟到数小时，若不收尾会长期停留在
    `idle in transaction`，占用连接池并阻止 vacuum 回收。
    写端点均已显式 commit，此处 rollback 对已提交事务是空操作。
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            if session.in_transaction():
                try:
                    await session.rollback()
                except Exception:
                    # 连接已失效时关闭异常不应覆盖请求本身的错误。
                    logger.debug("请求结束回滚未提交事务失败，交由连接池丢弃连接")


