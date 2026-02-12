"""
基础模型类
定义所有模型的公共属性和方法
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Integer, event, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncAttrs


class Base(AsyncAttrs, DeclarativeBase):
    """所有模型的基础类，提供公共字段和方法"""
    
    __table_args__ = {'comment': '基础表'}
    
    # 公共字段
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        index=True,
        comment='主键ID'
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
        server_default=func.now(),  # 使用数据库服务器的当前时间
        comment='创建时间'
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
        onupdate=datetime.now,
        server_default=func.now(),
        comment='更新时间'
    )
    
    def __repr__(self) -> str:
        """对象表示"""
        return f"<{self.__class__.__name__}(id={self.id})>"
    
    def to_dict(self) -> dict:
        """将模型实例转换为字典"""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }


# 通用事件监听器 - 在更新时自动更新updated_at字段
@event.listens_for(Base, 'before_update', propagate=True)
def receive_before_update(mapper, connection, target):
    """在更新前自动设置updated_at为当前时间"""
    # 检查目标对象是否有updated_at属性（可能被某些模型排除）
    if hasattr(target, 'updated_at'):
        target.updated_at = datetime.now()
