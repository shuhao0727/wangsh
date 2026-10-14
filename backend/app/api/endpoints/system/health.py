"""
健康检查 API 端点
"""

from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.database import AsyncSessionLocal, get_db
from app.core.config import settings
from app.utils.cache import cache
from app.core.startup import check_conversations_view_contract

router = APIRouter()


_READINESS_HEALTHY = "healthy"
_READINESS_DEGRADED = "degraded"
_READINESS_UNHEALTHY = "unhealthy"


def readiness_http_status(status: str) -> int:
    """Map readiness to HTTP semantics used by routes and Compose probes.

    A degraded service is useful for diagnostics but is not ready for traffic:
    HTTP-only orchestrators must not mistake it for a ready service.
    """
    return 200 if status == _READINESS_HEALTHY else 503


def _unhealthy_view_contract(reason: str) -> Dict[str, str]:
    return {"status": _READINESS_UNHEALTHY, "reason": reason}


async def check_agent_secret_contract(db: AsyncSession) -> Dict[str, Any]:
    """Verify stored agent API keys decrypt with the configured Fernet key.

    Why this exists: AGENT_API_KEY_ENCRYPTION_KEY is environment-specific, but
    the dev and prod stacks share one Postgres data directory. When the two env
    files disagree, decryption fails silently: rows still exist, has_api_key
    still reads true, and every agent chat later fails with
    "未配置API地址或密钥". That happened in production and stayed invisible
    because no readiness check looked at it. Read-only: never returns or logs
    plaintext, only agent ids that could not be decrypted.
    """
    if not (settings.AGENT_API_KEY_ENCRYPTION_KEY or "").strip():
        return {"status": _READINESS_UNHEALTHY, "reason": "encryption_key_not_configured"}

    try:
        from sqlalchemy import select as _select

        from app.models.agents.ai_agent import AIAgent
        from app.utils.agent_secrets import try_decrypt_api_key

        rows = (
            await db.execute(
                _select(AIAgent.id, AIAgent.api_key_encrypted).where(
                    AIAgent.api_key_encrypted.isnot(None)
                )
            )
        ).all()
    except Exception:
        return {"status": _READINESS_UNHEALTHY, "reason": "secret_contract_check_failed"}

    undecryptable = [int(row[0]) for row in rows if try_decrypt_api_key(row[1]) is None]
    if undecryptable:
        return {
            "status": _READINESS_UNHEALTHY,
            "reason": "agent_api_key_undecryptable",
            "agent_ids": undecryptable,
        }
    return {"status": _READINESS_HEALTHY, "reason": "ok", "checked": len(rows)}


def _readiness_payload(
    *,
    db_status: str,
    redis_status: str,
    view_contract: Dict[str, Any],
    agent_secrets: Dict[str, Any],
) -> Dict[str, Any]:
    view_contract_status = str(view_contract.get("status", _READINESS_UNHEALTHY))
    agent_secrets_status = str(agent_secrets.get("status", _READINESS_UNHEALTHY))

    if (
        db_status == _READINESS_HEALTHY
        and view_contract_status == _READINESS_HEALTHY
        and agent_secrets_status == _READINESS_HEALTHY
        and redis_status == _READINESS_HEALTHY
    ):
        overall_status = _READINESS_HEALTHY
    elif (
        db_status == _READINESS_HEALTHY
        and view_contract_status == _READINESS_HEALTHY
        and redis_status != _READINESS_HEALTHY
    ):
        overall_status = _READINESS_DEGRADED
    else:
        overall_status = _READINESS_UNHEALTHY

    system_info = {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now().isoformat(),
        "environment": settings.REACT_APP_ENV,
        "debug_mode": settings.DEBUG,
        "database": db_status,
        "redis": redis_status,
        "view_contract": view_contract_status,
    }

    return {
        "status": overall_status,
        "checks": {
            "database": db_status,
            "redis": redis_status,
            "view_contract": view_contract_status,
            "agent_secrets": agent_secrets_status,
        },
        "view_contract": view_contract,
        "agent_secrets": agent_secrets,
        "system": system_info,
    }


async def readiness_check(db: AsyncSession) -> Dict[str, Any]:
    """Run the single readiness contract shared by both health routes."""
    db_status = _READINESS_UNHEALTHY
    redis_status = _READINESS_UNHEALTHY
    view_contract: Dict[str, Any] = _unhealthy_view_contract("database_unavailable")
    agent_secrets: Dict[str, Any] = {"status": _READINESS_UNHEALTHY, "reason": "database_unavailable"}

    try:
        result = await db.execute(text("SELECT 1"))
        db_status = (
            _READINESS_HEALTHY
            if result.scalar() == 1
            else _READINESS_UNHEALTHY
        )
    except Exception:
        db_status = _READINESS_UNHEALTHY

    if db_status == _READINESS_HEALTHY:
        try:
            # 视图 DDL 只由 Alembic forward migration 负责；这里仅做只读合同检查。
            view_contract = await check_conversations_view_contract(db)
        except Exception:
            view_contract = _unhealthy_view_contract("view_contract_check_failed")

    if db_status == _READINESS_HEALTHY:
        try:
            # 加密密钥是环境相关的，而 dev/prod 共用同一 Postgres 数据目录；
            # 密钥不一致会让已存 API Key 静默解不开，必须显式暴露。
            agent_secrets = await check_agent_secret_contract(db)
        except Exception:
            agent_secrets = {"status": _READINESS_UNHEALTHY, "reason": "secret_contract_check_failed"}

    try:
        client = await cache.get_client()
        pong = await client.ping()
        if pong is True or pong == "PONG":
            redis_status = _READINESS_HEALTHY
    except Exception:
        redis_status = _READINESS_UNHEALTHY

    return _readiness_payload(
        db_status=db_status,
        redis_status=redis_status,
        view_contract=view_contract,
        agent_secrets=agent_secrets,
    )


async def health_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Return the shared readiness payload without choosing transport status."""
    return await readiness_check(db)


@router.get("/health")
async def health_endpoint(response: Response) -> Dict[str, Any]:
    """Readiness endpoint for the versioned API route.

    The route owns session acquisition so a database connection/session failure
    is represented by the same explicit 503 readiness payload as ``/health``
    instead of being converted into a generic 500 by FastAPI dependency
    resolution before the endpoint executes.
    """
    try:
        async with AsyncSessionLocal() as db:
            payload = await readiness_check(db)
    except Exception:
        payload = _readiness_payload(
            db_status=_READINESS_UNHEALTHY,
            redis_status=_READINESS_UNHEALTHY,
            view_contract=_unhealthy_view_contract(
                "database_session_unavailable"
            ),
            agent_secrets={
                "status": _READINESS_UNHEALTHY,
                "reason": "database_session_unavailable",
            },
        )

    response.status_code = readiness_http_status(payload["status"])
    return payload


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
