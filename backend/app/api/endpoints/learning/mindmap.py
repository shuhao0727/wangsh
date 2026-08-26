"""思维导图 API — 个人创作 + 公共广场。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_admin
from app.schemas.learning.content import MindmapCreate, MindmapUpdate
from app.services.learning import mindmap_service as mindmap_svc

router = APIRouter(prefix="/learning/mindmaps", tags=["mindmaps"])


@router.get("")
async def list_published(db: AsyncSession = Depends(get_db)):
    """公共导图广场。"""
    return await mindmap_svc.list_published_mindmaps(db)


@router.get("/my")
async def list_my(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """我的个人导图。"""
    return await mindmap_svc.list_my_mindmaps(db, int(current_user["id"]))


@router.post("")
async def create_mindmap(
    body: MindmapCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """创建个人思维导图。"""
    return await mindmap_svc.create_mindmap(db, int(current_user["id"]), body)


@router.put("/{mindmap_id}")
async def update_mindmap(
    mindmap_id: int,
    body: MindmapUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """更新个人思维导图（仅所有者）。"""
    return await mindmap_svc.update_mindmap(db, int(current_user["id"]), mindmap_id, body)


@router.delete("/{mindmap_id}")
async def delete_mindmap(
    mindmap_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """删除个人思维导图（所有者或管理员）。"""
    user_id = int(current_user["id"])
    is_admin = current_user.get("role_code") in ("admin", "super_admin")
    return await mindmap_svc.delete_mindmap(db, user_id, mindmap_id, is_admin)


@router.patch("/{mindmap_id}/publish")
async def toggle_publish(
    mindmap_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    """管理员发布/取消发布导图。"""
    return await mindmap_svc.toggle_mindmap_publish(db, mindmap_id)
