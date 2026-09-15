"""Transactional preview/confirm service for XBK course-selection workbooks.

Preview compares the exported workbook with the current server expectation.
Confirmation reconstructs the immutable export contract from the workbook,
binds the reconstructed plan to a server-signed token, then rechecks the locked
current roster, course catalogue, selection state, and target capacity.
``plan_id`` remains a content digest rather than an authentication signature.
The whole write batch is delegated to ``apply_selection_mutations`` in the
caller's transaction.
"""

from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass, field
from hashlib import sha256
import json
from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import XbkCourse, XbkSelection, XbkStudent
from app.services.xbk.course_selection_workbook import (
    WORKBOOK_FORMAT,
    WORKBOOK_VERSION,
    UNSELECTED_CODE,
    WorkbookExpectation,
    WorkbookIssue,
    WorkbookValidationError,
    compute_baseline_id,
    parse_course_selection_workbook,
    read_course_selection_workbook_expectation,
)
from app.services.xbk.selection_rules import (
    UNSELECTED_CODES,
    SelectionMutation,
    apply_selection_mutations,
)


@dataclass(frozen=True)
class WorkbookApplyIssue:
    code: str
    message: str
    sheet: Optional[str] = None
    row: Optional[int] = None
    student_no: Optional[str] = None
    course_code: Optional[str] = None
    details: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class CourseSelectionWorkbookServiceError(ValueError):
    """Structured service failure suitable for later router translation."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        issues: Sequence[WorkbookApplyIssue] = (),
        status_code: int = 409,
    ) -> None:
        self.code = code
        self.message = message
        self.issues = tuple(issues)
        self.status_code = status_code
        super().__init__(message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "issues": [issue.to_dict() for issue in self.issues],
        }


@dataclass(frozen=True)
class WorkbookPlannedSelection:
    sheet: str
    row: int
    grade: str
    class_name: str
    student_no: str
    name: str
    baseline_course: Optional[str]
    submitted_course: Optional[str]
    target_course: Optional[str]
    action: str


@dataclass(frozen=True)
class CourseSelectionWorkbookPlan:
    format: str
    version: str
    year: str
    term: str
    baseline_id: str
    rows: tuple[WorkbookPlannedSelection, ...]
    plan_id: str

    @property
    def changed_rows(self) -> tuple[WorkbookPlannedSelection, ...]:
        return tuple(row for row in self.rows if row.action != "no_change")


@dataclass(frozen=True)
class CourseSelectionWorkbookApplyResult:
    plan_id: str
    status: str  # applied | already_applied | no_changes
    changed: int
    inserted: int
    updated: int


@dataclass(frozen=True)
class _CurrentSelectionState:
    course_code: Optional[str]
    active_count: int


def _logical_course(code: Optional[str]) -> Optional[str]:
    if code is None or str(code) in UNSELECTED_CODES:
        return None
    return str(code)


def _plan_payload(plan: CourseSelectionWorkbookPlan) -> dict[str, Any]:
    return {
        "format": plan.format,
        "version": plan.version,
        "year": plan.year,
        "term": plan.term,
        "baseline_id": plan.baseline_id,
        "rows": [asdict(row) for row in plan.rows],
    }


def _plan_digest(payload: Mapping[str, Any]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256(canonical).hexdigest()


def _row_issue(
    row: WorkbookPlannedSelection,
    code: str,
    message: str,
    **details: Any,
) -> WorkbookApplyIssue:
    return WorkbookApplyIssue(
        code=code,
        message=message,
        sheet=row.sheet,
        row=row.row,
        student_no=row.student_no,
        course_code=row.target_course,
        details=details,
    )


def _parser_issue(issue: WorkbookIssue) -> WorkbookApplyIssue:
    return WorkbookApplyIssue(
        code="XBK_WORKBOOK_INVALID_ROW",
        message=issue.reason,
        sheet=issue.sheet,
        row=issue.row,
        student_no=issue.student_no,
        course_code=issue.course_code,
        details={"suggestions": [asdict(item) for item in issue.suggestions]},
    )


def preview_course_selection_workbook(
    source: bytes | Any,
    *,
    expectation: WorkbookExpectation,
) -> CourseSelectionWorkbookPlan:
    """Parse a workbook and return a plan with a content-addressed digest."""

    try:
        parsed = parse_course_selection_workbook(source, expected=expectation)
    except WorkbookValidationError as exc:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_INVALID",
            "选课工作簿校验失败",
            issues=tuple(_parser_issue(issue) for issue in exc.issues),
            status_code=422,
        ) from exc

    rows = tuple(
        WorkbookPlannedSelection(
            sheet=row.sheet,
            row=row.row,
            grade=row.grade,
            class_name=row.class_name,
            student_no=row.student_no,
            name=row.name,
            baseline_course=_logical_course(row.baseline_course),
            submitted_course=row.submitted_course,
            target_course=(
                _logical_course(row.baseline_course)
                if row.action == "no_change"
                else None
                if row.action == "set_unselected"
                else _logical_course(row.submitted_course)
            ),
            action=row.action,
        )
        for row in parsed.rows
    )
    unsigned = CourseSelectionWorkbookPlan(
        format=parsed.format,
        version=parsed.version,
        year=parsed.year,
        term=parsed.term,
        baseline_id=parsed.baseline_id,
        rows=rows,
        plan_id="",
    )
    return CourseSelectionWorkbookPlan(
        format=unsigned.format,
        version=unsigned.version,
        year=unsigned.year,
        term=unsigned.term,
        baseline_id=unsigned.baseline_id,
        rows=unsigned.rows,
        plan_id=_plan_digest(_plan_payload(unsigned)),
    )


def preview_course_selection_workbook_from_export(
    source: bytes | Any,
) -> tuple[CourseSelectionWorkbookPlan, WorkbookExpectation]:
    """Rebuild a signed-preview candidate from its embedded export contract.

    Confirmation uses this path so a previously applied workbook can still
    reach the locked idempotency check. The returned plan is safe only after
    its digest is matched against the server-signed preview token.
    """

    try:
        expectation = read_course_selection_workbook_expectation(source)
    except WorkbookValidationError as exc:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_INVALID",
            "选课工作簿校验失败",
            issues=tuple(_parser_issue(issue) for issue in exc.issues),
            status_code=422,
        ) from exc
    return preview_course_selection_workbook(source, expectation=expectation), expectation


def _row_matches_export_contract(
    row: WorkbookPlannedSelection, expected: Any, course_codes: set[str],
) -> bool:
    identity = (row.sheet, row.grade, row.class_name, row.name, row.baseline_course) == (
        expected.sheet, expected.grade, expected.class_name, expected.name,
        _logical_course(expected.baseline_course),
    )
    if row.action == "no_change":
        action = row.target_course == row.baseline_course and row.submitted_course in (
            None, expected.baseline_course,
        )
    elif row.action == "set_unselected":
        action = row.submitted_course == UNSELECTED_CODE and row.target_course is None
    elif row.action == "select":
        action = row.submitted_course in course_codes and (
            row.target_course, row.target_course != row.baseline_course
        ) == (row.submitted_course, True)
    else:
        action = False
    return identity and action


def _validate_plan_contract(
    plan: CourseSelectionWorkbookPlan, source_expectation: WorkbookExpectation,
) -> None:
    expected = {student.student_no: student for student in source_expectation.students}
    numbers = [row.student_no for row in plan.rows]
    header = (plan.format, plan.version, len(numbers), set(numbers))
    required = (WORKBOOK_FORMAT, WORKBOOK_VERSION, len(set(numbers)), set(expected))
    course_codes = {course.course_code for course in source_expectation.courses}
    rows_valid = header == required and all(
        _row_matches_export_contract(row, expected[row.student_no], course_codes)
        for row in plan.rows
    )
    if not rows_valid:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_PLAN_TAMPERED", "预览计划内容不符合服务器名册、课程或动作合同",
        )


def _validate_plan(
    plan: CourseSelectionWorkbookPlan,
    expected_plan_id: str,
    source_expectation: WorkbookExpectation,
) -> None:
    actual_plan_id = _plan_digest(_plan_payload(plan))
    if not expected_plan_id or (plan.plan_id, actual_plan_id) != (expected_plan_id, plan.plan_id):
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_PLAN_TAMPERED", "预览计划校验失败，请重新预览后再确认",
        )
    _validate_plan_contract(plan, source_expectation)
    current_baseline_id = compute_baseline_id(
        source_expectation.year, source_expectation.term,
        source_expectation.students, source_expectation.courses,
    )
    if current_baseline_id != source_expectation.baseline_id:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_STALE_BASELINE", "服务器当前导出基线合同无效，请重新导出",
        )
    if (plan.year, plan.term, plan.baseline_id) != (
        source_expectation.year, source_expectation.term, source_expectation.baseline_id,
    ):
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_STALE_BASELINE", "预览所依据的名册或课程基线已变化，请重新导出并预览",
        )


def _scalar_rows(result: Any) -> list[Any]:
    return list(result.scalars().all())


def _student_baseline_issues(
    plan: CourseSelectionWorkbookPlan, expectation: WorkbookExpectation,
    students: Sequence[XbkStudent],
) -> list[WorkbookApplyIssue]:
    planned = {row.student_no: row for row in plan.rows}
    expected = {row.student_no: row for row in expectation.students}
    active = {row.student_no: row for row in students if not row.is_deleted}
    issues: list[WorkbookApplyIssue] = []
    for student_no, exported in expected.items():
        current = active.get(student_no)
        if current is None:
            issues.append(_row_issue(
                planned[student_no], "XBK_WORKBOOK_STALE_STUDENT", "学生已不存在或已被删除",
            ))
        elif (current.grade, current.class_name, current.name) != (
            exported.grade, exported.class_name, exported.name,
        ):
            issues.append(_row_issue(
                planned[student_no], "XBK_WORKBOOK_STALE_STUDENT", "学生姓名、年级或班级已变化",
                current_grade=current.grade, current_class_name=current.class_name,
                current_name=current.name,
            ))
    for student_no in sorted(set(active) - set(expected)):
        current = active[student_no]
        issues.append(WorkbookApplyIssue(
            code="XBK_WORKBOOK_STALE_STUDENT", message="当前名册出现导出基线外的新学生",
            student_no=student_no, details={
                "current_grade": current.grade, "current_class_name": current.class_name,
                "current_name": current.name,
            },
        ))
    return issues


def _course_baseline_issues(
    expectation: WorkbookExpectation, courses: Sequence[XbkCourse],
) -> list[WorkbookApplyIssue]:
    current = {row.course_code: row for row in courses if not row.is_deleted}
    expected_codes = {row.course_code for row in expectation.courses}
    issues: list[WorkbookApplyIssue] = []
    for exported in expectation.courses:
        course = current.get(exported.course_code)
        contract = None if course is None else (course.course_name, int(course.quota or 0))
        if contract != (exported.course_name, exported.quota):
            issues.append(WorkbookApplyIssue(
                code="XBK_WORKBOOK_STALE_COURSE", message="课程名称、限额或有效状态已变化",
                course_code=exported.course_code, details={
                    "expected_name": exported.course_name, "expected_quota": exported.quota,
                    "current_name": getattr(course, "course_name", None),
                    "current_quota": getattr(course, "quota", None),
                },
            ))
    for code in sorted(set(current) - expected_codes):
        course = current[code]
        issues.append(WorkbookApplyIssue(
            code="XBK_WORKBOOK_STALE_COURSE", message="当前课程目录出现导出基线外的新课程",
            course_code=code, details={
                "current_name": course.course_name, "current_quota": course.quota,
            },
        ))
    return issues


def _raise_baseline_issues(
    issues: Sequence[WorkbookApplyIssue], message: str,
) -> None:
    if issues:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_STALE_BASELINE", message, issues=issues,
        )


async def _lock_current_selections(
    db: AsyncSession, plan: CourseSelectionWorkbookPlan, student_numbers: Sequence[str],
) -> list[XbkSelection]:
    if not student_numbers:
        return []
    result = await db.execute(select(XbkSelection).where(
        XbkSelection.year == plan.year, XbkSelection.term == plan.term,
        XbkSelection.student_no.in_(student_numbers), XbkSelection.is_deleted.is_(False),
    ).with_for_update())
    return _scalar_rows(result)


def _selection_states(
    plan: CourseSelectionWorkbookPlan, student_numbers: Sequence[str],
    selections: Sequence[XbkSelection],
) -> dict[str, _CurrentSelectionState]:
    grouped: dict[str, list[XbkSelection]] = {student_no: [] for student_no in student_numbers}
    for selection in selections:
        grouped.setdefault(selection.student_no, []).append(selection)
    states: dict[str, _CurrentSelectionState] = {}
    issues: list[WorkbookApplyIssue] = []
    for row in plan.rows:
        active = grouped.get(row.student_no, [])
        if len(active) > 1:
            issues.append(_row_issue(
                row, "XBK_WORKBOOK_SELECTION_CONFLICT", "学生存在多条有效选课记录，不能自动回导",
                active_courses=sorted(item.course_code for item in active),
            ))
        else:
            states[row.student_no] = _CurrentSelectionState(
                course_code=_logical_course(active[0].course_code) if active else None,
                active_count=len(active),
            )
    if issues:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_APPLY_CONFLICT", "当前选课数据存在冲突，请先处理后重试", issues=issues,
        )
    return states


async def _lock_and_validate_database_baseline(
    db: AsyncSession,
    plan: CourseSelectionWorkbookPlan,
    expectation: WorkbookExpectation,
) -> dict[str, _CurrentSelectionState]:
    students = _scalar_rows(await db.execute(select(XbkStudent).where(
        XbkStudent.year == plan.year, XbkStudent.term == plan.term,
    ).order_by(XbkStudent.id).with_for_update()))
    _raise_baseline_issues(
        _student_baseline_issues(plan, expectation, students),
        "学生名册已变化，请重新导出并预览",
    )
    courses = _scalar_rows(await db.execute(select(XbkCourse).where(
        XbkCourse.year == plan.year, XbkCourse.term == plan.term,
    ).order_by(XbkCourse.id).with_for_update()))
    _raise_baseline_issues(
        _course_baseline_issues(expectation, courses),
        "课程目录已变化，请重新导出并预览",
    )
    student_numbers = sorted(row.student_no for row in expectation.students)
    selections = await _lock_current_selections(db, plan, student_numbers)
    return _selection_states(plan, student_numbers, selections)


async def _validate_current_target_capacity(
    db: AsyncSession,
    plan: CourseSelectionWorkbookPlan,
    expectation: WorkbookExpectation,
) -> None:
    """Reject an idempotent success when the locked target state is over quota."""

    quotas = {course.course_code: course.quota for course in expectation.courses}
    buckets = {
        (row.target_course, row.grade, row.class_name)
        for row in plan.changed_rows
        if row.target_course is not None
    }
    issues: list[WorkbookApplyIssue] = []
    for course_code, grade, class_name in sorted(
        buckets, key=lambda item: tuple("" if value is None else str(value) for value in item),
    ):
        grade_filter = XbkStudent.grade.is_(None) if grade is None else XbkStudent.grade == grade
        used = (await db.execute(
            select(func.count(XbkSelection.id)).select_from(XbkSelection).join(
                XbkStudent,
                and_(
                    XbkStudent.year == XbkSelection.year,
                    XbkStudent.term == XbkSelection.term,
                    XbkStudent.student_no == XbkSelection.student_no,
                ),
            ).where(
                XbkSelection.is_deleted.is_(False),
                XbkSelection.year == plan.year,
                XbkSelection.term == plan.term,
                XbkSelection.course_code == course_code,
                XbkStudent.is_deleted.is_(False),
                grade_filter,
                XbkStudent.class_name == class_name,
            )
        )).scalar_one()
        quota = int(quotas[course_code])
        if int(used or 0) > quota:
            issues.append(WorkbookApplyIssue(
                code="XBK_WORKBOOK_CAPACITY_CONFLICT",
                message="计划目标状态已超过课程限额",
                course_code=course_code,
                details={
                    "grade": grade,
                    "class_name": class_name,
                    "used": int(used or 0),
                    "quota": quota,
                },
            ))
    if issues:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_APPLY_CONFLICT",
            "计划目标状态不再满足课程限额，未应用任何修改",
            issues=issues,
        )


async def _rollback(db: AsyncSession) -> None:
    rollback = getattr(db, "rollback", None)
    if rollback is not None:
        await rollback()


def _validate_unchanged_rows(
    plan: CourseSelectionWorkbookPlan,
    states: Mapping[str, _CurrentSelectionState],
) -> None:
    issues = [
        _row_issue(
            row,
            "XBK_WORKBOOK_STALE_SELECTION",
            "学生选课已不再等于预览基线",
            baseline_course=row.baseline_course,
            current_course=states[row.student_no].course_code,
        )
        for row in plan.rows
        if row.action == "no_change"
        and states[row.student_no].course_code != row.baseline_course
    ]
    if issues:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_STALE_BASELINE",
            "预览后的未修改行选课基线已变化，未应用任何修改",
            issues=issues,
        )


def _changed_rows_are_at_target(
    changed: Sequence[WorkbookPlannedSelection],
    states: Mapping[str, _CurrentSelectionState],
) -> bool:
    at_target: list[bool] = []
    at_baseline: list[bool] = []
    stale_issues: list[WorkbookApplyIssue] = []
    for row in changed:
        current = states[row.student_no].course_code
        target_match = current == row.target_course
        baseline_match = current == row.baseline_course
        at_target.append(target_match)
        at_baseline.append(baseline_match)
        if not target_match and not baseline_match:
            stale_issues.append(_row_issue(
                row,
                "XBK_WORKBOOK_STALE_SELECTION",
                "学生选课已被并发修改",
                baseline_course=row.baseline_course,
                current_course=current,
                target_course=row.target_course,
            ))
    if stale_issues:
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_STALE_BASELINE",
            "预览后的选课基线已变化，未应用任何修改",
            issues=stale_issues,
        )
    if all(at_target):
        return True
    if all(at_baseline):
        return False
    raise CourseSelectionWorkbookServiceError(
        "XBK_WORKBOOK_STALE_BASELINE",
        "计划不是完整基线或完整目标状态，未应用任何修改",
        issues=[
            _row_issue(
                row,
                "XBK_WORKBOOK_PARTIAL_APPLY",
                "计划处于部分目标状态，拒绝继续应用",
                baseline_course=row.baseline_course,
                current_course=states[row.student_no].course_code,
                target_course=row.target_course,
            )
            for row in changed
        ],
    )


def _selection_mutations(
    plan: CourseSelectionWorkbookPlan,
    changed: Sequence[WorkbookPlannedSelection],
) -> tuple[SelectionMutation, ...]:
    return tuple(
        SelectionMutation(
            values={
                "year": plan.year,
                "term": plan.term,
                "grade": row.grade,
                "student_no": row.student_no,
                "name": row.name,
                "course_code": row.target_course or UNSELECTED_CODE,
            },
            replace_existing=True,
        )
        for row in changed
    )


async def _apply_locked_plan(
    db: AsyncSession,
    plan: CourseSelectionWorkbookPlan,
    source_expectation: WorkbookExpectation,
) -> CourseSelectionWorkbookApplyResult:
    states = await _lock_and_validate_database_baseline(db, plan, source_expectation)
    _validate_unchanged_rows(plan, states)
    changed = plan.changed_rows
    if not changed:
        return CourseSelectionWorkbookApplyResult(plan.plan_id, "no_changes", 0, 0, 0)
    if _changed_rows_are_at_target(changed, states):
        await _validate_current_target_capacity(db, plan, source_expectation)
        return CourseSelectionWorkbookApplyResult(plan.plan_id, "already_applied", 0, 0, 0)
    applied = await apply_selection_mutations(db, _selection_mutations(plan, changed))
    return CourseSelectionWorkbookApplyResult(
        plan.plan_id, "applied", len(changed), applied.inserted, applied.updated
    )


async def apply_course_selection_workbook_plan(
    db: AsyncSession,
    plan: CourseSelectionWorkbookPlan,
    *,
    expected_plan_id: str,
    source_expectation: WorkbookExpectation,
) -> CourseSelectionWorkbookApplyResult:
    """Confirm one preview plan atomically without committing the transaction.

    ``expected_plan_id`` must be recovered from server-trusted storage or an
    equivalent server-controlled signature boundary.  It must not be accepted
    from the same untrusted client that supplies ``plan``.
    """

    _validate_plan(plan, expected_plan_id, source_expectation)
    try:
        return await _apply_locked_plan(db, plan, source_expectation)
    except asyncio.CancelledError:
        try:
            await asyncio.shield(_rollback(db))
        except Exception:
            # Cancellation remains the primary control-flow signal.  A caller
            # that owns the transaction must still discard the session.
            pass
        raise
    except CourseSelectionWorkbookServiceError:
        await _rollback(db)
        raise
    except HTTPException as exc:
        await _rollback(db)
        raise CourseSelectionWorkbookServiceError(
            "XBK_WORKBOOK_APPLY_CONFLICT",
            "选课事务裁决拒绝了整批回导，未应用任何修改",
            issues=(WorkbookApplyIssue(
                code="XBK_WORKBOOK_MUTATION_REJECTED",
                message=str(exc.detail),
                details={"status_code": exc.status_code},
            ),),
            status_code=exc.status_code,
        ) from exc
    except BaseException:
        await _rollback(db)
        raise
