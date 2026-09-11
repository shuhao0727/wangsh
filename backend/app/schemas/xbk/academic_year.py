"""XBK 学年字段的 Pydantic 类型。"""

from __future__ import annotations

from typing import Annotated

from pydantic import BeforeValidator

from app.utils.academic_year import normalize_academic_year, split_academic_year

AcademicYear = Annotated[str, BeforeValidator(normalize_academic_year)]

__all__ = ["AcademicYear", "normalize_academic_year", "split_academic_year"]
