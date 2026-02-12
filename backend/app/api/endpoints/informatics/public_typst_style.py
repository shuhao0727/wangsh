from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_db
from app.models.informatics.typst_style import TypstStyle
from app.services.informatics.typst_styles import read_resource_style


router = APIRouter(prefix="/public/informatics/typst-style")


@router.get("")
async def list_styles(db: AsyncSession = Depends(get_db)) -> list[str]:
    res = await db.execute(select(TypstStyle.key).order_by(TypstStyle.sort_order.asc(), TypstStyle.key.asc()))
    keys = [r[0] for r in res.all()]
    if keys:
        return keys
    base = Path(__file__).resolve().parents[3] / "resources" / "typst"
    if not base.exists():
        return []
    return sorted([p.stem for p in base.glob("*.typ") if p.is_file()])


@router.get("/{style_key}.typ")
async def get_style(style_key: str, db: AsyncSession = Depends(get_db)) -> Response:
    res = await db.execute(select(TypstStyle).where(TypstStyle.key == style_key))
    s = res.scalar_one_or_none()
    if s and (s.content or "").strip():
        return Response(content=s.content, media_type="text/plain; charset=utf-8")
    text = read_resource_style(style_key)
    if not text:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="默认样式文件不存在")
    return Response(content=text, media_type="text/plain; charset=utf-8")


@router.get("/my_style.typ")
async def get_my_style() -> Response:
    return await get_style("my_style")
