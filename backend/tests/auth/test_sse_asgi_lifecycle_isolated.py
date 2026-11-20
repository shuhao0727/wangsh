"""Actual ASGI routing/stream lifecycle, synthetic SQLite/cache/pubsub; no TCP."""
import asyncio
import importlib

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update

from app.api.endpoints.management.users import users
from app.core import stream_session
from app.models import User
from test_logout_revocation_isolated import isolated  # noqa: F401

ROUTES = [
    ('app.api.endpoints.admin_stream', '/api/v1/admin', 'admin'),
    ('app.api.endpoints.classroom.admin', '/api/v1/classroom/admin', 'teacher'),
    ('app.api.endpoints.classroom.student', '/api/v1/classroom', 'student'),
]


@pytest.mark.parametrize('module_name,prefix,role,ending', [
    (*route, ending) for route in ROUTES for ending in ('logout', 'disconnect')
] + [
    (*ROUTES[0], 'demote'),
    (*ROUTES[0], 'idle_demote'),
    (*ROUTES[0], 'deactivate'),
    (*ROUTES[1], 'demote'),
    (*ROUTES[1][:2], 'admin', 'demote'),
])
def test_real_asgi_stream_auth_and_cleanup(isolated, monkeypatch, module_name, prefix, role, ending):
    async def run():
        monkeypatch.setattr(stream_session, 'CHECK_INTERVAL_SECONDS', 0.01)
        async with isolated() as h:
            async with h.db_factory() as db:
                await db.execute(update(User).where(User.id == 1).values(
                    role_code=role, class_name='Synthetic ASGI Class'))
                await db.execute(update(User).where(User.id == 2).values(role_code='super_admin'))
                await db.commit()
            pair = await h.login()
            module = importlib.import_module(module_name)
            h.app.include_router(module.router, prefix=prefix)
            h.app.include_router(users.router, prefix='/api/v1/users')
            events, incoming = asyncio.Queue(), asyncio.Queue()
            subscribed, removed, output = [], [], []
            connected, profile_event = asyncio.Event(), asyncio.Event()

            async def subscribe(*args):
                subscribed.append(args)
                return events

            async def unsubscribe(*args):
                removed.append(args)

            async def send(message):
                output.append(message)
                body = message.get('body', b'')
                if b'connected' in body:
                    connected.set()
                if b'after_profile_edit' in body:
                    profile_event.set()

            async def publish(*args):
                pass

            monkeypatch.setattr(users, 'publish', publish)
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
                    events.put_nowait({'type': 'event_after_removal'})
                elif ending == 'disconnect':
                    incoming.put_nowait({'type': 'http.disconnect'})
                else:
                    root = await h.login('b')
                    async with AsyncClient(transport=ASGITransport(app=h.app), base_url='http://isolated.invalid') as client:
                        admin_headers = {'Authorization': 'Bearer ' + root['access_token']}
                        edited = await client.put('/api/v1/users/1', headers=admin_headers, json={'study_year': '2027'})
                        assert edited.status_code == 200, edited.text
                        events.put_nowait({'type': 'after_profile_edit'})
                        await asyncio.wait_for(profile_event.wait(), 2)
                        assert not removed

                        new_role = 'teacher' if role == 'admin' else 'student'
                        data = {'is_active': False} if ending == 'deactivate' else {'role_code': new_role}
                        changed = await client.put('/api/v1/users/1', headers=admin_headers, json=data)
                        assert changed.status_code == 200, changed.text
                        if ending != 'idle_demote':
                            events.put_nowait({'type': 'event_after_removal'})
                        await asyncio.wait_for(task, 2)

                        user_headers = {'Authorization': 'Bearer ' + pair['access_token']}
                        path = prefix + '/stream'
                        if prefix.endswith('/classroom/admin') and new_role == 'teacher':
                            assert [channel for channel, _ in subscribed] == ['admin_global']
                            connected.clear()
                            retry_input = asyncio.Queue()
                            retry_input.put_nowait({'type': 'http.request', 'body': b'', 'more_body': False})
                            retry = asyncio.create_task(h.app(scope.copy(), retry_input.get, send))
                            try:
                                await asyncio.wait_for(connected.wait(), 2)
                                assert [channel for channel, _ in subscribed] == ['admin_global', 'admin_1']
                            finally:
                                retry_input.put_nowait({'type': 'http.disconnect'})
                                await asyncio.wait_for(retry, 2)
                        else:
                            reconnect = await client.get(path, headers=user_headers)
                            assert reconnect.status_code == (401 if ending == 'deactivate' else 403)
                        if ending != 'deactivate':
                            me = await client.get('/api/v1/auth/me', headers=user_headers)
                            assert me.status_code == 200, me.text
                            assert me.json()['role_code'] == new_role
                await asyncio.wait_for(task, 2)
                assert removed == subscribed
                assert not any(b'event_after_removal' in m.get('body', b'') for m in output)
                if ending in ('demote', 'idle_demote'):
                    assert any(b'"error": "access_revoked"' in m.get('body', b'') for m in output)
            finally:
                if not task.done():
                    task.cancel()
                await asyncio.gather(task, return_exceptions=True)
    asyncio.run(run())
