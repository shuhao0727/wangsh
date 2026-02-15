from typing import List, Optional

from pydantic import BaseModel


class XbkStudentOut(BaseModel):
    id: int
    year: int
    term: str
    grade: Optional[str] = None
    class_name: str
    student_no: str
    name: str
    gender: Optional[str] = None

    class Config:
        from_attributes = True


class XbkCourseOut(BaseModel):
    id: int
    year: int
    term: str
    grade: Optional[str] = None
    course_code: str
    course_name: str
    teacher: Optional[str] = None
    quota: int
    location: Optional[str] = None

    class Config:
        from_attributes = True


class XbkSelectionOut(BaseModel):
    id: int
    year: int
    term: str
    grade: Optional[str] = None
    student_no: str
    name: Optional[str] = None
    course_code: str

    class Config:
        from_attributes = True


class XbkListResponse(BaseModel):
    total: int
    items: List[dict]


class XbkStudentUpsert(BaseModel):
    year: int
    term: str
    grade: Optional[str] = None
    class_name: str
    student_no: str
    name: str
    gender: Optional[str] = None


class XbkCourseUpsert(BaseModel):
    year: int
    term: str
    grade: Optional[str] = None
    course_code: str
    course_name: str
    teacher: Optional[str] = None
    quota: int = 0
    location: Optional[str] = None


class XbkSelectionUpsert(BaseModel):
    year: int
    term: str
    grade: Optional[str] = None
    student_no: str
    name: Optional[str] = None
    course_code: str
