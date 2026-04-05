"""
XBK 批量操作与元数据端点
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent

from ._common import require_xbk_access

router = APIRouter()


@router.delete("", response_model=Dict[str, Any])
async def delete_data(
    scope: str = Query(..., pattern="^(all|students|courses|selections)$"),
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    if year is None or not term:
        raise HTTPException(status_code=400, detail="删除操作必须指定年份和学期")

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
    student_no_sub = select(XbkStudent.student_no).where(*base_conditions(XbkStudent))
    if class_name:
        student_no_sub = student_no_sub.where(XbkStudent.class_name == class_name)

    course_code_sub = select(XbkCourse.course_code).where(*base_conditions(XbkCourse))

    if scope in ["all", "selections", "students", "courses"]:
        stmt = delete(XbkSelection).where(*base_conditions(XbkSelection))
        if scope in ["all", "students"] or class_name:
            stmt = stmt.where(XbkSelection.student_no.in_(student_no_sub))
        if scope in ["all", "courses"]:
            stmt = stmt.where(XbkSelection.course_code.in_(course_code_sub))
        res = await db.execute(stmt)
        deleted += res.rowcount or 0  # type: ignore[union-attr]

    if scope in ["all", "students"]:
        stmt = delete(XbkStudent).where(*base_conditions(XbkStudent))
        if class_name:
            stmt = stmt.where(XbkStudent.class_name == class_name)
        res = await db.execute(stmt)
        deleted += res.rowcount or 0  # type: ignore[union-attr]

    if scope in ["all", "courses"]:
        stmt = delete(XbkCourse).where(*base_conditions(XbkCourse))
        res = await db.execute(stmt)
        deleted += res.rowcount or 0  # type: ignore[union-attr]

    await db.commit()
    return {"deleted": deleted}


@router.get("/meta")
async def get_meta(
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    years: set[int] = set()
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
                years.add(int(y))
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
