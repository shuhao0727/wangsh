from fastapi import APIRouter

from app.api.endpoints.debug.sessions import router as sessions_router
from app.api.endpoints.debug.ws import router as ws_router
from app.api.endpoints.debug.cfg import router as cfg_router
from app.api.endpoints.debug.flow import router as flow_router
from app.api.endpoints.debug.pseudocode import router as pseudocode_router
from app.api.endpoints.debug.syntax import router as syntax_router

router = APIRouter()

router.include_router(sessions_router, tags=["debug"])
router.include_router(ws_router, tags=["debug"])
router.include_router(cfg_router, tags=["debug"])
router.include_router(flow_router, tags=["debug"])
router.include_router(pseudocode_router, tags=["debug"])
router.include_router(syntax_router, tags=["debug"])
