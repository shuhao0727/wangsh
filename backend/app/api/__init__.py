"""
API 路由注册
"""

from fastapi import APIRouter
from app.api.endpoints.system.health import router as health_router
from app.api.endpoints.system.admin import router as system_admin_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.content.articles import router as articles_router
from app.api.endpoints.content.categories import router as categories_router
from app.api.endpoints.management.users import router as users_router
from app.api.endpoints.agents import ai_agents_router, model_discovery_router
from app.api.endpoints.informatics.typst_notes import router as typst_notes_router
from app.api.endpoints.informatics.public_typst_notes import router as public_typst_notes_router
from app.api.endpoints.informatics.public_typst_style import router as public_typst_style_router
from app.api.endpoints.informatics.typst_styles import router as typst_styles_router
from app.api.endpoints.informatics.typst_categories import router as typst_categories_router
from app.api.endpoints.xbk import router as xbk_router
from app.api.endpoints.xxjs import router as xxjs_router

api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health_router, tags=["health"])
api_router.include_router(system_admin_router, tags=["system"])
api_router.include_router(auth_router, tags=["authentication"], prefix="/auth")
api_router.include_router(articles_router, tags=["articles"], prefix="/articles")
api_router.include_router(categories_router, tags=["categories"], prefix="/categories")
api_router.include_router(users_router, tags=["users"], prefix="/users")
api_router.include_router(ai_agents_router, tags=["ai-agents"], prefix="/ai-agents")
api_router.include_router(model_discovery_router, tags=["model-discovery"], prefix="/model-discovery")
api_router.include_router(typst_notes_router, tags=["informatics"])
api_router.include_router(typst_styles_router, tags=["informatics"])
api_router.include_router(typst_categories_router, tags=["informatics"])
api_router.include_router(public_typst_notes_router, tags=["public-informatics"])
api_router.include_router(public_typst_style_router, tags=["public-informatics"])
api_router.include_router(xbk_router, tags=["xbk"], prefix="/xbk")
api_router.include_router(xxjs_router, tags=["xxjs"], prefix="/xxjs")
