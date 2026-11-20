"""Atomic PythonLab session state shared by the HTTP API and worker."""
import json
from uuid import uuid4

from loguru import logger

from app.api.pythonlab.constants import (
    CACHE_KEY_SESSION_PREFIX,
    SESSION_STATUS_TERMINATED,
    SESSION_STATUS_TERMINATING,
)

STOP_FAILED = "SANDBOX_STOP_FAILED"


async def read_session_snapshot(client, key):
    raw = await client.get(key)
    if raw is None:
        return None, None
    meta = json.loads(raw)
    if not isinstance(meta, dict):
        raise RuntimeError("Invalid session metadata")
    return raw, meta


def encode_session_meta(meta):
    return json.dumps(meta, ensure_ascii=False)


async def replace_session_snapshot(client, key, expected, replacement, ttl):
    return bool(await client.eval(
        """if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
        redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
        return 1""",
        1, key, expected, replacement, ttl,
    ))


def is_stop_confirmed(meta):
    return meta.get("status") == SESSION_STATUS_TERMINATED and meta.get("stop_confirmed") is True


def is_stop_in_progress(meta):
    return (
        meta.get("status") == SESSION_STATUS_TERMINATING
        and bool(meta.get("stop_task_id"))
        and meta.get("error_code") != STOP_FAILED
    )


class StopDispatchError(Exception):
    """The stop task could not be confirmed as published."""


async def dispatch_session_stop(client, session_id, raw, meta, ttl, timestamp, send_task, *, force=False):
    key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    stop_task_id = uuid4().hex
    updated = {
        **meta, "status": SESSION_STATUS_TERMINATING, "stop_task_id": stop_task_id,
        "last_heartbeat_at": timestamp, "error_code": None, "error_detail": None,
    }
    replacement = encode_session_meta(updated)
    # Reserve before publishing: a fast worker must never have its result overwritten.
    if not await replace_session_snapshot(client, key, raw, replacement, ttl):
        return False
    args = [session_id, True] if force else [session_id]
    try:
        send_task("app.tasks.pythonlab.stop_session", args=args, kwargs={"stop_task_id": stop_task_id})
    except Exception as exc:
        try:
            await replace_session_snapshot(client, key, replacement, raw, ttl)
        except Exception:
            logger.exception("Could not roll back PythonLab stop dispatch reservation")
        raise StopDispatchError from exc
    return True


async def publish_failed_stop(client, key, raw, meta, ttl, timestamp):
    failed = {
        **meta, "status": SESSION_STATUS_TERMINATING, "error_code": STOP_FAILED,
        "error_detail": "未能确认运行环境已停止，请重试或联系老师", "last_heartbeat_at": timestamp,
    }
    await replace_session_snapshot(client, key, raw, encode_session_meta(failed), ttl)


async def publish_confirmed_stop(client, key, meta, ttl, timestamp):
    # Existing run/transport writers can record normal exit during Docker IO.
    # Merge that outcome only for the same session generation and stop attempt.
    latest_raw, latest = await read_session_snapshot(client, key)
    identity_fields = ("session_id", "owner_user_id", "startup_task_id", "sandbox_owner_token", "docker_container_id")
    if not latest or latest.get("stop_task_id") not in (None, meta.get("stop_task_id")) or any(
        latest.get(field) != meta.get(field) for field in identity_fields
    ):
        raise RuntimeError("PythonLab session identity changed while stopping")
    latest.update(status=SESSION_STATUS_TERMINATED, stop_confirmed=True,
                  error_code=None, error_detail=None, last_heartbeat_at=timestamp)
    if not await replace_session_snapshot(client, key, latest_raw, encode_session_meta(latest), ttl):
        raise RuntimeError("PythonLab session metadata changed while stopping")