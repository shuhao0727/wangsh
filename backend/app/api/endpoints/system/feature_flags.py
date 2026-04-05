"""
系统管理 - Feature Flags CRUD

从 admin.py 拆分出的功能开关管理端点。
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.models.core.feature_flag import FeatureFlag

router = APIRouter(prefix="/system")


class FeatureFlagSchema(BaseModel):
    key: str
    value: Any

    model_config = ConfigDict(from_attributes=True)


@router.get("/feature-flags", response_model=List[FeatureFlagSchema])
async def list_feature_flags(
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    stmt = select(FeatureFlag)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/feature-flags/{key}", response_model=FeatureFlagSchema)
async def get_feature_flag(
    key: str,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(require_admin),
) -> Any:
    stmt = select(FeatureFlag).where(FeatureFlag.key == key)
    result = await db.execute(stmt)
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@router.post("/feature-flags", response_model=FeatureFlagSchema)
async def create_or_update_feature_flag(
    data: FeatureFlagSchema,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    stmt = select(FeatureFlag).where(FeatureFlag.key == data.key)
    result = await db.execute(stmt)
    flag = result.scalar_one_or_none()

    if flag:
        flag.value = data.value
    else:
        flag = FeatureFlag(key=data.key, value=data.value)
        db.add(flag)

    await db.commit()
    await db.refresh(flag)
    return flag


@router.get("/public/feature-flags/{key}", response_model=FeatureFlagSchema)
async def get_public_feature_flag(
    key: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """公开端点：前端读取功能开关（无需认证）"""
    stmt = select(FeatureFlag).where(FeatureFlag.key == key)
    result = await db.execute(stmt)
    flag = result.scalar_one_or_none()
    if not flag:
        return FeatureFlagSchema(key=key, value={})
    return flag
