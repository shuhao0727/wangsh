"""Bounded session revalidation and cleanup for admitted event streams."""
import asyncio
import json
from contextlib import suppress

from fastapi import Request

from app.core.session_guard import (
    verify_request_session_detail,
    verify_stream_session_detail,
)
from app.services.auth import verify_token

CHECK_INTERVAL_SECONDS = 1.0
CHECK_TIMEOUT_SECONDS = 2.0
_DEFAULT_REQUEST_SESSION_DETAIL = verify_request_session_detail


def _session_error_frame(error: str, message: str) -> bytes:
    payload = json.dumps({"error": error, "message": message}, ensure_ascii=False)
    return f"event: error\ndata: {payload}\n\n".encode("utf-8")


async def _request_is_disconnected(request: Request | None) -> bool:
    """Best-effort disconnect check without breaking direct generator callers.

    Starlette's ``Request`` only has a receive channel when it is running inside
    an ASGI response. Unit callers often construct a request object without one;
    those callers must still exercise the stream state machine rather than fail
    before the source is subscribed. In a real ``StreamingResponse``, Starlette
    also listens for ``http.disconnect`` and cancels the generator, whose
    ``finally`` block closes the upstream source.
    """
    if request is None:
        return False
    try:
        return bool(await request.is_disconnected())
    except RuntimeError as exc:
        if "Receive channel has not been made available" in str(exc):
            return False
        raise


async def _session_status(request: Request | None) -> str:
    """Return ok, session_invalid, or session_revalidation_unavailable.

    ``None`` is used by direct generator/unit callers that intentionally bypass
    HTTP authentication. Keep that compatibility path live instead of trying to
    dereference ``request.state``. Real ASGI routes always pass a Request.
    """
    if request is None:
        return "ok"
    context = getattr(request.state, "accepted_stream_session", None)
    if not context:
        return "session_invalid"
    user_id, token = context
    try:
        payload = verify_token(token)
        if not payload:
            return "session_invalid"
        verifier = verify_stream_session_detail
        # Keep the old seam available for isolated callers that deliberately
        # inject a failing verifier to exercise timeout/error cleanup paths.
        if verify_request_session_detail is not _DEFAULT_REQUEST_SESSION_DETAIL:
            verifier = verify_request_session_detail
        result = await asyncio.wait_for(
            verifier(user_id, payload, request),
            timeout=CHECK_TIMEOUT_SECONDS,
        )
        return "ok" if result.get("ok") else "session_invalid"
    except asyncio.TimeoutError:
        return "session_revalidation_unavailable"
    except Exception:
        return "session_revalidation_unavailable"


async def _session_is_live(request: Request | None) -> bool:
    """Compatibility helper used by isolated tests and older callers."""
    return (await _session_status(request)) == "ok"


async def _emit_session_failure(request: Request, status: str):
    if await _request_is_disconnected(request):
        return
    if status == "session_invalid":
        yield _session_error_frame("session_invalid", "会话已失效，请重新登录")
    else:
        yield _session_error_frame("session_revalidation_unavailable", "暂时无法核验会话，请稍后重试")


async def session_checked_stream(source, request: Request | None):
    """Check before subscription and each frame; always close the source."""
    pending = None
    try:
        if await _request_is_disconnected(request):
            return
        if request is None:
            live = await _session_is_live(request)
            status = "ok" if live else "session_invalid"
        else:
            status = await _session_status(request)
        if status != "ok":
            if request is not None:
                async for frame in _emit_session_failure(request, status):
                    yield frame
            return
        while True:
            if await _request_is_disconnected(request):
                return
            if pending is None:
                pending = asyncio.create_task(anext(source))
            done, _ = await asyncio.wait({pending}, timeout=CHECK_INTERVAL_SECONDS)
            if await _request_is_disconnected(request):
                return
            if request is None:
                live = await _session_is_live(request)
                status = "ok" if live else "session_invalid"
            else:
                status = await _session_status(request)
            if status != "ok":
                if request is not None:
                    async for frame in _emit_session_failure(request, status):
                        yield frame
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
