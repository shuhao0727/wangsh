"""
XBK 课程管理 CRUD 端点
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Integer, case, cast, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.database import get_db
from app.models import XbkCourse
from app.schemas.xbk import XbkCourseOut, XbkCourseUpsert, XbkListResponse

from ._common import apply_common_filters, require_xbk_access

router = APIRouter()


@router.get("/courses", response_model=XbkListResponse)
async def list_courses(
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    search_text: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    stmt = select(XbkCourse).where(XbkCourse.is_deleted.is_(False))
    stmt = apply_common_filters(stmt, XbkCourse, year, term, grade, search_text)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one() or 0

    numeric_course_code = case(
        (XbkCourse.course_code.op("~")("^[0-9]+$"), cast(XbkCourse.course_code, Integer)),
        else_=None,
    )
    rows = (
        await db.execute(
            stmt.order_by(numeric_course_code.asc().nulls_last(), XbkCourse.course_code.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()

    items = [XbkCourseOut.model_validate(r).model_dump() for r in rows]
    return {"total": total, "items": items}


@router.post("/courses", response_model=XbkCourseOut)
async def create_course(
    payload: XbkCourseUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    if payload.quota < 0:
        raise HTTPException(status_code=422, detail="限报人数不能为负数")
    existing = (
        await db.execute(
            select(XbkCourse).where(
                XbkCourse.year == payload.year,
                XbkCourse.term == payload.term,
                XbkCourse.course_code == payload.course_code,
            )
        )
    ).scalar_one_or_none()
    if existing and not existing.is_deleted:  # type: ignore[truthy-bool]
        raise HTTPException(status_code=409, detail="课程已存在")
    row = existing or XbkCourse()
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.is_deleted = False  # type: ignore[assignment]
    row.updated_at = datetime.utcnow()  # type: ignore[assignment]
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="课程已存在")
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkCourseOut.model_validate(row).model_dump()


@router.put("/courses/{course_id}", response_model=XbkCourseOut)
async def update_course(
    course_id: int,
    payload: XbkCourseUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    if payload.quota < 0:
        raise HTTPException(status_code=422, detail="限报人数不能为负数")
    row = (await db.execute(select(XbkCourse).where(XbkCourse.id == course_id))).scalar_one_or_none()
    if not row or row.is_deleted:  # type: ignore[truthy-bool]
        raise HTTPException(status_code=404, detail="课程不存在")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()  # type: ignore[assignment]
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkCourseOut.model_validate(row).model_dump()


@router.delete("/courses/{course_id}", status_code=204)
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    row = (await db.execute(select(XbkCourse).where(XbkCourse.id == course_id))).scalar_one_or_none()
    if not row or row.is_deleted:  # type: ignore[truthy-bool]
        raise HTTPException(status_code=404, detail="课程不存在")
    row.is_deleted = True  # type: ignore[assignment]
    row.updated_at = datetime.utcnow()  # type: ignore[assignment]
    await db.commit()
    return None
