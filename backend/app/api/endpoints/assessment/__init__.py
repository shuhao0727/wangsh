"""
自主检测 API 路由聚合
"""

from fastapi import APIRouter
from .admin import router as admin_router
from .student import router as student_router

router = APIRouter()
router.include_router(admin_router, prefix="/admin", tags=["assessment-admin"])
router.include_router(student_router, tags=["assessment-student"])
