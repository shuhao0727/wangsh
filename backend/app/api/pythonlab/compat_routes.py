from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from app.api.pythonlab.compat import (
    DEBUG_V1_USAGE_LOOKBACK_DAYS_MAX,
    collect_debug_v1_alias_usage,
)
from app.core.deps import require_admin

router = APIRouter()


@router.get("/compat/deprecated_usage")
async def get_deprecated_usage(
    days: int = Query(default=7, ge=1, le=DEBUG_V1_USAGE_LOOKBACK_DAYS_MAX),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    return await collect_debug_v1_alias_usage(days)
