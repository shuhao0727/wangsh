"""小组讨论公共配置路由（GET/PUT public-config 及其 SSE 流）。

路由路径写全（不含 prefix），由 `group_discussion.py` 以
`router.include_router(public_config_router)` 聚合，以保证最终注册顺序
与原单文件实现一致。
"""
import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, require_admin, require_registered_user, require_registered_user_sse
from app.core.stream_session import session_checked_stream
from app.schemas.agents import GroupDiscussionPublicConfig
from app.services.agents.group_discussion_public_config import GroupDiscussionPublicConfigService
from app.utils.cache import cache
from typing import Any, Dict

from .group_discussion_common import PUBLIC_CONFIG_CHANNEL

router = APIRouter()


@router.get("/public-config", response_model=GroupDiscussionPublicConfig)
async def get_public_config(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_registered_user),
) -> GroupDiscussionPublicConfig:
    enabled = await GroupDiscussionPublicConfigService.get_enabled(db)
    return GroupDiscussionPublicConfig(
        enabled=enabled,
        join_lock_seconds=settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS,
        rate_limit_seconds=settings.GROUP_DISCUSSION_RATE_LIMIT_SECONDS,
    )


@router.get("/public-config/stream")
async def stream_public_config(
    request: Request,
    current_user: Dict[str, Any] = Depends(require_registered_user_sse),
    db: AsyncSession = Depends(get_db),
):
    async def gen():
        enabled = await GroupDiscussionPublicConfigService.get_enabled(db)
        yield f"data: {json.dumps({'enabled': bool(enabled)}, ensure_ascii=False)}\n\n"

        pubsub = None
        if settings.GROUP_DISCUSSION_REDIS_ENABLED:
            try:
                client = await cache.get_client()
                pubsub = client.pubsub()
                await pubsub.subscribe(PUBLIC_CONFIG_CHANNEL)
            except Exception:
                pubsub = None

        last_enabled = bool(enabled)
        try:
            while True:
                try:
                    if pubsub is not None:
                        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
                        if msg is None:
                            yield ":keepalive\n\n"
                            continue
                        data = msg.get("data")
                        if isinstance(data, (bytes, bytearray)):
                            data = data.decode("utf-8", errors="ignore")
                        try:
                            payload = json.loads(str(data)) if data is not None else {}
                        except Exception:
                            payload = {}
                        enabled_val = bool(payload.get("enabled", last_enabled))
                    else:
                        await asyncio.sleep(2)
                        enabled_val = bool(await GroupDiscussionPublicConfigService.get_enabled(db))

                    if enabled_val != last_enabled:
                        last_enabled = enabled_val
                        yield f"data: {json.dumps({'enabled': bool(enabled_val)}, ensure_ascii=False)}\n\n"
                except asyncio.CancelledError:
                    break
                except Exception:
                    yield ":keepalive\n\n"
                    await asyncio.sleep(1)
        finally:
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(PUBLIC_CONFIG_CHANNEL)
                    await pubsub.close()
                except Exception:
                    pass

    return StreamingResponse(
        session_checked_stream(gen(), request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.put("/public-config", response_model=GroupDiscussionPublicConfig)
async def set_public_config(
    payload: GroupDiscussionPublicConfig,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionPublicConfig:
    enabled = await GroupDiscussionPublicConfigService.set_enabled(db, bool(payload.enabled))
    if settings.GROUP_DISCUSSION_REDIS_ENABLED:
        try:
            await cache.publish(PUBLIC_CONFIG_CHANNEL, {"enabled": bool(enabled)})
        except Exception:
            pass
    return GroupDiscussionPublicConfig(
        enabled=enabled,
        join_lock_seconds=settings.GROUP_DISCUSSION_JOIN_LOCK_SECONDS,
        rate_limit_seconds=settings.GROUP_DISCUSSION_RATE_LIMIT_SECONDS,
    )
