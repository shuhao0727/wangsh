"""
XBK 模块共享依赖和工具函数
"""

from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_or_none
from app.db.database import get_db
from app.models import FeatureFlag
from app.services.xbk.public_config import XBK_PUBLIC_FLAG_KEY


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


def apply_common_filters(
    stmt,
    model,
    year: Optional[int],
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
        keyword = f"%{search_text.strip()}%"
        text_conditions = []
        for col in [
            "student_no", "name", "class_name",
            "course_code", "course_name", "teacher", "location",
        ]:
            if hasattr(model, col):
                text_conditions.append(getattr(model, col).ilike(keyword))
        if text_conditions:
            conditions.append(or_(*text_conditions))
    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt
