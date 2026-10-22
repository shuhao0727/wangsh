from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_super_admin
from app.schemas.xbk import XbkPublicConfig
from app.services.xbk.public_config import XbkPublicConfigService

router = APIRouter()


@router.get("", response_model=XbkPublicConfig)
async def get_xbk_public_config(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    enabled = await XbkPublicConfigService.get_enabled(db)
    return {"enabled": enabled}


@router.put("", response_model=XbkPublicConfig)
async def set_xbk_public_config(
    payload: XbkPublicConfig,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin),
) -> Dict[str, Any]:
    # 开放后匿名可读全量学生名册与选课数据，因此与系统功能开关一致，
    # 仅超级管理员可切换，避免任一管理员单方面开放隐私数据。
    enabled = await XbkPublicConfigService.set_enabled(db, payload.enabled)
    return {"enabled": enabled}

