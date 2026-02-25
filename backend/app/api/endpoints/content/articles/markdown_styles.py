from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_super_admin
from app.schemas.articles.markdown_style import (
    MarkdownStyleListItem,
    MarkdownStyleResponse,
    MarkdownStyleUpsert,
    MarkdownStyleUpdate,
)
from app.services.articles.markdown_styles import delete_style, get_style, list_styles, upsert_style, update_style


router = APIRouter(prefix="/markdown-styles")


@router.get("", response_model=list[MarkdownStyleListItem])
async def api_list_markdown_styles(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    styles = await list_styles(db=db)
    return [
        MarkdownStyleListItem(key=s.key, title=s.title or "", sort_order=s.sort_order or 0, updated_at=s.updated_at) for s in styles
    ]


@router.get("/{key}", response_model=MarkdownStyleResponse)
async def api_get_markdown_style(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    s = await get_style(db=db, key=key)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="样式不存在")
    return MarkdownStyleResponse(
        key=s.key,
        title=s.title or "",
        sort_order=s.sort_order or 0,
        content=s.content or "",
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.post("", response_model=MarkdownStyleResponse)
async def api_upsert_markdown_style(
    payload: MarkdownStyleUpsert,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    s = await upsert_style(
        db=db,
        key=payload.key,
        title=payload.title or payload.key,
        content=payload.content or "",
        sort_order=payload.sort_order or 0,
    )
    return MarkdownStyleResponse(
        key=s.key,
        title=s.title or "",
        sort_order=s.sort_order or 0,
        content=s.content or "",
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.patch("/{key}", response_model=MarkdownStyleResponse)
async def api_update_markdown_style(
    key: str,
    payload: MarkdownStyleUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    try:
        s = await update_style(db=db, key=key, title=payload.title, content=payload.content, sort_order=payload.sort_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return MarkdownStyleResponse(
        key=s.key,
        title=s.title or "",
        sort_order=s.sort_order or 0,
        content=s.content or "",
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.delete("/{key}")
async def api_delete_markdown_style(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    await delete_style(db=db, key=key)
    return {"ok": True}
