from __future__ import annotations

from io import BytesIO
from typing import Dict, List, Optional, Tuple

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, Protection
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from sqlalchemy import Numeric, case, cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.academic_year import split_academic_year
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.core.config import settings
from app.services.xbk.exports.common import apply_table_style, auto_adjust_column_width, class_sort_key, safe_sheet_name, force_text_cells


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


def _set_course_code_validation(ws, column_letter: str, valid_course_codes: List[str], catalog_sheet_name: str) -> None:
    # Identifiers can be alphanumeric or have leading zeros. Match the exact
    # catalog entry instead of accepting any integer between two endpoints.
    escaped_sheet = catalog_sheet_name.replace("'", "''")
    catalog_range = f"'{escaped_sheet}'!$A$3:$D${max(3, len(valid_course_codes) + 2)}"
    for row in range(2, ws.max_row + 1):
        ref = f"{column_letter}{row}"
        formula = (
            f'=IFERROR(AND({ref}<>"",'
            f'COUNTIF({column_letter}:{column_letter},{ref})'
            f'<=VLOOKUP({ref}&"",{catalog_range},4,0)),FALSE)'
        )
        dv = DataValidation(
            type="custom",
            formula1=formula,
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
    result: Dict[str, str] = {}
    for selection in selections:
        result.setdefault(selection.student_no, selection.course_code)
    return result

async def build_student_course_selection_xlsx(
    db: AsyncSession,
    year: str,
    term: str,
    class_name: Optional[str],
    year_start: Optional[int],
    year_end: Optional[int],
    grade: Optional[str] = None,
) -> BytesIO:
    courses = (
        await db.execute(
            select(XbkCourse)
            .where(XbkCourse.is_deleted.is_(False), XbkCourse.year == year, XbkCourse.term == term)
            .where(*([XbkCourse.grade == grade] if grade else []))
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

    stu_stmt = select(XbkStudent).where(
        XbkStudent.is_deleted.is_(False),
        XbkStudent.year == year,
        XbkStudent.term == term,
    )
    if grade:
        stu_stmt = stu_stmt.where(XbkStudent.grade == grade)
    if class_name:
        stu_stmt = stu_stmt.where(XbkStudent.class_name == class_name)
    students = (await db.execute(stu_stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc()))).scalars().all()

    # The class sheets are an operational view of the current selection result,
    # not a blank roster. Load active selections for the filtered roster and
    # write the student's single course code into column D below. The student
    # roster remains the driving table so deleted/orphan selections can never
    # create rows in a class sheet.
    selections_by_student = await _load_selection_map(db, year, term, students)

    students_by_class: Dict[tuple[str, str], List[XbkStudent]] = {}
    for student in students:
        key = (str(student.grade or "未知年级"), str(student.class_name or "未知班级"))
        students_by_class.setdefault(key, []).append(student)

    wb = Workbook()
    wb.remove(wb.active)

    catalog = wb.create_sheet("校本课程目录")
    catalog.append(["课程代码", "课程名称", "课程负责人", "各班限报人数", "上课地点"])
    for c in courses:
        catalog.append([c.course_code, c.course_name, c.teacher, int(c.quota or 0), c.location])

    ys, ye = _title_year_range(year, year_start, year_end)

    catalog.insert_rows(1)
    catalog["A1"] = f"江苏省昆山中学校本课程目录（{ys}-{ye} 学年）"
    catalog["A1"].font = Font(size=14, bold=True)
    catalog["A1"].alignment = Alignment(horizontal="center", vertical="center")
    catalog.merge_cells("A1:E1")

    apply_table_style(catalog, header_row=2, start_row=3, end_row=catalog.max_row, start_col=1, end_col=5)
    _adjust_catalog_dimensions(catalog)
    catalog.freeze_panes = "A3"
    catalog.auto_filter.ref = None
    _lock_sheet(catalog)

    valid_course_codes = _get_course_code_limits(catalog)

    grade_order = {"高一": 0, "高二": 1, "高三": 2}
    for row_grade, cls in sorted(
        students_by_class,
        key=lambda key: (grade_order.get(key[0], 99), key[0], class_sort_key(key[1])),
    ):
        stus = students_by_class[(row_grade, cls)]
        sheet_label = cls if grade else f"{row_grade}{cls}"
        ws = wb.create_sheet(safe_sheet_name(sheet_label))
        ws.append(["班级", "学号", "姓名", "课程代码"])
        for s in stus:
            ws.append([s.class_name, s.student_no, s.name, selections_by_student.get(s.student_no)])

        apply_table_style(ws, header_row=1, start_row=2, end_row=ws.max_row, start_col=1, end_col=4)
        auto_adjust_column_width(ws, max_width=30)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = None

        course_col_letter = get_column_letter(4)
        _set_course_code_validation(ws, course_col_letter, valid_course_codes, "校本课程目录")
        _lock_sheet(ws, unlock_header="课程代码")

    for ws in wb.worksheets:
        force_text_cells(ws)

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
