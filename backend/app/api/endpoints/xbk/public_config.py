from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_admin
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
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    enabled = await XbkPublicConfigService.set_enabled(db, payload.enabled)
    return {"enabled": enabled}

