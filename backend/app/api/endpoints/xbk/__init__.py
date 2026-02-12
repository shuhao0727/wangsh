"""
XBK（校本课）模块 API 端点
"""

from fastapi import APIRouter
from app.api.endpoints.xbk.public_config import router as public_config_router
from app.api.endpoints.xbk.data import router as data_router
from app.api.endpoints.xbk.analysis import router as analysis_router
from app.api.endpoints.xbk.import_export import router as import_export_router
from app.api.endpoints.xbk.exports import router as exports_router


router = APIRouter()

router.include_router(public_config_router, tags=["xbk"], prefix="/public-config")
router.include_router(data_router, tags=["xbk"], prefix="/data")
router.include_router(analysis_router, tags=["xbk"], prefix="/analysis")
router.include_router(import_export_router, tags=["xbk"], prefix="")
router.include_router(exports_router, tags=["xbk"], prefix="")
