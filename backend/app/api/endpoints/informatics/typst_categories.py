from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.schemas.informatics.typst_category import TypstCategoryCreate, TypstCategoryListItem, TypstCategoryUpdate
from app.services.informatics.typst_categories import create_category, delete_category, get_category, list_categories, update_category

router = APIRouter(prefix="/informatics/typst-categories", tags=["informatics"])


@router.get("", response_model=list[TypstCategoryListItem])
async def api_list_categories(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    items = await list_categories(db=db)
    return [TypstCategoryListItem(id=c.id, path=c.path or "", sort_order=c.sort_order or 0, updated_at=c.updated_at) for c in items]


@router.post("", response_model=TypstCategoryListItem)
async def api_create_category(
    payload: TypstCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    obj = await create_category(db=db, path=payload.path.strip(), sort_order=payload.sort_order or 0)
    return TypstCategoryListItem(id=obj.id, path=obj.path or "", sort_order=obj.sort_order or 0, updated_at=obj.updated_at)


@router.patch("/{category_id}", response_model=TypstCategoryListItem)
async def api_update_category(
    category_id: int,
    payload: TypstCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        obj = await update_category(db=db, category_id=category_id, path=payload.path.strip() if payload.path else None, sort_order=payload.sort_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return TypstCategoryListItem(id=obj.id, path=obj.path or "", sort_order=obj.sort_order or 0, updated_at=obj.updated_at)


@router.delete("/{category_id}")
async def api_delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    obj = await get_category(db=db, category_id=category_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")
    await delete_category(db=db, category_id=category_id)
    return {"ok": True}

