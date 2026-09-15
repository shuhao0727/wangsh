"""XBK selection transaction decisions and parent-change guards."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Optional, Sequence

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import XbkCourse, XbkSelection, XbkStudent
from app.services.xbk.locking import lock_key_rows, lock_rows

UNSELECTED_CODES = ("", "未选")
ACTIVE_SELECTION_UNIQUE_CONSTRAINT = "uq_xbk_selections_active_period_student"


def is_active_selection_unique_violation(exc: BaseException) -> bool:
    """Return whether an IntegrityError names the R4 active-selection index."""
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        diag = getattr(current, "diag", None)
        constraint_name = (
            getattr(diag, "constraint_name", None)
            or getattr(current, "constraint_name", None)
        )
        if constraint_name == ACTIVE_SELECTION_UNIQUE_CONSTRAINT:
            return True
        current = getattr(current, "orig", None) or getattr(current, "__cause__", None)
    return ACTIVE_SELECTION_UNIQUE_CONSTRAINT in str(exc)


@dataclass(frozen=True)
class SelectionMutation:
    values: Mapping[str, Any]
    selection_id: Optional[int] = None
    replace_existing: bool = False


@dataclass(frozen=True)
class SelectionApplyResult:
    rows: Sequence[XbkSelection]
    inserted: int
    updated: int


def _student_key(values: Mapping[str, Any]) -> tuple[str, str, str]:
    return (str(values["year"]), str(values["term"]), str(values["student_no"]))


def _course_key(values: Mapping[str, Any]) -> tuple[str, str, str]:
    return (str(values["year"]), str(values["term"]), str(values["course_code"]))


def _same_nullable(column, value):
    return column.is_(None) if value is None else column == value


async def _flush(db: AsyncSession) -> None:
    flush = getattr(db, "flush", None)
    if flush is not None:
        await flush()


@dataclass(frozen=True)
class _SelectionContext:
    locked_students: Mapping[tuple[str, str, str], XbkStudent]
    courses: Mapping[tuple[str, str, str], XbkCourse]
    locked_selections: Sequence[XbkSelection]
    selections_by_id: Mapping[int, XbkSelection]
    selections_by_student: dict[tuple[str, str, str], list[XbkSelection]]


def _validate_target_keys(mutations: Sequence[SelectionMutation]) -> list[tuple[str, str, str]]:
    target_keys = [_student_key(item.values) for item in mutations]
    if len(set(target_keys)) != len(target_keys):
        raise HTTPException(status_code=409, detail="同一批次中每名学生只能提交一个最终选课位置")
    return target_keys


async def _load_selection_snapshots(
    db: AsyncSession,
    mutations: Sequence[SelectionMutation],
) -> tuple[list[int], list[XbkSelection], dict[int, tuple[str, str, str, str]]]:
    ids = sorted({item.selection_id for item in mutations if item.selection_id is not None})
    if not ids:
        return [], [], {}
    snapshots = (
        await db.execute(select(XbkSelection).where(XbkSelection.id.in_(ids)))
    ).scalars().all()
    found = {row.id for row in snapshots if not row.is_deleted}
    if found != set(ids):
        raise HTTPException(status_code=404, detail="选课记录不存在")
    source_keys = {
        row.id: (row.year, row.term, row.student_no, row.course_code)
        for row in snapshots
    }
    return ids, snapshots, source_keys


async def _discover_students(
    db: AsyncSession,
    student_keys: set[tuple[str, str, str]],
) -> list[XbkStudent]:
    discovered: list[XbkStudent] = []
    key_list = sorted(student_keys)
    for offset in range(0, len(key_list), 500):
        conditions = [
            and_(
                XbkStudent.year == year,
                XbkStudent.term == term,
                XbkStudent.student_no == student_no,
            )
            for year, term, student_no in key_list[offset : offset + 500]
        ]
        rows = (await db.execute(select(XbkStudent).where(or_(*conditions)))).scalars().all()
        discovered.extend(rows)
    return discovered


def _active_student_map(students: Iterable[XbkStudent]) -> dict[tuple[str, str, str], XbkStudent]:
    return {
        (row.year, row.term, row.student_no): row
        for row in students
        if not row.is_deleted
    }


def _ensure_target_students_exist(
    target_keys: Sequence[tuple[str, str, str]],
    active_students: Mapping[tuple[str, str, str], XbkStudent],
) -> None:
    if any(key not in active_students for key in target_keys):
        raise HTTPException(
            status_code=404,
            detail="学生不存在（请先维护学生名单；须为同学年、同学期且未删除）",
        )


def _roster_sort_key(values: Iterable[Any]) -> tuple[str, ...]:
    return tuple("" if value is None else str(value) for value in values)


async def _discover_roster_ids(
    db: AsyncSession,
    discovered_students: Sequence[XbkStudent],
    active_students: Mapping[tuple[str, str, str], XbkStudent],
) -> set[int]:
    roster_ids = {row.id for row in discovered_students}
    buckets = {
        (row.year, row.term, row.grade, row.class_name)
        for row in active_students.values()
    }
    for year, term, grade, class_name in sorted(buckets, key=_roster_sort_key):
        condition = and_(
            XbkStudent.year == year,
            XbkStudent.term == term,
            _same_nullable(XbkStudent.grade, grade),
            XbkStudent.class_name == class_name,
        )
        roster_ids.update(
            (await db.execute(select(XbkStudent.id).where(condition))).scalars().all()
        )
    return roster_ids


def _validate_locked_targets(
    target_keys: Sequence[tuple[str, str, str]],
    discovered: Mapping[tuple[str, str, str], XbkStudent],
    locked: Mapping[tuple[str, str, str], XbkStudent],
) -> None:
    for key in target_keys:
        locked_student = locked.get(key)
        if not locked_student:
            raise HTTPException(status_code=404, detail="学生不存在（请刷新名单后重试）")
        discovered_student = discovered[key]
        if (locked_student.grade, locked_student.class_name) != (
            discovered_student.grade,
            discovered_student.class_name,
        ):
            raise HTTPException(status_code=409, detail="学生班级信息已变化，请刷新后重试")


async def _lock_student_rosters(
    db: AsyncSession,
    target_keys: Sequence[tuple[str, str, str]],
    student_keys: set[tuple[str, str, str]],
) -> dict[tuple[str, str, str], XbkStudent]:
    discovered = await _discover_students(db, student_keys)
    active_students = _active_student_map(discovered)
    _ensure_target_students_exist(target_keys, active_students)
    roster_ids = await _discover_roster_ids(db, discovered, active_students)
    locked_rows = (
        await lock_rows(db, XbkStudent, XbkStudent.id.in_(sorted(roster_ids)))
        if roster_ids
        else []
    )
    locked_students = _active_student_map(locked_rows)
    _validate_locked_targets(target_keys, active_students, locked_students)
    return locked_students


def _involved_course_keys(
    mutations: Sequence[SelectionMutation],
    snapshots: Sequence[XbkSelection],
) -> set[tuple[str, str, str]]:
    keys = {
        _course_key(item.values)
        for item in mutations
        if str(item.values["course_code"]) not in UNSELECTED_CODES
    }
    keys.update(
        (row.year, row.term, row.course_code)
        for row in snapshots
        if row.course_code not in UNSELECTED_CODES
    )
    return keys


def _validate_target_courses(
    mutations: Sequence[SelectionMutation],
    courses: Mapping[tuple[str, str, str], XbkCourse],
) -> None:
    for item in mutations:
        code = str(item.values["course_code"])
        if code not in UNSELECTED_CODES and _course_key(item.values) not in courses:
            raise HTTPException(
                status_code=404,
                detail="课程不存在（请先维护选课目录；须为同学年、同学期且未删除）",
            )


async def _lock_courses(
    db: AsyncSession,
    mutations: Sequence[SelectionMutation],
    snapshots: Sequence[XbkSelection],
) -> dict[tuple[str, str, str], XbkCourse]:
    course_keys = _involved_course_keys(mutations, snapshots)
    locked = (
        await lock_key_rows(
            db,
            XbkCourse,
            ("year", "term", "course_code"),
            sorted(course_keys),
        )
        if course_keys
        else []
    )
    courses = {
        (row.year, row.term, row.course_code): row
        for row in locked
        if not row.is_deleted
    }
    _validate_target_courses(mutations, courses)
    return courses


def _selection_lock_condition(
    student_keys: set[tuple[str, str, str]],
    selection_ids: Sequence[int],
):
    conditions = [
        and_(
            XbkSelection.year == year,
            XbkSelection.term == term,
            XbkSelection.student_no == student_no,
        )
        for year, term, student_no in sorted(student_keys)
    ]
    if selection_ids:
        conditions.append(XbkSelection.id.in_(selection_ids))
    return or_(*conditions)


def _validate_selection_snapshots(
    selections_by_id: Mapping[int, XbkSelection],
    source_keys: Mapping[int, tuple[str, str, str, str]],
) -> None:
    for selection_id, source_key in source_keys.items():
        locked = selections_by_id.get(selection_id)
        locked_key = (
            (locked.year, locked.term, locked.student_no, locked.course_code)
            if locked
            else None
        )
        if locked_key != source_key:
            raise HTTPException(status_code=409, detail="选课记录已被并发修改，请刷新后重试")


def _group_selections_by_student(
    rows: Sequence[XbkSelection],
) -> dict[tuple[str, str, str], list[XbkSelection]]:
    grouped: dict[tuple[str, str, str], list[XbkSelection]] = {}
    for row in rows:
        grouped.setdefault((row.year, row.term, row.student_no), []).append(row)
    return grouped


async def _build_selection_context(
    db: AsyncSession,
    mutations: Sequence[SelectionMutation],
) -> _SelectionContext:
    target_keys = _validate_target_keys(mutations)
    ids, snapshots, source_keys = await _load_selection_snapshots(db, mutations)
    student_keys = set(target_keys)
    student_keys.update((row.year, row.term, row.student_no) for row in snapshots)
    locked_students = await _lock_student_rosters(db, target_keys, student_keys)
    courses = await _lock_courses(db, mutations, snapshots)
    locked_selections = await lock_rows(
        db,
        XbkSelection,
        _selection_lock_condition(student_keys, ids),
    )
    selections_by_id = {row.id: row for row in locked_selections}
    _validate_selection_snapshots(selections_by_id, source_keys)
    return _SelectionContext(
        locked_students=locked_students,
        courses=courses,
        locked_selections=locked_selections,
        selections_by_id=selections_by_id,
        selections_by_student=_group_selections_by_student(locked_selections),
    )


def _ensure_no_other_rows(
    rows: Iterable[XbkSelection],
    row: XbkSelection,
    detail: str,
) -> None:
    if any(candidate.id != row.id for candidate in rows):
        raise HTTPException(status_code=409, detail=detail)


def _resolve_explicit_row(
    item: SelectionMutation,
    active: Sequence[XbkSelection],
    exact: Sequence[XbkSelection],
    selections_by_id: Mapping[int, XbkSelection],
) -> XbkSelection:
    row = selections_by_id.get(item.selection_id)
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="选课记录不存在")
    _ensure_no_other_rows(active, row, "该学生存在多条有效选课记录，请先处理历史冲突")
    _ensure_no_other_rows(exact, row, "目标选课键已有历史记录，需先完成数据清理或唯一约束迁移")
    return row


def _resolve_active_row(
    item: SelectionMutation,
    active: Sequence[XbkSelection],
    exact: Sequence[XbkSelection],
) -> XbkSelection:
    if len(active) > 1:
        raise HTTPException(status_code=409, detail="该学生存在多条有效选课记录，请先处理历史冲突")
    if not item.replace_existing:
        raise HTTPException(status_code=409, detail="每名学生只能选择一门课程")
    row = active[0]
    _ensure_no_other_rows(exact, row, "目标选课键已有历史记录，需先完成数据清理或唯一约束迁移")
    return row


def _resolve_inactive_row(
    db: AsyncSession,
    exact: Sequence[XbkSelection],
) -> tuple[XbkSelection, bool]:
    if len(exact) > 1:
        raise HTTPException(status_code=409, detail="目标选课键存在重复历史记录，请先完成数据清理")
    if exact:
        return exact[0], False
    row = XbkSelection()
    db.add(row)
    return row, True


def _resolve_mutation_row(
    db: AsyncSession,
    item: SelectionMutation,
    active: Sequence[XbkSelection],
    exact: Sequence[XbkSelection],
    selections_by_id: Mapping[int, XbkSelection],
) -> tuple[XbkSelection, bool]:
    if item.selection_id is not None:
        return _resolve_explicit_row(item, active, exact, selections_by_id), False
    if active:
        return _resolve_active_row(item, active, exact), False
    return _resolve_inactive_row(db, exact)


def _apply_mutation_values(
    row: XbkSelection,
    values: Mapping[str, Any],
    now: datetime,
) -> None:
    for field, value in values.items():
        setattr(row, field, value)
    row.is_deleted = False
    row.updated_at = now


def _capacity_key(
    values: Mapping[str, Any],
    student: XbkStudent,
) -> tuple[str, str, str, Optional[str], str] | None:
    code = str(values["course_code"])
    if code in UNSELECTED_CODES:
        return None
    year, term, _student_no = _student_key(values)
    return (year, term, code, student.grade, student.class_name)


def _apply_mutations(
    db: AsyncSession,
    mutations: Sequence[SelectionMutation],
    context: _SelectionContext,
) -> tuple[list[XbkSelection], int, int, set[tuple[str, str, str, Optional[str], str]]]:
    changed_rows: list[XbkSelection] = []
    inserted = updated = 0
    affected_capacity: set[tuple[str, str, str, Optional[str], str]] = set()
    now = datetime.now(timezone.utc)
    for item in mutations:
        values = dict(item.values)
        key = _student_key(values)
        rows = context.selections_by_student.get(key, [])
        active = [row for row in rows if not row.is_deleted]
        code = str(values["course_code"])
        exact = [row for row in rows if row.course_code == code]
        row, created = _resolve_mutation_row(
            db, item, active, exact, context.selections_by_id
        )
        inserted += int(created)
        updated += int(not created)
        if created:
            context.selections_by_student.setdefault(key, []).append(row)
        _apply_mutation_values(row, values, now)
        changed_rows.append(row)
        capacity_key = _capacity_key(values, context.locked_students[key])
        if capacity_key:
            affected_capacity.add(capacity_key)
    return changed_rows, inserted, updated, affected_capacity


def _validate_final_student_positions(
    locked_selections: Sequence[XbkSelection],
    changed_rows: Sequence[XbkSelection],
) -> None:
    final_rows = list(locked_selections)
    final_rows.extend(
        row
        for row in changed_rows
        if all(row is not current for current in final_rows)
    )
    counts: dict[tuple[str, str, str], int] = {}
    for row in final_rows:
        if not row.is_deleted:
            key = (row.year, row.term, row.student_no)
            counts[key] = counts.get(key, 0) + 1
    if any(count > 1 for count in counts.values()):
        raise HTTPException(
            status_code=409,
            detail="每个学期每名学生最多只能有一个有效选课位置",
        )


async def _capacity_used(
    db: AsyncSession,
    year: str,
    term: str,
    code: str,
    grade: Optional[str],
    class_name: str,
) -> int:
    statement = (
        select(func.count(XbkSelection.id))
        .select_from(XbkSelection)
        .join(
            XbkStudent,
            and_(
                XbkStudent.year == XbkSelection.year,
                XbkStudent.term == XbkSelection.term,
                XbkStudent.student_no == XbkSelection.student_no,
            ),
        )
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.year == year,
            XbkSelection.term == term,
            XbkSelection.course_code == code,
            XbkStudent.is_deleted.is_(False),
            _same_nullable(XbkStudent.grade, grade),
            XbkStudent.class_name == class_name,
        )
    )
    used = (await db.execute(statement)).scalar_one()
    return int(used or 0)


async def _validate_capacities(
    db: AsyncSession,
    affected: Iterable[tuple[str, str, str, Optional[str], str]],
    courses: Mapping[tuple[str, str, str], XbkCourse],
) -> None:
    for year, term, code, grade, class_name in sorted(affected, key=_roster_sort_key):
        quota = int(courses[(year, term, code)].quota or 0)
        used = await _capacity_used(db, year, term, code, grade, class_name)
        if used > quota:
            raise HTTPException(
                status_code=409,
                detail=f"课程已满（{grade or '未分年级'} {class_name}，限额 {quota} 人）",
            )


async def apply_selection_mutations(
    db: AsyncSession,
    mutations: Sequence[SelectionMutation],
) -> SelectionApplyResult:
    """Apply one final selection position per student in the caller transaction."""
    if not mutations:
        return SelectionApplyResult(rows=(), inserted=0, updated=0)
    context = await _build_selection_context(db, mutations)
    changed_rows, inserted, updated, affected = _apply_mutations(
        db, mutations, context
    )
    await _flush(db)
    _validate_final_student_positions(context.locked_selections, changed_rows)
    await _validate_capacities(db, affected, context.courses)
    return SelectionApplyResult(
        rows=tuple(changed_rows),
        inserted=inserted,
        updated=updated,
    )


async def _load_student_references(
    db: AsyncSession,
    row: XbkStudent,
) -> list[XbkSelection]:
    return (
        await db.execute(
            select(XbkSelection).where(
                XbkSelection.year == row.year,
                XbkSelection.term == row.term,
                XbkSelection.student_no == row.student_no,
            )
        )
    ).scalars().all()


def _student_natural_key_changed(row: XbkStudent, values: Mapping[str, Any]) -> bool:
    return any(
        str(getattr(row, field)) != str(values[field])
        for field in ("year", "term", "student_no")
    )


def _active_course_references(references: Iterable[XbkSelection]) -> list[XbkSelection]:
    return [
        selection
        for selection in references
        if not selection.is_deleted and selection.course_code not in UNSELECTED_CODES
    ]


async def _lock_student_reference_courses(
    db: AsyncSession,
    active: Sequence[XbkSelection],
) -> dict[tuple[str, str, str], XbkCourse]:
    keys = sorted(
        {(selection.year, selection.term, selection.course_code) for selection in active}
    )
    courses = await lock_key_rows(
        db, XbkCourse, ("year", "term", "course_code"), keys
    )
    await lock_rows(
        db,
        XbkSelection,
        XbkSelection.id.in_(sorted(selection.id for selection in active)),
    )
    return {
        (course.year, course.term, course.course_code): course
        for course in courses
        if not course.is_deleted
    }


async def _destination_course_used(
    db: AsyncSession,
    row: XbkStudent,
    values: Mapping[str, Any],
    course_code: str,
) -> int:
    statement = (
        select(func.count(XbkSelection.id))
        .select_from(XbkSelection)
        .join(
            XbkStudent,
            and_(
                XbkStudent.year == XbkSelection.year,
                XbkStudent.term == XbkSelection.term,
                XbkStudent.student_no == XbkSelection.student_no,
            ),
        )
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.year == values["year"],
            XbkSelection.term == values["term"],
            XbkSelection.course_code == course_code,
            XbkStudent.is_deleted.is_(False),
            XbkStudent.id != row.id,
            _same_nullable(XbkStudent.grade, values.get("grade")),
            XbkStudent.class_name == values["class_name"],
        )
    )
    used = (await db.execute(statement)).scalar_one()
    return int(used or 0)


async def _validate_student_destination_capacity(
    db: AsyncSession,
    row: XbkStudent,
    values: Mapping[str, Any],
    active: Sequence[XbkSelection],
    courses: Mapping[tuple[str, str, str], XbkCourse],
) -> None:
    for selection in active:
        course = courses.get((selection.year, selection.term, selection.course_code))
        if not course:
            raise HTTPException(
                status_code=409,
                detail="学生存在失效课程关联，不能直接变更班级或年级",
            )
        used = await _destination_course_used(
            db, row, values, selection.course_code
        )
        if used + 1 > int(course.quota or 0):
            raise HTTPException(
                status_code=409,
                detail=f"目标班级的课程 {selection.course_code} 已满，不能移动学生",
            )


async def guard_student_change(
    db: AsyncSession,
    row: XbkStudent,
    values: Mapping[str, Any],
) -> None:
    """Reject unsafe student identity changes and capacity-breaking class moves."""
    references = await _load_student_references(db, row)
    if _student_natural_key_changed(row, values) and references:
        raise HTTPException(
            status_code=409,
            detail="该学生已有选课关联，不能修改学年、学期或学号",
        )
    if (values.get("grade"), values["class_name"]) == (row.grade, row.class_name):
        return
    active = _active_course_references(references)
    if not active:
        return
    courses = await _lock_student_reference_courses(db, active)
    await _validate_student_destination_capacity(db, row, values, active, courses)


async def guard_course_change(db: AsyncSession, row: XbkCourse, values: Mapping[str, Any]) -> None:
    """Reject referenced natural-key changes and quota reductions below occupancy."""
    natural_changed = any(str(getattr(row, field)) != str(values[field]) for field in ("year", "term", "course_code"))
    references = (await db.execute(select(XbkSelection).where(
        XbkSelection.year == row.year,
        XbkSelection.term == row.term,
        XbkSelection.course_code == row.course_code,
    ))).scalars().all()
    if natural_changed and references:
        raise HTTPException(status_code=409, detail="该课程已有选课关联，不能修改学年、学期或课程代码")
    active_ids = sorted(selection.id for selection in references if not selection.is_deleted)
    if active_ids:
        await lock_rows(db, XbkSelection, XbkSelection.id.in_(active_ids))
    new_quota = int(values.get("quota") or 0)
    buckets = (await db.execute(select(
        XbkStudent.grade, XbkStudent.class_name, func.count(XbkSelection.id),
    ).select_from(XbkSelection).join(
        XbkStudent,
        and_(XbkStudent.year == XbkSelection.year, XbkStudent.term == XbkSelection.term,
             XbkStudent.student_no == XbkSelection.student_no),
    ).where(
        XbkSelection.is_deleted.is_(False),
        XbkSelection.year == row.year,
        XbkSelection.term == row.term,
        XbkSelection.course_code == row.course_code,
        XbkStudent.is_deleted.is_(False),
    ).group_by(XbkStudent.grade, XbkStudent.class_name))).all()
    over = [(grade, class_name, int(used)) for grade, class_name, used in buckets if int(used) > new_quota]
    if over:
        grade, class_name, used = sorted(over, key=lambda item: (-item[2], str(item[0]), item[1]))[0]
        raise HTTPException(
            status_code=409,
            detail=f"限额不能降至 {new_quota}：{grade or '未分年级'} {class_name} 已有 {used} 人选课",
        )
