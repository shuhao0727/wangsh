"""Independent cleanup race probes: actual ASGI/logout/Redis, DAP transport double.

Opt in via the isolated runner's exact private Redis socket; no Docker/debugpy.
"""
import asyncio
import json
from types import SimpleNamespace

import pytest

from app.api.pythonlab.ws import connection_auth, handlers
from test_logout_revocation_isolated import isolated  # noqa: F401
from test_pythonlab_v2_ws_behavior import FakeCeleryApp
from test_ws_revocation_isolated import ASGIWebSocketClient, auth_store


class CleanupBridge:
    gateway_seq = 0
    reader_task = flush_task = None
    attached_marked = True
    terminated_seen = closed = False

    def __init__(self, detach, preserve):
        self.detach = detach
        self.preserve = preserve
        self.attached = asyncio.Event()
        self.forwarded = []
        self.received = asyncio.Event()

    async def attach_client(self, *args, **kwargs):
        self.attached.set()

    async def handle_client_text(self, text):
        self.forwarded.append(json.loads(text)['seq'])
        self.received.set()

    async def detach_client(self, *args):
        await self.detach()

    def should_preserve_runtime(self):
        return self.preserve

    async def _send_output(self, text):
        pass


async def drive_cleanup(h, monkeypatch, cache, detach, preserve):
    h.app.include_router(handlers.router, prefix='/api/v2/pythonlab')
    monkeypatch.setattr(handlers, 'cache', cache)
    monkeypatch.setattr(handlers, 'celery_app', FakeCeleryApp())
    monkeypatch.setattr(connection_auth, 'REVOCATION_INTERVAL_SECONDS', 30)
    bridge = CleanupBridge(detach, preserve)

    async def factory(**kwargs):
        return bridge

    monkeypatch.setattr(handlers, '_get_or_create_dap_bridge', factory)
    pair = await h.login('a')
    initial = set(asyncio.all_tasks())
    async with ASGIWebSocketClient(h.app, 'ws', pair['access_token']) as ws:
        await asyncio.wait_for(bridge.attached.wait(), 2)
        ws.input('{"type":"request","command":"continue","seq":101}')
        await asyncio.wait_for(bridge.received.wait(), 2)
        await h.logout(pair)
        ws.input('{"type":"request","command":"continue","seq":102}')
        await ws.expect_revoked()
    await asyncio.sleep(0)
    assert bridge.forwarded == [101]
    assert not [t for t in asyncio.all_tasks() - initial if not t.done()]


@pytest.mark.parametrize('preserve', [False, True])
@pytest.mark.parametrize('change', ['terminated', 'new-owner', 'same-owner-revision', 'lease-only'])
def test_concurrent_cleanup_preserves_new_state(isolated, monkeypatch, preserve, change):
    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, 'redis') as cache:
            client = await cache.get_client()
            key = f'{handlers.CACHE_KEY_SESSION_PREFIX}:synthetic-session'
            lease = key + ':ws_owner'
            seed = {'owner_user_id': 1, 'status': 'READY', 'dap_port': 1234,
                    'ttl_seconds': 300, 'runtime_mode': 'debug', 'opaque': ['原样', 9007199254740993]}
            await cache.set(key, seed, expire_seconds=300)
            observed = SimpleNamespace()

            async def concurrent_writer():
                current = await cache.get(key)
                if change != 'lease-only':
                    current['revision'] = 'newer-generation'
                    current['status'] = 'TERMINATED' if change == 'terminated' else 'RUNNING'
                if change == 'new-owner':
                    current['debug_owner'] = {'conn_id': 'new-peer', 'state': 'active'}
                # Compact JSON also ensures the client compares actual raw bytes.
                observed.raw = (await client.get(key) if change == 'lease-only' else
                                json.dumps(current, ensure_ascii=False, separators=(',', ':')))
                await client.set(key, observed.raw, px=90000)
                if change != 'same-owner-revision':
                    await client.set(lease, '1:new-peer', px=60000)
                observed.lease = await client.get(lease)
                await asyncio.sleep(0)

            try:
                await drive_cleanup(h, monkeypatch, cache, concurrent_writer, preserve)
                result = {'change': change, 'preserve': preserve, 'meta': await client.get(key),
                          'lease': await client.get(lease), 'pttl': await client.pttl(key)}
                print('CLEANUP_RACE=' + json.dumps(result, ensure_ascii=False))
                assert result['meta'] == observed.raw
                expected_lease = None if change == 'same-owner-revision' else observed.lease
                assert result['lease'] == expected_lease
                assert 0 < result['pttl'] <= 90000
            finally:
                await client.delete(key, lease, key + ':ws_epoch')
    asyncio.run(scenario())


async def mutate_boundary(client, key, lease, case, original):
    if case == 'expired':
        await client.pexpire(key, 1)
        for _ in range(100):
            if not await client.exists(key):
                break
            await asyncio.sleep(.002)
        assert not await client.exists(key)
    elif case == 'deleted':
        await client.delete(key)
    elif case == 'wrongtype':
        await client.delete(key)
        await client.rpush(key, 'unique-list-sentinel')
        await client.pexpire(key, 45000)
    elif case == 'meta-at-eval':
        newer = json.loads(original)
        newer.update(status='RUNNING', revision='new-before-eval')
        await client.set(key, json.dumps(newer), px=45000)
    elif case == 'lease-at-eval':
        await client.set(lease, '1:new-peer', px=45000)


@pytest.mark.parametrize('case', [
    'unchanged', 'preserve', 'unattached', 'no-lease', 'binary',
    'terminated', 'terminating', 'failed', 'unknown', 'foreign-owner',
    'malformed', 'non-object', 'missing', 'expired', 'deleted', 'wrongtype',
    'snapshot-error', 'eval-error', 'detach-error', 'meta-at-eval', 'lease-at-eval',
])
def test_cleanup_atomic_redis_boundaries(isolated, monkeypatch, case):
    from app.api.pythonlab.ws.cleanup_state import cleanup_dap_connection

    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, 'redis') as cache:
            client = await cache.get_client()
            key = f'{handlers.CACHE_KEY_SESSION_PREFIX}:cleanup-boundary-{case}'
            lease = key + ':ws_owner'
            meta = {'status': 'STOPPED', 'revision': 'old', 'debug_owner':
                    {'conn_id': 'old-peer', 'state': 'active'},
                    'opaque': ['原样', 9007199254740993], 'ttl_seconds': 9999}
            if case in {'terminated', 'terminating', 'failed', 'unknown'}:
                meta['status'] = case.upper()
            if case == 'foreign-owner':
                meta['debug_owner']['conn_id'] = 'new-peer'
            raw = json.dumps(meta, ensure_ascii=False)
            raw = {'malformed': '{broken', 'non-object': '[]'}.get(case, raw)
            if case != 'missing':
                await client.set(key, raw, px=60000)
            if case != 'no-lease':
                await client.set(lease, '1:old-peer', px=60000)
            detached = []
            captured = {}

            async def detach():
                detached.append(True)
                if case == 'detach-error':
                    raise RuntimeError('synthetic detach failure')
                await mutate_boundary(client, key, lease, case, raw)

            class ClientBoundary:
                async def get(self, target):
                    if case == 'snapshot-error':
                        raise RuntimeError('synthetic snapshot failure')
                    value = await client.get(target)
                    return value.encode() if case == 'binary' and value else value

                async def eval(self, script, numkeys, *args):
                    if case == 'eval-error':
                        raise RuntimeError('synthetic Redis eval unavailable')
                    if case in {'meta-at-eval', 'lease-at-eval'}:
                        await mutate_boundary(client, key, lease, case, raw)
                    captured['type'] = await client.type(key)
                    captured['raw'] = await client.get(key) if captured['type'] == 'string' else None
                    return await client.eval(script, numkeys, *args)

            bridge = CleanupBridge(detach, case == 'preserve')
            bridge.attached_marked = case != 'unattached'
            try:
                changed = await cleanup_dap_connection(
                    ClientBoundary(), key, lease, '1:old-peer', 'old-peer', bridge,
                    lambda: 'synthetic-cleanup-timestamp',
                )
                result = {'case': case, 'changed': changed, 'type': await client.type(key),
                          'lease': await client.get(lease), 'pttl': await client.pttl(key)}
                print('CLEANUP_BOUNDARY=' + json.dumps(result))
                assert detached == [True]
                expected_lease = {'eval-error': '1:old-peer', 'lease-at-eval': '1:new-peer'}.get(case)
                assert result['lease'] == expected_lease
                if case in {'unchanged', 'preserve', 'unattached', 'no-lease', 'binary'}:
                    assert changed
                    after = json.loads(await client.get(key))
                    assert after['opaque'] == meta['opaque'] and after['revision'] == 'old'
                    assert after['status'] == ('STOPPED' if case in {'preserve', 'unattached'} else 'READY')
                    if case == 'preserve':
                        assert after['debug_owner']['state'] == 'detached'
                    else:
                        assert 'debug_owner' not in after
                    assert 0 < result['pttl'] <= 60000  # not ttl_seconds9999 refresh
                else:
                    assert not changed
                    if case in {'missing', 'expired', 'deleted'}:
                        assert result['type'] == 'none'
                    elif case == 'wrongtype':
                        assert await client.lrange(key, 0, -1) == ['unique-list-sentinel']
                        assert 0 < result['pttl'] <= 45000
                    else:
                        expected = captured['raw'] if case == 'meta-at-eval' else raw
                        assert await client.get(key) == expected
            finally:
                await client.delete(key, lease)
    asyncio.run(scenario())
