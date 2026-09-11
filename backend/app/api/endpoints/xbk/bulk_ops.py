"""
XBK 批量操作与元数据端点
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk.academic_year import AcademicYear
from app.services.xbk.locking import delete_locked_rows, frozen_id_condition, lock_rows

from ._common import require_xbk_access

router = APIRouter()


def _selection_delete_statement(scope, year, term, grade, class_name, student_no_sub, course_code_sub):
    """Resolve cascade membership from persisted parent identities and orphan snapshots."""
    roster_sub = select(XbkStudent.student_no).where(XbkStudent.year == year, XbkStudent.term == term)
    orphan_grade_scope = and_(
        XbkSelection.grade == grade,
        XbkSelection.student_no.not_in(roster_sub),
    )

    # Cascades follow parent identity even if a selection's grade snapshot is stale.
    stmt = delete(XbkSelection).where(XbkSelection.year == year, XbkSelection.term == term)
    if scope == "students":
        stmt = stmt.where(XbkSelection.student_no.in_(student_no_sub))
    elif scope == "courses":
        stmt = stmt.where(XbkSelection.course_code.in_(course_code_sub))
    elif scope == "all":
        if grade:
            stmt = stmt.where(or_(
                orphan_grade_scope,
                XbkSelection.student_no.in_(student_no_sub),
                XbkSelection.course_code.in_(course_code_sub),
            ))
    else:
        if class_name:
            stmt = stmt.where(XbkSelection.student_no.in_(student_no_sub))
        elif grade:
            stmt = stmt.where(or_(XbkSelection.student_no.in_(student_no_sub), orphan_grade_scope))
    return stmt


def _validate_delete_scope(scope, year, term, class_name) -> None:
    """Reject unsafe scopes before constructing or executing a deletion."""
    if year is None or not term:
        raise HTTPException(status_code=400, detail="删除操作必须指定学年和学期")

    if class_name and scope in ["all", "courses"]:
        raise HTTPException(
            status_code=400,
            detail="课程目录为年级共享数据，不能按班级删除全部或课程；请清除班级筛选，或选择学生名单/选课结果",
        )


@router.delete("", response_model=Dict[str, Any])
async def delete_data(
    scope: str = Query(..., pattern="^(all|students|courses|selections)$"),
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    _validate_delete_scope(scope, year, term, class_name)

    def base_conditions(model):
        conds: List[Any] = []
        if year is not None:
            conds.append(model.year == year)
        if term:
            conds.append(model.term == term)
        if grade and hasattr(model, "grade"):
            conds.append(model.grade == grade)
        return conds

    deleted = 0
    student_conditions = base_conditions(XbkStudent)
    if class_name:
        student_conditions.append(XbkStudent.class_name == class_name)
    try:
        # Freeze the parent set under locks BEFORE cascading. A broad parent
        # DELETE afterwards could otherwise pick up a newly inserted/moved row
        # whose selections were never included in the earlier cascade.
        students = courses = []
        if scope in ("all", "students"):
            students = await lock_rows(db, XbkStudent, *student_conditions)
        if scope in ("all", "courses"):
            courses = await lock_rows(db, XbkCourse, *base_conditions(XbkCourse))
        student_ids = [row.id for row in students]
        course_ids = [row.id for row in courses]
        student_no_sub = select(XbkStudent.student_no).where(*student_conditions)
        course_code_sub = select(XbkCourse.course_code).where(*base_conditions(XbkCourse))
        if scope in ("all", "students"):
            student_no_sub = student_no_sub.where(frozen_id_condition(XbkStudent, student_ids))
        if scope in ("all", "courses"):
            course_code_sub = course_code_sub.where(frozen_id_condition(XbkCourse, course_ids))
        stmt = _selection_delete_statement(
            scope, year, term, grade, class_name, student_no_sub, course_code_sub,
        )
        children = await lock_rows(db, XbkSelection, stmt.whereclause)
        deleted += await delete_locked_rows(db, XbkSelection, children)

        if scope in ["all", "students"]:
            deleted += await delete_locked_rows(db, XbkStudent, students)

        if scope in ["all", "courses"]:
            deleted += await delete_locked_rows(db, XbkCourse, courses)

        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"deleted": deleted}


@router.get("/meta")
async def get_meta(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    years: set[str] = set()
    terms: set[str] = set()
    classes: set[str] = set()

    for model in (XbkStudent, XbkCourse, XbkSelection):
        y_stmt = select(model.year).where(model.is_deleted.is_(False)).distinct()
        t_stmt = select(model.term).where(model.is_deleted.is_(False)).distinct()
        if year is not None:
            y_stmt = y_stmt.where(model.year == year)
            t_stmt = t_stmt.where(model.year == year)
        if term:
            y_stmt = y_stmt.where(model.term == term)
            t_stmt = t_stmt.where(model.term == term)
        if grade and hasattr(model, "grade"):
            y_stmt = y_stmt.where(model.grade == grade)
            t_stmt = t_stmt.where(model.grade == grade)
        for (y,) in (await db.execute(y_stmt)).all():
            if y is not None:
                years.add(str(y))
        for (t,) in (await db.execute(t_stmt)).all():
            if t:
                terms.add(str(t))

    class_stmt = select(XbkStudent.class_name).where(XbkStudent.is_deleted.is_(False)).distinct()
    if year is not None:
        class_stmt = class_stmt.where(XbkStudent.year == year)
    if term:
        class_stmt = class_stmt.where(XbkStudent.term == term)
    if grade:
        class_stmt = class_stmt.where(XbkStudent.grade == grade)
    for (c,) in (await db.execute(class_stmt)).all():
        if c:
            classes.add(str(c))

    return {
        "years": sorted(list(years), reverse=True),
        "terms": sorted(list(terms)),
        "classes": sorted(list(classes)),
    }
