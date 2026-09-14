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


async def selection_reference_errors(
    db: AsyncSession, rows: List[Dict[str, Any]], *, lock: bool = False,
) -> List[List[str]]:
    """Check natural-key parents in bounded batches for manual and file writes.

    A snapshot grade/name is not a reference key. Unselected markers need an
    active student but no course. Execute paths hold shared parent locks through
    commit; previews deliberately remain non-locking snapshots.
    """
    errors: List[List[str]] = [[] for _ in rows]
    for model, field, label, advice in (
        (XbkStudent, "student_no", "学生", "请先维护学生名单"),
        (XbkCourse, "course_code", "课程", "请先维护选课目录"),
    ):
        keys = list(dict.fromkeys(
            (row["year"], row["term"], row[field]) for row in rows
            if field != "course_code" or row[field] not in UNSELECTED_COURSE_CODES
        ))
        active = set()
        if lock:
            parents = await lock_key_rows(db, model, ("year", "term", field), keys, shared=True)
            active.update((row.year, row.term, getattr(row, field))
                          for row in parents if not row.is_deleted)
        else:
            for offset in range(0, len(keys), 500):
                columns = (model.year, model.term, getattr(model, field))
                result = await db.execute(select(*columns).where(
                    model.is_deleted.is_(False),
                    tuple_(*columns).in_(keys[offset:offset + 500]),
                ))
                active.update(tuple(row) for row in result.all())
        for index, row in enumerate(rows):
            if field == "course_code" and row[field] in UNSELECTED_COURSE_CODES:
                continue
            if (row["year"], row["term"], row[field]) not in active:
                errors[index].append(f"{label}不存在（{advice}；须为同学年、同学期且未删除）")
    return errors
