"""Real JWT/SQLite/ASGI WS admission; no real Docker, Redis or socket IO.

Use the external no-dotenv/no-network runner, not the ordinary test suite.
Transport backends are doubles; existing WS behavior tests cover their protocol.
"""
import asyncio
import sys
from datetime import timedelta
from types import SimpleNamespace
from urllib.parse import urlencode

import pytest

from app.api.pythonlab.ws import handlers
from app.core import session_guard
from app.core.config import settings
from app.models import User
from app.services import auth as auth_service
from test_logout_revocation_isolated import isolated  # noqa: F401
from test_pythonlab_v2_ws_behavior import FakeCache, FakeRedisClient, FakeCeleryApp


async def alter(h, uid, **fields):
    async with h.db_factory() as db:
        user = await db.get(User, uid)
        for key, value in fields.items():
            setattr(user, key, value)
        await db.commit()


def retoken(pair, **claims):
    payload = auth_service.verify_token(pair['access_token'])
    payload.update(claims)
    return auth_service.create_access_token(payload)


class BusinessCache(FakeCache):
    def __init__(self):
        super().__init__()
        self.client = FakeRedisClient()
        self.reads = []
        self.client_reads = 0

    async def get(self, key):
        self.reads.append(key)
        return await super().get(key)

    async def get_client(self):
        self.client_reads += 1
        return await super().get_client()


async def ws_connect(app, endpoint, *, token=None, cookies=None, ip='192.0.2.10', headers=None):
    """Drive the actual ASGI WebSocket scope without opening a network socket."""
    incoming = asyncio.Queue()
    incoming.put_nowait({'type': 'websocket.connect'})
    incoming.put_nowait({'type': 'websocket.disconnect', 'code': 1000})
    messages = []
    raw_headers = [(b'host', b'isolated.invalid')]
    raw_headers.extend((k.lower().encode(), v.encode()) for k, v in (headers or {}).items())
    if cookies:
        raw_headers.append((b'cookie', '; '.join(f'{k}={v}' for k, v in cookies.items()).encode()))
    path = f'/api/v2/pythonlab/sessions/synthetic-session/{endpoint}'
    scope = {
        'type': 'websocket', 'asgi': {'version': '3.0', 'spec_version': '2.4'},
        'http_version': '1.1', 'scheme': 'ws', 'path': path, 'raw_path': path.encode(),
        'root_path': '', 'query_string': urlencode({'token': token}).encode() if token is not None else b'',
        'headers': raw_headers, 'client': (ip, 12345), 'server': ('isolated.invalid', 80),
        'subprotocols': [], 'state': {},
    }

    async def send(message):
        messages.append(message)

    await asyncio.wait_for(app(scope, incoming.get, send), timeout=5)
    assert messages[0]['type'] == 'websocket.accept'
    closed = [m['code'] for m in messages if m['type'] == 'websocket.close']
    assert len(closed) == 1, messages
    return closed[0]


INVALID = [
    'anonymous', 'damaged', 'expired', 'no_nonce', 'wrong_nonce', 'missing_session',
    'cache_unavailable', 'cache_exception', 'logout', 'relogin', 'unique_rebound', 'ambiguous',
    'inactive', 'deleted', 'ip_mismatch', 'untrusted_forwarded_ip',
    'revoked_query_valid_cookie', 'damaged_query_valid_cookie',
]
VALID = [
    'valid_query', 'configured_cookie', 'legacy_cookie', 'ws_cookie',
    'empty_query_cookie', 'query_wins', 'same_ip', 'trusted_forwarded_ip',
]


@pytest.mark.parametrize('endpoint', ['terminal', 'ws'])
@pytest.mark.parametrize('case', INVALID + VALID + ['owner_mismatch', 'missing_business_session'])
def test_ws_session_admission(isolated, monkeypatch, endpoint, case):
    async def scenario():
        async with isolated() as h:
            # Never stub JWT verification, raw ORM resolver or the session verifier.
            h.app.include_router(handlers.router, prefix='/api/v2/pythonlab')
            business = BusinessCache()
            celery = FakeCeleryApp()
            io_calls = []
            monkeypatch.setattr(handlers, 'cache', business)
            monkeypatch.setattr(handlers, 'celery_app', celery)

            class FakeDockerProvider:
                def __init__(self):
                    io_calls.append('terminal_provider')

                async def attach_tty(self, *args):
                    io_calls.append('terminal_attach')
                    raise RuntimeError('synthetic terminal unavailable')

            async def fake_bridge(**kwargs):
                io_calls.append('dap_bridge')
                raise RuntimeError('synthetic DAP unavailable')

            monkeypatch.setitem(sys.modules, 'app.core.sandbox.docker', SimpleNamespace(DockerProvider=FakeDockerProvider))
            monkeypatch.setattr(handlers, '_get_or_create_dap_bridge', fake_bridge)
            pair = await h.login('a')
            token = pair['access_token']
            cookies, headers, ip = {}, {}, '192.0.2.10'
            owner = 1
            if case == 'anonymous':
                token = None
            elif case == 'damaged':
                token = 'synthetic-not-a-jwt'
            elif case == 'expired':
                token = auth_service.create_access_token(auth_service.verify_token(token), timedelta(seconds=-10))
            elif case == 'no_nonce':
                payload = auth_service.verify_token(token)
                payload.pop('sn')
                token = auth_service.create_access_token(payload)
            elif case == 'wrong_nonce':
                token = retoken(pair, sn='synthetic-wrong-nonce')
            elif case == 'missing_session':
                h.cache.data.pop(session_guard._key_user(1))
            elif case == 'cache_unavailable':
                h.cache.fail_read = True
            elif case == 'cache_exception':
                async def unavailable_cache(_key):
                    raise RuntimeError('synthetic session store unavailable')
                monkeypatch.setattr(h.cache, 'get', unavailable_cache)
            elif case == 'logout':
                await h.logout(pair)
                assert await h.revoked(pair)
            elif case == 'relogin':
                await h.login('a')
            elif case == 'unique_rebound':
                await h.login('b')  # B has an independently valid, different nonce.
                subject = auth_service.verify_token(token)['sub']
                await alter(h, 1, username='renamed-a', full_name='Renamed a', student_id='renamed-id-a')
                await alter(h, 2, full_name=subject)
                async with h.db_factory() as db:
                    # Establish the raw lookup counterexample, then assert WS denies it.
                    assert (await auth_service.get_current_user(token, db))['id'] == 2
                owner = 2
            elif case == 'ambiguous':
                await alter(h, 2, full_name=auth_service.verify_token(token)['sub'])
            elif case == 'inactive':
                await alter(h, 1, is_active=False)
            elif case == 'deleted':
                await alter(h, 1, is_deleted=True)
            elif case in {'ip_mismatch', 'untrusted_forwarded_ip', 'same_ip', 'trusted_forwarded_ip'}:
                monkeypatch.setattr(settings, 'AUTH_ENFORCE_SAME_IP_PER_REQUEST', True)
                if case != 'same_ip':
                    ip = '192.0.2.99'
                if case in {'trusted_forwarded_ip', 'untrusted_forwarded_ip'}:
                    headers['X-Forwarded-For'] = '192.0.2.10'
                    monkeypatch.setattr(settings, 'AUTH_TRUST_X_FORWARDED_FOR', case == 'trusted_forwarded_ip')
                    # S7 治理：可信代理还须有可信网段；ws_connect 的 peer 是 192.0.2.99。
                    monkeypatch.setattr(
                        settings, 'AUTH_TRUSTED_PROXY_CIDRS',
                        '192.0.2.99/32' if case == 'trusted_forwarded_ip' else '',
                    )
                    monkeypatch.setattr(settings, 'AUTH_IP_HEADER_ORDER', 'X-Forwarded-For')
            elif case in {'revoked_query_valid_cookie', 'damaged_query_valid_cookie'}:
                fresh = await h.login('a')
                cookies[settings.ACCESS_TOKEN_COOKIE_NAME] = fresh['access_token']
                if case == 'damaged_query_valid_cookie':
                    token = 'synthetic-not-a-jwt'
            elif case in {'configured_cookie', 'legacy_cookie', 'ws_cookie', 'empty_query_cookie'}:
                monkeypatch.setattr(settings, 'ACCESS_TOKEN_COOKIE_NAME', 'synthetic_configured_cookie')
                name = {'legacy_cookie': 'access_token', 'ws_cookie': 'ws_access_token'}.get(case, settings.ACCESS_TOKEN_COOKIE_NAME)
                cookies[name] = token
                token = '' if case == 'empty_query_cookie' else None
            elif case == 'query_wins':
                cookies[settings.ACCESS_TOKEN_COOKIE_NAME] = (await h.login('b'))['access_token']
            elif case == 'owner_mismatch':
                owner = 2

            if case != 'missing_business_session':
                business.store[f'{handlers.CACHE_KEY_SESSION_PREFIX}:synthetic-session'] = {
                    'session_id': 'synthetic-session', 'owner_user_id': owner,
                    'status': handlers.SESSION_STATUS_READY, 'dap_port': 5678,
                    'runtime_mode': 'debug', 'ttl_seconds': 300, 'limits': {},
                }
            close_code = await ws_connect(h.app, endpoint, token=token, cookies=cookies, ip=ip, headers=headers)
            if case in INVALID:
                assert close_code == 4401
                assert business.reads == []
                assert business.client_reads == 0
                assert business.set_calls == []
                assert io_calls == []
            elif case in {'owner_mismatch', 'missing_business_session'}:
                assert close_code == (4403 if case == 'owner_mismatch' else 4404)
                assert len(business.reads) == 1
                assert io_calls == []
                assert business.client_reads == 0
            else:
                # Valid authentication reaches the backend boundary; no real backend IO.
                assert close_code == (4500 if endpoint == 'terminal' else 1011)
                assert len(business.reads) == 1
                # Cleanup now snapshots raw Redis bytes for CAS, not cache.get.
                session_key = f'{handlers.CACHE_KEY_SESSION_PREFIX}:synthetic-session'
                assert business.client.get_calls.count(session_key) == (0 if endpoint == 'terminal' else 1)
                assert io_calls == (['terminal_provider', 'terminal_attach'] if endpoint == 'terminal' else ['dap_bridge'])
            assert celery.calls == []
    asyncio.run(scenario())
