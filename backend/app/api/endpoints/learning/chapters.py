"""学习章节内容 API。"""

from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.models.learning.chapter import LearningChapter
from app.schemas.user_info import UserInfo

router = APIRouter()

VALID_MODULE_KEYS = ("ml", "ai", "agents")


def _chapter_payload(ch: LearningChapter) -> Dict:
    return {
        "id": ch.id,
        "module_key": ch.module_key,
        "slug": ch.slug,
        "title": ch.title,
        "summary": ch.summary,
        "estimated_minutes": ch.estimated_minutes,
        "difficulty": ch.difficulty,
        "group_name": ch.group_name,
        "markdown": ch.markdown,
        "sort_order": ch.sort_order,
        "updated_at": ch.updated_at.isoformat() if ch.updated_at else None,
    }


@router.get("/learning/chapters/{module_key}")
async def list_chapters(
    module_key: str,
    db: AsyncSession = Depends(get_db),
) -> List[Dict]:
    """获取某模块所有章节。"""
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(status_code=400, detail="无效的模块标识")
    stmt = (
        select(LearningChapter)
        .where(LearningChapter.module_key == module_key)
        .order_by(LearningChapter.sort_order, LearningChapter.id)
    )
    result = await db.execute(stmt)
    return [_chapter_payload(ch) for ch in result.scalars().all()]


@router.get("/learning/chapters/{module_key}/{slug}")
async def get_chapter(
    module_key: str,
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> Dict:
    """获取单章节内容。"""
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(status_code=400, detail="无效的模块标识")
    stmt = select(LearningChapter).where(
        LearningChapter.module_key == module_key,
        LearningChapter.slug == slug,
    )
    result = await db.execute(stmt)
    ch = result.scalar_one_or_none()
    if ch is None:
        raise HTTPException(status_code=404, detail="章节不存在")
    return _chapter_payload(ch)


@router.put("/learning/chapters/{module_key}/{slug}")
async def upsert_chapter(
    module_key: str,
    slug: str,
    data: Dict,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
) -> Dict:
    """管理员创建或更新章节内容。"""
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(status_code=400, detail="无效的模块标识")

    stmt = select(LearningChapter).where(
        LearningChapter.module_key == module_key,
        LearningChapter.slug == slug,
    )
    result = await db.execute(stmt)
    ch = result.scalar_one_or_none()

    if ch is None:
        ch = LearningChapter(module_key=module_key, slug=slug)
        db.add(ch)

    if "title" in data:
        ch.title = data["title"]
    if "summary" in data:
        ch.summary = data["summary"]
    if "estimated_minutes" in data:
        ch.estimated_minutes = data["estimated_minutes"]
    if "difficulty" in data:
        ch.difficulty = data["difficulty"]
    if "group_name" in data:
        ch.group_name = data["group_name"]
    if "markdown" in data:
        ch.markdown = data["markdown"]
    if "sort_order" in data:
        ch.sort_order = data["sort_order"]

    await db.commit()
    await db.refresh(ch)
    return _chapter_payload(ch)


@router.delete("/learning/chapters/{module_key}/{slug}")
async def delete_chapter(
    module_key: str,
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
) -> Dict:
    """管理员删除章节。"""
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(status_code=400, detail="无效的模块标识")
    stmt = select(LearningChapter).where(
        LearningChapter.module_key == module_key,
        LearningChapter.slug == slug,
    )
    result = await db.execute(stmt)
    ch = result.scalar_one_or_none()
    if ch is None:
        raise HTTPException(status_code=404, detail="章节不存在")
    await db.delete(ch)
    await db.commit()
    return {"detail": "ok"}
