"""
Alembic迁移环境配置文件
支持异步SQLAlchemy和项目配置
"""

import asyncio
from logging.config import fileConfig
import os
import sys

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# 将项目根目录添加到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import Base
from app.core.config import settings

import app.models

# 这是Alembic Config对象，提供对.ini文件值的访问
config = context.config

# 从.ini文件设置Python日志记录
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 设置目标元数据以支持自动生成
target_metadata = Base.metadata

# 从项目配置获取数据库URL，覆盖alembic.ini中的设置
def get_database_url():
    """从项目配置获取数据库URL"""
    if not settings.DATABASE_URL:
        raise ValueError("DATABASE_URL未配置。请检查.env文件中的数据库配置。")
    return str(settings.DATABASE_URL)

def run_migrations_offline() -> None:
    """在'离线'模式下运行迁移"""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """在'在线'模式下运行迁移（异步）"""
    # 从alembic.ini获取配置
    alembic_config = config.get_section(config.config_ini_section, {})
    
    # 使用项目配置的数据库URL覆盖
    alembic_config['sqlalchemy.url'] = get_database_url()
    
    # 创建异步引擎
    connectable = async_engine_from_config(
        alembic_config,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    
    await connectable.dispose()

def do_run_migrations(connection):
    """同步运行迁移的函数"""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    # 异步运行迁移
    asyncio.run(run_migrations_online())
