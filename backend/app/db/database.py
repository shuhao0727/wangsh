"""
数据库配置和连接管理
SQLAlchemy 异步引擎和会话管理
"""

import logging
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)


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
    """
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """
    初始化数据库，创建表（仅在数据库完全为空时创建）
    
    注意：此函数仅在开发环境使用，作为初始建表手段。
    生产环境应完全使用 Alembic 迁移，这是唯一的数据库迁移手段。
    """
    if not settings.DEBUG:
        # 生产环境中不应自动创建表，必须使用 Alembic 迁移
        logger.warning("生产环境：禁止自动建表，请使用 Alembic 迁移")
        return
    
    async with engine.begin() as conn:
        from sqlalchemy import text
        from app.models import Base
        
        # 检查数据库是否完全为空（没有任何表）
        check_query = text("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        result = await conn.execute(check_query)
        total_table_count = result.scalar() or 0
        
        if total_table_count == 0:
            # 数据库完全为空，创建所有表（初始状态）
            logger.info("数据库为空，正在创建初始表结构...")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("初始表结构创建完成")
            logger.info("后续所有数据库变更请使用 Alembic 迁移")
            
            # 标记这是初始创建
            await conn.execute(text("COMMENT ON DATABASE wangsh_db IS '由 init_db() 初始创建，后续变更使用 Alembic 迁移'"))
        else:
            # 数据库中已经有表，不进行任何操作
            logger.info("检测到 %d 个表，跳过自动建表", total_table_count)
            logger.info("所有数据库变更请使用 Alembic 迁移")


async def close_db() -> None:
    """关闭数据库连接"""
    await engine.dispose()
