from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.schemas.informatics.typst_style import (
    TypstStyleListItem,
    TypstStyleResponse,
    TypstStyleUpsert,
    TypstStyleUpdate,
)
from app.services.informatics.typst_styles import delete_style, get_style, list_styles, read_resource_style, upsert_style, update_style

router = APIRouter(prefix="/informatics/typst-styles", tags=["informatics"])


@router.get("", response_model=list[TypstStyleListItem])
async def api_list_styles(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    styles = await list_styles(db=db)
    return [
        TypstStyleListItem(key=s.key, title=s.title or "", sort_order=s.sort_order or 0, updated_at=s.updated_at) for s in styles
    ]


@router.get("/{key}", response_model=TypstStyleResponse)
async def api_get_style(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    s = await get_style(db=db, key=key)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="样式不存在")
    return TypstStyleResponse(key=s.key, title=s.title or "", sort_order=s.sort_order or 0, content=s.content or "", updated_at=s.updated_at)


@router.post("", response_model=TypstStyleResponse)
async def api_upsert_style(
    payload: TypstStyleUpsert,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    s = await upsert_style(db=db, key=payload.key, title=payload.title or payload.key, content=payload.content or "", sort_order=payload.sort_order or 0)
    return TypstStyleResponse(key=s.key, title=s.title or "", sort_order=s.sort_order or 0, content=s.content or "", updated_at=s.updated_at)


@router.patch("/{key}", response_model=TypstStyleResponse)
async def api_update_style(
    key: str,
    payload: TypstStyleUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        s = await update_style(db=db, key=key, title=payload.title, content=payload.content, sort_order=payload.sort_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return TypstStyleResponse(key=s.key, title=s.title or "", sort_order=s.sort_order or 0, content=s.content or "", updated_at=s.updated_at)


@router.delete("/{key}")
async def api_delete_style(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    await delete_style(db=db, key=key)
    return {"ok": True}


@router.post("/seed/{key}", response_model=TypstStyleResponse)
async def api_seed_style_from_resource(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    content = read_resource_style(key=key)
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资源样式不存在")
    s = await upsert_style(db=db, key=key, title=key, content=content, sort_order=0)
    return TypstStyleResponse(key=s.key, title=s.title or "", sort_order=s.sort_order or 0, content=s.content or "", updated_at=s.updated_at)

