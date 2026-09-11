"""BIZ-01: real content/mindmap routers, JWT guards, services and SQLite ORM.

Run with --noconftest, synthetic settings and a runner that disables dotenv and
network BEFORE app import. Only DB sessions and nonce cache are adapted. No
app.main/lifespan, production database, Redis, browser or external AI is used.
"""
import asyncio
import json
import socket
from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.learning import content, mindmap
from app.core import session_guard
from app.core.config import settings
from app.db.database import Base, get_db
from app.models import AuthAuthority, AuthSessionState, User
from app.models.learning.content import LearningContentItem
from app.services.auth import create_access_token
from app.services.learning import content_service

MODULES = ('ml', 'ai', 'agents')
ROLES = {1: 'admin', 101: 'student', 102: 'student', 103: 'teacher',
         104: 'admin', 105: 'super_admin', 106: 'guest'}


class ContentHarness:
    async def request(self, method, path, *, user_id=101, bad_token=False, **kwargs):
        headers = {}
        if user_id is not None:
            token = create_access_token({
                'sub': f'content-user-{user_id}', 'sn': f'content-nonce-{user_id}',
            })
            headers['Authorization'] = 'Bearer ' + ('invalid.jwt' if bad_token else token)
        async with AsyncClient(transport=ASGITransport(app=self.app),
                               base_url='http://isolated.invalid') as client:
            return await client.request(method, '/api/v1' + path, headers=headers, **kwargs)

    async def create_private(self, module='ml', user_id=102):
        body = {'title': 'Synthetic private map', 'content': {
            'root': {'children': [{'data': {'text': f'SYNTHETIC-PRIVATE-{user_id}'}}]},
        }}
        if module is not None:
            body['module_key'] = module
        response = await self.request('POST', '/learning/mindmaps', user_id=user_id, json=body)
        assert response.status_code == 200, response.text
        item = response.json()
        assert item['owner_id'] == user_id and item['enabled'] is True
        async with self.db_factory() as db:
            saved = await db.get(LearningContentItem, item['id'])
            assert saved.owner_id == user_id
            assert json.loads(saved.content) == body['content']
        return item

    async def seed(self, module='ml', section='resources', owner=None, enabled=True,
                   order=0, source='admin', key=None):
        async with self.db_factory() as db:
            row = LearningContentItem(
                module_key=module, section_key=section, item_key=key or f'item-{self.counter}',
                title=f'Synthetic {self.counter}', summary='Synthetic summary',
                content=json.dumps({'nested': {'text': f'SYNTHETIC-{self.counter}'}}),
                tags='["synthetic"]', enabled=enabled, owner_id=owner, sort_order=order,
                source_type=source,
            )
            self.counter += 1
            db.add(row)
            await db.commit()
            return row.id


@pytest.fixture
def isolated(monkeypatch):
    h = ContentHarness()
    h.counter = 0
    h.reads, h.writes = [], []

    def deny_network(*args, **kwargs):
        raise AssertionError('BIZ-01 forbids network access')

    async def read_nonce(key):
        return next(({'nonce': f'content-nonce-{uid}'} for uid in ROLES
                     if key == f'auth:session:uid:{uid}'), None)

    monkeypatch.setattr(socket.socket, 'connect', deny_network)
    monkeypatch.setattr(socket.socket, 'connect_ex', deny_network)
    monkeypatch.setattr(settings, 'AUTH_ENFORCE_SAME_IP_PER_REQUEST', False)
    monkeypatch.setattr(session_guard, 'cache', SimpleNamespace(get=read_nonce))

    @asynccontextmanager
    async def context():
        engine = create_async_engine('sqlite+aiosqlite:///:memory:')

        @event.listens_for(engine.sync_engine, 'connect')
        def enable_fk(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')

        @event.listens_for(engine.sync_engine, 'before_cursor_execute')
        def track_sql(_conn, _cursor, statement, _params, _ctx, _many):
            if 'sys_learning_content_items' in statement:
                if statement.lstrip().upper().startswith('SELECT'):
                    h.reads.append(statement)
                elif statement.lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                    h.writes.append(statement)

        h.db_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=[
                    User.__table__, LearningContentItem.__table__,
                    AuthAuthority.__table__, AuthSessionState.__table__,
                ]))
            async with h.db_factory() as db:
                db.add_all([User(id=uid, username=f'content-user-{uid}',
                                 full_name=f'Synthetic {uid}', student_id=f'CONTENT-{uid}',
                                 role_code=role, is_active=True, is_deleted=False)
                            for uid, role in ROLES.items()])
                await db.flush()
                db.add(AuthAuthority(id=1, ready=True))
                db.add_all([AuthSessionState(
                    user_id=uid, nonce=f'content-nonce-{uid}', ip='', active=True,
                ) for uid in ROLES])
                await db.commit()

            async def isolated_db():
                async with h.db_factory() as db:
                    yield db

            h.app = FastAPI()
            h.app.include_router(content.router, prefix='/api/v1')
            h.app.include_router(mindmap.router, prefix='/api/v1')
            h.app.dependency_overrides[get_db] = isolated_db
            yield h
        finally:
            await engine.dispose()

    return context


@pytest.mark.parametrize('module', MODULES)
def test_http_created_private_map_cannot_leak_via_generic_route(isolated, module):
    async def scenario():
        async with isolated() as h:
            item = await h.create_private(module)
            public = await h.request('GET', '/learning/mindmaps', user_id=None)
            own = await h.request('GET', '/learning/mindmaps/my', user_id=102)
            other = await h.request('GET', '/learning/mindmaps/my', user_id=101)
            assert public.status_code == own.status_code == other.status_code == 200
            assert public.json() == other.json() == []
            assert [row['id'] for row in own.json()] == [item['id']]
            assert own.json()[0]['content'] == item['content']
            h.reads.clear()
            h.writes.clear()
            response = await h.request('GET', f'/learning/content/{module}', user_id=101)
            assert response.status_code == 200
            assert h.reads and not h.writes
            assert response.json() == [], f'private payload exposed: {response.text}'
    asyncio.run(scenario())


@pytest.mark.parametrize('module', MODULES)
@pytest.mark.parametrize('user_id', [101, 102, 103, 104, 105, 106])
def test_generic_list_is_public_enabled_only_for_every_logged_in_role(isolated, module, user_id):
    async def scenario():
        async with isolated() as h:
            first = await h.seed(module, section='mindmap', order=1, source='user')
            second = await h.seed(module, section='mindmap', order=2)
            third = await h.seed(module, section='resources', order=-1)
            hidden = [await h.seed(module, owner=101), await h.seed(module, owner=102),
                      await h.seed(module, section='mindmap', owner=102, source='admin'),
                      await h.seed(module, enabled=False),
                      await h.seed(module, owner=user_id, enabled=False),
                      await h.seed('ai' if module != 'ai' else 'agents'),
                      await h.seed('mindmap')]
            h.writes.clear()
            response = await h.request('GET', f'/learning/content/{module}', user_id=user_id)
            assert response.status_code == 200
            rows = response.json()
            assert [row['id'] for row in rows] == [first, second, third]
            assert not set(hidden).intersection(row['id'] for row in rows)
            assert rows[0]['content'] == {'nested': {'text': 'SYNTHETIC-0'}}
            assert rows[0]['tags'] == ['synthetic']
            assert set(rows[0]) == {'id', 'module_key', 'section_key', 'item_key', 'title',
                                   'summary', 'content', 'tags', 'difficulty', 'sort_order',
                                   'enabled', 'source_type', 'created_at', 'updated_at'}
            assert not h.writes
    asyncio.run(scenario())


@pytest.mark.parametrize('module', MODULES)
def test_service_query_filters_private_rows_without_router(isolated, module):
    async def scenario():
        async with isolated() as h:
            public = await h.seed(module)
            await h.seed(module, owner=102)
            await h.seed(module, enabled=False)
            async with h.db_factory() as db:
                rows = await content_service.list_learning_content(db, module)
            assert [row['id'] for row in rows] == [public]
    asyncio.run(scenario())


@pytest.mark.parametrize('user_id', [104, 105])
def test_admin_listing_and_mutations_keep_existing_scope(isolated, user_id):
    async def scenario():
        async with isolated() as h:
            item = await h.create_private()
            disabled = await h.seed(enabled=False, key='disabled')
            response = await h.request('GET', '/learning/content/ml/admin', user_id=user_id)
            assert response.status_code == 200
            assert {r['id'] for r in response.json()} == {item['id'], disabled}
            assert next(r for r in response.json() if r['id'] == item['id'])['content'] == item['content']
            body = {'section_key': 'resources', 'item_key': 'admin-created',
                    'title': 'Synthetic admin content', 'content': {'nested': {'ok': True}}}
            response = await h.request('PUT', '/learning/content/ml/resources/admin-created',
                                       user_id=user_id, json=body)
            assert response.status_code == 200
            new_id = response.json()['id']
            response = await h.request('PATCH', '/learning/content/ml/resources/admin-created/enabled',
                                       user_id=user_id, json={'enabled': False})
            assert response.status_code == 200 and response.json()['enabled'] is False
            async with h.db_factory() as db:
                row = await db.get(LearningContentItem, new_id)
                assert row.owner_id is None and row.enabled is False
                assert json.loads(row.content) == body['content']
    asyncio.run(scenario())


@pytest.mark.parametrize('user_id', [101, 103, 106, None])
def test_nonadmin_management_requests_are_denied_without_content_sql(isolated, user_id):
    async def scenario():
        async with isolated() as h:
            item = await h.create_private()
            h.reads.clear()
            h.writes.clear()
            for method, path, body in [
                ('GET', '/learning/content/ml/admin', None),
                ('PUT', '/learning/content/ml/resources/blocked', {'section_key': 'resources',
                 'item_key': 'blocked', 'title': 'Synthetic blocked', 'content': {}}),
                ('PATCH', '/learning/content/ml/mindmap/'+item['item_key']+'/enabled', {'enabled': False}),
                ('PATCH', f'/learning/mindmaps/{item["id"]}/publish', None),
            ]:
                response = await h.request(method, path, user_id=user_id, json=body)
                assert response.status_code == (401 if user_id is None else 403)
            assert h.reads == h.writes == []
    asyncio.run(scenario())


@pytest.mark.parametrize('module', MODULES)
@pytest.mark.parametrize('admin_id', [104, 105])
def test_publish_unpublish_keeps_existing_owner_and_visibility_contract(isolated, module, admin_id):
    async def scenario():
        async with isolated() as h:
            item = await h.create_private(module)
            response = await h.request('PATCH', f'/learning/mindmaps/{item["id"]}/publish', user_id=admin_id)
            assert response.status_code == 200
            assert response.json()['owner_id'] is None and response.json()['source_type'] == 'admin'
            for path in ['/learning/mindmaps', f'/learning/content/{module}']:
                public = await h.request('GET', path)
                assert public.status_code == 200
                assert [r['id'] for r in public.json()] == [item['id']]
            response = await h.request('PATCH', f'/learning/mindmaps/{item["id"]}/publish', user_id=admin_id)
            assert response.status_code == 200
            # Preserve the existing fixed owner 1 on unpublish; do not redesign publishing.
            assert response.json()['owner_id'] == 1 and response.json()['source_type'] == 'user'
            async with h.db_factory() as db:
                assert (await db.get(LearningContentItem, item['id'])).owner_id == 1
            public = await h.request('GET', '/learning/mindmaps', user_id=None)
            assert public.json() == []
            own = await h.request('GET', '/learning/mindmaps/my', user_id=1)
            assert [r['id'] for r in own.json()] == [item['id']]
            generic = await h.request('GET', f'/learning/content/{module}')
            assert generic.status_code == 200 and generic.json() == []
    asyncio.run(scenario())


def test_personal_owner_update_disable_and_delete_controls(isolated):
    async def scenario():
        async with isolated() as h:
            item = await h.create_private()
            h.writes.clear()
            for method, body in [('PUT', {'title': 'Blocked'}), ('DELETE', None)]:
                denied = await h.request(method, f'/learning/mindmaps/{item["id"]}', json=body)
                assert denied.status_code == 403
            assert not h.writes
            update = await h.request('PUT', f'/learning/mindmaps/{item["id"]}', user_id=102,
                                     json={'title': 'Synthetic owner edit', 'enabled': False})
            assert update.status_code == 200 and update.json()['enabled'] is False
            own = await h.request('GET', '/learning/mindmaps/my', user_id=102)
            assert own.status_code == 200 and own.json()[0]['title'] == 'Synthetic owner edit'
            generic = await h.request('GET', '/learning/content/ml')
            assert generic.status_code == 200 and generic.json() == []
            deleted = await h.request('DELETE', f'/learning/mindmaps/{item["id"]}', user_id=102)
            assert deleted.status_code == 200
            async with h.db_factory() as db:
                assert await db.get(LearningContentItem, item['id']) is None
    asyncio.run(scenario())


def test_default_mindmap_module_not_a_valid_generic_module(isolated):
    async def scenario():
        async with isolated() as h:
            item = await h.create_private(None)
            assert item['module_key'] == 'mindmap'
            for module in MODULES:
                response = await h.request('GET', f'/learning/content/{module}')
                assert response.status_code == 200 and response.json() == []
            invalid = await h.request('GET', '/learning/content/mindmap')
            assert invalid.status_code == 400
    asyncio.run(scenario())


@pytest.mark.parametrize('user_id,bad_token', [(None, False), (101, True), (999, False)])
def test_missing_invalid_or_unknown_identity_denied_before_content_sql(isolated, user_id, bad_token):
    async def scenario():
        async with isolated() as h:
            await h.create_private()
            h.reads.clear()
            h.writes.clear()
            response = await h.request('GET', '/learning/content/ml', user_id=user_id, bad_token=bad_token)
            assert response.status_code == 401
            assert h.reads == h.writes == []
    asyncio.run(scenario())
