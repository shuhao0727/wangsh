from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.api.endpoints.xbk.data import require_xbk_access

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
    student_stmt = select(func.count()).select_from(XbkStudent).where(XbkStudent.is_deleted.is_(False))
    course_stmt = select(func.count()).select_from(XbkCourse).where(XbkCourse.is_deleted.is_(False))
    selection_stmt = select(func.count()).select_from(XbkSelection).where(XbkSelection.is_deleted.is_(False))
    no_sel_stmt = select(func.count()).select_from(XbkStudent).where(XbkStudent.is_deleted.is_(False))

    if year is not None:
        student_stmt = student_stmt.where(XbkStudent.year == year)
        course_stmt = course_stmt.where(XbkCourse.year == year)
        selection_stmt = selection_stmt.where(XbkSelection.year == year)
        no_sel_stmt = no_sel_stmt.where(XbkStudent.year == year)
    if term:
        student_stmt = student_stmt.where(XbkStudent.term == term)
        course_stmt = course_stmt.where(XbkCourse.term == term)
        selection_stmt = selection_stmt.where(XbkSelection.term == term)
        no_sel_stmt = no_sel_stmt.where(XbkStudent.term == term)
    if grade:
        student_stmt = student_stmt.where(XbkStudent.grade == grade)
        course_stmt = course_stmt.where(XbkCourse.grade == grade)
        selection_stmt = selection_stmt.where(XbkSelection.grade == grade)
        no_sel_stmt = no_sel_stmt.where(XbkStudent.grade == grade)
    if class_name:
        student_stmt = student_stmt.where(XbkStudent.class_name == class_name)
        no_sel_stmt = no_sel_stmt.where(XbkStudent.class_name == class_name)
        sub = select(XbkStudent.student_no).where(
            XbkStudent.is_deleted.is_(False),
            XbkStudent.class_name == class_name,
            *( [XbkStudent.year == year] if year is not None else [] ),
            *( [XbkStudent.term == term] if term else [] ),
            *( [XbkStudent.grade == grade] if grade else [] ),
        )
        selection_stmt = selection_stmt.where(XbkSelection.student_no.in_(sub))

    students = (await db.execute(student_stmt)).scalar_one()
    courses = (await db.execute(course_stmt)).scalar_one()
    selections = (await db.execute(selection_stmt)).scalar_one()
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
    no_sel_stmt = no_sel_stmt.where(XbkStudent.student_no.not_in(selected_student_sub))
    no_selection_students = (await db.execute(no_sel_stmt)).scalar_one()

    return {
        "students": students,
        "courses": courses,
        "selections": selections,
        "no_selection_students": no_selection_students,
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

    selection_stmt = (
        select(XbkSelection.course_code, func.count().label("count"))
        .where(XbkSelection.is_deleted.is_(False))
        .group_by(XbkSelection.course_code)
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
    codes = [r[0] for r in rows]

    course_map: Dict[str, Dict[str, Any]] = {}
    if codes:
        course_stmt = select(XbkCourse.course_code, XbkCourse.course_name, XbkCourse.quota).where(
            XbkCourse.is_deleted.is_(False),
            XbkCourse.course_code.in_(codes),
            *( [XbkCourse.year == year] if year is not None else [] ),
            *( [XbkCourse.term == term] if term else [] ),
            *( [XbkCourse.grade == grade] if grade else [] ),
        )
        for code, name, quota in (await db.execute(course_stmt)).all():
            course_map[str(code)] = {"course_name": str(name), "quota": int(quota or 0)}

    items = [
        {
            "course_code": str(code),
            "course_name": course_map.get(str(code), {}).get("course_name"),
            "count": int(count),
            "quota": int(course_map.get(str(code), {}).get("quota") or 0),
            "class_count": class_count,
            "allowed_total": int(course_map.get(str(code), {}).get("quota") or 0) * class_count,
        }
        for code, count in rows
    ]
    
    # 按照课程代码排序 (尝试转换为数字排序)
    def _sort_key(item):
        code = item["course_code"]
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

    selected_student_nos = {row[0] for row in (await db.execute(selections_stmt)).all()}
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
