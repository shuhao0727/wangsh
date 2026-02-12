"""
健康检查 API 端点
"""

from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.database import get_db
from app.core.config import settings
from app.utils.cache import cache

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    健康检查接口
    检查数据库连接和基本服务状态
    """
    try:
        # 检查数据库连接
        result = await db.execute(text("SELECT 1"))
        db_status = "healthy" if result.scalar() == 1 else "unhealthy"
        
        # 检查 Redis 连接
        redis_status = "healthy"
        try:
            client = await cache.get_client()
            pong = await client.ping()
            if pong is not True and pong != "PONG":
                redis_status = "unhealthy"
        except Exception:
            redis_status = "unhealthy"
        
        # 获取系统信息
        system_info = {
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "timestamp": datetime.now().isoformat(),
            "environment": settings.REACT_APP_ENV,
            "debug_mode": settings.DEBUG,
            "database": db_status,
            "redis": redis_status,
        }
        
        # 总体状态
        if db_status != "healthy":
            overall_status = "unhealthy"
        elif redis_status != "healthy":
            overall_status = "degraded"
        else:
            overall_status = "healthy"
        
        return {
            "status": overall_status,
            "checks": {
                "database": db_status,
                "redis": redis_status,
            },
            "system": system_info,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "error": str(e),
                "service": settings.PROJECT_NAME,
                "timestamp": datetime.now().isoformat(),
            }
        )


@router.get("/ping")
async def ping() -> Dict[str, str]:
    """
    简单的 ping 接口
    用于测试 API 是否可达
    """
    return {
        "message": "pong",
        "service": settings.PROJECT_NAME,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/version")
async def version() -> Dict[str, str]:
    """
    获取服务版本信息
    """
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_version": settings.API_V1_STR,
        "environment": settings.REACT_APP_ENV,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/config")
async def config_check() -> Dict[str, Any]:
    """
    配置检查接口（仅开发环境）
    返回当前配置信息（不包含敏感信息）
    """
    if not settings.DEBUG:
        raise HTTPException(
            status_code=403,
            detail="配置检查仅在开发环境可用"
        )
    
    return {
        "project": {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "api_version": settings.API_V1_STR,
        },
        "server": {
            "host": settings.BACKEND_HOST,
            "port": settings.BACKEND_PORT,
            "reload": settings.BACKEND_RELOAD,
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
        "features": {
            "debug": settings.DEBUG,
            "log_level": settings.LOG_LEVEL,
            "timezone": settings.TIMEZONE,
        }
    }
