"""
XBK 模块共享依赖和工具函数
"""

from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import and_, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_or_none
from app.db.database import get_db
from app.models import FeatureFlag, XbkCourse, XbkStudent
from app.schemas.xbk.academic_year import AcademicYear
from app.services.xbk.grade_scope import normalize_grade
from app.services.xbk.public_config import XBK_PUBLIC_FLAG_KEY
from app.services.xbk.locking import lock_key_rows


# Legacy manual entries use an empty code; imports use the explicit marker.
UNSELECTED_COURSE_CODES = ("", "未选")


async def require_xbk_access(
    db: AsyncSession = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_or_none),
) -> Optional[Dict[str, Any]]:
    """检查 XBK 访问权限：公开模式下所有人可访问，否则仅管理员"""
    stmt = select(FeatureFlag).where(FeatureFlag.key == XBK_PUBLIC_FLAG_KEY)
    result = await db.execute(stmt)
    flag = result.scalar_one_or_none()
    enabled = bool((flag.value or {}).get("enabled", False)) if flag else False
    if enabled:
        return user
    if user and user.get("role_code") in ["admin", "super_admin"]:
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="XBK 未开放")


def apply_search_filter(stmt, search_text: Optional[str], columns: List[Any]):
    """按调用方提供的关联字段统一应用关键词搜索。"""
    if search_text and search_text.strip():
        keyword = f"%{search_text.strip()}%"
        stmt = stmt.where(or_(*(column.ilike(keyword) for column in columns)))
    return stmt


def apply_common_filters(
    stmt,
    model,
    year: Optional[AcademicYear],
    term: Optional[str],
    grade: Optional[str],
    search_text: Optional[str],
):
    """对查询语句应用通用过滤条件（年份、学期、年级、关键词搜索）"""
    conditions: List[Any] = []
    if year is not None:
        conditions.append(model.year == year)
    if term:
        conditions.append(model.term == term)
    if grade:
        conditions.append(model.grade == grade)
    if search_text and search_text.strip():
        text_columns = [
            getattr(model, col) for col in [
                "student_no", "name", "class_name",
                "course_code", "course_name", "teacher", "location",
            ] if hasattr(model, col)
        ]
        if text_columns:
            conditions.append(or_(*[column.ilike(f"%{search_text.strip()}%") for column in text_columns]))
    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt


async def _active_parent_grades(
    db: AsyncSession, model, field: str, keys: list, *, lock: bool,
) -> Dict[tuple[str, str, str], Optional[str]]:
    """按自然键返回活跃父记录及其年级，保留年级为空的记录。"""
    if lock:
        parents = await lock_key_rows(db, model, ("year", "term", field), keys, shared=True)
        return {(row.year, row.term, getattr(row, field)): normalize_grade(row.grade)
                for row in parents if not row.is_deleted}
    grades: Dict[tuple[str, str, str], Optional[str]] = {}
    columns = (model.year, model.term, getattr(model, field))
    for offset in range(0, len(keys), 500):
        result = await db.execute(select(*columns, model.grade).where(
            model.is_deleted.is_(False),
            tuple_(*columns).in_(keys[offset:offset + 500]),
        ))
        for year, term, code, grade in result.all():
            grades[(year, term, code)] = normalize_grade(grade)
    return grades


async def selection_reference_errors(
    db: AsyncSession, rows: List[Dict[str, Any]], *, lock: bool = False,
) -> List[List[str]]:
    """Check natural-key parents in bounded batches for manual and file writes.

    A snapshot grade/name is not a reference key. Unselected markers need an
    active student but no course. Execute paths hold shared parent locks through
    commit; previews deliberately remain non-locking snapshots.
    """
    errors: List[List[str]] = [[] for _ in rows]
    # 课程开设年级：课程只面向其所属年级开设（为空表示全年级可选）。
    # 预检必须与执行阶段给出一致的年级错误，否则会先显示“可导入”
    # 再在提交时整份 409。
    parent_grades = {}
    for model, field, label, advice in (
        (XbkStudent, "student_no", "学生", "请先维护学生名单"),
        (XbkCourse, "course_code", "课程", "请先维护选课目录"),
    ):
        keys = list(dict.fromkeys(
            (row["year"], row["term"], row[field]) for row in rows
            if field != "course_code" or row[field] not in UNSELECTED_COURSE_CODES
        ))
        active = await _active_parent_grades(db, model, field, keys, lock=lock)
        parent_grades[field] = active
        for index, row in enumerate(rows):
            if field == "course_code" and row[field] in UNSELECTED_COURSE_CODES:
                continue
            if (row["year"], row["term"], row[field]) not in active:
                errors[index].append(f"{label}不存在（{advice}；须为同学年、同学期且未删除）")
    _append_grade_scope_errors(rows, parent_grades["student_no"], parent_grades["course_code"], errors)
    return errors


def _append_grade_scope_errors(
    rows: List[Dict[str, Any]],
    student_grades: Dict[tuple[str, str, str], Optional[str]],
    course_grades: Dict[tuple[str, str, str], Optional[str]],
    errors: List[List[str]],
) -> None:
    """按当前学生名册核对课程年级范围。"""
    for index, row in enumerate(rows):
        if errors[index] or row["course_code"] in UNSELECTED_COURSE_CODES:
            continue
        year, term, code = row["year"], row["term"], row["course_code"]
        scope = course_grades[(year, term, code)]
        student_grade = student_grades[(year, term, row["student_no"])]
        if scope and scope != student_grade:
            errors[index].append(
                f"课程 {code} 仅面向 {scope} 开设，"
                f"不能分配给 {student_grade or '未分年级'} 的学生"
            )
