"""Fail-closed DAP cleanup: byte CAS plus ownership check in one Redis script.

Snapshot before detach, never retry on changed state, and never extend metadata
TTL. An expired/missing key is not resurrected. A new connection's lease wins.
"""
import json

from loguru import logger

from app.api.pythonlab.constants import (
    SESSION_STATUS_ATTACHED,
    SESSION_STATUS_READY,
    SESSION_STATUS_RUNNING,
    SESSION_STATUS_STOPPED,
)

# Redis executes the ownership test, compare-delete, and raw-byte CAS atomically.
# No JSON decode/encode in Lua: preserve opaque fields and large integer values.
_CLEANUP_CAS = """
local owner = redis.call('GET', KEYS[2])
if owner and owner ~= ARGV[1] then return 0 end
if owner == ARGV[1] then redis.call('DEL', KEYS[2]) end
if ARGV[2] == '' or ARGV[3] == '' then return 0 end
if redis.call('GET', KEYS[1]) ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], ARGV[3], 'KEEPTTL')
return 1
"""


def _cleanup_candidate(raw, conn_id, preserve, attached, timestamp):
    if not raw:
        return None
    meta = json.loads(raw)
    if not isinstance(meta, dict):
        return None
    owner = meta.get('debug_owner')
    if not isinstance(owner, dict) or owner.get('conn_id') != conn_id:
        return None
    if meta.get('status') not in {
        SESSION_STATUS_READY, SESSION_STATUS_ATTACHED,
        SESSION_STATUS_RUNNING, SESSION_STATUS_STOPPED,
    }:
        return None
    if preserve:
        owner.update(state='detached', updated_at=timestamp)
    else:
        meta.pop('debug_owner')
        if attached:
            meta.update(status=SESSION_STATUS_READY, last_heartbeat_at=timestamp)
    return json.dumps(meta, ensure_ascii=False)


async def cleanup_dap_connection(client, session_key, owner_key, owner_value,
                                 conn_id, bridge, now_iso):
    """Detach even on read failure; no read/error path falls back to a blind SET.

    Only the exact old lease may be released; if a new lease appears, neither
    lease nor metadata is changed. Errors leave remaining leases to their TTL.
    """
    raw = None
    try:
        raw = await client.get(session_key)
    except Exception:
        logger.warning('DAP cleanup snapshot unavailable; skipping metadata update')
    try:
        if bridge is not None:
            await bridge.detach_client(conn_id)
    except Exception:
        raw = None
        logger.warning('DAP cleanup detach failed; skipping metadata update')
    replacement = None
    try:
        preserve = bridge.should_preserve_runtime() if bridge is not None else False
        attached = bool(bridge.attached_marked) if bridge is not None else False
        replacement = _cleanup_candidate(raw, conn_id, preserve, attached, now_iso())
    except Exception:
        logger.warning('DAP cleanup candidate unavailable; skipping metadata update')
    try:
        return bool(await client.eval(
            _CLEANUP_CAS, 2, session_key, owner_key, owner_value,
            raw or '', replacement or '',
        ))
    except Exception:
        logger.warning('DAP atomic cleanup unavailable; no non-atomic fallback')
        return False
