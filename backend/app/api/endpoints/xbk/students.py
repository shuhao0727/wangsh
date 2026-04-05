"""
XBK 学生管理 CRUD 端点
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.database import get_db
from app.models import XbkStudent
from app.schemas.xbk import XbkListResponse, XbkStudentOut, XbkStudentUpsert

from ._common import apply_common_filters, require_xbk_access

router = APIRouter()


@router.get("/students", response_model=XbkListResponse)
async def list_students(
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    search_text: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    stmt = select(XbkStudent).where(XbkStudent.is_deleted.is_(False))
    stmt = apply_common_filters(stmt, XbkStudent, year, term, grade, search_text)
    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one() or 0

    rows = (
        await db.execute(
            stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()

    items = [XbkStudentOut.model_validate(r).model_dump() for r in rows]
    return {"total": total, "items": items}


@router.post("/students", response_model=XbkStudentOut)
async def create_student(
    payload: XbkStudentUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    existing = (
        await db.execute(
            select(XbkStudent).where(
                XbkStudent.year == payload.year,
                XbkStudent.term == payload.term,
                XbkStudent.student_no == payload.student_no,
            )
        )
    ).scalar_one_or_none()
    if existing and not existing.is_deleted:  # type: ignore[truthy-bool]
        raise HTTPException(status_code=409, detail="学生已存在")
    row = existing or XbkStudent()
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.is_deleted = False  # type: ignore[assignment]
    row.updated_at = datetime.utcnow()  # type: ignore[assignment]
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="学生已存在")
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkStudentOut.model_validate(row).model_dump()


@router.put("/students/{student_id}", response_model=XbkStudentOut)
async def update_student(
    student_id: int,
    payload: XbkStudentUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    row = (await db.execute(select(XbkStudent).where(XbkStudent.id == student_id))).scalar_one_or_none()
    if not row or row.is_deleted:  # type: ignore[truthy-bool]
        raise HTTPException(status_code=404, detail="学生不存在")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()  # type: ignore[assignment]
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkStudentOut.model_validate(row).model_dump()


@router.delete("/students/{student_id}", status_code=204)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    row = (await db.execute(select(XbkStudent).where(XbkStudent.id == student_id))).scalar_one_or_none()
    if not row or row.is_deleted:  # type: ignore[truthy-bool]
        raise HTTPException(status_code=404, detail="学生不存在")
    row.is_deleted = True  # type: ignore[assignment]
    row.updated_at = datetime.utcnow()  # type: ignore[assignment]
    await db.commit()
    return None
