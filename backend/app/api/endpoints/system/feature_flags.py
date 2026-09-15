"""
系统管理 - Feature Flags CRUD

从 admin.py 拆分出的功能开关管理端点。
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_super_admin
from app.models.core.feature_flag import FeatureFlag

router = APIRouter(prefix="/system")


# 匿名接口只公开前端既有消费者需要的入口可见性。这里必须使用明确白名单，
# 不能通过前缀、敏感词黑名单或数据库中是否存在某个 key 来决定是否公开。
PUBLIC_FEATURE_FLAG_KEYS = frozenset(
    {
        "ai_agents_nav_enabled",
        "informatics_competition_nav_enabled",
        "it_technology_nav_enabled",
        "personal_programs_nav_enabled",
        "articles_nav_enabled",
        "it_dianming_enabled",
        "it_survey_enabled",
        "it_mindmap_enabled",
        "it_python_lab_enabled",
        "it_machine_learning_enabled",
        "it_ai_exploration_enabled",
        "it_agent_exploration_enabled",
        "it_game_lock_cracker_enabled",
        "it_game_repo_enabled",
    }
)

PUBLIC_FEATURE_FLAG_NOT_FOUND = "Public feature flag not found"


class FeatureFlagSchema(BaseModel):
    key: str
    value: Any

    model_config = ConfigDict(from_attributes=True)


class PublicFeatureFlagSchema(BaseModel):
    """匿名接口的最小响应合同；不允许透传数据库中的通用 JSON。"""

    key: str
    value: Dict[str, bool]


@router.get("/feature-flags", response_model=List[FeatureFlagSchema])
async def list_feature_flags(
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin),
) -> Any:
    stmt = select(FeatureFlag)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/feature-flags/{key}", response_model=FeatureFlagSchema)
async def get_feature_flag(
    key: str,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(require_super_admin),
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
    _: Dict[str, Any] = Depends(require_super_admin),
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


@router.get(
    "/public/feature-flags/{key}",
    response_model=PublicFeatureFlagSchema,
)
async def get_public_feature_flag(
    key: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> PublicFeatureFlagSchema:
    """公开端点：仅投影获准入口的严格布尔 ``value.enabled``。"""
    response.headers["Cache-Control"] = "no-store"

    # 在查询数据库之前拒绝未知 key，避免泄露私有配置的存在性和值。
    if key not in PUBLIC_FEATURE_FLAG_KEYS:
        raise HTTPException(status_code=404, detail=PUBLIC_FEATURE_FLAG_NOT_FOUND)

    stmt = select(FeatureFlag).where(FeatureFlag.key == key)
    result = await db.execute(stmt)
    flag = result.scalar_one_or_none()
    if not flag:
        return PublicFeatureFlagSchema(key=key, value={})

    raw_value = flag.value
    if not isinstance(raw_value, dict):
        return PublicFeatureFlagSchema(key=key, value={})

    enabled = raw_value.get("enabled")
    if not isinstance(enabled, bool):
        return PublicFeatureFlagSchema(key=key, value={})

    return PublicFeatureFlagSchema(key=key, value={"enabled": enabled})
