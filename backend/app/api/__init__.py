"""
API 路由注册
"""

from fastapi import APIRouter
from app.api.endpoints.system import router as system_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.content.articles import router as articles_router
from app.api.endpoints.content.categories import router as categories_router
from app.api.endpoints.management.users import router as users_router
from app.api.endpoints.agents import ai_agents_router, model_discovery_router
from app.api.endpoints.informatics.typst_notes import router as typst_notes_router
from app.api.endpoints.informatics.github_sync import router as github_sync_router
from app.api.endpoints.informatics.public_typst_notes import router as public_typst_notes_router
from app.api.endpoints.informatics.public_typst_style import router as public_typst_style_router
from app.api.endpoints.informatics.typst_styles import router as typst_styles_router
from app.api.endpoints.informatics.typst_categories import router as typst_categories_router
from app.api.endpoints.xbk import router as xbk_router
from app.api.endpoints.xxjs import router as xxjs_router
from app.api.endpoints.debug import router as debug_router
from app.api.endpoints.assessment import router as assessment_router
from app.api.endpoints.classroom import router as classroom_router
from app.api.endpoints.admin_stream import router as admin_stream_router

api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(system_router)  # health + feature_flags + overview + metrics
api_router.include_router(auth_router, tags=["authentication"], prefix="/auth")
api_router.include_router(articles_router, tags=["articles"], prefix="/articles")
api_router.include_router(categories_router, tags=["categories"], prefix="/categories")
api_router.include_router(users_router, tags=["users"], prefix="/users")
api_router.include_router(ai_agents_router, tags=["ai-agents"], prefix="/ai-agents")
api_router.include_router(model_discovery_router, tags=["model-discovery"], prefix="/model-discovery")
api_router.include_router(typst_notes_router, tags=["informatics"])
api_router.include_router(github_sync_router, tags=["informatics"])
api_router.include_router(typst_styles_router, tags=["informatics"])
api_router.include_router(typst_categories_router, tags=["informatics"])
api_router.include_router(public_typst_notes_router, tags=["public-informatics"])
api_router.include_router(public_typst_style_router, tags=["public-informatics"])
api_router.include_router(xbk_router, tags=["xbk"], prefix="/xbk")
api_router.include_router(xxjs_router, tags=["xxjs"], prefix="/xxjs")
api_router.include_router(debug_router, tags=["debug"], prefix="/debug")
api_router.include_router(assessment_router, tags=["assessment"], prefix="/assessment")
api_router.include_router(classroom_router, tags=["classroom"], prefix="/classroom")
api_router.include_router(admin_stream_router, tags=["admin-stream"], prefix="/admin")
