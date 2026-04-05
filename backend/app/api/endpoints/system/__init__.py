"""
系统模块 API 端点

统一注册所有系统管理子路由：
- health: 健康检查
- feature_flags: 功能开关 CRUD
- overview: 系统概览与配置
- metrics: Typst/Prometheus 指标与 PDF 清理
"""

from fastapi import APIRouter

from .feature_flags import router as feature_flags_router
from .health import router as health_router
from .metrics import router as metrics_router
from .overview import router as overview_router

router = APIRouter()

# health.py 没有 prefix，直接挂载
router.include_router(health_router, tags=["health"])

# 以下三个都有 prefix="/system"，通过 tags 区分
router.include_router(feature_flags_router, tags=["system"])
router.include_router(overview_router, tags=["system"])
router.include_router(metrics_router, tags=["system"])
