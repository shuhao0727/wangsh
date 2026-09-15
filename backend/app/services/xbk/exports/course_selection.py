from __future__ import annotations

from collections import Counter
from io import BytesIO
from typing import Dict, List, Optional, Tuple

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, Protection
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from sqlalchemy import Numeric, case, cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.academic_year import normalize_academic_year, split_academic_year
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.core.config import settings
from app.services.xbk.exports.common import apply_table_style, auto_adjust_column_width, class_sort_key, safe_sheet_name, force_text_cells
from app.services.xbk.course_selection_workbook import (
    CATALOG_SHEET,
    INSTRUCTION,
    METADATA_SHEET,
    WorkbookCourse,
    WorkbookStudent,
    write_metadata_sheet,
)


def _sheet_protection_password() -> str:
    # Excel worksheet protection is an editing guard, not file encryption.
    return settings.XBK_EXPORT_SHEET_PASSWORD


def _title_year_range(year: str, year_start: Optional[int], year_end: Optional[int]) -> Tuple[int, int]:
    academic_start, academic_end = split_academic_year(year)
    ys = year_start if year_start is not None else academic_start
    ye = year_end if year_end is not None else academic_end
    return ys, ye


def _parse_int(value: object) -> Optional[int]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return int(float(s))
    except Exception:
        return None


def _get_course_code_limits(ws) -> List[str]:
    codes: List[str] = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row:
            continue
        code = row[0]
        if code is None:
            continue
        codes.append(str(code))
    return codes


class CourseSelectionExportConflict(ValueError):
    """Raised when an ambiguous stored selection would otherwise be collapsed."""

    def __init__(self, conflicts: Dict[str, List[str]]):
        self.conflicts = conflicts
        details = "；".join(f"{student_no}: {', '.join(codes)}" for student_no, codes in conflicts.items())
        super().__init__(f"存在同一学生多门有效选课，已阻止生成可填写工作簿：{details}")


def _set_course_code_validation(
    ws,
    column_letter: str,
    valid_course_codes: List[str],
    catalog_sheet_name: str,
    end_row: int,
) -> None:
    # Identifiers can be alphanumeric or have leading zeros. Match the exact
    # catalog entry instead of accepting any integer between two endpoints.
    escaped_sheet = catalog_sheet_name.replace("'", "''")
    catalog_range = f"'{escaped_sheet}'!$A$3:$D${max(3, len(valid_course_codes) + 2)}"
    for row in range(2, end_row + 1):
        ref = f"{column_letter}{row}"
        formula = (
            f'=IFERROR(OR({ref}="",{ref}="未选",AND({ref}<>"",'
            f'COUNTIF({column_letter}:{column_letter},{ref})'
            f'<=VLOOKUP({ref}&"",{catalog_range},4,0))),FALSE)'
        )
        dv = DataValidation(
            type="custom",
            formula1=formula,
            allow_blank=True,
            showErrorMessage=True,
            errorTitle="错误",
            error="只能输入有效的课程代码，并且数量不能超过限制",
        )
        ws.add_data_validation(dv)
        dv.add(f"{column_letter}{row}")


def _lock_sheet(ws, unlock_header: Optional[str] = None, unlock_ranges: Optional[List[str]] = None) -> None:
    ws.protection.sheet = True
    ws.protection.set_password(_sheet_protection_password())
    for row in ws.iter_rows():
        for cell in row:
            cell.protection = Protection(locked=True)
    if unlock_header:
        for col in range(1, ws.max_column + 1):
            if ws.cell(row=1, column=col).value == unlock_header:
                for r in range(2, ws.max_row + 1):
                    ws.cell(row=r, column=col).protection = Protection(locked=False)
    if unlock_ranges:
        for rng in unlock_ranges:
            for row in ws[rng]:
                for cell in row:
                    cell.protection = Protection(locked=False)


def _cn_len(value: object) -> int:
    if value is None:
        return 0
    s = str(value)
    n = 0
    for ch in s:
        n += 2 if ord(ch) > 127 else 1
    return n


def _clamp(v: int, mn: int, mx: int) -> int:
    return max(mn, min(mx, v))


def _adjust_catalog_dimensions(ws) -> None:
    col_specs = [
        ("A", 1, "课程代码", 10, 14),
        ("B", 2, "课程名称", 20, 44),
        ("C", 3, "课程负责人", 12, 22),
        ("D", 4, "各班限报人数", 10, 14),
        ("E", 5, "上课地点", 16, 46),
    ]

    for letter, idx, title, min_w, max_w in col_specs:
        max_len = _cn_len(title)
        for r in range(2, min(ws.max_row, 300) + 1):
            v = ws.cell(row=r, column=idx).value
            if v is None:
                continue
            max_len = max(max_len, _cn_len(v))
        width = _clamp(int(max_len * 0.9) + 2, min_w, max_w)
        ws.column_dimensions[letter].width = width

    ws.row_dimensions[1].height = 26
    ws.row_dimensions[2].height = 20
    for r in range(3, ws.max_row + 1):
        max_lines = 1
        for letter, idx, _, _, _ in col_specs:
            v = ws.cell(row=r, column=idx).value
            if v is None:
                continue
            text = str(v).strip()
            if not text:
                continue
            base_lines = text.count("\n") + 1
            width = ws.column_dimensions[letter].width or 10
            approx_per_line = max(6, int(width * 1.1))
            wrapped_lines = max(base_lines, (_cn_len(text) + approx_per_line - 1) // approx_per_line)
            max_lines = max(max_lines, wrapped_lines)
        ws.row_dimensions[r].height = min(18 * max_lines, 72)



async def _load_selection_map(db: AsyncSession, year: str, term: str, students: List[XbkStudent]) -> Dict[str, str]:
    if not students:
        return {}
    selection_stmt = (
        select(XbkSelection)
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.year == year, XbkSelection.term == term,
            XbkSelection.student_no.in_([student.student_no for student in students]),
        )
        .order_by(
            XbkSelection.student_no.asc(),
            case((XbkSelection.course_code.op("~")("^[0-9]+$"), cast(XbkSelection.course_code, Numeric(50, 0))), else_=None).asc().nulls_last(),
            XbkSelection.course_code.asc(),
        )
    )
    selections = (await db.execute(selection_stmt)).scalars().all()
    codes_by_student: Dict[str, List[str]] = {}
    for selection in selections:
        codes_by_student.setdefault(selection.student_no, []).append(selection.course_code)
    conflicts = {student_no: codes for student_no, codes in codes_by_student.items() if len(codes) > 1}
    if conflicts:
        raise CourseSelectionExportConflict(conflicts)
    return {student_no: codes[0] for student_no, codes in codes_by_student.items()}

def _unique_sheet_name(label: str, used: set[str]) -> str:
    base = safe_sheet_name(label)
    candidate = base
    suffix = 2
    while candidate in used:
        marker = f"_{suffix}"
        candidate = f"{base[:31 - len(marker)]}{marker}"
        suffix += 1
    used.add(candidate)
    return candidate


async def _load_export_rows(
    db: AsyncSession, normalized_year: str, term: str
) -> tuple[List[XbkCourse], List[XbkStudent]]:
    courses = (
        await db.execute(
            select(XbkCourse)
            .where(
                XbkCourse.is_deleted.is_(False),
                XbkCourse.year == normalized_year,
                XbkCourse.term == term,
            )
            .order_by(
                case(
                    (XbkCourse.course_code.op("~")("^[0-9]+$"), cast(XbkCourse.course_code, Numeric(50, 0))),
                    else_=None,
                )
                .asc()
                .nulls_last(),
                XbkCourse.course_code.asc(),
            )
        )
    ).scalars().all()
    students = (
        await db.execute(
            select(XbkStudent)
            .where(
                XbkStudent.is_deleted.is_(False),
                XbkStudent.year == normalized_year,
                XbkStudent.term == term,
            )
            .order_by(
                XbkStudent.grade.asc(),
                XbkStudent.class_name.asc(),
                XbkStudent.student_no.asc(),
            )
        )
    ).scalars().all()
    return list(courses), list(students)


def _group_export_students(
    students: List[XbkStudent],
) -> tuple[Dict[tuple[str, str], List[XbkStudent]], List[tuple[str, str]]]:
    invalid_roster = [
        str(student.student_no)
        for student in students
        if not str(student.grade or "").strip() or not str(student.class_name or "").strip()
    ]
    if invalid_roster:
        raise CourseSelectionExportConflict(
            {student_no: ["名册缺少年级或班级"] for student_no in invalid_roster}
        )

    students_by_class: Dict[tuple[str, str], List[XbkStudent]] = {}
    for student in students:
        key = (str(student.grade).strip(), str(student.class_name).strip())
        students_by_class.setdefault(key, []).append(student)
    grade_order = {"高一": 0, "高二": 1, "高三": 2}
    ordered_classes = sorted(
        students_by_class,
        key=lambda key: (grade_order.get(key[0], 99), key[0], class_sort_key(key[1])),
    )
    return students_by_class, ordered_classes


def _build_export_manifest(
    courses: List[XbkCourse],
    students_by_class: Dict[tuple[str, str], List[XbkStudent]],
    ordered_classes: List[tuple[str, str]],
    selections_by_student: Dict[str, str],
) -> tuple[
    List[WorkbookCourse],
    List[WorkbookStudent],
    Dict[tuple[str, str], str],
]:
    used_sheet_names = {CATALOG_SHEET, METADATA_SHEET}
    sheet_by_class = {
        class_key: _unique_sheet_name(f"{class_key[0]}{class_key[1]}", used_sheet_names)
        for class_key in ordered_classes
    }
    manifest_courses = [
        WorkbookCourse(str(course.course_code), str(course.course_name), int(course.quota or 0))
        for course in courses
    ]
    manifest_students = [
        WorkbookStudent(
            sheet=sheet_by_class[class_key],
            grade=class_key[0],
            class_name=class_key[1],
            student_no=str(student.student_no),
            name=str(student.name),
            baseline_course=selections_by_student.get(str(student.student_no)),
        )
        for class_key in ordered_classes
        for student in students_by_class[class_key]
    ]
    return manifest_courses, manifest_students, sheet_by_class


def _create_catalog_sheet(
    wb: Workbook,
    courses: List[XbkCourse],
    normalized_year: str,
    term: str,
    year_start: Optional[int],
    year_end: Optional[int],
):
    catalog = wb.create_sheet(CATALOG_SHEET)
    catalog.append(["课程代码", "课程名称", "课程负责人", "各班限报人数", "上课地点"])
    for course in courses:
        catalog.append([
            course.course_code,
            course.course_name,
            course.teacher,
            int(course.quota or 0),
            course.location,
        ])
    ys, ye = _title_year_range(normalized_year, year_start, year_end)
    catalog.insert_rows(1)
    catalog["A1"] = f"江苏省昆山中学校本课程目录（{ys}-{ye} 学年 {term}）"
    catalog["A1"].font = Font(size=14, bold=True)
    catalog["A1"].alignment = Alignment(horizontal="center", vertical="center")
    catalog.merge_cells(start_row=1, start_column=1, end_row=1, end_column=5)
    apply_table_style(catalog, header_row=2, start_row=3, end_row=catalog.max_row, start_col=1, end_col=5)
    _adjust_catalog_dimensions(catalog)
    catalog.freeze_panes = "A3"
    catalog.auto_filter.ref = None
    _lock_sheet(catalog)
    return catalog


def _count_baseline_occupancy(
    students: List[WorkbookStudent],
) -> Counter[tuple[str, str, str]]:
    occupancy: Counter[tuple[str, str, str]] = Counter()
    for student in students:
        if student.baseline_course and student.baseline_course != "未选":
            occupancy[(student.grade, student.class_name, student.baseline_course)] += 1
    return occupancy


def _write_class_course_summary(
    ws,
    grade: str,
    class_name: str,
    courses: List[WorkbookCourse],
    occupancy: Counter[tuple[str, str, str]],
) -> List[WorkbookCourse]:
    ws.merge_cells(start_row=1, start_column=6, end_row=1, end_column=10)
    ws.cell(row=1, column=6).value = INSTRUCTION
    ws.cell(row=1, column=6).font = Font(bold=True)
    ws.cell(row=1, column=6).alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    for column, value in enumerate(["课程代码", "课程名称", "本班限额", "已选", "剩余"], start=6):
        ws.cell(row=2, column=column).value = value
    ordered_courses = sorted(
        courses,
        key=lambda course: (
            -(course.quota - occupancy[(grade, class_name, course.course_code)]),
            course.course_code,
        ),
    )
    for row, course in enumerate(ordered_courses, start=3):
        selected = occupancy[(grade, class_name, course.course_code)]
        for column, value in enumerate(
            [course.course_code, course.course_name, course.quota, selected, course.quota - selected],
            start=6,
        ):
            ws.cell(row=row, column=column).value = value
    return ordered_courses


def _create_class_sheet(
    wb: Workbook,
    sheet_name: str,
    grade: str,
    class_name: str,
    students: List[XbkStudent],
    selections_by_student: Dict[str, str],
    courses: List[WorkbookCourse],
    occupancy: Counter[tuple[str, str, str]],
    valid_course_codes: List[str],
) -> None:
    ws = wb.create_sheet(sheet_name)
    ws.append(["班级", "学号", "姓名", "课程代码"])
    for student in students:
        ws.append([
            student.class_name,
            student.student_no,
            student.name,
            selections_by_student.get(str(student.student_no)),
        ])
    student_end_row = len(students) + 1
    ordered_courses = _write_class_course_summary(ws, grade, class_name, courses, occupancy)
    apply_table_style(ws, header_row=1, start_row=2, end_row=student_end_row, start_col=1, end_col=4)
    if ordered_courses:
        apply_table_style(ws, header_row=2, start_row=3, end_row=len(ordered_courses) + 2, start_col=6, end_col=10)
    auto_adjust_column_width(ws, max_width=30)
    ws.column_dimensions["E"].width = 3
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = None
    _set_course_code_validation(ws, get_column_letter(4), valid_course_codes, CATALOG_SHEET, student_end_row)
    _lock_sheet(ws, unlock_ranges=[f"D2:D{student_end_row}"])


def _finalize_export_workbook(
    wb: Workbook,
    normalized_year: str,
    term: str,
    students: List[WorkbookStudent],
    courses: List[WorkbookCourse],
) -> BytesIO:
    metadata = wb.create_sheet(METADATA_SHEET)
    write_metadata_sheet(metadata, year=normalized_year, term=str(term), students=students, courses=courses)
    _lock_sheet(metadata)
    metadata.sheet_state = "veryHidden"
    for ws in wb.worksheets:
        force_text_cells(ws)
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output


async def build_student_course_selection_xlsx(
    db: AsyncSession,
    year: str,
    term: str,
    class_name: Optional[str],
    year_start: Optional[int],
    year_end: Optional[int],
    grade: Optional[str] = None,
) -> BytesIO:
    """Build one versioned workbook for every actual class in the period."""
    del class_name, grade  # Compatibility parameters cannot narrow the all-class handout.
    normalized_year = normalize_academic_year(year)
    courses, students = await _load_export_rows(db, normalized_year, term)
    selections = await _load_selection_map(db, normalized_year, term, students)
    students_by_class, ordered_classes = _group_export_students(students)
    manifest_courses, manifest_students, sheet_by_class = _build_export_manifest(
        courses, students_by_class, ordered_classes, selections
    )

    wb = Workbook()
    wb.remove(wb.active)
    catalog = _create_catalog_sheet(wb, courses, normalized_year, term, year_start, year_end)
    valid_course_codes = _get_course_code_limits(catalog)
    occupancy = _count_baseline_occupancy(manifest_students)
    for class_key in ordered_classes:
        _create_class_sheet(
            wb,
            sheet_by_class[class_key],
            class_key[0],
            class_key[1],
            students_by_class[class_key],
            selections,
            manifest_courses,
            occupancy,
            valid_course_codes,
        )
    return _finalize_export_workbook(
        wb, normalized_year, term, manifest_students, manifest_courses
    )
