import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import require_user
from app.core.celery_app import celery_app
from app.core.config import settings
from app.utils.cache import cache
from app.api.endpoints.debug.constants import (
    ACTIVE_STATUSES,
    CACHE_KEY_SESSION_PREFIX,
    CACHE_KEY_USER_SESSIONS_PREFIX,
    DEFAULT_SESSION_TTL,
    DEFAULT_UNATTACHED_TTL,
    INACTIVE_STATUSES,
    SESSION_STATUS_FAILED,
    SESSION_STATUS_PENDING,
    SESSION_STATUS_TERMINATED,
    SESSION_STATUS_TERMINATING,
    WS_MAX_DAP_MSG_BYTES,
    WS_MAX_STDOUT_KB,
)
from app.api.endpoints.debug.utils import now_iso, sha256_text

router = APIRouter()


async def _cleanup_and_count_active_sessions(user_id: int) -> int:
    client = await cache.get_client()
    user_sessions_key = f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
    try:
        members = list(await client.smembers(user_sessions_key) or [])
    except Exception:
        members = []

    active = 0
    for sid in members:
        if not sid:
            continue
        meta = await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{sid}")
        if not meta:
            try:
                celery_app.send_task("app.tasks.pythonlab.stop_session", args=[sid])
            except Exception:
                pass
            try:
                await client.srem(user_sessions_key, sid)
            except Exception:
                pass
            continue
        st = str(meta.get("status") or "").upper()
        if st in INACTIVE_STATUSES:
            try:
                await client.srem(user_sessions_key, sid)
            except Exception:
                pass
            continue
        if st in ACTIVE_STATUSES:
            active += 1
        else:
            active += 1
    return active


class DebugLimits(BaseModel):
    cpu_ms: int = Field(default=30000, ge=1000, le=300000)
    wall_ms: int = Field(default=600000, ge=1000, le=3600000)
    memory_mb: int = Field(default=512, ge=128, le=4096)
    max_stdout_kb: int = Field(default=WS_MAX_STDOUT_KB, ge=16, le=4096)
    max_dap_msg_bytes: int = Field(default=WS_MAX_DAP_MSG_BYTES, ge=65536, le=4 * 1024 * 1024)


class DebugSessionCreateRequest(BaseModel):
    title: str = Field(default="pythonlab", max_length=120)
    code: str = Field(..., min_length=1)
    python_version: str = Field(default="3.11", max_length=16)
    requirements: List[str] = Field(default_factory=list)
    entry_path: str = Field(default="main.py", max_length=64)
    limits: DebugLimits = Field(default_factory=DebugLimits)


class DebugSessionCreateResponse(BaseModel):
    session_id: str
    status: str
    ws_url: str
    cfg_url: str


class DebugSessionResponse(BaseModel):
    session_id: str
    owner_user_id: int
    status: str
    created_at: str
    last_heartbeat_at: str
    ttl_seconds: int
    limits: Dict[str, Any]
    entry_path: str
    code_sha256: str
    dap_host: Optional[str] = None
    dap_port: Optional[int] = None
    docker_container_id: Optional[str] = None
    error_code: Optional[str] = None
    error_detail: Optional[str] = None


@router.post("/sessions", response_model=DebugSessionCreateResponse)
async def create_session(payload: DebugSessionCreateRequest, current_user: Dict[str, Any] = Depends(require_user)):
    if payload.entry_path != "main.py":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="entry_path 目前仅支持 main.py")
    if payload.requirements:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="V2 默认不支持 requirements 安装，请先使用内置镜像能力")

    user_id = int(current_user.get("id") or 0)
    if user_id <= 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未认证用户")

    max_sessions = int(getattr(settings, "PYTHONLAB_MAX_SESSIONS_PER_USER", 2) or 2)
    active = await _cleanup_and_count_active_sessions(user_id)
    if active >= max_sessions:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error_code": "QUOTA_EXCEEDED", "message": "并发调试会话数已达上限"},
        )

    session_id = f"dbg_{uuid.uuid4().hex}"
    ttl_seconds = int(getattr(settings, "PYTHONLAB_UNATTACHED_TTL_SECONDS", DEFAULT_UNATTACHED_TTL) or DEFAULT_UNATTACHED_TTL)
    created_at = now_iso()
    code_sha256 = sha256_text(payload.code)

    meta: Dict[str, Any] = {
        "session_id": session_id,
        "owner_user_id": user_id,
        "status": SESSION_STATUS_PENDING,
        "created_at": created_at,
        "last_heartbeat_at": created_at,
        "ttl_seconds": ttl_seconds,
        "limits": payload.limits.model_dump(),
        "entry_path": "main.py",
        "python_version": payload.python_version,
        "requirements": [],
        "code_sha256": code_sha256,
        "docker_container_id": None,
        "dap_host": None,
        "dap_port": None,
        "error_code": None,
        "error_detail": None,
    }

    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    ok = await cache.set(session_key, meta, expire_seconds=ttl_seconds)
    if not ok:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Redis 写入失败")

    try:
        client = await cache.get_client()
        user_sessions_key = f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
        await client.sadd(user_sessions_key, session_id)
        await client.expire(user_sessions_key, max(3600, ttl_seconds))
    except Exception:
        pass

    code_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}:code"
    await cache.set(code_key, payload.code, expire_seconds=ttl_seconds)

    try:
        celery_app.send_task("app.tasks.pythonlab.start_session", args=[session_id])
    except Exception:
        pass

    return DebugSessionCreateResponse(
        session_id=session_id,
        status=SESSION_STATUS_PENDING,
        ws_url=f"/api/v1/debug/sessions/{session_id}/ws",
        cfg_url=f"/api/v1/debug/sessions/{session_id}/cfg",
    )


@router.get("/sessions/{session_id}", response_model=DebugSessionResponse)
async def get_session(session_id: str, current_user: Dict[str, Any] = Depends(require_user)):
    user_id = int(current_user.get("id") or 0)
    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    meta = await cache.get(session_key)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在或已过期")
    if int(meta.get("owner_user_id") or 0) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问该会话")
    return DebugSessionResponse(**meta)


@router.post("/sessions/{session_id}/stop")
async def stop_session(session_id: str, current_user: Dict[str, Any] = Depends(require_user)):
    user_id = int(current_user.get("id") or 0)
    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    meta = await cache.get(session_key)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在或已过期")
    if int(meta.get("owner_user_id") or 0) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问该会话")

    try:
        celery_app.send_task("app.tasks.pythonlab.stop_session", args=[session_id])
    except Exception:
        pass

    meta["status"] = SESSION_STATUS_TERMINATED
    meta["last_heartbeat_at"] = now_iso()
    await cache.set(session_key, meta, expire_seconds=60)
    return {"ok": True}


@router.get("/sessions")
async def list_sessions(current_user: Dict[str, Any] = Depends(require_user)):
    user_id = int(current_user.get("id") or 0)
    if user_id <= 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未认证用户")

    client = await cache.get_client()
    user_sessions_key = f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
    try:
        members = list(await client.smembers(user_sessions_key) or [])
    except Exception:
        members = []

    items: List[Dict[str, Any]] = []
    for sid in members:
        meta = await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{sid}")
        if not meta:
            try:
                await client.srem(user_sessions_key, sid)
            except Exception:
                pass
            continue
        if int(meta.get("owner_user_id") or 0) != user_id:
            continue
        st = str(meta.get("status") or "").upper()
        if st in INACTIVE_STATUSES:
            try:
                await client.srem(user_sessions_key, sid)
            except Exception:
                pass
            continue
        items.append(meta)

    items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return {"items": items, "total": len(items)}


@router.post("/sessions/cleanup")
async def cleanup_sessions(current_user: Dict[str, Any] = Depends(require_user)):
    user_id = int(current_user.get("id") or 0)
    if user_id <= 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未认证用户")

    client = await cache.get_client()
    user_sessions_key = f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
    try:
        members = list(await client.smembers(user_sessions_key) or [])
    except Exception:
        members = []

    stopped: List[str] = []
    for sid in members:
        meta = await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{sid}")
        if not meta:
            try:
                await client.srem(user_sessions_key, sid)
            except Exception:
                pass
            continue
        if int(meta.get("owner_user_id") or 0) != user_id:
            continue
        st = str(meta.get("status") or "").upper()
        if st in INACTIVE_STATUSES:
            try:
                await client.srem(user_sessions_key, sid)
            except Exception:
                pass
            continue
        try:
            celery_app.send_task("app.tasks.pythonlab.stop_session", args=[sid])
        except Exception:
            pass
        meta["status"] = SESSION_STATUS_TERMINATING
        meta["last_heartbeat_at"] = now_iso()
        await cache.set(f"{CACHE_KEY_SESSION_PREFIX}:{sid}", meta, expire_seconds=int(meta.get("ttl_seconds") or DEFAULT_SESSION_TTL))
        try:
            await client.srem(user_sessions_key, sid)
        except Exception:
            pass
        stopped.append(str(sid))

    return {"ok": True, "stopped": stopped, "stopped_count": len(stopped)}
