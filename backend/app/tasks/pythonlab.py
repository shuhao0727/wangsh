import json
from typing import Any, Dict, Optional
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.config import settings
from app.utils.cache import cache
from app.core.sandbox import get_sandbox_provider
from app.api.endpoints.debug.constants import (
    CACHE_KEY_SESSION_PREFIX,
    CACHE_KEY_USER_SESSIONS_PREFIX,
    DEFAULT_SESSION_TTL,
    DEFAULT_UNATTACHED_TTL,
    SESSION_STATUS_FAILED,
    SESSION_STATUS_PENDING,
    SESSION_STATUS_READY,
    SESSION_STATUS_STARTING,
    SESSION_STATUS_TERMINATING,
    SESSION_STATUS_TERMINATED,
    SESSION_STATUS_ATTACHED,
    SESSION_STATUS_RUNNING,
    SESSION_STATUS_STOPPED,
)


async def _get_session_meta(session_id: str) -> Optional[Dict[str, Any]]:
    return await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}")


async def _set_session_meta(session_id: str, meta: Dict[str, Any]) -> None:
    ttl = int(meta.get("ttl_seconds") or getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL) or DEFAULT_SESSION_TTL)
    await cache.set(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}", meta, expire_seconds=ttl)


@celery_app.task(name="app.tasks.pythonlab.start_session")
def start_session(session_id: str):
    import asyncio

    async def run():
        meta = await _get_session_meta(session_id)
        if not meta:
            return
        if meta.get("status") not in {SESSION_STATUS_PENDING, SESSION_STATUS_FAILED}:
            return

        meta["status"] = SESSION_STATUS_STARTING
        await _set_session_meta(session_id, meta)

        code = await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}:code")
        if not isinstance(code, str) or not code.strip():
            meta["status"] = SESSION_STATUS_FAILED
            meta["error_code"] = "CODE_MISSING"
            meta["error_detail"] = "会话代码不存在或为空"
            await _set_session_meta(session_id, meta)
            return

        provider = get_sandbox_provider()
        try:
            # Phase 3 Architecture: Use SandboxProvider to abstract runtime details
            result = await provider.start_session(session_id, code, meta)
            meta.update(result)
            meta["status"] = SESSION_STATUS_READY
            meta["error_code"] = None
            meta["error_detail"] = None
        except Exception as e:
            meta["status"] = SESSION_STATUS_FAILED
            meta["error_code"] = "SANDBOX_START_FAILED"
            meta["error_detail"] = str(e)
            
        await _set_session_meta(session_id, meta)

    asyncio.run(run())


@celery_app.task(name="app.tasks.pythonlab.cleanup_orphans")
def cleanup_orphans():
    import asyncio

    async def run():
        provider = get_sandbox_provider()
        try:
            active_ids = await provider.list_active_sessions()
        except Exception:
            return

        client = await cache.get_client()

        for sid in active_ids:
            if not sid:
                continue
            
            # New Strategy: sid is u{user_id}
            if sid.startswith("u"):
                try:
                    user_id = int(sid[1:])
                    # Check if user has any active sessions
                    user_sessions_key = f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
                    count = await client.scard(user_sessions_key)
                    if count > 0:
                        continue # Keep container alive
                    
                    # No sessions, terminate container
                    # We need to construct a fake meta to terminate
                    fake_meta = {"owner_user_id": user_id}
                    await provider.terminate_session("orphan", fake_meta)
                except Exception:
                    pass
                continue

            # Legacy Strategy: sid is session_id
            meta = await _get_session_meta(sid)
            if meta:
                continue

            # Orphaned session (no meta found), request provider to stop it
            try:
                await provider.terminate_session(sid, {})
            except Exception:
                pass

    asyncio.run(run())


@celery_app.task(name="app.tasks.pythonlab.cleanup_stale_sessions")
def cleanup_stale_sessions():
    import asyncio

    async def run():
        client = await cache.get_client()
        now = datetime.now(timezone.utc)
        unattached_ttl = int(getattr(settings, "PYTHONLAB_UNATTACHED_TTL_SECONDS", DEFAULT_UNATTACHED_TTL) or DEFAULT_UNATTACHED_TTL)
        heartbeat_timeout = int(getattr(settings, "PYTHONLAB_HEARTBEAT_TIMEOUT_SECONDS", 60) or 60)
        idle_timeout = int(getattr(settings, "PYTHONLAB_IDLE_TIMEOUT_SECONDS", DEFAULT_SESSION_TTL) or DEFAULT_SESSION_TTL)

        cursor: int = 0
        while True:
            cursor, keys = await client.scan(cursor=cursor, match=f"{CACHE_KEY_SESSION_PREFIX}:dbg_*", count=200)
            for k in keys or []:
                meta = await cache.get(str(k))
                if not isinstance(meta, dict):
                    continue
                st = str(meta.get("status") or "").upper()
                if st in {SESSION_STATUS_TERMINATED, SESSION_STATUS_FAILED, SESSION_STATUS_TERMINATING}:
                    continue
                sid = str(meta.get("session_id") or "")
                if not sid:
                    continue
                last = str(meta.get("last_heartbeat_at") or meta.get("created_at") or "")
                try:
                    last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    continue
                age = (now - last_dt).total_seconds()
                should_stop = False
                
                if st in {SESSION_STATUS_PENDING, SESSION_STATUS_READY}:
                    if age > unattached_ttl:
                        should_stop = True
                else:
                    if st == SESSION_STATUS_RUNNING:
                         # Running sessions generally shouldn't timeout unless very long?
                         # Let's say heartbeat timeout applies
                         if age > heartbeat_timeout:
                             should_stop = True
                    elif st in {SESSION_STATUS_ATTACHED, SESSION_STATUS_STOPPED}:
                        if age > idle_timeout:
                            should_stop = True
                    else:
                        if age > heartbeat_timeout:
                            should_stop = True

                if should_stop:
                    try:
                        # Force terminate for stale sessions
                        celery_app.send_task("app.tasks.pythonlab.stop_session", args=[sid, True])
                    except Exception:
                        pass
                    meta["status"] = SESSION_STATUS_TERMINATING
                    await cache.set(str(k), meta, expire_seconds=int(meta.get("ttl_seconds") or 300))

            if cursor == 0:
                break

    asyncio.run(run())


@celery_app.task(name="app.tasks.pythonlab.stop_session")
def stop_session(session_id: str, force: bool = False):
    import asyncio

    async def run():
        meta = await _get_session_meta(session_id)
        provider = get_sandbox_provider()

        # Stop Sandbox Resource
        try:
            if force:
                await provider.terminate_session(session_id, meta or {})
            else:
                await provider.stop_session(session_id, meta or {})
        except Exception:
            pass

        if meta:
            owner = int(meta.get("owner_user_id") or 0)
            try:
                client = await cache.get_client()
                if owner > 0:
                    # Only remove from active set if forced termination?
                    # No, if we stop the session, it's effectively gone from UI.
                    # But we want to keep container alive.
                    # The set tracks "Sessions the user sees in UI".
                    # If we remove it, UI won't show it.
                    # So yes, remove it.
                    await client.srem(f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{owner}:sessions", session_id)
            except Exception:
                pass

            meta["status"] = SESSION_STATUS_TERMINATED
            await _set_session_meta(session_id, meta)
            
    asyncio.run(run())
