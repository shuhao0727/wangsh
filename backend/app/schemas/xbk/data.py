from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from .academic_year import AcademicYear
from .validation import (
    OptionalText10, OptionalText20, OptionalText50, OptionalText100,
    OptionalText200, Quota, SelectionCode, Text20, Text50, Text200,
)


class XbkStudentOut(BaseModel):
    id: int
    year: AcademicYear
    term: str
    grade: Optional[str] = None
    class_name: str
    student_no: str
    name: str
    gender: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class XbkCourseOut(BaseModel):
    id: int
    year: AcademicYear
    term: str
    grade: Optional[str] = None
    course_code: str
    course_name: str
    teacher: Optional[str] = None
    quota: int
    location: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class XbkSelectionOut(BaseModel):
    id: int
    year: AcademicYear
    term: str
    grade: Optional[str] = None
    student_no: str
    name: Optional[str] = None
    course_code: str

    model_config = ConfigDict(from_attributes=True)


class XbkListResponse(BaseModel):
    total: int
    items: List[dict]


class XbkStudentUpsert(BaseModel):
    year: AcademicYear
    term: Text20
    grade: OptionalText20 = None
    class_name: Text50
    student_no: Text50
    name: Text50
    gender: OptionalText10 = None


class XbkCourseUpsert(BaseModel):
    year: AcademicYear
    term: Text20
    grade: OptionalText20 = None
    course_code: Text50
    course_name: Text200
    teacher: OptionalText100 = None
    quota: Quota = 0
    location: OptionalText200 = None


class XbkSelectionUpsert(BaseModel):
    year: AcademicYear
    term: Text20
    grade: OptionalText20 = None
    student_no: Text50
    name: OptionalText50 = None
    course_code: SelectionCode
