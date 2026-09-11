"""Opt-in isolated Redis/Docker regression contracts, never normal services.

Requires this batch's guarded harness; ordinary pytest collection skips safely.
The harness disables dotenv/config/DB/broker and restricts Docker to exact IDs.
"""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
import uuid

import pytest

h = pytest.importorskip('sandbox_recovery_harness')
from app.tasks import pythonlab as tasks
from app.core.sandbox import docker as docker_api
from app.core.sandbox.docker_runtime import WorkspaceOwnership


@pytest.fixture
def env(monkeypatch):
    sid = uuid.uuid4().hex
    key = f'debug:session:{sid}'
    meta = {'session_id': sid, 'runtime_mode': 'plain', 'status': 'PENDING', 'ttl_seconds': 90}
    h.raw.set(key, json.dumps(meta))
    h.raw.set(key + ':code', json.dumps("print('isolated')"))
    h.client.before_write = h.client.ready_failure = None
    monkeypatch.setattr(tasks, '_run_async', asyncio.run)
    monkeypatch.setitem(tasks.celery_app.conf, 'task_always_eager', True)
    monkeypatch.setitem(tasks.celery_app.conf, 'task_store_eager_result', False)
    monkeypatch.setattr(docker_api, '_run_async', h.run_docker)
    provider = docker_api.DockerProvider()
    async def mount(ws): return ws
    monkeypatch.setattr(provider, '_resolve_host_mount_path', mount)
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    yield SimpleNamespace(sid=sid, key=key, meta=meta, provider=provider)
    h.client.before_write = h.client.ready_failure = None


def eager(env, task='task-a'):
    return tasks.start_session.apply(args=[env.sid], task_id=task, throw=False)


def read(env): return json.loads(h.raw.get(env.key))


def record(env):
    async def get():
        async with WorkspaceOwnership(Path(h.config.settings.PYTHONLAB_WORKSPACE_ROOT),
                                      env.provider._ws_path_for_session(env.meta)) as owner:
            return owner.read()
    return asyncio.run(get())


@pytest.mark.parametrize('replacement', ['TERMINATED', 'STARTING'])
def test_ready_cas_rejects_write_between_read_and_publish(env, replacement):
    initial = {**env.meta, 'status': 'STARTING', 'startup_task_id': 'task-a'}
    h.raw.set(env.key, json.dumps(initial))
    other = {**initial, 'status': replacement, 'startup_task_id': 'task-b', 'sentinel': ['keep', {}]}
    fired = []
    def race(method, data):
        if data.get('status') == 'READY' and not fired:
            fired.append(method)
            h.raw.set(env.key, json.dumps(other))
    h.client.before_write = race
    accepted = asyncio.run(tasks._save_start_outcome(env.sid, 'task-a', {'status': 'READY'}))
    assert fired
    assert accepted is False
    assert read(env) == other


@pytest.mark.parametrize('replacement', ['TERMINATED', 'STARTING'])
def test_initial_claim_cas_does_not_overwrite_stop_or_new_task(env, monkeypatch, replacement):
    provider = SimpleNamespace(start_session=AsyncMock(return_value={}))
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    other = {**env.meta, 'status': replacement, 'startup_task_id': 'task-b'}
    fired = []
    def race(method, data):
        if data.get('status') == 'STARTING' and data.get('startup_task_id') == 'task-a' and not fired:
            fired.append(method); h.raw.set(env.key, json.dumps(other))
    h.client.before_write = race
    eager(env)
    assert fired
    assert read(env) == other
    provider.start_session.assert_not_awaited()


def test_ready_persistent_transport_failure_compensates_real_owned_id(env):
    h.client.ready_failure = 'before'
    result = eager(env)
    assert result.state == 'FAILURE'
    assert read(env)['status'] == 'FAILED'
    journal = record(env)
    assert journal['phase'] == 'removed'
    assert h.verify(journal['container_id']) is None


def test_ready_committed_ack_lost_preserves_real_live_generation(env):
    h.client.ready_failure = 'after'
    result = eager(env)
    assert result.state == 'SUCCESS'
    meta = read(env)
    assert meta['status'] == 'READY'
    journal = record(env)
    assert meta['sandbox_owner_token'] == journal['token']
    assert journal['phase'] == 'live'
    assert h.verify(journal['container_id'])['State']['Running']
    assert 0 < h.raw.ttl(env.key) <= 90
    asyncio.run(env.provider.terminate_session(env.sid, meta))
    assert h.verify(journal['container_id']) is None


@pytest.mark.parametrize('state', ['running', 'exited'])
def test_removed_journal_cannot_adopt_external_same_name_from_writable_meta(env, state):
    # Build/remove our own generation. Then simulate an unrelated replacement,
    # also created by the harness with the same unique batch label (not a real user's resource).
    owned = asyncio.run(env.provider.start_session(env.sid, 'print(1)', env.meta))
    old_id = owned['docker_container_id']
    creation = list(h.manifest['containers'][old_id]['creation_command'])
    asyncio.run(env.provider.terminate_session(env.sid, {**env.meta, **owned}))
    assert record(env)['phase'] == 'removed'
    ws = env.provider._ws_path_for_session(env.meta)
    ws.mkdir(parents=True, exist_ok=True)
    (ws/'meta.json').write_text(json.dumps({'session_id': env.sid}))
    (ws/'main.py').write_text('external replacement sentinel')
    # Strip harness flags; wrapper re-applies them. Use fresh dedicated cidfile.
    for flag in ['--pull', '--label']:
        index = creation.index(flag); del creation[index:index+2]
    creation[creation.index('--cidfile')+1] = str(h.RUN / ('replacement-' + env.sid + '.cid'))
    if state == 'exited': creation[-1] = 'exit 0'
    rc, cid, _ = asyncio.run(h.run_docker(['docker', *creation]))
    assert rc == 0
    before = record(env)
    rejected = False
    try:
        asyncio.run(env.provider.start_session(env.sid, 'MUST NOT WRITE', env.meta))
    except RuntimeError:
        rejected = True
    assert rejected
    assert h.verify(cid) is not None
    assert record(env) == before
    assert (ws/'main.py').read_text() == 'external replacement sentinel'


def test_stale_compensation_does_not_remove_adopted_generation(env):
    first = asyncio.run(env.provider.start_session(env.sid, 'print(1)', env.meta))
    h.raw.set(env.key, json.dumps({**env.meta, 'status': 'TERMINATED'}))
    next_meta = {**env.meta, 'startup_task_id': 'new-task'}
    next_sid = env.sid + '-next'
    second = asyncio.run(env.provider.start_session(next_sid, 'print(2)', next_meta))
    assert first['docker_container_id'] == second['docker_container_id']
    assert first['sandbox_owner_token'] != second['sandbox_owner_token']
    asyncio.run(env.provider.terminate_session(env.sid, {**env.meta, **first}))
    assert h.verify(second['docker_container_id']) is not None
    asyncio.run(env.provider.terminate_session(next_sid, {**next_meta, **second}))
    assert h.verify(second['docker_container_id']) is None


def test_two_readers_racing_real_redis_have_only_one_ready_winner(env):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    initial = {**env.meta, 'status': 'STARTING', 'startup_task_id': 'task-a',
               'large_integer': 2**62 + 123, 'empty': {}, 'nested': ['unchanged']}
    h.raw.set(env.key, json.dumps(initial))
    barrier = Barrier(2)
    def race(method, data):
        if data.get('status') == 'READY': barrier.wait(timeout=5)
    h.client.before_write = race
    def contender(index):
        return asyncio.run(tasks._save_start_outcome(env.sid, 'task-a', {'status': 'READY', 'winner': index}))
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(contender, [0, 1]))
    assert sorted(outcomes) == [False, True]
    current = read(env)
    assert current['winner'] == outcomes.index(True)
    assert current['large_integer'] == initial['large_integer']
    assert current['empty'] == {} and current['nested'] == ['unchanged']
    assert 0 < h.raw.ttl(env.key) <= 90


def test_recovery_read_outage_preserves_real_resource_without_blind_retry(env, monkeypatch):
    original = tasks._read_start_snapshot
    async def read_or_outage(sid):
        if h.client.ready_failure:
            raise ConnectionError('Injected reconciliation read outage')
        return await original(sid)
    monkeypatch.setattr(tasks, '_read_start_snapshot', read_or_outage)
    start = env.provider.start_session
    calls = []
    async def create_then_fail(*args):
        result = await start(*args)
        calls.append(result)
        h.client.ready_failure = 'before'
        return result
    monkeypatch.setattr(env.provider, 'start_session', create_then_fail)
    result = eager(env)
    assert result.state == 'FAILURE'
    assert len(calls) == 1
    assert record(env)['phase'] == 'live'
    assert h.verify(calls[0]['docker_container_id']) is not None
    # A total Redis outage remains an explicit recovery boundary, not a claim
    # that the resource is safe to delete. Harness cleanup is separately logged.


def test_generation_cleanup_failure_remains_visible_and_is_not_retried(env, monkeypatch):
    async def failed_remove(cmd, timeout_s=30):
        if cmd[:2] == ['docker', 'rm']:
            return 1, '', 'Injected exact-ID removal denial'
        return await h.run_docker(cmd, timeout_s)
    monkeypatch.setattr(docker_api, '_run_async', failed_remove)
    h.client.ready_failure = 'before'
    result = eager(env)
    assert result.state == 'FAILURE'
    assert read(env)['status'] == 'FAILED'
    journal = record(env)
    assert journal['phase'] == 'deleting'
    assert h.verify(journal['container_id']) is not None
    assert len([v for v in h.manifest['containers'].values() if v['name'].endswith(env.sid)]) == 1


@pytest.mark.parametrize('failures', [1, 3])
def test_pre_resource_transient_retries_still_work_with_cas(env, monkeypatch, failures):
    provider = SimpleNamespace(start_session=AsyncMock(side_effect=
        [TimeoutError('before any resource')] * failures + [{'docker_container_id': 'synthetic-no-resource'}]))
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    result = eager(env)
    assert provider.start_session.await_count == (2 if failures == 1 else 3)
    assert result.state == ('SUCCESS' if failures == 1 else 'FAILURE')
    assert read(env)['status'] == ('READY' if failures == 1 else 'FAILED')


def test_cas_loser_preserves_same_generation_ready_written_by_peer(env):
    fired = []
    def peer_publish(method, data):
        if data.get('status') == 'READY' and not fired:
            fired.append(method)
            # A second Redis writer commits exactly this generation before our
            # CAS. Our false outcome must not delete the now-published resource.
            h.raw.set(env.key, json.dumps(data))
    h.client.before_write = peer_publish
    result = eager(env)
    assert fired
    assert result.state == 'SUCCESS'
    meta = read(env)
    assert meta['status'] == 'READY'
    assert record(env)['phase'] == 'live'
    assert h.verify(meta['docker_container_id']) is not None
    asyncio.run(env.provider.terminate_session(env.sid, meta))
