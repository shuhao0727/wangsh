"""
PythonLab API v2 兼容别名层（facade），不是空壳。

规范实现位于 app.api.pythonlab；本模块只把同一批 router 以 /api/v2/pythonlab
前缀重挂（main.py 中 include_router(v2_pythonlab_router, prefix="/api/v2/pythonlab")）。
新增/修改 PythonLab 端点请改 app.api.pythonlab，不要在本层复制逻辑。
"""
from fastapi import APIRouter

from app.api.pythonlab.sessions import router as sessions_router
from app.api.pythonlab.ws import router as ws_router
from app.api.pythonlab.cfg import router as cfg_router
from app.api.pythonlab.flow import router as flow_router
from app.api.pythonlab.syntax import router as syntax_router

router = APIRouter()

# Canonical PythonLab implementation lives under app.api.pythonlab.
router.include_router(sessions_router, tags=["pythonlab-v2"])
router.include_router(ws_router, tags=["pythonlab-v2"])
router.include_router(cfg_router, tags=["pythonlab-v2"])
router.include_router(flow_router, tags=["pythonlab-v2"])
router.include_router(syntax_router, tags=["pythonlab-v2"])
