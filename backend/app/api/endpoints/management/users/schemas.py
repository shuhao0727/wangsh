"""用户管理 API 的 Pydantic 模型。"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    """用户创建请求模型"""

    student_id: Optional[str] = Field(None, max_length=50, description="学号")
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="用户名")
    full_name: str = Field(..., max_length=100, description="全名")
    password: Optional[str] = Field(None, min_length=6, max_length=128, description="密码（仅教职工需要）")
    class_name: Optional[str] = Field(None, max_length=50, description="班级名称")
    study_year: Optional[str] = Field(None, max_length=10, description="学年")
    role_code: Optional[str] = Field("student", max_length=20, description="角色代码")
    is_active: Optional[bool] = Field(True, description="是否激活")


class UserUpdate(BaseModel):
    """用户更新请求模型"""

    student_id: Optional[str] = Field(None, max_length=50, description="学号")
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="用户名")
    full_name: Optional[str] = Field(None, max_length=100, description="全名")
    class_name: Optional[str] = Field(None, max_length=50, description="班级名称")
    study_year: Optional[str] = Field(None, max_length=10, description="学年")
    role_code: Optional[str] = Field(None, max_length=20, description="角色代码")
    is_active: Optional[bool] = Field(None, description="是否激活")


class UserResponse(BaseModel):
    """用户响应模型"""

    id: int
    student_id: Optional[str]
    username: Optional[str]
    full_name: str
    class_name: Optional[str]
    study_year: Optional[str]
    role_code: str
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """用户列表响应模型"""

    users: List[UserResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


class UserStatsResponse(BaseModel):
    """用户统计响应"""

    total: int = Field(..., description="用户总数（未删除）")
    active: int = Field(..., description="激活用户数")
    inactive: int = Field(..., description="禁用用户数")
    by_role: Dict[str, int] = Field(default_factory=dict, description="按角色分组计数")


class BatchDeleteRequest(BaseModel):
    """批量删除请求。"""

    user_ids: List[int] = Field(..., min_length=1, description="用户 ID 列表")


class ImportUserResponse(BaseModel):
    """单行导入响应模型"""

    row_number: int
    student_id: Optional[str] = None
    full_name: str
    status: str
    message: Optional[str] = None
    user_id: Optional[int] = None


class UserImportResult(BaseModel):
    """用户导入结果模型"""

    success: bool
    message: str
    total_rows: int
    imported_count: int = 0
    updated_count: int = 0
    error_count: int = 0
    errors: List[ImportUserResponse] = []
