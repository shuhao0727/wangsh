"""Offline contract tests; real Redis CAS/ACL/race evidence is run in an isolated batch.

No database, Redis socket, dotenv loading or shared cache is requested by these
fixtures. Missing atomic support must never fall back to an unchecked write.
"""
import asyncio
import copy
import json

import pytest
from redis.exceptions import WatchError
from starlette.requests import Request

from app.core import session_guard as guard


class MemoryCache:
    def __init__(self, *, fail_binding=False):
        self.data = {}
        self.fail_binding = fail_binding

    async def get(self, key):
        return copy.deepcopy(self.data.get(key))

    async def set(self, key, value, expire_seconds=None):
        if self.fail_binding and ':ip:' in key:
            return False
        self.data[key] = copy.deepcopy(value)
        return True


def request():
    return Request({'type': 'http', 'headers': [], 'client': ('192.0.2.1', 1)})


@pytest.mark.parametrize('unique', [False, True])
def test_basic_cache_first_login_and_same_user_relogin(monkeypatch, unique):
    cache = MemoryCache()
    monkeypatch.setattr(guard, 'cache', cache)
    monkeypatch.setattr(guard.settings, 'AUTH_USER_UNIQUE_PER_IP', unique)
    monkeypatch.setattr(guard.settings, 'AUTH_TRUST_X_FORWARDED_FOR', False)

    async def run():
        first, ip = await guard.on_successful_login(1, request())
        second, _ = await guard.on_successful_login(1, request())
        assert first != second
        assert cache.data[guard._key_ip(ip)]['nonce'] == second
        assert cache.data[guard._key_user(1)]['nonce'] == second
    asyncio.run(run())


def test_binding_write_false_does_not_report_login_success(monkeypatch):
    monkeypatch.setattr(guard, 'cache', MemoryCache(fail_binding=True))
    monkeypatch.setattr(guard.settings, 'AUTH_USER_UNIQUE_PER_IP', True)
    with pytest.raises(RuntimeError, match='IP绑定'):
        asyncio.run(guard.on_successful_login(1, request()))


def test_cross_user_without_atomic_support_fails_closed(monkeypatch):
    cache = MemoryCache()
    cache.data[guard._key_ip('192.0.2.1')] = {'user_id': 1, 'nonce': 'old'}
    cache.data[guard._key_user(1)] = {'nonce': 'old', 'ip': '192.0.2.1'}
    monkeypatch.setattr(guard, 'cache', cache)
    monkeypatch.setattr(guard.settings, 'AUTH_USER_UNIQUE_PER_IP', True)
    monkeypatch.setattr(guard.settings, 'AUTH_TRUST_X_FORWARDED_FOR', False)
    with pytest.raises(RuntimeError, match='原子'):
        asyncio.run(guard.on_successful_login(2, request()))
    assert cache.data[guard._key_user(1)]['nonce'] == 'old'
    assert guard._key_user(2) not in cache.data


class Pipeline:
    def __init__(self, binding, session, *, conflict=False, result=None):
        self.values = [json.dumps(binding).encode(), json.dumps(session).encode()]
        self.conflict = conflict
        self.result = [True] if result is None else result
        self.watched = []
        self.writes = []
        self.executions = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def watch(self, *keys):
        self.watched.append(keys)

    async def mget(self, *keys):
        return self.values

    def multi(self):
        pass

    def set(self, key, value, *, ex):
        self.writes.append((key, json.loads(value), ex))

    async def execute(self):
        self.executions += 1
        if self.conflict:
            raise WatchError('synthetic concurrent change')
        return self.result


class AtomicCache(MemoryCache):
    def __init__(self, pipe):
        super().__init__()
        self.pipe = pipe

    async def get_client(self):
        return self

    def pipeline(self, *, transaction):
        assert transaction is True
        return self.pipe


@pytest.mark.parametrize('ttl', [31, 0, -1])
def test_cas_watches_both_keys_and_uses_existing_ttl(monkeypatch, ttl):
    binding = {'user_id': 1, 'nonce': 'old'}
    pipe = Pipeline(binding, {'nonce': 'old', 'ip': '192.0.2.1'})
    monkeypatch.setattr(guard, 'cache', AtomicCache(pipe))
    monkeypatch.setattr(guard.settings, 'AUTH_SESSION_TTL_SECONDS', ttl)
    expected_ttl = guard._session_ttl()
    asyncio.run(guard._rotate_current_ip_owner('192.0.2.1', binding))
    assert pipe.watched == [(guard._key_ip('192.0.2.1'), guard._key_user(1))]
    assert len(pipe.writes) == 1
    key, data, expiry = pipe.writes[0]
    assert key == guard._key_user(1) and data['nonce'] != 'old' and data['ip'] == ''
    assert expiry == expected_ttl


@pytest.mark.parametrize('current_binding,current_session', [
    ({'user_id': 2, 'nonce': 'old'}, {'nonce': 'old', 'ip': '192.0.2.1'}),
    ({'user_id': 1, 'nonce': 'new'}, {'nonce': 'old', 'ip': '192.0.2.1'}),
    ({'user_id': 1, 'nonce': 'old'}, {'nonce': 'new', 'ip': '192.0.2.1'}),
    ({'user_id': 1, 'nonce': 'old'}, {'nonce': 'old', 'ip': '192.0.2.2'}),
    (None, {'nonce': 'old', 'ip': '192.0.2.1'}),
    ({'user_id': 1, 'nonce': 'old'}, None),
])
def test_stale_or_expired_binding_never_writes(monkeypatch, current_binding, current_session):
    pipe = Pipeline(current_binding, current_session)
    monkeypatch.setattr(guard, 'cache', AtomicCache(pipe))
    asyncio.run(guard._rotate_current_ip_owner('192.0.2.1', {'user_id': 1, 'nonce': 'old'}))
    assert not pipe.writes and not pipe.executions


def test_repeated_cas_conflicts_fail_closed(monkeypatch):
    pipe = Pipeline({'user_id': 1, 'nonce': 'old'}, {'nonce': 'old', 'ip': '192.0.2.1'}, conflict=True)
    monkeypatch.setattr(guard, 'cache', AtomicCache(pipe))
    with pytest.raises(RuntimeError, match='并发'):
        asyncio.run(guard._rotate_current_ip_owner('192.0.2.1', {'user_id': 1, 'nonce': 'old'}))
    assert pipe.executions == 3


def test_failed_atomic_write_is_not_success(monkeypatch):
    pipe = Pipeline({'user_id': 1, 'nonce': 'old'}, {'nonce': 'old', 'ip': '192.0.2.1'}, result=[False])
    monkeypatch.setattr(guard, 'cache', AtomicCache(pipe))
    with pytest.raises(RuntimeError, match='服务端会话'):
        asyncio.run(guard._rotate_current_ip_owner('192.0.2.1', {'user_id': 1, 'nonce': 'old'}))
