"""
学习板块 API 路由聚合
"""

from fastapi import APIRouter
from .progress import router as progress_router
from .content import router as content_router
from .chapters import router as chapters_router
from .mindmap import router as mindmap_router

router = APIRouter()
router.include_router(progress_router, prefix="", tags=["learning"])
router.include_router(content_router, prefix="", tags=["learning"])
router.include_router(chapters_router, prefix="", tags=["learning"])
router.include_router(mindmap_router, prefix="", tags=["mindmaps"])
