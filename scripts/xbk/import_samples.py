#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict, List

from openpyxl import Workbook

if __package__ in (None, ""):
    import sys
    from pathlib import Path

    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.xbk.common import (
    auth_headers,
    dump_json,
    ensure_dir,
    get_http_client,
    get_settings,
    login_admin,
    utc_now_iso,
)


def _write_xlsx(path: Path, headers: List[str], rows: List[Dict[str, Any]]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "data"
    ws.append(headers)
    for row in rows:
        ws.append([row.get(h) for h in headers])
    ensure_dir(path.parent)
    wb.save(path)


def _list_items(
    client,
    api_base: str,
    token: str,
    endpoint: str,
    *,
    year: int,
    term: str,
) -> List[Dict[str, Any]]:
    resp = client.get(
        f"{api_base}{endpoint}",
        params={"page": 1, "size": 500, "year": year, "term": term},
        headers=auth_headers(token),
    )
    resp.raise_for_status()
    body = resp.json() or {}
    items = body.get("items") if isinstance(body, dict) else None
    if not isinstance(items, list):
        raise RuntimeError(f"Unexpected list response from {endpoint}: {body}")
    return [it for it in items if isinstance(it, dict)]


def generate_import_samples() -> Dict[str, Any]:
    settings = get_settings()
    ensure_dir(settings.sample_dir)

    with get_http_client() as client:
        token = login_admin(client, settings)

        students = _list_items(
            client,
            settings.api_base,
            token,
            "/xbk/data/students",
            year=settings.year,
            term=settings.term,
        )
        courses = _list_items(
            client,
            settings.api_base,
            token,
            "/xbk/data/courses",
            year=settings.year,
            term=settings.term,
        )
        selections = _list_items(
            client,
            settings.api_base,
            token,
            "/xbk/data/selections",
            year=settings.year,
            term=settings.term,
        )

    if not students:
        raise RuntimeError("No seeded students found. Run scripts/xbk/seed.py first.")
    if not courses:
        raise RuntimeError("No seeded courses found. Run scripts/xbk/seed.py first.")

    real_selections = [
        row
        for row in selections
        if int(row.get("id") or 0) > 0 and str(row.get("course_code") or "") not in {"未选", "休学或其他", ""}
    ]
    if not real_selections:
        raise RuntimeError("No real selection rows found for update sample.")

    update_student = students[0]
    update_course = courses[0]
    update_selection = real_selections[0]

    suffix = str(int(time.time()))[-6:]
    new_student_nos = [f"{settings.year}99{suffix}1", f"{settings.year}99{suffix}2"]
    new_course_codes = [f"IMP-{suffix}-A", f"IMP-{suffix}-B"]

    students_rows: List[Dict[str, Any]] = [
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": update_student.get("grade") or "高一",
            "班级": update_student.get("class_name"),
            "学号": update_student.get("student_no"),
            "姓名": f"{update_student.get('name', '学生')}-导入更新",
            "性别": update_student.get("gender") or "男",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高一",
            "班级": "高一(1)班",
            "学号": new_student_nos[0],
            "姓名": f"导入新增学生A-{suffix}",
            "性别": "男",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高二",
            "班级": "高二(2)班",
            "学号": new_student_nos[1],
            "姓名": f"导入新增学生B-{suffix}",
            "性别": "女",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高一",
            "班级": "高一(3)班",
            "学号": "",
            "姓名": "无效学生-缺学号",
            "性别": "男",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高一",
            "班级": "高一(4)班",
            "学号": f"{settings.year}88{suffix}",
            "姓名": "",
            "性别": "女",
        },
    ]

    courses_rows: List[Dict[str, Any]] = [
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": update_course.get("grade") or "高一",
            "课程代码": update_course.get("course_code"),
            "课程名称": f"{update_course.get('course_name', '课程')}-导入更新",
            "课程负责人": "导入更新教师",
            "各班限报人数": 26,
            "上课地点": "信息楼 Z901",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高一",
            "课程代码": new_course_codes[0],
            "课程名称": f"导入新增课程A-{suffix}",
            "课程负责人": "导入教师A",
            "各班限报人数": 18,
            "上课地点": "信息楼 Z902",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高二",
            "课程代码": new_course_codes[1],
            "课程名称": f"导入新增课程B-{suffix}",
            "课程负责人": "导入教师B",
            "各班限报人数": 20,
            "上课地点": "信息楼 Z903",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高二",
            "课程代码": "",
            "课程名称": "无效课程-缺代码",
            "课程负责人": "无效",
            "各班限报人数": 10,
            "上课地点": "信息楼 Z904",
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高二",
            "课程代码": f"BAD-{suffix}",
            "课程名称": "无效课程-限报错误",
            "课程负责人": "无效",
            "各班限报人数": "abc",
            "上课地点": "信息楼 Z905",
        },
    ]

    selections_rows: List[Dict[str, Any]] = [
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": update_selection.get("grade") or "高一",
            "学号": update_selection.get("student_no"),
            "姓名": f"{update_selection.get('name', '学生')}-导入更新",
            "课程代码": update_selection.get("course_code"),
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高一",
            "学号": new_student_nos[0],
            "姓名": f"导入新增学生A-{suffix}",
            "课程代码": new_course_codes[0],
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高二",
            "学号": new_student_nos[1],
            "姓名": f"导入新增学生B-{suffix}",
            "课程代码": update_course.get("course_code"),
        },
        {
            "年份": settings.year,
            "学期": settings.term,
            "年级": "高一",
            "学号": "",
            "姓名": "无效选课-缺学号",
            "课程代码": new_course_codes[1],
        },
        {
            "年份": "",
            "学期": settings.term,
            "年级": "高一",
            "学号": new_student_nos[0],
            "姓名": "无效选课-缺年份",
            "课程代码": new_course_codes[1],
        },
    ]

    students_file = settings.sample_dir / "students-import.xlsx"
    courses_file = settings.sample_dir / "courses-import.xlsx"
    selections_file = settings.sample_dir / "selections-import.xlsx"

    _write_xlsx(
        students_file,
        ["年份", "学期", "年级", "班级", "学号", "姓名", "性别"],
        students_rows,
    )
    _write_xlsx(
        courses_file,
        ["年份", "学期", "年级", "课程代码", "课程名称", "课程负责人", "各班限报人数", "上课地点"],
        courses_rows,
    )
    _write_xlsx(
        selections_file,
        ["年份", "学期", "年级", "学号", "姓名", "课程代码"],
        selections_rows,
    )

    expected = {
        "students": {"total_rows": 5, "processed": 3, "inserted": 2, "updated": 1, "invalid": 2},
        "courses": {"total_rows": 5, "processed": 3, "inserted": 2, "updated": 1, "invalid": 2},
        "selections": {"total_rows": 5, "processed": 3, "inserted": 2, "updated": 1, "invalid": 2},
    }

    manifest = {
        "timestamp": utc_now_iso(),
        "year": settings.year,
        "term": settings.term,
        "files": {
            "students": str(students_file),
            "courses": str(courses_file),
            "selections": str(selections_file),
        },
        "expected": expected,
        "entities": {
            "update_student_no": update_student.get("student_no"),
            "update_course_code": update_course.get("course_code"),
            "update_selection": {
                "student_no": update_selection.get("student_no"),
                "course_code": update_selection.get("course_code"),
            },
            "new_student_nos": new_student_nos,
            "new_course_codes": new_course_codes,
        },
    }

    manifest_path = settings.sample_dir / "manifest.json"
    dump_json(manifest_path, manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate XBK import sample excel files.")
    parser.parse_args()

    manifest = generate_import_samples()
    print("[xbk-import-samples] done")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
