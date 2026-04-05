"""
XBK（校本课）模块 API 端点
"""

from fastapi import APIRouter

from app.api.endpoints.xbk.public_config import router as public_config_router
from app.api.endpoints.xbk.students import router as students_router
from app.api.endpoints.xbk.courses import router as courses_router
from app.api.endpoints.xbk.selections import router as selections_router
from app.api.endpoints.xbk.bulk_ops import router as bulk_ops_router
from app.api.endpoints.xbk.analysis import router as analysis_router
from app.api.endpoints.xbk.import_export import router as import_export_router
from app.api.endpoints.xbk.exports import router as exports_router


router = APIRouter()

router.include_router(public_config_router, tags=["xbk"], prefix="/public-config")
# data 子路由（原 data.py 拆分为 4 个文件）
router.include_router(students_router, tags=["xbk"], prefix="/data")
router.include_router(courses_router, tags=["xbk"], prefix="/data")
router.include_router(selections_router, tags=["xbk"], prefix="/data")
router.include_router(bulk_ops_router, tags=["xbk"], prefix="/data")
# 分析 & 导入导出
router.include_router(analysis_router, tags=["xbk"], prefix="/analysis")
router.include_router(import_export_router, tags=["xbk"], prefix="")
router.include_router(exports_router, tags=["xbk"], prefix="")
