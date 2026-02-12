from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.informatics.typst_category import TypstCategory


async def list_categories(db: AsyncSession) -> List[TypstCategory]:
    res = await db.execute(select(TypstCategory).order_by(TypstCategory.sort_order.asc(), TypstCategory.path.asc()))
    return list(res.scalars().all())


async def get_category(db: AsyncSession, category_id: int) -> Optional[TypstCategory]:
    res = await db.execute(select(TypstCategory).where(TypstCategory.id == category_id))
    return res.scalar_one_or_none()


async def get_category_by_path(db: AsyncSession, path: str) -> Optional[TypstCategory]:
    res = await db.execute(select(TypstCategory).where(TypstCategory.path == path))
    return res.scalar_one_or_none()


async def create_category(db: AsyncSession, path: str, sort_order: int = 0) -> TypstCategory:
    existing = await get_category_by_path(db=db, path=path)
    if existing:
        return existing
    obj = TypstCategory(path=path, sort_order=sort_order)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_category(db: AsyncSession, category_id: int, path: str | None = None, sort_order: int | None = None) -> TypstCategory:
    obj = await get_category(db=db, category_id=category_id)
    if not obj:
        raise ValueError("分类不存在")
    if path is not None:
        obj.path = path
    if sort_order is not None:
        obj.sort_order = sort_order
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_category(db: AsyncSession, category_id: int) -> None:
    obj = await get_category(db=db, category_id=category_id)
    if not obj:
        return
    await db.delete(obj)
    await db.commit()

