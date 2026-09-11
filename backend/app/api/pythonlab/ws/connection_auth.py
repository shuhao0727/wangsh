"""Bounded WS revocation; no claim of an atomic Redis/transport transaction.

Idle checks run every second, each auth check times out after two seconds.
Checks also fence each client input, output, and explicit transport boundary.
Already in-flight IO cannot be recalled. These bounds require a responsive event
loop and cancellation-cooperative dependencies. No DB session is shared with the
watcher: identity is pinned at admission; nonce/JWT/IP are rechecked thereafter.
"""

import asyncio
import os
from contextlib import suppress
from functools import wraps

from fastapi import WebSocketDisconnect

from app.api.pythonlab.ws import session_auth
from app.api.pythonlab.ws.validation import _extract_ws_token

REVOCATION_INTERVAL_SECONDS = 1.0
CLOSE_TIMEOUT_SECONDS = 1.0


class SessionWebSocket:
    """Connection-local fail-closed latch, shared with the DAP output bridge."""

    def __init__(self, websocket, token, user):
        self.raw = websocket
        self.token = token
        self.user = user
        self.revoked = False
        self.closed = False

    def __getattr__(self, name):
        return getattr(self.raw, name)

    async def check_session(self):
        if not self.revoked:
            valid = await session_auth.verify_ws_session(self.token, int(self.user["id"]), self.raw)
            if not valid:
                self.revoked = True
        if self.revoked:
            raise WebSocketDisconnect(code=4401)

    async def receive_text(self):
        data = await self.raw.receive_text()
        await self.check_session()
        return data

    async def send_text(self, data):
        await self.check_session()
        await self.raw.send_text(data)

    async def close(self, code=1000, reason=None):
        if self.closed:
            return
        self.closed = True
        with suppress(Exception):
            await asyncio.wait_for(
                self.raw.close(code=4401 if self.revoked else code, reason=reason),
                CLOSE_TIMEOUT_SECONDS,
            )

    async def watch(self):
        while True:
            with suppress(TimeoutError):
                await asyncio.wait_for(asyncio.Event().wait(), REVOCATION_INTERVAL_SECONDS)
            try:
                await self.check_session()
            except WebSocketDisconnect:
                return


async def cancel_and_join(*tasks):
    """Never leave a receive/pump/watcher task behind on disconnect or cancel."""
    for task in tasks:
        if task is not None and not task.done():
            task.cancel()
    for task in tasks:
        if task is not None:
            with suppress(asyncio.CancelledError, Exception):
                await task


async def serve_authenticated_ws(websocket, session_id, db, resolve_user, handler):
    await websocket.accept()
    token = _extract_ws_token(websocket)
    user = await session_auth.authenticate_ws_session(token, db, websocket, resolve_user) if token else None
    if not user:
        with suppress(Exception):
            await asyncio.wait_for(websocket.close(code=4401), CLOSE_TIMEOUT_SECONDS)
        return
    guarded = SessionWebSocket(websocket, token, user)
    worker = asyncio.create_task(handler(guarded, session_id, user), name="pythonlab-ws-handler")
    watcher = asyncio.create_task(guarded.watch(), name="pythonlab-ws-auth-watch")
    try:
        done, _ = await asyncio.wait({worker, watcher}, return_when=asyncio.FIRST_COMPLETED)
        if watcher in done:
            # Close before cancelling handler: finalization may block on business IO.
            guarded.revoked = True
            await guarded.close(code=4401)
        else:
            try:
                await worker
            except WebSocketDisconnect:
                pass
    finally:
        if guarded.revoked:
            await guarded.close(code=4401)
        await cancel_and_join(worker, watcher)


async def read_pty(fd, size):
    """Cancellable POSIX PTY read, without an uninterruptible executor thread."""
    loop = asyncio.get_running_loop()
    ready = loop.create_future()

    def readable():
        if ready.done():
            return
        try:
            ready.set_result(os.read(fd, size))
        except BlockingIOError:
            return
        except Exception as exc:
            ready.set_exception(exc)

    loop.add_reader(fd, readable)
    try:
        return await ready
    finally:
        loop.remove_reader(fd)


def authenticated_ws(resolve_user):
    """Keep endpoint signatures and historical governance identities intact."""
    def decorate(handler):
        @wraps(handler)
        async def guarded(websocket, session_id, db):
            async def run(socket, sid, user):
                await handler(socket, sid, db)
            await serve_authenticated_ws(websocket, session_id, db, resolve_user(), run)
        return guarded
    return decorate
