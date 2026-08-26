"""学习内容配置 API。"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_admin
from app.schemas.learning.content import LearningContentItemIn
from app.schemas.user_info import UserInfo
from app.services.learning import content_service as content_svc

router = APIRouter()

VALID_MODULE_KEYS = ("ml", "ai", "agents")


def _validate_module_key(module_key: str) -> None:
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(status_code=400, detail="无效的模块标识，仅支持: ml, ai, agents")


@router.get("/learning/content/{module_key}")
async def list_learning_content(
    module_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """获取学习模块启用内容。"""
    _validate_module_key(module_key)
    return await content_svc.list_learning_content(db, module_key)


@router.get("/learning/content/{module_key}/admin")
async def list_learning_content_admin(
    module_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
) -> List[Dict[str, Any]]:
    """管理员获取学习模块全部内容。"""
    _validate_module_key(module_key)
    return await content_svc.list_learning_content_admin(db, module_key)


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
    return await content_svc.upsert_learning_content(db, module_key, section_key, item_key, data)


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
    return await content_svc.toggle_learning_content(
        db, module_key, section_key, item_key, bool(data["enabled"])
    )
