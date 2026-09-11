from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.api.endpoints.xbk._common import UNSELECTED_COURSE_CODES, require_xbk_access
from app.schemas.xbk.academic_year import AcademicYear
from app.schemas.xbk.data import XbkStudentOut

router = APIRouter()


def _has_selection():
    """Match the roster identity, not just a student number shared by other terms."""
    return select(XbkSelection.id).where(
        XbkSelection.is_deleted.is_(False),
        XbkSelection.year == XbkStudent.year,
        XbkSelection.term == XbkStudent.term,
        XbkSelection.student_no == XbkStudent.student_no,
    ).exists()


def _student_scope_filters(
    year: Optional[AcademicYear],
    term: Optional[str],
    grade: Optional[str],
    class_name: Optional[str],
) -> list:
    filters: list = [XbkStudent.is_deleted.is_(False)]
    if year is not None:
        filters.append(XbkStudent.year == year)
    if term:
        filters.append(XbkStudent.term == term)
    if grade:
        filters.append(XbkStudent.grade == grade)
    if class_name:
        filters.append(XbkStudent.class_name == class_name)
    return filters


def _course_scope_filters(
    year: Optional[AcademicYear],
    term: Optional[str],
    grade: Optional[str],
    class_name: Optional[str],
    student_filters: list,
) -> list:
    filters: list = [
        XbkCourse.is_deleted.is_(False),
        XbkCourse.course_code.notin_(UNSELECTED_COURSE_CODES),
    ]
    if year is not None:
        filters.append(XbkCourse.year == year)
    if term:
        filters.append(XbkCourse.term == term)
    if grade:
        filters.append(XbkCourse.grade == grade)
    if class_name:
        # A class name is only meaningful inside a grade. Resolve its actual
        # grade scope from the live roster so same-named classes stay separate.
        scoped_grades = (
            select(XbkStudent.grade)
            .where(*student_filters, XbkStudent.grade.is_not(None))
            .distinct()
        )
        filters.append(XbkCourse.grade.in_(scoped_grades))
    return filters



@router.get("/summary")
async def get_summary(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    student_filters = _student_scope_filters(year, term, grade, class_name)

    students_stmt = select(func.count()).select_from(XbkStudent).where(*student_filters)
    students = (await db.execute(students_stmt)).scalar_one() or 0

    course_filters = _course_scope_filters(year, term, grade, class_name, student_filters)
    courses_stmt = select(func.count()).select_from(XbkCourse).where(*course_filters)
    courses = (await db.execute(courses_stmt)).scalar_one() or 0

    student_scope_sub = (
        select(
            XbkStudent.student_no.label("student_no"),
            XbkStudent.year.label("year"),
            XbkStudent.term.label("term"),
        )
        .where(*student_filters)
        .subquery()
    )
    selection_scope = (
        select(func.count())
        .select_from(XbkSelection)
        .join(
            student_scope_sub,
            and_(
                XbkSelection.student_no == student_scope_sub.c.student_no,
                XbkSelection.year == student_scope_sub.c.year,
                XbkSelection.term == student_scope_sub.c.term,
            ),
        )
        .where(XbkSelection.is_deleted.is_(False))
    )
    selections_stmt = selection_scope.where(XbkSelection.course_code.notin_(UNSELECTED_COURSE_CODES))
    unselected_stmt = selection_scope.where(XbkSelection.course_code.in_(UNSELECTED_COURSE_CODES))
    selections = (await db.execute(selections_stmt)).scalar_one() or 0
    unselected_count = (await db.execute(unselected_stmt)).scalar_one() or 0

    suspended_stmt = select(func.count()).select_from(XbkStudent).where(
        *student_filters,
        ~_has_selection(),
    )
    suspended_count = (await db.execute(suspended_stmt)).scalar_one() or 0

    return {
        "students": int(students),
        "courses": int(courses),
        "selections": int(selections),
        "unselected_count": int(unselected_count),
        "suspended_count": int(suspended_count),
    }


@router.get("/course-stats")
async def course_stats(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    student_filters = _student_scope_filters(year, term, grade, class_name)
    course_filters = _course_scope_filters(year, term, grade, class_name, student_filters)

    # 班级身份必须包含年级；同名班级不能跨年级合并。课程容量按课程所属年级计算。
    class_count_stmt = (
        select(XbkStudent.grade, func.count(func.distinct(XbkStudent.class_name)).label("count"))
        .where(*student_filters)
        .group_by(XbkStudent.grade)
    )
    class_counts = {
        str(row_grade) if row_grade is not None else "": int(count or 0)
        for row_grade, count in (await db.execute(class_count_stmt)).all()
    }
    scoped_class_count = sum(class_counts.values())

    student_scope_sub = (
        select(
            XbkStudent.student_no.label("student_no"),
            XbkStudent.year.label("year"),
            XbkStudent.term.label("term"),
        )
        .where(*student_filters)
        .subquery()
    )
    selection_counts = (
        select(
            XbkSelection.year.label("year"),
            XbkSelection.term.label("term"),
            XbkSelection.course_code.label("course_code"),
            func.count(XbkSelection.id).label("count"),
        )
        .join(
            student_scope_sub,
            and_(
                XbkSelection.year == student_scope_sub.c.year,
                XbkSelection.term == student_scope_sub.c.term,
                XbkSelection.student_no == student_scope_sub.c.student_no,
            ),
        )
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.course_code.notin_(UNSELECTED_COURSE_CODES),
        )
        .group_by(XbkSelection.year, XbkSelection.term, XbkSelection.course_code)
        .subquery()
    )

    # The course catalog is the source of truth. This keeps zero-enrollment
    # courses visible and excludes deleted courses and orphan course codes.
    course_stmt = (
        select(
            XbkCourse.course_code,
            XbkCourse.course_name,
            XbkCourse.quota,
            XbkCourse.grade.label("course_grade"),
            func.coalesce(selection_counts.c.count, 0).label("count"),
        )
        .outerjoin(
            selection_counts,
            and_(
                XbkCourse.year == selection_counts.c.year,
                XbkCourse.term == selection_counts.c.term,
                XbkCourse.course_code == selection_counts.c.course_code,
            ),
        )
        .where(*course_filters)
    )
    rows = (await db.execute(course_stmt)).all()

    items = []
    for code, name, quota, course_grade, count in rows:
        course_class_count = (
            class_counts.get(str(course_grade), 0)
            if course_grade
            else scoped_class_count
        )
        items.append({
            "course_code": str(code),
            "course_name": str(name),
            "count": int(count),
            "quota": int(quota or 0),
            "grade": str(course_grade) if course_grade else None,
            "class_count": course_class_count,
            "allowed_total": int(quota or 0) * course_class_count,
        })
    
    unselected_stmt = (
        select(func.count())
        .select_from(XbkSelection)
        .join(
            student_scope_sub,
            and_(
                XbkSelection.year == student_scope_sub.c.year,
                XbkSelection.term == student_scope_sub.c.term,
                XbkSelection.student_no == student_scope_sub.c.student_no,
            ),
        )
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.course_code.in_(UNSELECTED_COURSE_CODES),
        )
    )
    unselected_count = int((await db.execute(unselected_stmt)).scalar_one() or 0)
    if unselected_count:
        items.append({
            "course_code": "未选", "course_name": "未选", "count": unselected_count,
            "quota": 0, "grade": grade, "class_count": scoped_class_count, "allowed_total": 0,
        })

    # Calculate unselected students (Actually Suspended/Other in new logic)
    suspended_stmt = select(func.count()).select_from(XbkStudent).where(
        *student_filters,
        ~_has_selection(),
    )
    suspended_count = (await db.execute(suspended_stmt)).scalar_one() or 0
    
    # Add virtual row for "休学或其他"
    if suspended_count > 0:
        items.append({
            "course_code": "休学或其他",
            "course_name": "休学或其他",
            "count": suspended_count,
            "quota": 0,
            "grade": grade,
            "class_count": 0,
            "allowed_total": 0,
        })
    
    # 按照课程代码排序 (尝试转换为数字排序)
    def _sort_key(item):
        code = item["course_code"]
        if code == "":
            item["course_code"] = "未选"
            item["course_name"] = "未选"
            return (2, 0) # Unselected
        if code == "未选": # In case it's already "未选"
             return (2, 0)
        if code == "休学或其他":
            return (3, 0) # Suspended at the very end
        if code.isdigit():
            return (0, int(code))
        return (1, code)
    
    items.sort(key=_sort_key)
    return {"items": items}


@router.get("/class-stats")
async def class_stats(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    stmt = (
        select(XbkStudent.grade, XbkStudent.class_name, func.count().label("count"))
        .where(XbkStudent.is_deleted.is_(False))
        .group_by(XbkStudent.grade, XbkStudent.class_name)
    )
    if year is not None:
        stmt = stmt.where(XbkStudent.year == year)
    if term:
        stmt = stmt.where(XbkStudent.term == term)
    if grade:
        stmt = stmt.where(XbkStudent.grade == grade)
    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)
    rows = (await db.execute(stmt)).all()
    items = [
        {"grade": str(row_grade) if row_grade else None, "class_name": str(cls), "count": int(count)}
        for row_grade, cls, count in rows
    ]
    
    # 按照班级名称排序
    def _sort_key(item):
        name = item["class_name"]
        # 尝试提取班级中的数字进行排序，例如 "高二(1)班" -> 1
        import re
        match = re.search(r'\((\d+)\)', name) or re.search(r'（(\d+)）', name) or re.search(r'(\d+)', name)
        if match:
             return (str(item.get("grade") or ""), 0, int(match.group(1)), name)
        return (str(item.get("grade") or ""), 1, 0, name)
        
    items.sort(key=_sort_key)
    return {"items": items}


@router.get("/students-with-empty-selection")
async def students_with_empty_selection(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    stmt = (
        select(XbkStudent)
        .select_from(XbkSelection)
        .join(
            XbkStudent,
            and_(
                XbkStudent.is_deleted.is_(False),
                XbkStudent.year == XbkSelection.year,
                XbkStudent.term == XbkSelection.term,
                XbkStudent.student_no == XbkSelection.student_no,
            ),
        )
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.course_code.in_(UNSELECTED_COURSE_CODES)
        )
    )

    if year is not None:
        stmt = stmt.where(XbkSelection.year == year)
    if term:
        stmt = stmt.where(XbkSelection.term == term)
    if grade:
        stmt = stmt.where(XbkStudent.grade == grade)
    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)

    rows = (await db.execute(stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc()))).scalars().all()
    items = [XbkStudentOut.model_validate(r).model_dump() for r in rows]
    return {"items": items}


@router.get("/students-without-selection")
async def students_without_selection(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    students_stmt = select(XbkStudent).where(
        XbkStudent.is_deleted.is_(False),
        ~_has_selection(),
    )
    if year is not None:
        students_stmt = students_stmt.where(XbkStudent.year == year)
    if term:
        students_stmt = students_stmt.where(XbkStudent.term == term)
    if grade:
        students_stmt = students_stmt.where(XbkStudent.grade == grade)
    if class_name:
        students_stmt = students_stmt.where(XbkStudent.class_name == class_name)

    rows = (await db.execute(
        students_stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc())
    )).scalars().all()
    return {"items": [XbkStudentOut.model_validate(row).model_dump() for row in rows]}
