"""Real router/JWT/SQLite regressions for new families; no external services."""
import asyncio
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import select

from app.api.endpoints.auth import auth as api
from app.core import session_guard
from app.core.config import settings
from app.models import RefreshToken
from app.services.auth import verify_token
from test_logout_revocation_isolated import isolated  # noqa: F401


def test_new_login_and_rotation_share_one_family(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            payload = verify_token(pair['access_token'])
            assert payload.get('sf') == 1
            assert pair['refresh_token'].split('.')[1] == payload['sn']
            rotated = await h.refresh(pair, 200)
            assert rotated['refresh_token'] != pair['refresh_token']
            assert rotated['refresh_token'].split('.')[1] == payload['sn']
            assert verify_token(rotated['access_token'])['sn'] == payload['sn']
            await h.me(pair, 200)
            await h.me(rotated, 200)
            await h.logout(rotated)
            await h.me(pair, 401)
            await h.me(rotated, 401)
    asyncio.run(run())


def test_pg_commit_failure_preserves_session_and_allows_logout_retry(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            h.fail_commit = True
            await h.logout(pair, expected_status=503)
            h.fail_commit = False
            assert await h.revoked(pair) is False
            state = await session_guard.get_user_session(1)
            await h.me(pair, 200)
            rotated = await h.refresh(pair, 200)
            assert await session_guard.get_user_session(1) == state
            await h.logout(rotated)
            await h.me(rotated, 401)
            await h.refresh(rotated, 401)
    asyncio.run(run())


def test_pg_revocation_rejects_access_when_redis_write_failed(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            state = await session_guard.get_user_session(1)
            h.cache.fail_write = 'false'
            await h.logout(pair, expected_status=200)
            h.cache.fail_write = None
            assert await session_guard.get_user_session(1) == state
            assert await h.revoked(pair) is True
            await h.me(pair, 401)
            await h.refresh(pair, 401)
    asyncio.run(run())


def test_versioned_malformed_refresh_is_rejected(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            for token in ['ws1.', 'ws1.bad.random', 'ws1.' + 'a' * 22 + '.bad']:
                response = await h.request('POST', '/refresh', json={'refresh_token': token})
                assert response.status_code == 401
            await h.refresh(pair, 200)
    asyncio.run(run())


def test_cache_missing_recovery_preserves_new_family(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            nonce = verify_token(pair['access_token'])['sn']
            h.cache.data.pop(session_guard._key_user(1))
            rotated = await h.refresh(pair, 200)
            assert verify_token(rotated['access_token'])['sn'] == nonce
            await h.me(rotated, 200)
    asyncio.run(run())


def test_get_failure_does_not_recreate_family(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            old = await session_guard.get_user_session(1)
            h.cache.fail_read = True
            response = await h.request('POST', '/refresh', json={'refresh_token': pair['refresh_token']})
            assert response.status_code == 503
            h.cache.fail_read = False
            assert await session_guard.get_user_session(1) == old
            assert await h.revoked(pair) is False
            await h.refresh(pair, 200)
    asyncio.run(run())


def test_family_revocation_checks_stream_and_ws(isolated, monkeypatch):
    from app.db import database
    from app.core.stream_session import _session_is_live
    from app.api.pythonlab.ws.session_auth import verify_ws_session
    from starlette.requests import Request

    async def run():
        async with isolated() as h:
            monkeypatch.setattr(database, 'AsyncSessionLocal', h.db_factory)
            pair = await h.login()
            request = Request({'type': 'http', 'headers': [], 'client': ('192.0.2.10', 1234)})
            request.state.accepted_stream_session = (1, pair['access_token'])
            assert await _session_is_live(request)
            assert await verify_ws_session(pair['access_token'], 1, request)
            h.cache.fail_write = 'false'
            await h.logout(pair, expected_status=200)
            h.cache.fail_write = None
            assert not await _session_is_live(request)
            assert not await verify_ws_session(pair['access_token'], 1, request)
    asyncio.run(run())


def test_family_query_error_fails_closed(isolated, monkeypatch):
    from app.core import session_family

    async def fail(*args, **kwargs):
        raise RuntimeError('synthetic family SELECT failure')

    async def run():
        async with isolated() as h:
            pair = await h.login()
            with monkeypatch.context() as patch:
                patch.setattr(session_family, 'family_is_active', fail)
                await h.me(pair, 503)
            await h.me(pair, 200)
            await h.refresh(pair, 200)
    asyncio.run(run())


@pytest.mark.parametrize('marker', [True, '1', 0, 2, None])
def test_invalid_family_marker_does_not_downgrade(isolated, marker):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            payload = verify_token(pair['access_token'])
            payload['sf'] = marker
            forged = {**pair, 'access_token': api.create_access_token(payload)}
            await h.me(forged, 401)
            await h.me(pair, 200)
    asyncio.run(run())


@pytest.mark.parametrize('stored', [{}, {'nonce': ''}, {'nonce': None}, {'nonce': False}, {'nonce': 0}, {'nonce': 'bad'}])
def test_present_corrupt_session_cannot_recover_or_consume_refresh(isolated, stored):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            h.cache.data[session_guard._key_user(1)] = stored
            response = await h.request('POST', '/refresh', json={'refresh_token': pair['refresh_token']})
            assert response.status_code == 503
            assert h.cache.data[session_guard._key_user(1)] == stored
            assert await h.revoked(pair) is False
            async with h.db_factory() as db:
                assert len((await db.execute(select(RefreshToken))).scalars().all()) == 1
    asyncio.run(run())


def test_revoked_access_cannot_mask_independent_refresh_logout(isolated):
    async def run():
        async with isolated() as h:
            a, b = await h.login('a'), await h.login('b')
            h.cache.fail_write = 'false'
            await h.logout(a, expected_status=200)
            h.cache.fail_write = None
            # The old A nonce survives in Redis but PG has revoked A's family.
            await h.me(a, 401)
            await h.me(b, 200)
            await h.logout(b, token=a['access_token'])
            assert await h.revoked(b) is True
            await h.me(b, 401)
            await h.refresh(b, 401)
    asyncio.run(run())


@pytest.mark.parametrize('marker', [True, '1', 0, 2, None])
def test_invalid_family_marker_cannot_authorize_bearer_only_logout(isolated, marker):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            payload = verify_token(pair['access_token'])
            payload['sf'] = marker
            await h.logout(token=api.create_access_token(payload))
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
    asyncio.run(run())


def test_family_select_failure_logout_is_503_and_does_not_revoke(isolated, monkeypatch):
    async def fail(*args, **kwargs):
        raise RuntimeError('synthetic family query failure')
    async def run():
        async with isolated() as h:
            pair = await h.login()
            with monkeypatch.context() as patch:
                patch.setattr(api, 'verify_access_family', fail)
                await h.logout(token=pair['access_token'], expected_status=503)
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
    asyncio.run(run())


@pytest.mark.parametrize('case', ['literal_underscore', 'other_owner', 'expired', 'revoked', 'active'])
def test_durable_family_requires_literal_live_same_owner(isolated, case):
    from datetime import datetime, timedelta, timezone
    from app.core.session_family import family_is_active, new_family_refresh

    async def run():
        async with isolated() as h:
            nonce = 'A_' + 'b' * 20
            stored_nonce = nonce.replace('_', 'x') if case == 'literal_underscore' else nonce
            async with h.db_factory() as db:
                db.add(RefreshToken(
                    user_id=2 if case == 'other_owner' else 1,
                    token=new_family_refresh(stored_nonce),
                    is_revoked=case == 'revoked',
                    expires_at=datetime.now(timezone.utc) + timedelta(days=-1 if case == 'expired' else 1),
                ))
                await db.commit()
            async with h.db_factory() as db:
                assert await family_is_active(db, 1, nonce) is (case == 'active')
    asyncio.run(run())
