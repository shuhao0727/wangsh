"""
XBK 选课管理 CRUD 端点（含选课结果查询）
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Numeric, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.deps import require_admin
from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk.academic_year import AcademicYear
from app.services.xbk.locking import lock_rows
from app.services.xbk.selection_rules import (
    SelectionMutation,
    apply_selection_mutations,
    is_active_selection_unique_violation,
)
from app.schemas.xbk import XbkListResponse, XbkSelectionOut, XbkSelectionUpsert

from ._common import apply_common_filters, apply_search_filter, require_xbk_access

router = APIRouter()


# ---------------------------------------------------------------------------
# CRUD 端点
# ---------------------------------------------------------------------------

@router.post("/selections", response_model=XbkSelectionOut)
async def create_selection(
    payload: XbkSelectionUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    try:
        result = await apply_selection_mutations(
            db, [SelectionMutation(payload.model_dump())],
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if is_active_selection_unique_violation(exc):
            raise HTTPException(
                status_code=409,
                detail="该学生在本学期已有有效选课，请刷新后重试",
            ) from exc
        raise
    except Exception:
        await db.rollback()
        raise
    row = result.rows[0]
    await db.refresh(row)
    return XbkSelectionOut.model_validate(row).model_dump()


@router.put("/selections/{selection_id}", response_model=XbkSelectionOut)
async def update_selection(
    selection_id: int,
    payload: XbkSelectionUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    try:
        result = await apply_selection_mutations(
            db, [SelectionMutation(payload.model_dump(), selection_id=selection_id)],
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if is_active_selection_unique_violation(exc):
            raise HTTPException(
                status_code=409,
                detail="该学生在本学期已有有效选课，请刷新后重试",
            ) from exc
        raise
    except Exception:
        await db.rollback()
        raise
    row = result.rows[0]
    await db.refresh(row)
    return XbkSelectionOut.model_validate(row).model_dump()


@router.delete("/selections/{selection_id}", status_code=204)
async def delete_selection(
    selection_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    rows = await lock_rows(db, XbkSelection, XbkSelection.id == selection_id)
    row = rows[0] if rows else None
    if not row or row.is_deleted:  # type: ignore[truthy-bool]
        raise HTTPException(status_code=404, detail="选课记录不存在")
    row.is_deleted = True  # type: ignore[assignment]
    row.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# 查询端点
# ---------------------------------------------------------------------------

@router.get("/selections", response_model=XbkListResponse)
async def list_selections(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    search_text: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    # 以学生表为主，Left Join 选课表，确保未选课学生也能显示
    stmt = (
        select(XbkStudent, XbkSelection)
        .select_from(XbkStudent)
        .outerjoin(
            XbkSelection,
            and_(
                XbkSelection.is_deleted.is_(False),
                XbkSelection.year == XbkStudent.year,
                XbkSelection.term == XbkStudent.term,
                XbkSelection.student_no == XbkStudent.student_no,
            ),
        )
        .outerjoin(
            XbkCourse,
            and_(
                XbkCourse.is_deleted.is_(False),
                XbkCourse.year == XbkSelection.year,
                XbkCourse.term == XbkSelection.term,
                XbkCourse.course_code == XbkSelection.course_code,
            ),
        )
        .where(XbkStudent.is_deleted.is_(False))
    )

    # 关键词覆盖学生、班级以及关联课程字段。
    stmt = apply_common_filters(stmt, XbkStudent, year, term, grade, None)
    stmt = apply_search_filter(stmt, search_text, [
        XbkStudent.student_no, XbkStudent.name, XbkStudent.class_name,
        XbkSelection.course_code,
    ])

    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one() or 0

    rows = (
        await db.execute(
            stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc(), XbkSelection.course_code.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    items = []
    for student, selection in rows:
        if selection:
            item = XbkSelectionOut.model_validate(selection).model_dump()
            if not item["course_code"]:
                item["course_code"] = "未选"
            items.append(item)
        else:
            # 构造虚拟未选记录
            items.append({
                "id": 0,
                "year": student.year,
                "term": student.term,
                "grade": student.grade,
                "student_no": student.student_no,
                "name": student.name,
                "course_code": "休学或其他",
            })
    return {"total": total, "items": items}


@router.get("/course-results", response_model=XbkListResponse)
async def list_course_results(
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    search_text: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    stmt = (
        select(
            XbkSelection.id.label("id"),
            XbkStudent.year.label("year"),
            XbkStudent.term.label("term"),
            XbkStudent.grade.label("grade"),
            XbkStudent.student_no.label("student_no"),
            XbkStudent.name.label("student_name"),
            XbkStudent.class_name.label("class_name"),
            XbkSelection.course_code.label("course_code"),
            XbkCourse.course_name.label("course_name"),
            XbkCourse.teacher.label("teacher"),
            XbkCourse.location.label("location"),
        )
        .select_from(XbkStudent)
        .outerjoin(
            XbkSelection,
            and_(
                XbkSelection.is_deleted.is_(False),
                XbkSelection.year == XbkStudent.year,
                XbkSelection.term == XbkStudent.term,
                XbkSelection.student_no == XbkStudent.student_no,
            ),
        )
        .outerjoin(
            XbkCourse,
            and_(
                XbkCourse.is_deleted.is_(False),
                XbkCourse.year == XbkSelection.year,
                XbkCourse.term == XbkSelection.term,
                XbkCourse.course_code == XbkSelection.course_code,
            ),
        )
        .where(XbkStudent.is_deleted.is_(False))
    )

    stmt = apply_common_filters(stmt, XbkStudent, year, term, grade, None)
    stmt = apply_search_filter(stmt, search_text, [
        XbkStudent.student_no, XbkStudent.name, XbkStudent.class_name,
        XbkSelection.course_code, XbkCourse.course_name,
        XbkCourse.teacher, XbkCourse.location,
    ])

    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one() or 0

    numeric_student_no = cast(
        func.nullif(func.regexp_replace(XbkStudent.student_no, r"\D", "", "g"), ""),
        Numeric(50, 0),
    )

    rows = (
        await db.execute(
            stmt.order_by(
                XbkStudent.class_name.asc(),
                numeric_student_no.asc().nulls_last(),
                XbkStudent.student_no.asc(),
                XbkSelection.course_code.asc(),
            )
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    items = [
        {
            "id": int(r.id) if r.id else 0,
            "year": str(r.year),
            "term": str(r.term),
            "grade": str(r.grade) if r.grade else None,
            "student_no": str(r.student_no),
            "student_name": str(r.student_name) if r.student_name else None,
            "class_name": str(r.class_name) if r.class_name else None,
            "course_code": str(r.course_code) if r.course_code else ("未选" if r.id else "休学或其他"),
            "course_name": str(r.course_name) if r.course_name else ("未选" if r.id else "休学或其他"),
            "teacher": str(r.teacher) if r.teacher else None,
            "location": str(r.location) if r.location else None,
        }
        for r in rows
    ]
    return {"total": total, "items": items}
