"""
系统管理 - 系统概览与配置

从 admin.py 拆分出的系统概览和配置端点。
使用 utils/metrics.py 中的公共指标采集函数消除重复代码。
"""

from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, require_admin
from app.utils.metrics import collect_db_pool_metrics, collect_http_metrics

router = APIRouter(prefix="/system")


@router.get("/overview")
async def system_overview(
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    users = await db.execute(text("SELECT COUNT(1) FROM sys_users WHERE is_deleted = false"))
    articles = await db.execute(text("SELECT COUNT(1) FROM wz_articles"))
    agents = await db.execute(text("SELECT COUNT(1) FROM znt_agents WHERE is_deleted = false"))
    sessions = await db.execute(text("SELECT COUNT(1) FROM znt_group_discussion_sessions"))
    messages = await db.execute(text("SELECT COUNT(1) FROM znt_group_discussion_messages"))

    http = await collect_http_metrics()
    db_pool = collect_db_pool_metrics()

    return {
        "timestamp": datetime.now().isoformat(),
        "counts": {
            "users": int(users.scalar() or 0),
            "articles": int(articles.scalar() or 0),
            "agents": int(agents.scalar() or 0),
            "group_sessions": int(sessions.scalar() or 0),
            "group_messages": int(messages.scalar() or 0),
        },
        "observability": {
            "http": http,
            "db": db_pool,
        },
    }


@router.get("/settings")
async def system_settings(
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    return {
        "project": {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "api_version": settings.API_V1_STR,
            "environment": settings.REACT_APP_ENV,
            "debug": settings.DEBUG,
        },
        "features": {
            "auto_create_tables": bool(settings.AUTO_CREATE_TABLES),
        },
        "server": {
            "host": settings.BACKEND_HOST,
            "port": settings.BACKEND_PORT,
            "log_level": settings.LOG_LEVEL,
            "timezone": settings.TIMEZONE,
        },
        "database": {
            "host": settings.POSTGRES_HOST,
            "port": settings.POSTGRES_PORT,
            "db": settings.POSTGRES_DB,
            "max_connections": settings.POSTGRES_MAX_CONNECTIONS,
            "url_configured": bool(settings.DATABASE_URL),
        },
        "redis": {
            "host": settings.REDIS_HOST,
            "port": settings.REDIS_PORT,
        },
        "security": {
            "jwt_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            "algorithm": settings.ALGORITHM,
        },
        "cors": {
            "origins": settings.CORS_ORIGINS,
        },
    }
