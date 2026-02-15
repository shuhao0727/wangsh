from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Integer, and_, case, cast, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_or_none, require_admin
from app.db.database import get_db
from app.models import FeatureFlag, XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk import (
    XbkCourseOut,
    XbkCourseUpsert,
    XbkListResponse,
    XbkSelectionOut,
    XbkSelectionUpsert,
    XbkStudentOut,
    XbkStudentUpsert,
)
from app.services.xbk.public_config import XBK_PUBLIC_FLAG_KEY

router = APIRouter()


async def require_xbk_access(
    db: AsyncSession = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_or_none),
) -> Optional[Dict[str, Any]]:
    stmt = select(FeatureFlag).where(FeatureFlag.key == XBK_PUBLIC_FLAG_KEY)
    result = await db.execute(stmt)
    flag = result.scalar_one_or_none()
    enabled = bool((flag.value or {}).get("enabled", False)) if flag else False
    if enabled:
        return user
    if user and user.get("role_code") in ["admin", "super_admin"]:
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="XBK 未开放")


def _apply_common_filters(stmt, model, year: Optional[int], term: Optional[str], grade: Optional[str], search_text: Optional[str]):
    conditions = []
    if year is not None:
        conditions.append(model.year == year)
    if term:
        conditions.append(model.term == term)
    if grade:
        conditions.append(model.grade == grade)
    if search_text and search_text.strip():
        keyword = f"%{search_text.strip()}%"
        text_conditions = []
        for col in ["student_no", "name", "class_name", "course_code", "course_name", "teacher", "location"]:
            if hasattr(model, col):
                text_conditions.append(getattr(model, col).ilike(keyword))
        if text_conditions:
            conditions.append(or_(*text_conditions))
    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt


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
    stmt = _apply_common_filters(stmt, XbkStudent, year, term, grade, search_text)
    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (
        await db.execute(
            stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()

    items = [XbkStudentOut.model_validate(r).model_dump() for r in rows]
    return {"total": total, "items": items}


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
    stmt = _apply_common_filters(stmt, XbkCourse, year, term, grade, search_text)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

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


async def _validate_student_and_course(
    db: AsyncSession,
    *,
    year: int,
    term: str,
    student_no: str,
    course_code: str,
) -> None:
    student = (
        await db.execute(
            select(XbkStudent).where(
                XbkStudent.is_deleted.is_(False),
                XbkStudent.year == year,
                XbkStudent.term == term,
                XbkStudent.student_no == student_no,
            )
        )
    ).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在（请先维护学生名单）")

    course = (
        await db.execute(
            select(XbkCourse).where(
                XbkCourse.is_deleted.is_(False),
                XbkCourse.year == year,
                XbkCourse.term == term,
                XbkCourse.course_code == course_code,
            )
        )
    ).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在（请先维护选课目录）")


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
    if existing and not existing.is_deleted:
        raise HTTPException(status_code=409, detail="学生已存在")
    row = existing or XbkStudent()
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.is_deleted = False
    row.updated_at = datetime.utcnow()
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
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="学生不存在")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkStudentOut.model_validate(row).model_dump()


@router.delete("/students/{student_id}", status_code=200)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    row = (await db.execute(select(XbkStudent).where(XbkStudent.id == student_id))).scalar_one_or_none()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="学生不存在")
    row.is_deleted = True
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"deleted": 1}


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
    if existing and not existing.is_deleted:
        raise HTTPException(status_code=409, detail="课程已存在")
    row = existing or XbkCourse()
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.is_deleted = False
    row.updated_at = datetime.utcnow()
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
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="课程不存在")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkCourseOut.model_validate(row).model_dump()


@router.delete("/courses/{course_id}", status_code=200)
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    row = (await db.execute(select(XbkCourse).where(XbkCourse.id == course_id))).scalar_one_or_none()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="课程不存在")
    row.is_deleted = True
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"deleted": 1}


@router.post("/selections", response_model=XbkSelectionOut)
async def create_selection(
    payload: XbkSelectionUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    await _validate_student_and_course(
        db,
        year=payload.year,
        term=payload.term,
        student_no=payload.student_no,
        course_code=payload.course_code,
    )
    existing = (
        await db.execute(
            select(XbkSelection).where(
                XbkSelection.year == payload.year,
                XbkSelection.term == payload.term,
                XbkSelection.student_no == payload.student_no,
                XbkSelection.course_code == payload.course_code,
            )
        )
    ).scalar_one_or_none()
    if existing and not existing.is_deleted:
        raise HTTPException(status_code=409, detail="选课记录已存在")
    row = existing or XbkSelection()
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.is_deleted = False
    row.updated_at = datetime.utcnow()
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="选课记录已存在")
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkSelectionOut.model_validate(row).model_dump()


@router.put("/selections/{selection_id}", response_model=XbkSelectionOut)
async def update_selection(
    selection_id: int,
    payload: XbkSelectionUpsert,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    row = (await db.execute(select(XbkSelection).where(XbkSelection.id == selection_id))).scalar_one_or_none()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="选课记录不存在")
    await _validate_student_and_course(
        db,
        year=payload.year,
        term=payload.term,
        student_no=payload.student_no,
        course_code=payload.course_code,
    )
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(row)
    return XbkSelectionOut.model_validate(row).model_dump()


@router.delete("/selections/{selection_id}", status_code=200)
async def delete_selection(
    selection_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    row = (await db.execute(select(XbkSelection).where(XbkSelection.id == selection_id))).scalar_one_or_none()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="选课记录不存在")
    row.is_deleted = True
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"deleted": 1}

@router.get("/selections", response_model=XbkListResponse)
async def list_selections(
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
    stmt = select(XbkSelection).where(XbkSelection.is_deleted.is_(False))
    stmt = _apply_common_filters(stmt, XbkSelection, year, term, grade, search_text)

    if class_name:
        sub = (
            select(XbkStudent.student_no)
            .where(
                XbkStudent.is_deleted.is_(False),
                XbkStudent.class_name == class_name,
                *( [XbkStudent.year == year] if year is not None else [] ),
                *( [XbkStudent.term == term] if term else [] ),
            )
            .subquery()
        )
        stmt = stmt.where(XbkSelection.student_no.in_(select(sub.c.student_no)))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (
        await db.execute(
            stmt.order_by(XbkSelection.student_no.asc(), XbkSelection.course_code.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()

    items = [XbkSelectionOut.model_validate(r).model_dump() for r in rows]
    return {"total": total, "items": items}


@router.get("/course-results", response_model=XbkListResponse)
async def list_course_results(
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
    stmt = (
        select(
            XbkSelection.id.label("id"),
            XbkSelection.year.label("year"),
            XbkSelection.term.label("term"),
            XbkSelection.grade.label("grade"),
            XbkSelection.student_no.label("student_no"),
            func.coalesce(XbkSelection.name, XbkStudent.name).label("student_name"),
            XbkStudent.class_name.label("class_name"),
            XbkSelection.course_code.label("course_code"),
            XbkCourse.course_name.label("course_name"),
            XbkCourse.teacher.label("teacher"),
            XbkCourse.location.label("location"),
        )
        .select_from(XbkSelection)
        .outerjoin(
            XbkStudent,
            and_(
                XbkStudent.is_deleted.is_(False),
                XbkStudent.year == XbkSelection.year,
                XbkStudent.term == XbkSelection.term,
                XbkStudent.student_no == XbkSelection.student_no,
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
        .where(XbkSelection.is_deleted.is_(False))
    )

    if year is not None:
        stmt = stmt.where(XbkSelection.year == year)
    if term:
        stmt = stmt.where(XbkSelection.term == term)
    if grade:
        stmt = stmt.where(XbkSelection.grade == grade)
    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)
    if search_text and search_text.strip():
        keyword = f"%{search_text.strip()}%"
        stmt = stmt.where(
            or_(
                XbkSelection.student_no.ilike(keyword),
                XbkSelection.course_code.ilike(keyword),
                func.coalesce(XbkSelection.name, XbkStudent.name).ilike(keyword),
                XbkStudent.class_name.ilike(keyword),
                XbkCourse.course_name.ilike(keyword),
                XbkCourse.teacher.ilike(keyword),
                XbkCourse.location.ilike(keyword),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (
        await db.execute(
            stmt.order_by(
                XbkStudent.class_name.asc(),  # 先按班级
                cast(func.regexp_replace(XbkSelection.student_no, '\D', '', 'g'), Integer).asc(), # 再按学号数字部分
                XbkSelection.student_no.asc() # 最后按学号字符串
            )
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    items = [
        {
            "id": int(r.id),
            "year": int(r.year),
            "term": str(r.term),
            "grade": str(r.grade) if r.grade else None,
            "student_no": str(r.student_no),
            "student_name": str(r.student_name) if r.student_name else None,
            "class_name": str(r.class_name) if r.class_name else None,
            "course_code": str(r.course_code),
            "course_name": str(r.course_name) if r.course_name else None,
            "teacher": str(r.teacher) if r.teacher else None,
            "location": str(r.location) if r.location else None,
        }
        for r in rows
    ]
    return {"total": total, "items": items}


@router.delete("", response_model=Dict[str, Any])
async def delete_data(
    scope: str = Query(..., pattern="^(all|students|courses|selections)$"),
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    def base_conditions(model):
        conds: List[Any] = [model.is_deleted.is_(False)]
        if year is not None:
            conds.append(model.year == year)
        if term:
            conds.append(model.term == term)
        return conds

    deleted = 0

    if scope in ["all", "students"]:
        stmt = delete(XbkStudent).where(*base_conditions(XbkStudent))
        if class_name:
            stmt = stmt.where(XbkStudent.class_name == class_name)
        res = await db.execute(stmt)
        deleted += res.rowcount or 0

    if scope in ["all", "courses"]:
        stmt = delete(XbkCourse).where(*base_conditions(XbkCourse))
        res = await db.execute(stmt)
        deleted += res.rowcount or 0

    if scope in ["all", "selections"]:
        stmt = delete(XbkSelection).where(*base_conditions(XbkSelection))
        if class_name:
            sub = select(XbkStudent.student_no).where(
                XbkStudent.is_deleted.is_(False),
                XbkStudent.class_name == class_name,
                *( [XbkStudent.year == year] if year is not None else [] ),
                *( [XbkStudent.term == term] if term else [] ),
            )
            stmt = stmt.where(XbkSelection.student_no.in_(sub))
        res = await db.execute(stmt)
        deleted += res.rowcount or 0

    await db.commit()
    return {"deleted": deleted}


@router.get("/meta")
async def get_meta(
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
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
    for (c,) in (await db.execute(class_stmt)).all():
        if c:
            classes.add(str(c))

    return {
        "years": sorted(list(years), reverse=True),
        "terms": sorted(list(terms)),
        "classes": sorted(list(classes)),
    }
