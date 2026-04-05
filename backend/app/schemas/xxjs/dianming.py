"""
信息技术 - 点名系统 Pydantic Schemas
"""

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class DianmingClass(BaseModel):
    """班级聚合视图"""
    year: str
    class_name: str
    count: int


class DianmingStudentBase(BaseModel):
    """学生基础字段"""
    year: str
    class_name: str
    student_name: str
    student_no: Optional[str] = None


class DianmingStudentCreate(DianmingStudentBase):
    """创建学生（预留扩展）"""
    pass


class DianmingStudent(DianmingStudentBase):
    """学生完整响应"""
    id: int
    created_at: Any
    model_config = ConfigDict(from_attributes=True)


class DianmingImportRequest(BaseModel):
    """批量导入请求"""
    year: str
    class_name: str
    names_text: str  # 纯文本，换行分隔
