"""学习内容配置 API。"""

import json
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.models.learning.content import LearningContentItem
from app.schemas.learning.content import LearningContentItemIn
from app.schemas.user_info import UserInfo

router = APIRouter()

VALID_MODULE_KEYS = ("ml", "ai", "agents")


def _validate_module_key(module_key: str) -> None:
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(status_code=400, detail="无效的模块标识，仅支持: ml, ai, agents")


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


@router.get("/learning/content/{module_key}")
async def list_learning_content(
    module_key: str,
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """获取学习模块启用内容。"""
    _validate_module_key(module_key)
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


@router.get("/learning/content/{module_key}/admin")
async def list_learning_content_admin(
    module_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
) -> List[Dict[str, Any]]:
    """管理员获取学习模块全部内容。"""
    _validate_module_key(module_key)
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


@router.put("/learning/content/{module_key}/{section_key}/{item_key}")
async def upsert_learning_content(
    module_key: str,
    section_key: str,
    item_key: str,
    data: LearningContentItemIn,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
) -> Dict[str, Any]:
    """管理员创建或更新学习内容项。"""
    _validate_module_key(module_key)
    if data.section_key != section_key or data.item_key != item_key:
        raise HTTPException(status_code=400, detail="路径参数与请求体 section_key/item_key 不一致")

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

    await db.commit()
    await db.refresh(item)
    return _content_payload(item)


@router.patch("/learning/content/{module_key}/{section_key}/{item_key}/enabled")
async def toggle_learning_content(
    module_key: str,
    section_key: str,
    item_key: str,
    data: Dict[str, bool],
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
) -> Dict[str, Any]:
    """管理员启用或停用学习内容项。"""
    _validate_module_key(module_key)
    if "enabled" not in data:
        raise HTTPException(status_code=400, detail="缺少 enabled 字段")

    stmt = select(LearningContentItem).where(
        LearningContentItem.module_key == module_key,
        LearningContentItem.section_key == section_key,
        LearningContentItem.item_key == item_key,
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="未找到学习内容项")

    item.enabled = bool(data["enabled"])
    await db.commit()
    await db.refresh(item)
    return _content_payload(item)
