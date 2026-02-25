from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.articles.markdown_style import MarkdownStyle


async def list_styles(db: AsyncSession) -> List[MarkdownStyle]:
    res = await db.execute(select(MarkdownStyle).order_by(MarkdownStyle.sort_order.asc(), MarkdownStyle.key.asc()))
    return list(res.scalars().all())


async def get_style(db: AsyncSession, key: str) -> Optional[MarkdownStyle]:
    res = await db.execute(select(MarkdownStyle).where(MarkdownStyle.key == key))
    return res.scalar_one_or_none()


async def upsert_style(db: AsyncSession, key: str, title: str, content: str, sort_order: int = 0) -> MarkdownStyle:
    existing = await get_style(db=db, key=key)
    if existing:
        existing.title = title
        existing.content = content
        existing.sort_order = sort_order
        await db.commit()
        await db.refresh(existing)
        return existing
    obj = MarkdownStyle(key=key, title=title, content=content, sort_order=sort_order)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_style(
    db: AsyncSession,
    key: str,
    title: str | None = None,
    content: str | None = None,
    sort_order: int | None = None,
) -> MarkdownStyle:
    obj = await get_style(db=db, key=key)
    if not obj:
        raise ValueError("样式不存在")
    if title is not None:
        obj.title = title
    if content is not None:
        obj.content = content
    if sort_order is not None:
        obj.sort_order = sort_order
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_style(db: AsyncSession, key: str) -> None:
    obj = await get_style(db=db, key=key)
    if not obj:
        return
    await db.delete(obj)
    await db.commit()
