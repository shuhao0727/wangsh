from fastapi import APIRouter

from app.api.pythonlab.cfg import router as cfg_router
from app.api.pythonlab.flow import router as flow_router
from app.api.pythonlab.sessions import router as sessions_router
from app.api.pythonlab.syntax import router as syntax_router
from app.api.pythonlab.ws import router as ws_router

router = APIRouter()

router.include_router(sessions_router, tags=["pythonlab"])
router.include_router(ws_router, tags=["pythonlab"])
router.include_router(cfg_router, tags=["pythonlab"])
router.include_router(flow_router, tags=["pythonlab"])
router.include_router(syntax_router, tags=["pythonlab"])
