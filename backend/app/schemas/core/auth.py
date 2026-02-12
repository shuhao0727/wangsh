"""
认证相关的 Pydantic 模型
用于请求/响应的数据验证
符合数据库设计文档v3.0
"""

from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, Field, validator


class Token(BaseModel):
    """令牌响应模型"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 秒
    role_code: str
    full_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class TokenData(BaseModel):
    """令牌数据模型"""
    username: Optional[str] = None
    student_id: Optional[str] = None
    user_id: Optional[str] = None
    role_code: Optional[str] = None


class UserBase(BaseModel):
    """用户基础模型"""
    full_name: str = Field(..., max_length=100, description="全名")
    
    class Config:
        from_attributes = True


class UserCreate(UserBase):
    """用户创建模型 - 支持管理员和学生创建"""
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="用户名（管理员使用）")
    password: Optional[str] = Field(None, min_length=8, max_length=128, description="密码（管理员使用）")
    student_id: Optional[str] = Field(None, max_length=50, description="学号（学生使用）")
    role_code: str = Field("student", max_length=20, description="角色代码")
    
    @validator("password")
    def validate_password_strength(cls, v, values):
        """验证密码强度"""
        if v and len(v) < 8:
            raise ValueError("密码长度至少为8个字符")
        
        # 如果创建管理员用户，必须有密码
        role_code = values.get("role_code")
        if role_code in ["admin", "super_admin"] and not v:
            raise ValueError("管理员用户必须设置密码")
        return v
    
    @validator("username")
    def validate_username(cls, v, values):
        """验证用户名"""
        role_code = values.get("role_code")
        if role_code in ["admin", "super_admin"] and not v:
            raise ValueError("管理员用户必须设置用户名")
        return v


class UserLogin(BaseModel):
    """用户登录模型"""
    username: str = Field(..., description="用户名/学号/姓名")
    password: str = Field(..., description="密码/学号")


class UserUpdate(BaseModel):
    """用户更新模型"""
    full_name: Optional[str] = Field(None, max_length=100)
    class_name: Optional[str] = Field(None, max_length=50)
    study_year: Optional[str] = Field(None, max_length=10)
    avatar_url: Optional[str] = Field(None, max_length=255)
    bio: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class UserInDB(UserBase):
    """数据库用户模型"""
    id: int
    username: Optional[str]
    student_id: Optional[str]
    class_name: Optional[str]
    study_year: Optional[str]
    role_code: str
    is_active: bool = True
    is_deleted: bool = False
    avatar_url: Optional[str]
    bio: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """用户响应模型"""
    id: int
    username: Optional[str]
    student_id: Optional[str]
    full_name: str
    class_name: Optional[str]
    study_year: Optional[str]
    role_code: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class StudentLoginResponse(BaseModel):
    """学生登录响应模型"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role_code: str = "student"
    student_id: str
    full_name: str
    class_name: Optional[str]
    study_year: Optional[str]


class AdminLoginResponse(BaseModel):
    """管理员登录响应模型"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role_code: str
    username: str
    full_name: str


class PasswordResetRequest(BaseModel):
    """密码重置请求模型"""
    identifier: str = Field(..., description="用户名或邮箱")


class PasswordReset(BaseModel):
    """密码重置模型"""
    token: str = Field(..., description="重置令牌")
    new_password: str = Field(..., min_length=8, max_length=128, description="新密码")
    
    @validator("new_password")
    def validate_password_strength(cls, v):
        """验证密码强度"""
        if len(v) < 8:
            raise ValueError("密码长度至少为8个字符")
        return v
