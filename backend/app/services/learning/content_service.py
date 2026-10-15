"""学习内容配置服务。"""

import json
from typing import Any, Dict, List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning.chapter import LearningChapter
from app.models.learning.content import LearningContentItem
from app.schemas.learning.content import LearningContentItemIn
from app.services.learning import chapter_overlay
from app.utils.errors import safe_error_detail


def _safe_json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _chapter_overlay(chapter: LearningChapter) -> Dict[str, Any]:
    """Convert the chapter table row to the public LearningBook shape."""
    return {
        "slug": chapter.slug,
        "title": chapter.title,
        "summary": chapter.summary,
        "estimatedMinutes": chapter.estimated_minutes,
        "difficulty": chapter.difficulty,
        "group": chapter.group_name,
        "markdown": chapter.markdown or "",
        "sort_order": chapter.sort_order,
        "updated_at": chapter.updated_at.isoformat() if chapter.updated_at else None,
    }


def _merge_book_chapters(content: Any, chapters: List[LearningChapter]) -> Any:
    """Overlay persisted chapters without discarding bundled book metadata."""
    return chapter_overlay.merge_book_chapters(
        content, chapters, lambda chapter: _chapter_overlay(chapter),
    )


def _content_payload(
    item: LearningContentItem,
    chapters: List[LearningChapter] | None = None,
) -> Dict[str, Any]:
    content = _safe_json_loads(item.content, {})
    if item.section_key == "raw" and item.item_key == "book":
        content = _merge_book_chapters(content, chapters or [])
    return {
        "id": item.id,
        "module_key": item.module_key,
        "section_key": item.section_key,
        "item_key": item.item_key,
        "title": item.title,
        "summary": item.summary,
        "content": content,
        "tags": _safe_json_loads(item.tags, []),
        "difficulty": item.difficulty,
        "sort_order": item.sort_order,
        "enabled": item.enabled,
        "source_type": item.source_type,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


async def list_learning_content(db: AsyncSession, module_key: str) -> List[Dict[str, Any]]:
    """获取学习模块启用的公共内容；个人内容由专用归属接口提供。"""
    stmt = (
        select(LearningContentItem)
        .where(
            LearningContentItem.module_key == module_key,
            LearningContentItem.enabled.is_(True),
            LearningContentItem.owner_id.is_(None),
        )
        .order_by(
            LearningContentItem.section_key,
            LearningContentItem.sort_order,
            LearningContentItem.id,
        )
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    chapter_result = await db.execute(
        select(LearningChapter)
        .where(LearningChapter.module_key == module_key)
        .order_by(LearningChapter.sort_order, LearningChapter.id)
    )
    chapters = chapter_result.scalars().all()
    return [_content_payload(item, chapters) for item in items]


async def list_learning_content_admin(db: AsyncSession, module_key: str) -> List[Dict[str, Any]]:
    """管理员获取学习模块全部内容。"""
    stmt = (
        select(LearningContentItem)
        .where(LearningContentItem.module_key == module_key)
        .order_by(
            LearningContentItem.section_key,
            LearningContentItem.sort_order,
            LearningContentItem.id,
        )
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    chapter_result = await db.execute(
        select(LearningChapter)
        .where(LearningChapter.module_key == module_key)
        .order_by(LearningChapter.sort_order, LearningChapter.id)
    )
    chapters = chapter_result.scalars().all()
    return [_content_payload(item, chapters) for item in items]


async def upsert_learning_content(
    db: AsyncSession,
    module_key: str,
    section_key: str,
    item_key: str,
    data: LearningContentItemIn,
) -> Dict[str, Any]:
    """管理员创建或更新学习内容项。"""
    stmt = select(LearningContentItem).where(
        LearningContentItem.module_key == module_key,
        LearningContentItem.section_key == section_key,
        LearningContentItem.item_key == item_key,
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if item is None:
        item = LearningContentItem(module_key=module_key, section_key=section_key, item_key=item_key)
        db.add(item)

    item.title = data.title
    item.summary = data.summary
    item.content = json.dumps(data.content, ensure_ascii=False)
    item.tags = json.dumps(data.tags, ensure_ascii=False)
    item.difficulty = data.difficulty
    item.sort_order = data.sort_order
    item.enabled = data.enabled
    item.source_type = data.source_type

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_detail("保存学习内容失败", e))
    await db.refresh(item)
    return _content_payload(item)


async def toggle_learning_content(
    db: AsyncSession,
    module_key: str,
    section_key: str,
    item_key: str,
    enabled: bool,
) -> Dict[str, Any]:
    """管理员启用或停用学习内容项。"""
    stmt = select(LearningContentItem).where(
        LearningContentItem.module_key == module_key,
        LearningContentItem.section_key == section_key,
        LearningContentItem.item_key == item_key,
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="未找到学习内容项")

    item.enabled = enabled
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_detail("保存学习内容失败", e))
    await db.refresh(item)
    return _content_payload(item)
