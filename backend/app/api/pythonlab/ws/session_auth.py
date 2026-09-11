"""WS identity admission and bounded JWT/nonce/IP revalidation."""

import asyncio

from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import WebSocket
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session_guard import verify_request_session_detail
from app.services.auth import verify_token


AUTH_CHECK_TIMEOUT_SECONDS = 2.0


async def verify_ws_session(token: str, user_id: int, websocket: WebSocket) -> bool:
    """Revalidate the selected credential only; never fall back to another one."""
    try:
        async with asyncio.timeout(AUTH_CHECK_TIMEOUT_SECONDS):
            payload = verify_token(token)
            if not payload or user_id <= 0:
                return False
            result = await verify_request_session_detail(user_id, payload, websocket)
            return result.get("ok") is True
    except Exception:
        logger.warning("pythonlab ws session revalidation failed")
        return False


async def authenticate_ws_session(
    token: str,
    db: AsyncSession,
    websocket: WebSocket,
    resolve_user: Callable[[str, AsyncSession], Awaitable[Any]],
):
    """Require the current session even when a legacy subject resolves uniquely."""
    try:
        async with asyncio.timeout(AUTH_CHECK_TIMEOUT_SECONDS):
            if not verify_token(token):
                return None
            user = await resolve_user(token, db)
            if not user:
                return None
            valid = await verify_ws_session(token, int(user.get("id") or 0), websocket)
            return user if valid else None
    except Exception:
        # Store/validation failures must not reach business cache or backend IO.
        logger.warning("pythonlab ws session verification failed")
        return None
