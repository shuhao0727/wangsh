"""学习内容配置服务。"""

import json
from typing import Any, Dict, List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning.content import LearningContentItem
from app.schemas.learning.content import LearningContentItemIn
from app.utils.errors import safe_error_detail


def _safe_json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _content_payload(item: LearningContentItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "module_key": item.module_key,
        "section_key": item.section_key,
        "item_key": item.item_key,
        "title": item.title,
        "summary": item.summary,
        "content": _safe_json_loads(item.content, {}),
        "tags": _safe_json_loads(item.tags, []),
        "difficulty": item.difficulty,
        "sort_order": item.sort_order,
        "enabled": item.enabled,
        "source_type": item.source_type,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


async def list_learning_content(db: AsyncSession, module_key: str) -> List[Dict[str, Any]]:
    """获取学习模块启用内容。"""
    stmt = (
        select(LearningContentItem)
        .where(
            LearningContentItem.module_key == module_key,
            LearningContentItem.enabled.is_(True),
        )
        .order_by(
            LearningContentItem.section_key,
            LearningContentItem.sort_order,
            LearningContentItem.id,
        )
    )
    result = await db.execute(stmt)
    return [_content_payload(item) for item in result.scalars().all()]


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
    return [_content_payload(item) for item in result.scalars().all()]


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
