from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.api.endpoints.xbk.data import require_xbk_access
from app.schemas.xbk.data import XbkStudentOut

router = APIRouter()


@router.get("/summary")
async def get_summary(
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    # 合并前4个COUNT查询为单个查询
    from sqlalchemy import case, literal_column

    # 构建过滤条件
    filters = [XbkStudent.is_deleted.is_(False)]
    if year is not None:
        filters.append(XbkStudent.year == year)
    if term:
        filters.append(XbkStudent.term == term)
    if grade:
        filters.append(XbkStudent.grade == grade)
    if class_name:
        filters.append(XbkStudent.class_name == class_name)

    # 学生子查询（用于selection过滤）
    student_sub = None
    if class_name:
        student_sub = select(XbkStudent.student_no).where(*filters)

    # 合并统计查询
    summary_stmt = select(
        func.count(func.distinct(XbkStudent.id)).label('students'),
        func.count(func.distinct(XbkCourse.id)).label('courses'),
        func.count(case((XbkSelection.course_code != "", XbkSelection.id), else_=None)).label('selections'),
        func.count(case((XbkSelection.course_code == "", XbkSelection.id), else_=None)).label('unselected')
    ).select_from(XbkStudent).outerjoin(
        XbkSelection,
        (XbkStudent.student_no == XbkSelection.student_no) &
        (XbkStudent.year == XbkSelection.year) &
        (XbkStudent.term == XbkSelection.term) &
        (XbkSelection.is_deleted.is_(False))
    ).outerjoin(
        XbkCourse,
        (XbkStudent.year == XbkCourse.year) &
        (XbkStudent.term == XbkCourse.term) &
        (XbkCourse.is_deleted.is_(False)) &
        ((XbkStudent.grade == XbkCourse.grade) if grade else literal_column("true"))
    ).where(*filters)

    result = (await db.execute(summary_stmt)).one()
    students, courses, selections, unselected_count = result

    # suspended_count 需要单独查询
    selected_student_sub = (
        select(XbkSelection.student_no)
        .where(XbkSelection.is_deleted.is_(False))
        .group_by(XbkSelection.student_no)
    )
    if year is not None:
        selected_student_sub = selected_student_sub.where(XbkSelection.year == year)
    if term:
        selected_student_sub = selected_student_sub.where(XbkSelection.term == term)
    if grade:
        selected_student_sub = selected_student_sub.where(XbkSelection.grade == grade)
    if class_name and student_sub is not None:
        selected_student_sub = selected_student_sub.where(XbkSelection.student_no.in_(student_sub))

    suspended_stmt = select(func.count()).select_from(XbkStudent).where(
        *filters,
        XbkStudent.student_no.not_in(selected_student_sub)
    )
    suspended_count = (await db.execute(suspended_stmt)).scalar_one() or 0

    return {
        "students": int(students or 0),
        "courses": int(courses or 0),
        "selections": int(selections or 0),
        "unselected_count": int(unselected_count or 0),
        "suspended_count": suspended_count,
    }


@router.get("/course-stats")
async def course_stats(
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    class_count_stmt = select(func.count(func.distinct(XbkStudent.class_name))).where(XbkStudent.is_deleted.is_(False))
    if year is not None:
        class_count_stmt = class_count_stmt.where(XbkStudent.year == year)
    if term:
        class_count_stmt = class_count_stmt.where(XbkStudent.term == term)
    if grade:
        class_count_stmt = class_count_stmt.where(XbkStudent.grade == grade)
    if class_name:
        class_count_stmt = class_count_stmt.where(XbkStudent.class_name == class_name)
    class_count = int((await db.execute(class_count_stmt)).scalar_one() or 0)

    # 使用JOIN一次性获取课程统计，避免N+1查询
    selection_stmt = (
        select(
            XbkSelection.course_code,
            func.count(XbkSelection.id).label("count"),
            XbkCourse.course_name,
            XbkCourse.quota
        )
        .join(XbkCourse,
              (XbkSelection.course_code == XbkCourse.course_code) &
              (XbkSelection.year == XbkCourse.year) &
              (XbkSelection.term == XbkCourse.term))
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkCourse.is_deleted.is_(False)
        )
        .group_by(XbkSelection.course_code, XbkCourse.course_name, XbkCourse.quota)
    )
    if year is not None:
        selection_stmt = selection_stmt.where(XbkSelection.year == year)
    if term:
        selection_stmt = selection_stmt.where(XbkSelection.term == term)
    if grade:
        selection_stmt = selection_stmt.where(XbkSelection.grade == grade)
    if class_name:
        sub = select(XbkStudent.student_no).where(
            XbkStudent.is_deleted.is_(False),
            XbkStudent.class_name == class_name,
            *( [XbkStudent.year == year] if year is not None else [] ),
            *( [XbkStudent.term == term] if term else [] ),
            *( [XbkStudent.grade == grade] if grade else [] ),
        )
        selection_stmt = selection_stmt.where(XbkSelection.student_no.in_(sub))

    rows = (await db.execute(selection_stmt)).all()

    items = [
        {
            "course_code": str(code),
            "course_name": str(name) if name else None,
            "count": int(count),
            "quota": int(quota or 0),
            "class_count": class_count,
            "allowed_total": int(quota or 0) * class_count,
        }
        for code, count, name, quota in rows
    ]
    
    # Calculate unselected students (Actually Suspended/Other in new logic)
    suspended_stmt = select(func.count()).select_from(XbkStudent).where(XbkStudent.is_deleted.is_(False))
    if year is not None:
        suspended_stmt = suspended_stmt.where(XbkStudent.year == year)
    if term:
        suspended_stmt = suspended_stmt.where(XbkStudent.term == term)
    if grade:
        suspended_stmt = suspended_stmt.where(XbkStudent.grade == grade)
    if class_name:
        suspended_stmt = suspended_stmt.where(XbkStudent.class_name == class_name)
    
    # Reuse the subquery logic from get_summary
    selected_student_sub = (
        select(XbkSelection.student_no)
        .where(XbkSelection.is_deleted.is_(False))
        .group_by(XbkSelection.student_no)
    )
    if year is not None:
        selected_student_sub = selected_student_sub.where(XbkSelection.year == year)
    if term:
        selected_student_sub = selected_student_sub.where(XbkSelection.term == term)
    if grade:
        selected_student_sub = selected_student_sub.where(XbkSelection.grade == grade)
    if class_name:
        selected_student_sub = selected_student_sub.where(XbkSelection.student_no.in_(sub))
        
    suspended_stmt = suspended_stmt.where(XbkStudent.student_no.not_in(selected_student_sub))
    suspended_count = (await db.execute(suspended_stmt)).scalar_one() or 0
    
    # Add virtual row for "休学或其他"
    if suspended_count > 0:
        items.append({
            "course_code": "休学或其他",
            "course_name": "休学或其他",
            "count": suspended_count,
            "quota": 0,
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
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    stmt = (
        select(XbkStudent.class_name, func.count().label("count"))
        .where(XbkStudent.is_deleted.is_(False))
        .group_by(XbkStudent.class_name)
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
    items = [{"class_name": str(cls), "count": int(count)} for cls, count in rows]
    
    # 按照班级名称排序
    def _sort_key(item):
        name = item["class_name"]
        # 尝试提取班级中的数字进行排序，例如 "高二(1)班" -> 1
        import re
        match = re.search(r'\((\d+)\)', name) or re.search(r'（(\d+)）', name) or re.search(r'(\d+)', name)
        if match:
             return (0, int(match.group(1)), name)
        return (1, 0, name)
        
    items.sort(key=_sort_key)
    return {"items": items}


@router.get("/students-with-empty-selection")
async def students_with_empty_selection(
    year: Optional[int] = Query(None),
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
            XbkSelection.course_code == ""
        )
    )

    if year is not None:
        stmt = stmt.where(XbkSelection.year == year)
    if term:
        stmt = stmt.where(XbkSelection.term == term)
    if grade:
        stmt = stmt.where(XbkSelection.grade == grade)
    if class_name:
        stmt = stmt.where(XbkStudent.class_name == class_name)

    rows = (await db.execute(stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc()))).scalars().all()
    items = [XbkStudentOut.model_validate(r).model_dump() for r in rows]
    return {"items": items}


@router.get("/students-without-selection")
async def students_without_selection(
    year: Optional[int] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Optional[Dict[str, Any]] = Depends(require_xbk_access),
) -> Dict[str, Any]:
    students_stmt = select(XbkStudent).where(XbkStudent.is_deleted.is_(False))
    selections_stmt = select(XbkSelection.student_no).where(XbkSelection.is_deleted.is_(False)).group_by(XbkSelection.student_no)

    if year is not None:
        students_stmt = students_stmt.where(XbkStudent.year == year)
        selections_stmt = selections_stmt.where(XbkSelection.year == year)
    if term:
        students_stmt = students_stmt.where(XbkStudent.term == term)
        selections_stmt = selections_stmt.where(XbkSelection.term == term)
    if grade:
        students_stmt = students_stmt.where(XbkStudent.grade == grade)
        selections_stmt = selections_stmt.where(XbkSelection.grade == grade)
    if class_name:
        students_stmt = students_stmt.where(XbkStudent.class_name == class_name)

    selection_rows = (await db.execute(selections_stmt)).all()
    if not selection_rows:
        selected_student_nos = set()
    else:
        selected_student_nos = {row[0] for row in selection_rows}
    
    students = (await db.execute(students_stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc()))).scalars().all()
    items: List[Dict[str, Any]] = []
    for s in students:
        if s.student_no not in selected_student_nos:
            items.append(
                {
                    "id": s.id,
                    "year": s.year,
                    "term": s.term,
                    "grade": s.grade,
                    "class_name": s.class_name,
                    "student_no": s.student_no,
                    "name": s.name,
                    "gender": s.gender,
                }
            )
    return {"items": items}
