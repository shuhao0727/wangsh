import json
import asyncio
import threading
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional
from datetime import datetime, timezone

import httpx
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError

from app.core.celery_app import celery_app
from app.core.config import settings
from app.utils.cache import cache
from app.core.sandbox import get_sandbox_provider
from app.api.pythonlab.constants import (
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

# ---------------------------------------------------------------------------
# Shared event loop for Celery tasks — avoids creating/destroying a loop per
# task invocation which is expensive (Redis reconnects, etc.)
# ---------------------------------------------------------------------------
_loop_lock = threading.Lock()
_shared_loop: Optional[asyncio.AbstractEventLoop] = None
from loguru import logger


def _get_loop() -> asyncio.AbstractEventLoop:
    global _shared_loop
    if _shared_loop is not None and not _shared_loop.is_closed():
        return _shared_loop
    with _loop_lock:
        if _shared_loop is not None and not _shared_loop.is_closed():
            return _shared_loop
        _shared_loop = asyncio.new_event_loop()
        return _shared_loop


def _run_async(coro):
    """Run an async coroutine on the shared event loop (thread-safe)."""
    loop = _get_loop()
    return loop.run_until_complete(coro)


async def _get_session_meta(session_id: str) -> Optional[Dict[str, Any]]:
    return await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}")


async def _set_session_meta(session_id: str, meta: Dict[str, Any]) -> None:
    ttl = int(meta.get("ttl_seconds") or getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL) or DEFAULT_SESSION_TTL)
    await cache.set(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}", meta, expire_seconds=ttl)


async def _owner_has_other_active_session(owner_user_id: int, excluding_session_id: str) -> bool:
    if owner_user_id <= 0:
        return False
    try:
        client = await cache.get_client()
        user_sessions_key = f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{owner_user_id}:sessions"
        raw_ids = await client.smembers(user_sessions_key)  # type: ignore[misc]
    except Exception:
        # stop_session already treats an ownership-query failure conservatively.
        # Do not turn an unavailable membership index into permission to delete.
        logger.exception("_owner_has_other_active_session 获取用户活跃会话失败")
        raise

    for raw in raw_ids or []:
        sid = raw.decode("utf-8", errors="ignore") if isinstance(raw, (bytes, bytearray)) else str(raw)
        sid = sid.strip()
        if not sid or sid == excluding_session_id:
            continue
        # Bypass cache.get's error-to-miss downgrade for destructive decisions.
        meta = await _get_start_meta(sid)
        if not isinstance(meta, dict):
            return True
        st = str(meta.get("status") or "").upper()
        # Missing/unknown/terminating metadata cannot prove the resource is idle.
        if st not in {SESSION_STATUS_TERMINATED, SESSION_STATUS_FAILED}:
            return True
    return False


async def _get_start_value(key: str):
    # The general cache facade deliberately swallows transport errors. Startup
    # must distinguish a missing value from an unavailable store for retries.
    client = await cache.get_client()
    value = await client.get(key)
    if value is None:
        return None
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return value


async def _get_start_meta(session_id: str) -> Optional[Dict[str, Any]]:
    return await _get_start_value(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}")


async def _set_start_meta(session_id: str, meta: Dict[str, Any]) -> None:
    ttl = int(meta.get("ttl_seconds") or getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL) or DEFAULT_SESSION_TTL)
    client = await cache.get_client()
    if not await client.set(
        f"{CACHE_KEY_SESSION_PREFIX}:{session_id}",
        json.dumps(meta, ensure_ascii=False), ex=ttl,
    ):
        raise RuntimeError("Session metadata write was not acknowledged")


# Only transport/timeouts are transient; invalid resources, permissions and
# arbitrary RuntimeError must not cause repeated sandbox creation.
_START_RETRY_ERRORS = (
    ConnectionError, TimeoutError, httpx.NetworkError, httpx.TimeoutException,
    RedisConnectionError, RedisTimeoutError,
)


async def _cas_start_meta(session_id: str, expected: str, meta: Dict[str, Any]) -> bool:
    """Compare the exact Redis bytes, not a decoded/re-encoded approximation.

    Stop/new-task writes before this script are never overwritten. JSON merging
    stays in Python to preserve integers, empty objects and unknown fields.
    """
    ttl = int(meta.get("ttl_seconds") or getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL) or DEFAULT_SESSION_TTL)
    client = await cache.get_client()
    return bool(await client.eval(
        """if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
        redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
        return 1""",
        1, f"{CACHE_KEY_SESSION_PREFIX}:{session_id}", expected,
        json.dumps(meta, ensure_ascii=False), ttl,
    ))


async def _read_start_snapshot(session_id: str):
    client = await cache.get_client()
    raw = await client.get(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}")
    if raw is None:
        return None, None
    meta = json.loads(raw)
    if not isinstance(meta, dict):
        raise RuntimeError("Invalid session metadata")
    return raw, meta


async def _save_start_outcome(
    session_id: str, task_id: str, updates: Dict[str, Any], *, allow_pending: bool = False,
) -> bool:
    raw, current = await _read_start_snapshot(session_id)
    if not current:
        return False
    owned_start = (
        current.get("status") == SESSION_STATUS_STARTING
        and current.get("startup_task_id") == task_id
    )
    uncommitted_start = (
        allow_pending and current.get("status") == SESSION_STATUS_PENDING
        and current.get("startup_task_id") in (None, task_id)
    )
    if not (owned_start or uncommitted_start):
        return False
    current.update(updates)
    return await _cas_start_meta(session_id, raw, current)


async def _recover_start_publication(session_id, task_id, meta, result, provider, error):
    """Resolve a lost READY acknowledgement before touching the owned resource.

    A confirmed committed generation is retained. Otherwise fence the startup
    out with FAILED before compensating its exact provider generation. If Redis
    is unavailable or repeatedly changing, leave the journal for recovery rather
    than delete a potentially published resource. Never blindly retry creation
    after an uncertain compensation.
    """
    for _ in range(3):
        raw, current = await _read_start_snapshot(session_id)
        if current and (
            current.get("startup_task_id") == task_id
            and current.get("sandbox_owner_token") == result.get("sandbox_owner_token")
            and current.get("docker_container_id") == result.get("docker_container_id")
            and current.get("status") in {
                SESSION_STATUS_READY, SESSION_STATUS_ATTACHED,
                SESSION_STATUS_RUNNING, SESSION_STATUS_STOPPED,
            }
        ):
            return True
        if current and current.get("startup_task_id") == task_id and current.get("status") in {
            SESSION_STATUS_STARTING, SESSION_STATUS_PENDING,
        }:
            failed = {**current, **result, "status": SESSION_STATUS_FAILED,
                      "error_code": "SANDBOX_PUBLICATION_FAILED", "error_detail": str(error)}
            if not await _cas_start_meta(session_id, raw, failed):
                continue
        if result.get("sandbox_owner_token"):
            await provider.terminate_session(session_id, {**meta, **result})
        return False
    raise RuntimeError("Sandbox publication remains uncertain; ownership journal retained") from error


def _start_allowed(meta: Dict[str, Any], task_id: str, retries: int, redelivered: bool = False) -> bool:
    same_task = meta.get("startup_task_id") == task_id
    if meta.get("startup_task_id") and not same_task:
        return False
    return meta.get("status") == SESSION_STATUS_PENDING or (
        meta.get("status") == SESSION_STATUS_STARTING and same_task and (retries > 0 or redelivered)
    )



@asynccontextmanager
async def _startup_execution_fence(provider, meta):
    # Separate from the provider's resource fence: hold through READY publication.
    # All Docker startup writers must share this root and flock-capable inodes.
    from app.core.sandbox.docker import DockerProvider, _workspace_root
    from app.core.sandbox.docker_runtime import WorkspaceOwnership

    if isinstance(provider, DockerProvider):
        workspace = provider._ws_path_for_session(meta)
        async with WorkspaceOwnership(
            _workspace_root(), workspace / ".startup-execution-v1", timeout=120,
        ):
            yield
    else:
        yield


def _validate_start_recovery_owner(record, session_id, task_id, meta, name):
    """Redis IDs/headers/student files cannot replace the trusted live journal."""
    if not (
        record and record.get("phase") == "live"
        and record.get("session_id") == session_id
        and record.get("startup_task_id") == task_id
        and record.get("container_name") == name
        and record.get("token") and record.get("container_id")
    ):
        raise RuntimeError("Startup recovery lacks trusted same-generation live ownership")
    for field, journal_field in (
        ("sandbox_owner_token", "token"), ("docker_container_id", "container_id"),
    ):
        if meta.get(field) and meta[field] != record[journal_field]:
            raise RuntimeError("Startup recovery generation changed; refusing takeover")


def _recovery_expected_config(provider, workspace, current, limits, runtime, memory):
    """Build the expected host configuration for the interrupted container."""
    return {
        "mode": str(current.get("runtime_mode") or "debug").lower(),
        "image": provider.image,
        "mount": str(provider._resolve_host_mount_path(workspace)),
        "host": {"Memory": memory * 1024**2, "MemorySwap": memory * 1024**2,
                 "CpuPeriod": 100000, "CpuQuota": int(limits.get("cpu_quota") or settings.PYTHONLAB_DEFAULT_CPU_QUOTA),
                 "PidsLimit": settings.PYTHONLAB_CONTAINER_PIDS_LIMIT, "Runtime": runtime},
    }


def _validated_recovery_target(provider, current, task_id, workspace):
    """Verify the STARTING snapshot still names this task and workspace."""
    if not current or current.get("status") != SESSION_STATUS_STARTING or current.get("startup_task_id") != task_id:
        return None
    if provider._ws_path_for_session(current) != workspace:
        raise RuntimeError("Startup recovery workspace changed")
    return current


async def _recover_interrupted_start(provider, session_id, task_id, code, meta):
    """Recover only the existing running generation; never create/retire by name."""
    from app.core.sandbox import docker as docker_provider
    from app.core.sandbox.docker_runtime import WorkspaceOwnership, RedisDistributedLock

    if meta.get("startup_recovery_protocol") != 1:
        raise RuntimeError("Legacy STARTING requires manual reconciliation; journal retained")
    if not isinstance(provider, docker_provider.DockerProvider):
        raise RuntimeError("Startup recovery unsupported for this provider")
    name = provider._container_name(meta)
    workspace = provider._ws_path_for_session(meta)
    async with WorkspaceOwnership(
        docker_provider._workspace_root(), workspace, timeout=120,
    ) as ownership, RedisDistributedLock(name, timeout=120):
        # Lock acquisition can wait for a dead worker's genuine Redis lease.
        _, snapshot = await _read_start_snapshot(session_id)
        current = _validated_recovery_target(provider, snapshot, task_id, workspace)
        if current is None:
            return None
        record = ownership.read()
        _validate_start_recovery_owner(record, session_id, task_id, current, name)
        existing = await docker_provider.inspect_container(docker_provider._run_async, record["container_id"])
        if not existing or existing.get("State", {}).get("Status") != "running" or existing.get("Name", "").lstrip("/") != name:
            raise RuntimeError("Startup recovery container absent/replaced/not running; journal retained")
        mode = str(current.get("runtime_mode") or "debug").lower()
        if mode not in {"plain", "debug"}:
            raise ValueError("Unsupported sandbox runtime mode")
        limits = current.get("limits") or {}
        memory = docker_provider._resolve_memory_mb_limit(limits, int(settings.PYTHONLAB_DEFAULT_MEMORY_MB))
        runtime = provider.runtime or "runc"
        if runtime != "runc" and runtime not in await provider._get_available_runtimes():
            runtime = "runc"
        expected = _recovery_expected_config(provider, workspace, current, limits, runtime, memory)
        result = await provider._reuse_running_container(
            session_id, code, current, existing=existing, expected=expected,
            ws_path=workspace, ownership=ownership, record=record,
        )
        await provider._wait_for_readiness(
            record["container_id"], int(result.get("dap_port") or 0), mode,
        )
        return result

def _start_failure_updates(exc, task_id: str, retries: int, max_retries: int) -> Dict[str, Any]:
    """Build failure metadata without IO or changing the task retry decision."""
    retrying = isinstance(exc, _START_RETRY_ERRORS) and retries < max_retries
    return {
        "status": SESSION_STATUS_PENDING if retrying else SESSION_STATUS_FAILED,
        "error_code": "SANDBOX_START_RETRYING" if retrying else "SANDBOX_START_FAILED",
        "error_detail": str(exc),
        "startup_task_id": task_id,
    }


async def _persist_start_failure(session_id, task_id, exc, retries, max_retries, recovering):
    """Persist a startup failure without turning provider errors into retryable cache errors."""
    updates = _start_failure_updates(exc, task_id, retries, max_retries)
    if recovering and updates["status"] == SESSION_STATUS_PENDING:
        # A retry must revalidate the journal, never enter the create path.
        updates.update(status=SESSION_STATUS_STARTING, error_code="SANDBOX_RECOVERY_RETRYING")
    try:
        return await _save_start_outcome(session_id, task_id, updates, allow_pending=True)
    except Exception:
        # A failed status write must not turn a permanent provider error
        # into a retryable cache error. The original failure owns policy.
        logger.exception("Could not persist PythonLab startup failure")
        raise exc


async def _publish_ready_outcome(session_id, task_id, meta, result, provider):
    """Publish READY via a single CAS; reconcile rejection/compensation after."""
    try:
        published = await _save_start_outcome(session_id, task_id, {
            **result, "status": SESSION_STATUS_READY,
            "error_code": None, "error_detail": None,
        })
    except Exception as publication_error:
        try:
            committed = await _recover_start_publication(
                session_id, task_id, meta, result, provider, publication_error,
            )
        except Exception as recovery_error:
            # Do not autoretry a resource whose publication/deletion may
            # have committed. Its trusted journal remains the recovery key.
            raise RuntimeError("Sandbox publication recovery failed: " + str(recovery_error)) from recovery_error
        if not committed:
            raise RuntimeError("Sandbox READY publication failed; generation compensation completed") from publication_error
        return
    if not published:
        # A concurrent writer may have published this same generation.
        # Reconcile a rejected CAS too; never delete an acknowledged READY.
        await _recover_start_publication(
            session_id, task_id, meta, result, provider,
            RuntimeError("Sandbox READY compare-and-set rejected"),
        )


@celery_app.task(
    name="app.tasks.pythonlab.start_session",
    bind=True,
    autoretry_for=_START_RETRY_ERRORS,
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=30,
    acks_late=True,
    reject_on_worker_lost=True,
)
def start_session(self, session_id: str):
    async def execute(provider, initial):
        task_id = str(self.request.id or "direct")
        publication_rejected = False
        recovering = False
        try:
            raw, meta = await _read_start_snapshot(session_id)
            redelivered = bool((getattr(self.request, "delivery_info", {}) or {}).get("redelivered"))
            if not meta or not _start_allowed(meta, task_id, self.request.retries, redelivered):
                return
            if (meta.get("owner_user_id"), meta.get("session_id")) != (initial.get("owner_user_id"), initial.get("session_id")):
                raise RuntimeError("Startup identity changed while awaiting execution fence")
            recovering = meta.get("status") == SESSION_STATUS_STARTING
            if not recovering:
                meta["startup_recovery_protocol"] = 1
            meta.update(status=SESSION_STATUS_STARTING, startup_task_id=task_id)
            if not await _cas_start_meta(session_id, raw, meta):
                return
            code = await _get_start_value(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}:code")
            if not isinstance(code, str) or not code.strip():
                await _save_start_outcome(session_id, task_id, {
                    "status": SESSION_STATUS_FAILED,
                    "error_code": "CODE_MISSING",
                    "error_detail": "会话代码不存在或为空",
                })
                return

            if recovering:
                result = await _recover_interrupted_start(provider, session_id, task_id, code, meta)
                if result is None:
                    return
            else:
                result = await provider.start_session(session_id, code, meta)
            # 发布阶段的异常不得被失败状态持久化覆盖：
            # 补偿结果（已提交保留 / FAILED 栅栏）由 _recover_start_publication 负责。
            publication_rejected = True
            await _publish_ready_outcome(session_id, task_id, meta, result, provider)
            publication_rejected = False
        except Exception as exc:
            if publication_rejected:
                # Cleanup uncertainty must not disappear behind Celery SUCCESS.
                raise
            saved = await _persist_start_failure(
                session_id, task_id, exc, self.request.retries, self.max_retries, recovering,
            )
            # A stop or another task took ownership while the provider awaited.
            # Never resurrect that session or schedule another create attempt.
            if not saved:
                return
            raise

    async def run():
        _, initial = await _read_start_snapshot(session_id)
        task_id = str(self.request.id or "direct")
        redelivered = bool((getattr(self.request, "delivery_info", {}) or {}).get("redelivered"))
        if not initial or not _start_allowed(initial, task_id, self.request.retries, redelivered):
            return
        provider = get_sandbox_provider()
        # A busy fence retries without rewriting the active writer's metadata.
        async with _startup_execution_fence(provider, initial):
            await execute(provider, initial)

    _run_async(run())


@celery_app.task(name="app.tasks.pythonlab.cleanup_orphans")
def cleanup_orphans():
    async def run():
        provider = get_sandbox_provider()
        try:
            active_ids = await provider.list_active_sessions()
        except Exception:
            logger.exception("cleanup_orphans 获取活跃会话列表失败")
            return

        client = await cache.get_client()

        for sid in active_ids:
            if not sid:
                continue
            
            # New Strategy: sid is u{user_id}
            if sid.startswith("u"):
                try:
                    user_id = int(sid[1:])
                    # Deliberately conservative: the scheduler may detect a user
                    # container, but it is NOT deletion authority. Real recovery
                    # happens through stop_session with the true session identity
                    # (cleanup_stale_sessions). Keeping the owner-scoped probe
                    # means a container without proven ownership is retained.
                    user_sessions_key = f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
                    count = await client.scard(user_sessions_key)  # type: ignore[misc]
                    if count > 0:
                        continue # Keep container alive
                    
                    # No sessions, terminate container
                    # We need to construct a fake meta to terminate
                    fake_meta = {"owner_user_id": user_id}
                    await provider.terminate_session("orphan", fake_meta)
                except Exception:
                    logger.exception("cleanup_orphans 终止用户级孤儿容器失败")
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
                logger.exception("cleanup_orphans 终止旧版孤儿会话失败")

    _run_async(run())


def _cleanup_ttl_settings():
    """Return (unattached_ttl, heartbeat_timeout, idle_timeout) in seconds."""
    unattached_ttl = int(getattr(settings, "PYTHONLAB_UNATTACHED_TTL_SECONDS", DEFAULT_UNATTACHED_TTL) or DEFAULT_UNATTACHED_TTL)
    heartbeat_timeout = int(getattr(settings, "PYTHONLAB_HEARTBEAT_TIMEOUT_SECONDS", 60) or 60)
    idle_timeout = int(getattr(settings, "PYTHONLAB_IDLE_TIMEOUT_SECONDS", DEFAULT_SESSION_TTL) or DEFAULT_SESSION_TTL)
    return unattached_ttl, heartbeat_timeout, idle_timeout


def _cleanup_age_seconds(meta, now):
    """Age since last heartbeat/creation; None when the timestamp is unusable."""
    last = str(meta.get("last_heartbeat_at") or meta.get("created_at") or "")
    try:
        last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None
    return (now - last_dt).total_seconds()


def _cleanup_should_stop(status, age, unattached_ttl, heartbeat_timeout, idle_timeout):
    """Decide whether a session has outlived its lease for its current status."""
    if status in {SESSION_STATUS_PENDING, SESSION_STATUS_READY}:
        return age > unattached_ttl
    if status == SESSION_STATUS_RUNNING:
        return age > heartbeat_timeout
    if status == SESSION_STATUS_STOPPED:
        # A stopped session is no longer attached, so it must not pin the shared
        # owner container for the whole idle window: that is exactly what made a
        # same-owner follow-up debug fail with "运行环境模式不兼容，请先停止旧会话"
        # for up to an hour.
        return age > unattached_ttl
    if status == SESSION_STATUS_ATTACHED:
        return age > idle_timeout
    return age > heartbeat_timeout


async def _cleanup_terminate(client, k, meta, sid):
    """Mark terminating and dispatch a forced stop for one stale session."""
    try:
        # Force terminate for stale sessions
        celery_app.send_task("app.tasks.pythonlab.stop_session", args=[sid, True])
    except Exception:
        logger.exception("cleanup_stale_sessions 发送 stop_session 任务失败")
    meta["status"] = SESSION_STATUS_TERMINATING
    await cache.set(str(k), meta, expire_seconds=int(meta.get("ttl_seconds") or 300))


@celery_app.task(name="app.tasks.pythonlab.cleanup_stale_sessions")
def cleanup_stale_sessions():
    async def run():
        client = await cache.get_client()
        now = datetime.now(timezone.utc)
        unattached_ttl, heartbeat_timeout, idle_timeout = _cleanup_ttl_settings()

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
                age = _cleanup_age_seconds(meta, now)
                if age is None:
                    continue
                if _cleanup_should_stop(st, age, unattached_ttl, heartbeat_timeout, idle_timeout):
                    await _cleanup_terminate(client, k, meta, sid)

            if cursor == 0:
                break

    _run_async(run())


@celery_app.task(name="app.tasks.pythonlab.stop_session")
def stop_session(session_id: str, force: bool = False):
    async def run():
        meta = await _get_session_meta(session_id)
        provider = get_sandbox_provider()
        provider_meta = meta if isinstance(meta, dict) else {"session_id": session_id}
        owner = int(provider_meta.get("owner_user_id") or 0)
        runtime_mode = str(provider_meta.get("runtime_mode") or "debug").lower()
        skip_provider_stop = False
        has_other_active = False

        # User-scoped container reuse means stopping an old session can kill
        # debugpy for a newer active session of the same owner.
        if owner > 0:
            try:
                has_other_active = await _owner_has_other_active_session(owner, session_id)
                # IMPORTANT:
                # Even for force=True (e.g. stale cleanup), do not kill the shared
                # owner container when another active session exists for that owner.
                # Otherwise a stale session cleanup can terminate the currently
                # running/paused debugging session of the same user.
                if has_other_active:
                    skip_provider_stop = True
            except Exception:
                # 保守处理：查询其它活跃会话时抛异常，无法确认该 owner 是否还有
                # 其它活跃会话。此时宁可保留共享容器，也绝不误杀可能正在运行的
                # 同 owner 调试会话（debugpy 共用同一容器）。
                skip_provider_stop = True

        logger.info(
            "pythonlab.stop_session decision session_id={} force={} owner={} has_other_active={} skip_provider_stop={}",
            session_id,
            force,
            owner,
            has_other_active,
            skip_provider_stop,
        )

        # Stop Sandbox Resource
        try:
            if not skip_provider_stop:
                if force or runtime_mode == "debug":
                    await provider.terminate_session(session_id, provider_meta)
                else:
                    await provider.stop_session(session_id, provider_meta)
        except Exception:
            logger.exception("stop_session 停止/终止沙箱资源失败")

        if meta:
            try:
                client = await cache.get_client()
                if owner > 0:
                    # Only remove from active set if forced termination?
                    # No, if we stop the session, it's effectively gone from UI.
                    # But we want to keep container alive.
                    # The set tracks "Sessions the user sees in UI".
                    # If we remove it, UI won't show it.
                    # So yes, remove it.
                    await client.srem(f"{CACHE_KEY_USER_SESSIONS_PREFIX}:{owner}:sessions", session_id)  # type: ignore[misc]
            except Exception:
                pass

            meta["status"] = SESSION_STATUS_TERMINATED
            await _set_session_meta(session_id, meta)
            
    _run_async(run())
