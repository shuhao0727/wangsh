"""
统一用户模型定义 - 使用 sys_ 前缀
支持管理员、学生等多种用户类型
与数据库设计文档v3.0保持一致
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from sqlalchemy.sql import expression
from app.db.database import Base


class User(Base):
    """统一用户表模型 - sys_users（v3.0增强版）"""
    __tablename__ = "sys_users"

    # 主键
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 登录凭证（超级管理员和管理员使用）
    username = Column(String(50), unique=True, index=True, nullable=True, comment="用户名（管理员使用）")
    hashed_password = Column(String(255), nullable=True, comment="加密密码（管理员使用）")
    
    # 基本信息
    full_name = Column(String(100), nullable=False, comment="全名（学生姓名）")
    
    # 学生专用字段（仅学生用户使用）
    student_id = Column(String(50), unique=True, index=True, nullable=True, comment="学号（学生使用）")
    class_name = Column(String(50), nullable=True, comment="班级名称")
    study_year = Column(String(10), nullable=True, comment="学年（如'2025'）")
    
    # 角色标识
    role_code = Column(String(20), nullable=False, default='student', server_default='student', comment="角色代码: super_admin, admin, student, guest")
    
    # 状态
    is_active = Column(Boolean, default=True, server_default=expression.true(), comment="是否激活")
    is_deleted = Column(Boolean, default=False, server_default=expression.false(), comment="是否已删除（软删除）")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    
    # 可选个人信息（根据数据库设计文档v3.0，不包含avatar_url和bio字段）
    
    # 关系定义 - 注意：文章表已改为 wz_articles
    articles = relationship("Article", back_populates="author", lazy="select")
    
    def __repr__(self):
        return f"<User(id={self.id}, role_code='{self.role_code}', username='{self.username}', student_id='{self.student_id}')>"
