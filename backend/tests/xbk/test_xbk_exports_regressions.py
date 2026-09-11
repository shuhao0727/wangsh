"""Workbook/SQL-contract tests with fake query results; no configured DB access."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from openpyxl import load_workbook

from app.api.endpoints.xbk import exports
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.services.xbk.exports import course_selection, class_distribution, teacher_distribution


class Rows:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows

    def scalars(self):
        return self


class CaptureDb:
    def __init__(self, *rows):
        self.results = iter(rows)
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        return Rows(next(self.results))


def catalog(code="C1"):
    return XbkCourse(year=2026, term="上学期", grade="高一", course_code=code,
                     course_name="课程", teacher="老师", quota=3, location="A101", is_deleted=False)


def roster():
    return XbkStudent(year=2026, term="上学期", grade="高一", class_name="1班",
                      student_no="00001", name="学生", is_deleted=False)


@pytest.mark.parametrize("kind,builder_name", [
    ("course-selection", "build_student_course_selection_xlsx"),
    ("distribution", "build_class_distribution_xlsx"),
    ("teacher-distribution", "build_teacher_distribution_xlsx"),
])
def test_export_endpoint_passes_grade_to_every_builder(monkeypatch, kind, builder_name):
    builder = AsyncMock(return_value=iter([b"xlsx"]))
    monkeypatch.setattr(exports, builder_name, builder)
    asyncio.run(exports.export_tables(kind, 2026, "上学期", "高一", None, None, None, object(), {}))
    assert builder.call_args.kwargs.get("grade") == "高一" or "高一" in builder.call_args.args


def test_student_template_filters_both_roster_and_catalog_by_grade():
    db = CaptureDb([], [])
    asyncio.run(course_selection.build_student_course_selection_xlsx(
        db, 2026, "上学期", None, None, None, grade="高一"))
    assert "xbk_courses.grade" in str(db.statements[0])
    assert "xbk_students.grade" in str(db.statements[1])


def test_teacher_export_filters_roster_by_grade_and_excludes_deleted_students():
    db = CaptureDb([catalog()], [])
    asyncio.run(teacher_distribution.build_teacher_distribution_xlsx(
        db, 2026, "上学期", None, None, None, grade="高一"))
    assert "xbk_courses.grade" in str(db.statements[0])
    sql = str(db.statements[1])
    assert "xbk_students.grade" in sql
    assert "LEFT OUTER JOIN xbk_students" not in sql


def test_class_export_uses_roster_grade_and_excludes_deleted_students():
    db = CaptureDb([])
    asyncio.run(class_distribution.build_class_distribution_xlsx(
        db, 2026, "上学期", "高一", None, None, None))
    sql = str(db.statements[0])
    assert "xbk_students.grade" in sql
    assert "LEFT OUTER JOIN xbk_students" not in sql


@pytest.mark.parametrize("code", ["001", "1234567890123456789012345", "H1-AI-02", "1.5"])
def test_student_template_preserves_course_identifiers_and_supports_text_codes(code):
    db = CaptureDb([catalog(code)], [roster()])
    output = asyncio.run(course_selection.build_student_course_selection_xlsx(
        db, 2026, "上学期", None, None, None))
    wb = load_workbook(output)
    assert wb["校本课程目录"]["A3"].value == code
    assert wb["高一1班"]["B2"].value == "00001"
    validation = next(iter(wb["高一1班"].data_validations.dataValidation))
    assert "ISNUMBER(D2)" not in validation.formula1
    assert 'VLOOKUP' in validation.formula1
    assert ",4,0)" in validation.formula1


@pytest.mark.parametrize("builder,args", [
    (course_selection.build_student_course_selection_xlsx, (2026, "上学期", None, None, None)),
    (class_distribution.build_class_distribution_xlsx, (2026, "上学期", None, None, None, None)),
    (teacher_distribution.build_teacher_distribution_xlsx, (2026, "上学期", None, None, None)),
])
def test_export_numeric_sort_accepts_full_50_character_identifiers(builder, args):
    db = CaptureDb([], [])
    asyncio.run(builder(db, *args))
    assert "NUMERIC(50, 0)" in str(db.statements[0])
