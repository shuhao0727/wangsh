"""Actual ASGI routing/stream lifecycle, synthetic SQLite/cache/pubsub; no TCP."""
import asyncio
import importlib

import pytest
from sqlalchemy import update

from app.core import stream_session
from app.models import User
from test_logout_revocation_isolated import isolated  # noqa: F401

ROUTES = [
    ('app.api.endpoints.admin_stream', '/api/v1/admin', 'admin'),
    ('app.api.endpoints.classroom.admin', '/api/v1/classroom/admin', 'teacher'),
    ('app.api.endpoints.classroom.student', '/api/v1/classroom', 'student'),
]


@pytest.mark.parametrize('module_name,prefix,role', ROUTES)
@pytest.mark.parametrize('ending', ['logout', 'disconnect'])
def test_real_asgi_stream_auth_and_cleanup(isolated, monkeypatch, module_name, prefix, role, ending):
    async def run():
        monkeypatch.setattr(stream_session, 'CHECK_INTERVAL_SECONDS', 0.01)
        async with isolated() as h:
            async with h.db_factory() as db:
                await db.execute(update(User).where(User.id == 1).values(
                    role_code=role, class_name='Synthetic ASGI Class'))
                await db.commit()
            pair = await h.login()
            module = importlib.import_module(module_name)
            h.app.include_router(module.router, prefix=prefix)
            events, incoming = asyncio.Queue(), asyncio.Queue()
            subscribed, removed, output = [], [], []
            connected = asyncio.Event()

            async def subscribe(*args):
                subscribed.append(args)
                return events

            async def unsubscribe(*args):
                removed.append(args)

            async def send(message):
                output.append(message)
                if b'connected' in message.get('body', b''):
                    connected.set()

            target = getattr(module, 'svc', module)
            monkeypatch.setattr(target, 'subscribe', subscribe)
            monkeypatch.setattr(target, 'unsubscribe', unsubscribe)
            scope = {
                'type': 'http', 'asgi': {'version': '3.0', 'spec_version': '2.3'},
                'http_version': '1.1', 'method': 'GET', 'scheme': 'http',
                'path': prefix + '/stream', 'raw_path': (prefix + '/stream').encode(),
                'query_string': b'', 'root_path': '',
                'headers': [(b'authorization', ('Bearer ' + pair['access_token']).encode())],
                'client': ('192.0.2.10', 12345), 'server': ('isolated.invalid', 80),
            }
            incoming.put_nowait({'type': 'http.request', 'body': b'', 'more_body': False})
            task = asyncio.create_task(h.app(scope, incoming.get, send))
            try:
                await asyncio.wait_for(connected.wait(), 2)
                assert output[0]['type'] == 'http.response.start'
                assert output[0]['status'] == 200
                assert len(subscribed) == 1
                if ending == 'logout':
                    await h.logout(pair)
                    events.put_nowait({'type': 'private_after_logout'})
                else:
                    incoming.put_nowait({'type': 'http.disconnect'})
                await asyncio.wait_for(task, 2)
                assert len(removed) == 1
                assert not any(b'private_after_logout' in m.get('body', b'') for m in output)
            finally:
                if not task.done():
                    task.cancel()
                await asyncio.gather(task, return_exceptions=True)
    asyncio.run(run())
