"""思维导图 API — 个人创作 + 公共广场。"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_admin
from app.models.learning.content import LearningContentItem
from app.schemas.learning.content import MindmapCreate, MindmapUpdate, LearningContentItemOut

from app.utils.errors import safe_error_detail
router = APIRouter(prefix="/learning/mindmaps", tags=["mindmaps"])


def _to_out(item: LearningContentItem) -> dict:
    content = {}
    if item.content:
        try:
            content = json.loads(item.content)
        except (json.JSONDecodeError, TypeError):
            content = {"raw": item.content}
    return {
        "id": item.id,
        "module_key": item.module_key,
        "section_key": item.section_key,
        "item_key": item.item_key,
        "title": item.title,
        "summary": item.summary,
        "content": content,
        "tags": json.loads(item.tags) if item.tags else [],
        "difficulty": item.difficulty,
        "sort_order": item.sort_order,
        "enabled": item.enabled,
        "source_type": item.source_type,
        "owner_id": item.owner_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("")
async def list_published(db: AsyncSession = Depends(get_db)):
    """公共导图广场。"""
    stmt = (
        select(LearningContentItem)
        .where(
            LearningContentItem.section_key == "mindmap",
            LearningContentItem.owner_id.is_(None),
            LearningContentItem.enabled.is_(True),
        )
        .order_by(LearningContentItem.updated_at.desc())
    )
    result = await db.execute(stmt)
    return [_to_out(row) for row in result.scalars()]


@router.get("/my")
async def list_my(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """我的个人导图。"""
    user_id = int(current_user["id"])
    stmt = (
        select(LearningContentItem)
        .where(
            LearningContentItem.section_key == "mindmap",
            LearningContentItem.owner_id == user_id,
        )
        .order_by(LearningContentItem.updated_at.desc())
    )
    result = await db.execute(stmt)
    return [_to_out(row) for row in result.scalars()]


@router.post("")
async def create_mindmap(
    body: MindmapCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """创建个人思维导图。"""
    user_id = int(current_user["id"])
    now = datetime.utcnow()
    item_key = f"user-{uuid.uuid4().hex[:12]}"
    content_json = json.dumps(body.content, ensure_ascii=False)
    item = LearningContentItem(
        module_key=body.module_key,
        section_key="mindmap",
        item_key=item_key,
        title=body.title,
        summary="",
        content=content_json,
        tags=json.dumps([]),
        difficulty="",
        sort_order=0,
        enabled=True,
        source_type="user",
        owner_id=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_detail("创建思维导图失败", e))
    await db.refresh(item)
    return _to_out(item)


@router.put("/{mindmap_id}")
async def update_mindmap(
    mindmap_id: int,
    body: MindmapUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """更新个人思维导图（仅所有者）。"""
    user_id = int(current_user["id"])
    stmt = select(LearningContentItem).where(LearningContentItem.id == mindmap_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="导图不存在")
    if item.owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权修改此导图")
    if body.title is not None:
        item.title = body.title
    if body.content is not None:
        item.content = json.dumps(body.content, ensure_ascii=False)
    if body.enabled is not None:
        item.enabled = body.enabled
    item.updated_at = datetime.utcnow()
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_detail("更新思维导图失败", e))
    await db.refresh(item)
    return _to_out(item)


@router.delete("/{mindmap_id}")
async def delete_mindmap(
    mindmap_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """删除个人思维导图（所有者或管理员）。"""
    user_id = int(current_user["id"])
    stmt = select(LearningContentItem).where(LearningContentItem.id == mindmap_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="导图不存在")
    is_admin = current_user.get("role_code") in ("admin", "super_admin")
    if item.owner_id != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="无权删除此导图")
    await db.delete(item)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_detail("删除思维导图失败", e))
    return {"ok": True}


@router.patch("/{mindmap_id}/publish")
async def toggle_publish(
    mindmap_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    """管理员发布/取消发布导图。"""
    stmt = select(LearningContentItem).where(LearningContentItem.id == mindmap_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="导图不存在")
    # toggle: if owner_id is set → unpublish (set to NULL); else → publish
    if item.owner_id is not None:
        item.owner_id = None
        item.source_type = "admin"
    else:
        item.owner_id = 1  # admin user
        item.source_type = "user"
    item.updated_at = datetime.utcnow()
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_detail("更新思维导图失败", e))
    await db.refresh(item)
    return _to_out(item)
