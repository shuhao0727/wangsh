"""XBK import/export core rules regression tests."""

from __future__ import annotations

import asyncio
import io

import pandas as pd
from fastapi import HTTPException
from starlette.datastructures import UploadFile

from app.api.endpoints.xbk.import_export import (
    _courses_mapping,
    _drop_empty_rows,
    _get_year_term,
    _parse_quota_int,
    _remap_columns,
    _students_mapping,
    _template_columns,
    _validate_required_columns,
    preview_import,
)


def _make_upload_file(rows: list[dict], filename: str = "sample.xlsx") -> UploadFile:
    df = pd.DataFrame(rows)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    buffer.seek(0)
    return UploadFile(filename=filename, file=buffer)


def _make_upload_file_with_columns(columns: list[str], filename: str = "sample.xlsx") -> UploadFile:
    df = pd.DataFrame(columns=columns)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    buffer.seek(0)
    return UploadFile(filename=filename, file=buffer)


def test_remap_students_alias_columns() -> None:
    df = pd.DataFrame(
        [
            {
                "year": "2026",
                "term": "上学期",
                "班别": "高一(1)班",
                "student_id": "20260001",
                "student_name": "张三",
                "sex": "男",
            }
        ]
    )
    remapped = _remap_columns(df, _students_mapping())

    for col in ["年份", "学期", "班级", "学号", "姓名", "性别"]:
        assert col in remapped.columns


def test_validate_required_columns_raises_422() -> None:
    df = pd.DataFrame([{"年份": 2026, "学期": "上学期", "班级": "高一(1)班"}])
    try:
        _validate_required_columns(df, ["班级", "学号", "姓名"])
        assert False, "Should raise HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 422
        assert "缺少必要列" in str(exc.detail)


def test_parse_quota_int_cases() -> None:
    assert _parse_quota_int("12") == 12
    assert _parse_quota_int("12.0") == 12
    assert _parse_quota_int(9) == 9
    assert _parse_quota_int("") is None
    assert _parse_quota_int(None) is None
    assert _parse_quota_int("abc") is None


def test_get_year_term_parse_and_invalid() -> None:
    row_ok = pd.Series({"年份": "2026", "学期": "上学期"})
    year, term = _get_year_term(row_ok)
    assert year == 2026
    assert term == "上学期"

    row_default = pd.Series({"年份": "", "学期": ""})
    year_default, term_default = _get_year_term(row_default, default_year=2026, default_term="下学期")
    assert year_default == 2026
    assert term_default == "下学期"

    try:
        _get_year_term(pd.Series({"年份": "", "学期": "上学期"}))
        assert False, "Should raise HTTPException for missing year"
    except HTTPException as exc:
        assert exc.status_code == 422

    try:
        _get_year_term(pd.Series({"年份": "20xx", "学期": "上学期"}))
        assert False, "Should raise HTTPException for invalid year"
    except HTTPException as exc:
        assert exc.status_code == 422


def test_preview_import_students_counting_rules() -> None:
    upload = _make_upload_file(
        [
            {"年份": 2026, "学期": "上学期", "班级": "高一(1)班", "学号": "20260001", "姓名": "张三", "性别": "男"},
            {"年份": 2026, "学期": "上学期", "班级": "高一(1)班", "学号": "", "姓名": "李四", "性别": "女"},
            {"年份": "", "学期": "上学期", "班级": "高一(2)班", "学号": "20260003", "姓名": "王五", "性别": "男"},
        ]
    )

    result = asyncio.run(preview_import(scope="students", file=upload, db=None, _={}))
    assert result["total_rows"] == 3
    assert result["valid_rows"] == 1
    assert result["invalid_rows"] == 2


def test_preview_import_courses_quota_invalid_counted() -> None:
    upload = _make_upload_file(
        [
            {"年份": 2026, "学期": "上学期", "课程代码": "C-01", "课程名称": "课程A", "各班限报人数": "20"},
            {"年份": 2026, "学期": "上学期", "课程代码": "C-02", "课程名称": "课程B", "各班限报人数": "abc"},
        ]
    )

    result = asyncio.run(preview_import(scope="courses", file=upload, db=None, _={}))
    assert result["total_rows"] == 2
    assert result["valid_rows"] == 1
    assert result["invalid_rows"] == 1


def test_preview_import_students_can_use_query_year_term_defaults() -> None:
    upload = _make_upload_file(
        [
            {"年份": "", "学期": "", "班级": "高一(1)班", "学号": "20260011", "姓名": "王六", "性别": "男"},
        ]
    )

    result = asyncio.run(
        preview_import(scope="students", year=2026, term="上学期", grade="高一", file=upload, db=None, _={})
    )
    assert result["total_rows"] == 1
    assert result["valid_rows"] == 1
    assert result["invalid_rows"] == 0
    assert result["preview"][0]["年级"] == "高一"


def test_preview_import_selections_blank_course_code_maps_to_unselected() -> None:
    upload = _make_upload_file(
        [
            {"年份": 2026, "学期": "上学期", "学号": "20260021", "姓名": "赵七", "课程代码": ""},
        ]
    )

    result = asyncio.run(preview_import(scope="selections", file=upload, db=None, _={}))
    assert result["total_rows"] == 1
    assert result["valid_rows"] == 1
    assert result["invalid_rows"] == 0
    assert result["preview"][0]["课程代码"] == "未选"


def test_remap_courses_alias_columns() -> None:
    df = pd.DataFrame(
        [
            {
                "year": "2026",
                "term": "上学期",
                "course_id": "A-01",
                "名称": "课程A",
                "teacher": "王老师",
                "quota": "15",
                "location": "A101",
            }
        ]
    )
    remapped = _remap_columns(df, _courses_mapping())
    for col in ["年份", "学期", "课程代码", "课程名称", "课程负责人", "各班限报人数", "上课地点"]:
        assert col in remapped.columns


def test_template_columns_contract() -> None:
    assert _template_columns("students") == ["年份", "学期", "年级", "班级", "学号", "姓名", "性别"]
    assert _template_columns("courses") == ["年份", "学期", "年级", "课程代码", "课程名称", "课程负责人", "各班限报人数", "上课地点"]
    assert _template_columns("selections") == ["年份", "学期", "年级", "学号", "姓名", "课程代码"]


def test_preview_import_students_header_only_returns_zero() -> None:
    upload = _make_upload_file_with_columns(["年份", "学期", "年级", "班级", "学号", "姓名", "性别"])
    result = asyncio.run(preview_import(scope="students", file=upload, db=None, _={}))
    assert result["total_rows"] == 0
    assert result["valid_rows"] == 0
    assert result["invalid_rows"] == 0
    assert result["errors"] == []


def test_drop_empty_rows_removes_blank_lines() -> None:
    df = pd.DataFrame(
        [
            {"年份": "", "学期": "", "班级": "", "学号": "", "姓名": ""},
            {"年份": 2026, "学期": "上学期", "班级": "高一(1)班", "学号": "20260001", "姓名": "张三"},
        ]
    )
    cleaned = _drop_empty_rows(df)
    assert cleaned.shape[0] == 1
