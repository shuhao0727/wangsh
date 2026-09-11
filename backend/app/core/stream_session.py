"""Bounded session revalidation for admitted event streams, not atomic revocation."""
import asyncio
from contextlib import suppress

from fastapi import Request

from app.core.session_guard import verify_request_session_detail
from app.services.auth import verify_token

CHECK_INTERVAL_SECONDS = 1.0
CHECK_TIMEOUT_SECONDS = 2.0


async def _session_is_live(request: Request) -> bool:
    """Use only the credential accepted by admission; never reselect a fallback."""
    context = getattr(request.state, 'accepted_stream_session', None)
    if not context:
        return False
    user_id, token = context
    try:
        payload = verify_token(token)
        if not payload:
            return False
        result = await asyncio.wait_for(
            verify_request_session_detail(user_id, payload, request),
            timeout=CHECK_TIMEOUT_SECONDS,
        )
        return bool(result.get('ok'))
    except Exception:
        return False


async def session_checked_stream(source, request: Request):
    """Check before subscription and each frame; idle waits also recheck.

    One pending read is kept across polls and cancelled/awaited on exit. A logout
    racing the last check and delivery can still allow that in-flight frame.
    """
    pending = None
    try:
        if not await _session_is_live(request):
            return
        while True:
            if pending is None:
                pending = asyncio.create_task(anext(source))
            done, _ = await asyncio.wait({pending}, timeout=CHECK_INTERVAL_SECONDS)
            if not await _session_is_live(request):
                return
            if not done:
                continue
            try:
                frame = pending.result()
            except StopAsyncIteration:
                return
            pending = None
            yield frame
    finally:
        try:
            if pending is not None:
                pending.cancel()
                with suppress(asyncio.CancelledError, StopAsyncIteration):
                    await pending
        finally:
            await source.aclose()
