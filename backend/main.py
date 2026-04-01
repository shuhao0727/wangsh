"""
WangSh 后端应用主入口
FastAPI 应用配置和启动
"""

import time
import uuid
from datetime import datetime
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.api import api_router
from app.core.celery_app import celery_app
from app.utils.cache import cache
from app.core.startup import (
    init_database,
    init_super_admin,
    init_seed_data,
    init_services,
    start_background_tasks,
    shutdown,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("应用启动中...")

    await init_database()
    await init_super_admin()
    await init_seed_data()
    await init_services()

    logger.info("应用启动完成")
    cleanup_task = start_background_tasks()

    yield

    logger.info("应用关闭中...")
    await shutdown(cleanup_task)


# 创建 FastAPI 应用实例
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="WangSh 项目后端 API 服务",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if not settings.DEBUG:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' blob:; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self' data:; "
                "connect-src 'self' blob: wss:; "
                "worker-src 'self' blob:; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "frame-ancestors 'none'; "
                "form-action 'self'",
            )
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        return response

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

class HttpMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in {"/health", "/ping", "/docs", "/openapi.json"}:
            return await call_next(request)
        if path.startswith("/docs") or path.startswith("/redoc"):
            return await call_next(request)
        if path.startswith(f"{settings.API_V1_STR}/openapi.json"):
            return await call_next(request)
        if path.startswith(f"{settings.API_V1_STR}/system/metrics"):
            return await call_next(request)

        client = None
        inflight_inc_ok = False
        try:
            client = await cache.get_client()
            await client.incr("http:req:inflight")
            inflight_inc_ok = True
        except Exception:
            client = None

        start = time.perf_counter()
        status_code = 500
        try:
            response: Response = await call_next(request)
            status_code = int(getattr(response, "status_code", 200) or 200)
            return response
        finally:
            dur_ms = int((time.perf_counter() - start) * 1000)
            try:
                if inflight_inc_ok:
                    if client is not None:
                        try:
                            await client.decr("http:req:inflight")
                        except Exception:
                            pass
                    else:
                        try:
                            tmp = await cache.get_client()
                            await tmp.decr("http:req:inflight")
                        except Exception:
                            pass

                client = client or await cache.get_client()
                pipe = client.pipeline()
                pipe.incr("http:req:total")
                if 400 <= status_code < 500:
                    pipe.incr("http:req:4xx")
                if status_code >= 500:
                    pipe.incr("http:req:5xx")
                pipe.lpush("http:req:dur_ms", dur_ms)
                pipe.ltrim("http:req:dur_ms", 0, max(0, int(settings.HTTP_METRICS_SAMPLE_SIZE) - 1))
                await pipe.execute()
            except Exception:
                pass

# 配置 CORS
_cors_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
_cors_headers = ["Content-Type", "Authorization", "X-Request-ID"]
if settings.DEBUG:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_origin_regex=r"^https?://((localhost|127\.0\.0\.1)|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(\.\d{1,3}){2})(:\d+)?$",
        allow_credentials=True,
        allow_methods=_cors_methods,
        allow_headers=_cors_headers,
    )
elif settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=_cors_methods,
        allow_headers=_cors_headers,
    )

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(HttpMetricsMiddleware)

# 注册 API 路由
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """根路径，返回应用信息"""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "description": "WangSh 项目后端 API 服务",
        "docs": "/docs" if settings.DEBUG else None,
        "health": "/health",
    }


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    db_status = "healthy"
    try:
        async with AsyncSessionLocal() as db:
            r = await db.execute(text("SELECT 1"))
            db_status = "healthy" if r.scalar() == 1 else "unhealthy"
    except Exception:
        db_status = "unhealthy"

    redis_status = "healthy"
    try:
        client = await cache.get_client()
        pong = await client.ping()  # type: ignore[misc]
        if pong is not True and pong != "PONG":
            redis_status = "unhealthy"
    except Exception:
        redis_status = "unhealthy"

    if db_status != "healthy":
        overall_status = "unhealthy"
    elif redis_status != "healthy":
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "checks": {"database": db_status, "redis": redis_status},
        "system": {
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "timestamp": datetime.now().isoformat(),
            "environment": settings.REACT_APP_ENV,
            "debug_mode": settings.DEBUG,
        },
    }


@app.get("/ping")
async def ping():
    """简单的 ping 接口，用于测试"""
    return {"message": "pong"}


# Celery 应用实例
celery = celery_app

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.BACKEND_PORT,
        reload=settings.BACKEND_RELOAD,
        log_level=settings.LOG_LEVEL.lower(),
    )
