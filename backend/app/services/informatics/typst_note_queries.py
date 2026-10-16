"""SQL expression builders for Typst note lists; no database IO or transactions."""

from collections.abc import Callable
from typing import Any

from sqlalchemy import Integer, Select, cast, func, select

from app.models.informatics.typst_note import TypstNote


def _title_natural_order():
    """按标题中的数字前缀自然排序，如 1.1, 1.2, ..., 1.10, 2.1"""
    # 提取主序号（标题开头的第一个数字）
    major = cast(
        func.coalesce(
            func.nullif(func.substring(TypstNote.title, r'^(\d+)'), ''),
            '999999'
        ),
        Integer,
    )
    # 提取子序号（主序号后面 . 跟的数字）
    minor = cast(
        func.coalesce(
            func.nullif(func.substring(TypstNote.title, r'^\d+\.(\d+)'), ''),
            '0'
        ),
        Integer,
    )
    return [major, minor, TypstNote.title]



def note_list_query(
    published_only: bool,
    search: str | None,
    skip: int,
    limit: int,
    order_builder: Callable[[], list[Any]],
) -> Select:
    """Build list SQL without IO; the facade supplies its current ordering hook."""
    if published_only:
        stmt = select(TypstNote).where(
            TypstNote.is_deleted.is_(False),
            TypstNote.published.is_(True),
        )
    else:
        stmt = select(TypstNote).where(TypstNote.is_deleted.is_(False))
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(TypstNote.title.ilike(like))
    return stmt.order_by(*order_builder()).offset(skip).limit(limit)
