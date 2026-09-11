"""Real JWT/logout and endpoint generators; synthetic SQLite/pubsub/cache, no wire SSE."""
import asyncio
import importlib
import inspect

import pytest
from starlette.requests import Request

from app.core import deps
from app.core.config import settings
from test_logout_revocation_isolated import isolated  # noqa: F401

ENDPOINTS = [
    ('app.api.endpoints.admin_stream', 'admin_stream'),
    ('app.api.endpoints.classroom.admin', 'admin_stream'),
    ('app.api.endpoints.classroom.student', 'student_stream'),
]


async def open_stream(h, monkeypatch, module_name, function_name, *, cookie=False):
    module = importlib.import_module(module_name)
    pair = await h.login('a')
    headers = [(b'cookie', f'{settings.ACCESS_TOKEN_COOKIE_NAME}={pair["access_token"]}'.encode())] if cookie else []
    request = Request({'type': 'http', 'method': 'GET', 'path': '/stream',
                       'headers': headers, 'query_string': b'', 'client': ('127.0.0.1', 1)})
    async with h.db_factory() as db:
        user = await deps.get_current_user(
            token='damaged-query-token' if cookie else pair['access_token'], db=db, request=request)
    user['class_name'] = 'Synthetic Class'
    queue = asyncio.Queue()
    removed = []
    async def subscribe(*args):
        return queue
    async def unsubscribe(*args):
        removed.append(args)
    target = getattr(module, 'svc', module)
    monkeypatch.setattr(target, 'subscribe', subscribe)
    monkeypatch.setattr(target, 'unsubscribe', unsubscribe)
    endpoint = getattr(module, function_name)
    # Permits a before-source overlay to reproduce the same behavioral assertion.
    kwargs = {'request': request} if 'request' in inspect.signature(endpoint).parameters else {}
    response = await endpoint(current_user=user, **kwargs)
    return response.body_iterator, queue, removed, pair


@pytest.mark.parametrize('module_name,function_name', ENDPOINTS)
@pytest.mark.parametrize('cookie', [False, True])
def test_sse_logout_stops_next_private_event(isolated, monkeypatch, module_name, function_name, cookie):
    async def run():
        async with isolated() as h:
            stream, queue, removed, pair = await open_stream(h, monkeypatch, module_name, function_name, cookie=cookie)
            try:
                assert 'connected' in await anext(stream)
                queue.put_nowait({'type': 'before_logout'})
                assert 'before_logout' in await anext(stream)
                await h.logout(token=pair['access_token'], cookies={})
                queue.put_nowait({'type': 'private_after_logout'})
                with pytest.raises(StopAsyncIteration):
                    await asyncio.wait_for(anext(stream), 3)
                assert len(removed) == 1
            finally:
                await stream.aclose()
    asyncio.run(run())


@pytest.mark.parametrize('module_name,function_name', ENDPOINTS)
@pytest.mark.parametrize('failure', ['logout_before_subscribe', 'idle_logout', 'cache_error', 'cache_timeout', 'cancel'])
def test_sse_idle_failure_and_cleanup(isolated, monkeypatch, module_name, function_name, failure):
    from app.core import stream_session
    async def run():
        monkeypatch.setattr(stream_session, 'CHECK_INTERVAL_SECONDS', 0.01)
        monkeypatch.setattr(stream_session, 'CHECK_TIMEOUT_SECONDS', 0.03)
        async with isolated() as h:
            stream, queue, removed, pair = await open_stream(h, monkeypatch, module_name, function_name)
            if failure == 'logout_before_subscribe':
                await h.logout(token=pair['access_token'], cookies={})
                with pytest.raises(StopAsyncIteration):
                    await anext(stream)
                assert not removed  # No subscription was ever opened.
                return
            assert 'connected' in await anext(stream)
            consumer = asyncio.create_task(anext(stream))
            await asyncio.sleep(0)
            if failure == 'idle_logout':
                await h.logout(token=pair['access_token'], cookies={})
            elif failure.startswith('cache_'):
                async def fail(*args, **kwargs):
                    if failure == 'cache_timeout':
                        await asyncio.Event().wait()
                    raise RuntimeError('synthetic cache failure')
                monkeypatch.setattr(stream_session, 'verify_request_session_detail', fail)
            elif failure == 'cancel':
                consumer.cancel()
            expected = asyncio.CancelledError if failure == 'cancel' else StopAsyncIteration
            with pytest.raises(expected):
                await asyncio.wait_for(consumer, 1)
            assert len(removed) == 1
            assert queue.empty()
            await stream.aclose()
    asyncio.run(run())


def test_sse_expired_jwt_and_missing_context_fail_closed(monkeypatch):
    from datetime import timedelta
    from app.core import stream_session
    from app.services.auth import create_access_token
    async def run():
        request = Request({'type': 'http', 'headers': []})
        calls = []
        async def source():
            calls.append('opened')
            yield 'must-not-deliver'
        for context in [None, (1, create_access_token({'sub': 'a', 'sn': 'n'}, expires_delta=timedelta(seconds=-1)))]:
            request.state.accepted_stream_session = context
            stream = stream_session.session_checked_stream(source(), request)
            with pytest.raises(StopAsyncIteration):
                await anext(stream)
        assert calls == []
    asyncio.run(run())


def test_sse_source_error_and_finite_end_close(monkeypatch):
    from app.core import stream_session
    async def live(*args):
        return True
    monkeypatch.setattr(stream_session, '_session_is_live', live)
    async def run():
        for failure in [False, True]:
            closed = []
            async def source():
                try:
                    yield 'first'
                    if failure:
                        raise ValueError('synthetic source error')
                finally:
                    closed.append(True)
            stream = stream_session.session_checked_stream(source(), None)
            assert await anext(stream) == 'first'
            with pytest.raises(ValueError if failure else StopAsyncIteration):
                await anext(stream)
            assert closed == [True]
    asyncio.run(run())
