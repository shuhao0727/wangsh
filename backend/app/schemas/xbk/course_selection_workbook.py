"""HTTP schemas for the R3 all-class course-selection workbook flow."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class CourseSelectionWorkbookPlanRowResponse(BaseModel):
    sheet: str
    row: int
    grade: str
    class_name: str
    student_no: str
    name: str
    baseline_course: Optional[str] = None
    submitted_course: Optional[str] = None
    target_course: Optional[str] = None
    action: str


class CourseSelectionWorkbookPreviewResponse(BaseModel):
    plan_id: str
    preview_token: str
    token_version: int = 1
    expires_at: datetime
    year: str
    term: str
    baseline_id: str
    total_rows: int
    changed: int
    unchanged: int
    changed_rows: list[CourseSelectionWorkbookPlanRowResponse]
    notice: str = "预览不预留名额；确认时将重新鉴权并按数据库当前状态整批校验。"


class CourseSelectionWorkbookConfirmResponse(BaseModel):
    plan_id: str
    status: str
    changed: int
    inserted: int
    updated: int


class CourseSelectionWorkbookErrorDetail(BaseModel):
    code: str
    message: str
    issues: list[dict[str, Any]] = Field(default_factory=list)
