"""Redis-backed join lock helpers for group discussions."""

import json

from app.core.config import settings
from app.utils.cache import cache

from .core import _gd_key


async def enforce_join_lock(
    *,
    user_id: int,
    requested_group_no: str,
    user_role: str = "student",
) -> int:
    """Check the active join lock without changing it."""
    lock_seconds = int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300)
    if user_role != "student" or not settings.GROUP_DISCUSSION_REDIS_ENABLED:
        return lock_seconds

    lock_key = _gd_key("join_lock", int(user_id))
    locked_data = await cache.get(lock_key)
    if locked_data is None:
        return lock_seconds

    try:
        data = json.loads(locked_data) if isinstance(locked_data, str) else locked_data
        locked_group = str(data.get("group_no", ""))
    except Exception:
        locked_group = ""

    if locked_group == requested_group_no:
        return 0

    ttl = await cache.ttl(lock_key)
    return max(0, int(ttl or 0))


async def set_join_lock(
    *,
    user_id: int,
    requested_group_no: str,
    user_role: str = "student",
) -> None:
    """Create the join lock after a student joins a group."""
    if user_role != "student" or not settings.GROUP_DISCUSSION_REDIS_ENABLED:
        return

    await cache.set(
        _gd_key("join_lock", int(user_id)),
        json.dumps({"group_no": str(requested_group_no)}, ensure_ascii=False),
        expire_seconds=int(settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS or 300),
        nx=True,
    )
