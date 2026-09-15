"""Trusted HTTP preview/confirm boundary for R3 XBK workbooks."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import Numeric, case, cast, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.deps import require_admin
from app.core.request_budget import FALLBACK_FORM_BUDGET
from app.db.database import AsyncSessionLocal, get_db
from app.models import XbkCourse, XbkStudent
from app.schemas.user_info import UserInfo
from app.schemas.xbk.academic_year import normalize_academic_year
from app.schemas.xbk.course_selection_workbook import (
    CourseSelectionWorkbookConfirmResponse,
    CourseSelectionWorkbookPlanRowResponse,
    CourseSelectionWorkbookPreviewResponse,
)
from app.services.xbk.course_selection_workbook import (
    METADATA_SHEET,
    WorkbookArchiveError,
    WorkbookCourse,
    WorkbookExpectation,
    WorkbookStudent,
    compute_baseline_id,
    validate_xlsx_archive_budget,
)
from app.services.xbk.course_selection_workbook_apply import (
    CourseSelectionWorkbookServiceError,
    apply_course_selection_workbook_plan,
    preview_course_selection_workbook,
    preview_course_selection_workbook_from_export,
)
from app.services.xbk.course_selection_workbook_token import (
    TOKEN_VERSION,
    CourseSelectionWorkbookTokenError,
    issue_course_selection_workbook_token,
    verify_course_selection_workbook_token,
)
from app.services.xbk.exports.common import class_sort_key, safe_sheet_name
from app.services.xbk.exports.course_selection import (
    CATALOG_SHEET,
    CourseSelectionExportConflict,
    _load_selection_map,
)
from app.services.xbk.selection_rules import is_active_selection_unique_violation


router = APIRouter(prefix="/course-selection-workbook")
# The global request-budget middleware applies FALLBACK_FORM_BUDGET to these new
# multipart endpoints before Starlette parses the upload. Keep the service-side
# file cap below that request cap to leave room for multipart framing.
MAX_WORKBOOK_BYTES = FALLBACK_FORM_BUDGET.max_body_bytes - 64 * 1024


async def get_workbook_transaction_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a business transaction isolated from the authentication session."""

    async with AsyncSessionLocal() as session:
        yield session


def _error(
    exc: CourseSelectionWorkbookServiceError | CourseSelectionWorkbookTokenError | WorkbookArchiveError,
) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.to_dict())


def _admin_id(current_user: UserInfo) -> int:
    try:
        value = int(current_user["id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "XBK_WORKBOOK_ADMIN_IDENTITY_INVALID",
                "message": "当前管理员身份缺少稳定标识，无法授权工作簿确认",
                "issues": [],
            },
        ) from exc
    if value <= 0:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "XBK_WORKBOOK_ADMIN_IDENTITY_INVALID",
                "message": "当前管理员身份标识无效，无法授权工作簿确认",
                "issues": [],
            },
        )
    return value


def _period(year: str, term: str) -> tuple[str, str]:
    try:
        normalized_year = normalize_academic_year(year)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "XBK_WORKBOOK_PERIOD_INVALID", "message": str(exc), "issues": []},
        ) from exc
    normalized_term = str(term or "").strip()
    if not normalized_term or len(normalized_term) > 20 or "\x00" in normalized_term:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "XBK_WORKBOOK_PERIOD_INVALID",
                "message": "学期不能为空、超过20个字符或包含空字符",
                "issues": [],
            },
        )
    return normalized_year, normalized_term


async def _read_workbook(file: UploadFile) -> bytes:
    if Path(file.filename or "").suffix.lower() != ".xlsx":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "XBK_WORKBOOK_FILE_TYPE_INVALID",
                "message": "学生选课工作簿仅支持 .xlsx 文件",
                "issues": [],
            },
        )
    content = await file.read(MAX_WORKBOOK_BYTES + 1)
    if len(content) > MAX_WORKBOOK_BYTES:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "XBK_WORKBOOK_FILE_TOO_LARGE",
                "message": f"工作簿文件不能超过 {MAX_WORKBOOK_BYTES // 1024} KiB",
                "issues": [],
            },
        )
    if not content:
        raise HTTPException(
            status_code=400,
            detail={"code": "XBK_WORKBOOK_FILE_EMPTY", "message": "工作簿文件为空", "issues": []},
        )
    try:
        validate_xlsx_archive_budget(content)
    except WorkbookArchiveError as exc:
        raise _error(exc) from exc
    return content


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


async def _load_current_courses(
    db: AsyncSession,
    year: str,
    term: str,
) -> list[XbkCourse]:
    result = await db.execute(
        select(XbkCourse).where(
            XbkCourse.is_deleted.is_(False),
            XbkCourse.year == year,
            XbkCourse.term == term,
        ).order_by(
            case(
                (XbkCourse.course_code.op("~")("^[0-9]+$"), cast(XbkCourse.course_code, Numeric(50, 0))),
                else_=None,
            ).asc().nulls_last(),
            XbkCourse.course_code.asc(),
        )
    )
    return list(result.scalars().all())


async def _load_current_students(
    db: AsyncSession,
    year: str,
    term: str,
) -> list[XbkStudent]:
    result = await db.execute(
        select(XbkStudent).where(
            XbkStudent.is_deleted.is_(False),
            XbkStudent.year == year,
            XbkStudent.term == term,
        ).order_by(
            XbkStudent.grade.asc(),
            XbkStudent.class_name.asc(),
            XbkStudent.student_no.asc(),
        )
    )
    return list(result.scalars().all())


def _validate_current_roster(students: list[XbkStudent]) -> None:
    invalid_roster = [
        str(student.student_no)
        for student in students
        if not str(student.grade or "").strip() or not str(student.class_name or "").strip()
    ]
    if invalid_roster:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "XBK_WORKBOOK_CURRENT_ROSTER_INVALID",
                "message": "当前名册存在缺少年级或班级的学生，无法预览",
                "issues": [{"student_no": value} for value in invalid_roster],
            },
        )


async def _load_current_selection_map(
    db: AsyncSession,
    year: str,
    term: str,
    students: list[XbkStudent],
) -> dict[str, str]:
    try:
        return await _load_selection_map(db, year, term, students)
    except CourseSelectionExportConflict as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "XBK_WORKBOOK_CURRENT_SELECTION_AMBIGUOUS",
                "message": str(exc),
                "issues": [
                    {"student_no": student_no, "course_codes": codes}
                    for student_no, codes in sorted(exc.conflicts.items())
                ],
            },
        ) from exc


def _students_by_class(
    students: list[XbkStudent],
) -> dict[tuple[str, str], list[XbkStudent]]:
    grouped: dict[tuple[str, str], list[XbkStudent]] = defaultdict(list)
    for student in students:
        key = (str(student.grade).strip(), str(student.class_name).strip())
        grouped[key].append(student)
    return grouped


def _ordered_class_keys(
    students_by_class: dict[tuple[str, str], list[XbkStudent]],
) -> list[tuple[str, str]]:
    grade_order = {"高一": 0, "高二": 1, "高三": 2}
    return sorted(
        students_by_class,
        key=lambda key: (grade_order.get(key[0], 99), key[0], class_sort_key(key[1])),
    )


def _sheet_names_by_class(
    ordered_classes: list[tuple[str, str]],
) -> dict[tuple[str, str], str]:
    used_sheet_names = {CATALOG_SHEET, METADATA_SHEET}
    return {
        class_key: _unique_sheet_name(f"{class_key[0]}{class_key[1]}", used_sheet_names)
        for class_key in ordered_classes
    }


def _manifest_students(
    ordered_classes: list[tuple[str, str]],
    students_by_class: dict[tuple[str, str], list[XbkStudent]],
    sheet_by_class: dict[tuple[str, str], str],
    selections_by_student: dict[str, str],
) -> tuple[WorkbookStudent, ...]:
    return tuple(
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
    )


def _manifest_courses(courses: list[XbkCourse]) -> tuple[WorkbookCourse, ...]:
    return tuple(
        WorkbookCourse(str(course.course_code), str(course.course_name), int(course.quota or 0))
        for course in courses
    )


async def load_current_workbook_expectation(
    db: AsyncSession,
    year: str,
    term: str,
) -> WorkbookExpectation:
    """Rebuild the exact all-class export baseline from authoritative rows."""

    courses = await _load_current_courses(db, year, term)
    students = await _load_current_students(db, year, term)
    _validate_current_roster(students)
    selections = await _load_current_selection_map(db, year, term, students)

    grouped_students = _students_by_class(students)
    ordered_classes = _ordered_class_keys(grouped_students)
    sheet_by_class = _sheet_names_by_class(ordered_classes)
    manifest_students = _manifest_students(
        ordered_classes,
        grouped_students,
        sheet_by_class,
        selections,
    )
    manifest_courses = _manifest_courses(courses)
    return WorkbookExpectation(
        year=year,
        term=term,
        baseline_id=compute_baseline_id(year, term, manifest_students, manifest_courses),
        students=manifest_students,
        courses=manifest_courses,
    )


@router.post("/preview", response_model=CourseSelectionWorkbookPreviewResponse)
async def preview_workbook(
    file: UploadFile = File(...),
    year: str = Form(...),
    term: str = Form(...),
    current_user: UserInfo = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CourseSelectionWorkbookPreviewResponse:
    normalized_year, normalized_term = _period(year, term)
    content = await _read_workbook(file)
    expectation = await load_current_workbook_expectation(db, normalized_year, normalized_term)
    try:
        plan = await run_in_threadpool(
            preview_course_selection_workbook,
            content,
            expectation=expectation,
        )
        preview_token, claims = issue_course_selection_workbook_token(
            admin_id=_admin_id(current_user),
            year=plan.year,
            term=plan.term,
            plan_id=plan.plan_id,
        )
    except CourseSelectionWorkbookServiceError as exc:
        raise _error(exc) from exc

    changed_rows = [CourseSelectionWorkbookPlanRowResponse(**row.__dict__) for row in plan.changed_rows]
    return CourseSelectionWorkbookPreviewResponse(
        plan_id=plan.plan_id,
        preview_token=preview_token,
        token_version=TOKEN_VERSION,
        expires_at=claims.expires_at_datetime,
        year=plan.year,
        term=plan.term,
        baseline_id=plan.baseline_id,
        total_rows=len(plan.rows),
        changed=len(plan.changed_rows),
        unchanged=len(plan.rows) - len(plan.changed_rows),
        changed_rows=changed_rows,
    )


@router.post("/confirm", response_model=CourseSelectionWorkbookConfirmResponse)
async def confirm_workbook(
    file: UploadFile = File(...),
    preview_token: str = Form(...),
    year: str = Form(...),
    term: str = Form(...),
    current_user: UserInfo = Depends(require_admin),
    db: AsyncSession = Depends(get_workbook_transaction_db),
) -> CourseSelectionWorkbookConfirmResponse:
    normalized_year, normalized_term = _period(year, term)
    admin_id = _admin_id(current_user)
    try:
        claims = verify_course_selection_workbook_token(
            preview_token,
            admin_id=admin_id,
            year=normalized_year,
            term=normalized_term,
        )
    except CourseSelectionWorkbookTokenError as exc:
        raise _error(exc) from exc

    content = await _read_workbook(file)
    try:
        plan, source_expectation = await run_in_threadpool(
            preview_course_selection_workbook_from_export,
            content,
        )
        verify_course_selection_workbook_token(
            preview_token,
            admin_id=admin_id,
            year=plan.year,
            term=plan.term,
            expected_plan_id=plan.plan_id,
        )
        result = await apply_course_selection_workbook_plan(
            db,
            plan,
            expected_plan_id=claims.plan_id,
            source_expectation=source_expectation,
        )
        await db.commit()
    except CourseSelectionWorkbookTokenError as exc:
        await db.rollback()
        raise _error(exc) from exc
    except CourseSelectionWorkbookServiceError as exc:
        raise _error(exc) from exc
    except IntegrityError as exc:
        await db.rollback()
        if is_active_selection_unique_violation(exc):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "XBK_WORKBOOK_ACTIVE_SELECTION_CONFLICT",
                    "message": "学生选课已被并发修改，请重新预览后重试",
                    "issues": [],
                },
            ) from exc
        raise
    except BaseException:
        await db.rollback()
        raise

    return CourseSelectionWorkbookConfirmResponse(
        plan_id=result.plan_id,
        status=result.status,
        changed=result.changed,
        inserted=result.inserted,
        updated=result.updated,
    )
