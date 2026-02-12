"""
WangSh 后端应用主入口
FastAPI 应用配置和启动
"""

import os
import time
import uuid
from datetime import datetime
from typing import Any, Dict

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import select, text
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.db.database import engine, Base, AsyncSessionLocal
from app.api import api_router
from app.core.celery_app import celery_app
from app.utils.security import hash_super_admin_password
from app.utils.cache import cache, startup_cache, shutdown_cache
from app.models import User
from app.services.informatics.typst_styles import read_resource_style
from app.models.informatics.typst_style import TypstStyle


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    - 启动时：初始化数据库连接，创建表，创建超级管理员，初始化缓存
    - 关闭时：清理资源
    """
    logger.info("应用启动中...")
    
    if settings.DEBUG or settings.AUTO_CREATE_TABLES:
        logger.info("创建数据库表（仅开发环境/首次部署可选，生产请使用 Alembic 迁移）...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await _ensure_dev_schema(conn)

    # 创建超级管理员账户
    await create_super_admin()

    async with AsyncSessionLocal() as db:
        try:
            res = await db.execute(select(TypstStyle))
            any_style = res.scalar_one_or_none()
            if not any_style:
                content = read_resource_style("my_style")
                if content.strip():
                    db.add(TypstStyle(key="my_style", title="my_style", content=content, sort_order=0))
                    await db.commit()
        except Exception:
            pass
    
    # 初始化缓存
    try:
        logger.info("缓存服务初始化完成")
    except Exception as e:
        logger.error(f"缓存服务初始化失败: {e}")
        # 不抛出异常，避免应用启动失败
    
    logger.info("应用启动完成")
    yield
    logger.info("应用关闭中...")
    
    # 关闭缓存连接
    try:
        await shutdown_cache()
        logger.info("缓存服务已关闭")
    except Exception as e:
        logger.error(f"缓存服务关闭失败: {e}")
    
    # 清理数据库连接
    await engine.dispose()
    logger.info("应用已关闭")


async def _ensure_dev_schema(conn):
    try:
        await conn.execute(
            text(
                "ALTER TABLE znt_group_discussion_sessions "
                "ADD COLUMN IF NOT EXISTS group_name VARCHAR(64)"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_znt_group_discussion_sessions_group_name "
                "ON znt_group_discussion_sessions (group_name)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE znt_group_discussion_analyses "
                "ADD COLUMN IF NOT EXISTS compare_session_ids TEXT"
            )
        )
    except Exception:
        pass


async def create_super_admin():
    """
    创建或更新超级管理员账户
    从环境变量读取配置
    基于 sys_users 表结构（v3.0），使用 role_code='super_admin' 标识超级管理员
    """
    logger.info("检查超级管理员账户...")

    try:
        # 从环境变量获取超级管理员配置
        admin_username = settings.SUPER_ADMIN_USERNAME
        admin_password = settings.SUPER_ADMIN_PASSWORD
        admin_full_name = settings.SUPER_ADMIN_FULL_NAME
        
        # 不再需要 email 字段
        if not all([admin_username, admin_password]):
            logger.warning("超级管理员配置不完整，跳过创建")
            return
        
        # 哈希密码
        hashed_password = hash_super_admin_password()
        
        async with AsyncSessionLocal() as session:
            # 检查管理员是否已存在（根据 username）
            query = select(User).where(
                User.username == admin_username,
                User.role_code.in_(['admin', 'super_admin'])
            )
            result = await session.execute(query)
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                # 更新现有管理员
                existing_admin.hashed_password = hashed_password  # type: ignore[assignment]
                existing_admin.role_code = 'super_admin'  # type: ignore[assignment]
                existing_admin.is_active = True  # type: ignore
                existing_admin.full_name = admin_full_name if admin_full_name else existing_admin.full_name  # type: ignore[assignment]
                logger.info(f"超级管理员账户已更新: {admin_username}")
            else:
                # 创建新管理员
                new_admin = User(
                    username=admin_username,
                    hashed_password=hashed_password,
                    full_name=admin_full_name if admin_full_name else "系统超级管理员",
                    role_code='super_admin',
                    is_active=True
                )
                session.add(new_admin)
                logger.info(f"超级管理员账户已创建: {admin_username}")
            
            await session.commit()
            logger.info("超级管理员账户设置完成")
    
    except Exception as e:
        logger.error(f"创建超级管理员失败: {e}")
        # 不抛出异常，避免应用启动失败


# 创建 FastAPI 应用实例
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="WangSh 项目后端 API 服务",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
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
if settings.DEBUG:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
        pong = await client.ping()
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
