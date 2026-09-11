"""Offline ownership counterexamples, not worker/Redis/Docker E2E evidence."""
import asyncio
from copy import deepcopy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.core.sandbox import docker as docker_api
from app.core.sandbox import docker_runtime
from app.tasks import pythonlab as tasks
from test_sandbox_start_recovery import (  # Reuse isolated, self-contained fixtures.
    _REAL_GET_START_META,
    apply_start,
    docker_env,
    task_env,
)


@pytest.fixture
def ownership_env(task_env, docker_env, monkeypatch):
    store, _, _ = task_env
    provider, meta, ws, state, calls = docker_env
    store.update(meta)
    template = deepcopy(state['info'])
    state['info'] = None
    live_ids = set()
    original_run = docker_api._run_async

    async def run(cmd, timeout_s=30):
        # Unlike an argv-only fake, model successful creation/removal and reuse.
        rc, out, err = await original_run(cmd, timeout_s=timeout_s)
        if cmd[:2] == ['docker', 'run'] and rc == 0:
            out = state.get('next_id', out.strip())
            if '--cidfile' in cmd:
                from pathlib import Path
                Path(cmd[cmd.index('--cidfile') + 1]).write_text(out)
            state['info'] = deepcopy(template)
            state['info']['Id'] = out.strip()
            live_ids.add(out.strip())
        if cmd[:2] == ['docker', 'rm'] and rc == 0:
            target = cmd[-1]
            if target == provider._container_name(meta) and state['info']:
                target = state['info']['Id']
            live_ids.discard(target)
            if state['info'] and state['info']['Id'] == target:
                state['info'] = None
        return rc, out, err

    monkeypatch.setattr(docker_api, '_run_async', run)
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    return store, provider, meta, ws, state, calls, live_ids


def _create_unpublished_then_adopt(env, monkeypatch):
    store, provider, meta, ws, _, _, live_ids = env
    original = provider.start_session

    # Simulate worker death after provider return, before task finalization.
    # Normal rejected publication now compensates; a crash still needs a safe adopter.
    asyncio.run(original('synthetic', 'old owner code', store))
    store['status'] = 'TERMINATED'
    assert 'docker_container_id' not in store
    assert live_ids == {'b' * 64}
    newer = dict(meta, session_id='newer', status='STARTING', startup_task_id='newer-task')
    result = asyncio.run(provider.start_session('newer', 'new owner code', newer))
    newer.update(result, status='READY')
    assert newer['docker_container_id'] == 'b' * 64  # Real provider reuse branch.
    assert json.loads((ws/'meta.json').read_text())['session_id'] == 'newer'
    return newer


@pytest.mark.parametrize('fault', ['get-client', 'members', 'session-read', 'missing-meta', 'invalid-meta'])
@pytest.mark.parametrize('force', [False, True])
def test_old_stop_preserves_adopted_container_when_ownership_query_is_uncertain(
    ownership_env, monkeypatch, fault, force,
):
    env = ownership_env
    store, _, _, ws, _, calls, live_ids = env
    newer = _create_unpublished_then_adopt(env, monkeypatch)
    saved, removed_members = [], []

    async def get_meta(key):
        if key.endswith(':synthetic'):
            return deepcopy(store)
        # Model the normal facade's transport-error downgrade to cache miss.
        if fault in {'session-read', 'missing-meta'}:
            return None
        if fault == 'invalid-meta':
            return 'not-a-session'
        return deepcopy(newer)

    async def raw_get(key):
        if fault == 'session-read':
            raise ConnectionError('synthetic session lookup unavailable')
        value = await get_meta(key)
        return json.dumps(value) if value is not None else None

    async def members(_key):
        if fault == 'members':
            raise ConnectionError('synthetic membership lookup unavailable')
        return {b'synthetic', b'newer'}

    async def srem(key, sid):
        removed_members.append((key, sid))

    client = SimpleNamespace(get=raw_get, smembers=members, srem=srem)

    async def get_client():
        if fault == 'get-client':
            raise ConnectionError('synthetic client unavailable')
        return client

    async def save_meta(sid, meta):
        saved.append((sid, deepcopy(meta)))

    monkeypatch.setattr(tasks, 'cache', SimpleNamespace(get=get_meta, get_client=get_client))
    monkeypatch.setattr(tasks, '_get_start_meta', _REAL_GET_START_META)
    monkeypatch.setattr(tasks, '_set_session_meta', save_meta)
    tasks.stop_session.run('synthetic', force=force)
    assert live_ids == {newer['docker_container_id']}
    assert (ws/'main.py').read_text() == 'new owner code'
    assert not any(c[1] in {'rm', 'exec'} for c in calls)
    assert saved[-1][1]['status'] == 'TERMINATED'
    assert all(sid == 'synthetic' for _, sid in removed_members)


@pytest.mark.parametrize('status, expected', [
    ('READY', True), ('RUNNING', True), ('TERMINATING', True),
    (None, True), ('', True), ('unrecognized', True),
    ('TERMINATED', False), ('FAILED', False),
])
def test_definitive_owner_lookup_preserves_active_and_terminal_controls(monkeypatch, status, expected):
    client = SimpleNamespace(
        smembers=AsyncMock(return_value={b'synthetic', b'newer'}),
        get=AsyncMock(return_value=json.dumps({'status': status})),
    )
    monkeypatch.setattr(tasks, 'cache', SimpleNamespace(
        get_client=AsyncMock(return_value=client), get=AsyncMock(return_value={'status': status}),
    ))
    assert asyncio.run(tasks._owner_has_other_active_session(701, 'synthetic')) is expected


@pytest.mark.parametrize('marker', ['missing', 'terminated', 'other-task'])
def test_successful_create_is_not_left_unregistered_after_marker_loss(ownership_env, monkeypatch, marker):
    store, provider, _, _, _, _, live_ids = ownership_env
    original = provider.start_session

    async def start(*args):
        result = await original(*args)
        if marker == 'missing':
            store.clear()
        elif marker == 'terminated':
            store['status'] = 'TERMINATED'
        else:
            store.update(status='STARTING', startup_task_id='newer-task')
        return result

    monkeypatch.setattr(provider, 'start_session', start)
    assert apply_start().state == 'SUCCESS'
    # Stronger post-repair contract: compensate, do not overwrite the winner
    # just to make the original metadata-ID assertion pass.
    assert not live_ids
    assert 'docker_container_id' not in store
    if marker == 'missing':
        assert store == {}
    elif marker == 'terminated':
        assert store['status'] == 'TERMINATED'
    else:
        assert store['status'] == 'STARTING'
        assert store['startup_task_id'] == 'newer-task'
    assert not ownership_env[3].exists()


def test_counterexample_id_only_compensation_would_delete_new_adopter(ownership_env, monkeypatch):
    # This tests a rejected repair, NOT a claim that startup currently compensates.
    env = ownership_env
    newer = _create_unpublished_then_adopt(env, monkeypatch)
    live_ids = env[-1]
    assert live_ids == {'b' * 64}
    asyncio.run(docker_runtime.remove_owned_container(docker_api._run_async, 'b' * 64))
    assert newer['status'] == 'READY'
    assert newer['docker_container_id'] not in live_ids


@pytest.mark.parametrize('adoption', ['reuse', 'replacement'])
def test_stop_owner_check_to_delete_interleaving_preserves_new_session(ownership_env, monkeypatch, adoption):
    env = ownership_env
    store, provider, meta, ws, state, _, live_ids = env
    # The old task DID publish its token. A stale token must be rejected just
    # as safely as the tokenless crashed-start cases above.
    original = provider.start_session
    assert apply_start().state == 'SUCCESS'
    assert store['docker_container_id'] == 'b' * 64
    store['status'] = 'TERMINATED'
    newer = dict(meta, session_id='newer', status='STARTING', startup_task_id='newer-task')
    # Actual helper sees a valid empty membership snapshot, then a new start wins.
    async def get_client():
        return SimpleNamespace(smembers=AsyncMock(return_value=set()), srem=AsyncMock())

    real_terminate = provider.terminate_session

    async def interleaved_terminate(*args):
        if adoption == 'replacement':
            await docker_api._run_async(['docker', 'rm', '-f', 'b' * 64])
            state['next_id'] = 'c' * 64
        newer.update(await original('newer', 'new owner code', newer), status='READY')
        await real_terminate(*args)

    monkeypatch.setattr(tasks, 'cache', SimpleNamespace(get_client=get_client))
    monkeypatch.setattr(tasks, '_get_session_meta', AsyncMock(side_effect=lambda _: deepcopy(store)))
    monkeypatch.setattr(tasks, '_set_session_meta', AsyncMock())
    monkeypatch.setattr(provider, 'terminate_session', interleaved_terminate)
    tasks.stop_session.run('synthetic', force=True)
    assert newer['status'] == 'READY'
    assert newer['docker_container_id'] in live_ids
    assert (ws/'main.py').read_text() == 'new owner code'


@pytest.mark.parametrize('force', [False, True])
def test_definitive_empty_owner_index_still_allows_stop(ownership_env, monkeypatch, force):
    store, _, _, ws, _, calls, live_ids = ownership_env
    assert apply_start().state == 'SUCCESS'
    client = SimpleNamespace(smembers=AsyncMock(return_value={b'synthetic'}), srem=AsyncMock())
    monkeypatch.setattr(tasks, 'cache', SimpleNamespace(get_client=AsyncMock(return_value=client)))
    monkeypatch.setattr(tasks, '_get_session_meta', AsyncMock(side_effect=lambda _: deepcopy(store)))
    saved = AsyncMock()
    monkeypatch.setattr(tasks, '_set_session_meta', saved)
    tasks.stop_session.run('synthetic', force=force)
    assert not live_ids
    assert len([cmd for cmd in calls if cmd[1] == 'rm']) == 1
    assert saved.await_args.args[1]['status'] == 'TERMINATED'
    assert ws.exists() is (not force)


@pytest.mark.parametrize('error', [TimeoutError, asyncio.CancelledError])
@pytest.mark.parametrize('already_exited', [False, True])
def test_cli_timeout_or_cancellation_kills_and_reaps(monkeypatch, error, already_exited):
    process = SimpleNamespace(
        communicate=AsyncMock(side_effect=error()),
        kill=Mock(side_effect=ProcessLookupError() if already_exited else None),
        wait=AsyncMock(), returncode=None,
    )
    monkeypatch.setattr(asyncio, 'create_subprocess_exec', AsyncMock(return_value=process))
    with pytest.raises(error):
        asyncio.run(docker_runtime.run_async(['synthetic-cli'], timeout_s=1))
    process.kill.assert_called_once_with()
    process.wait.assert_awaited_once_with()


def test_rejected_publication_compensation_preserves_actual_adopter(ownership_env, monkeypatch):
    store, provider, meta, ws, _, calls, live_ids = ownership_env
    original = provider.start_session
    newer = dict(meta, session_id='newer', startup_task_id='newer-task')
    tokens = []

    async def interleaved_start(*args):
        created = await original(*args)
        tokens.append(created['sandbox_owner_token'])
        store['status'] = 'TERMINATED'
        newer.update(await original('newer', 'adopted code', newer), status='READY')
        return created  # Old task now attempts real compensating terminate.

    monkeypatch.setattr(provider, 'start_session', interleaved_start)
    assert apply_start().state == 'SUCCESS'
    assert live_ids == {newer['docker_container_id']}
    assert newer['sandbox_owner_token'] != tokens[0]
    assert (ws / 'main.py').read_text() == 'adopted code'
    assert not any(c[1] in {'rm', 'exec'} for c in calls)
    assert store['status'] == 'TERMINATED'
    assert 'docker_container_id' not in store


def test_journal_registers_id_before_readiness_and_outlives_marker(ownership_env, monkeypatch):
    store, provider, _, ws, _, _, live_ids = ownership_env
    observed = []
    journal = docker_runtime.WorkspaceOwnership(docker_api._workspace_root(), ws)

    async def readiness(container_id, *_):
        record = json.loads(journal.record_path.read_text())
        assert record['container_id'] == container_id
        assert record['session_id'] == 'synthetic'
        assert record['startup_task_id'] == 'synthetic-task'
        assert record['phase'] == 'live'
        assert record['token']
        assert not journal.record_path.is_relative_to(ws)
        observed.append(record)

    monkeypatch.setattr(provider, '_wait_for_readiness', readiness)
    assert apply_start().state == 'SUCCESS'
    store.clear()  # Expiry/crash cannot erase the trusted resource journal.
    assert {r['container_id'] for r in observed} == live_ids
    assert json.loads(journal.record_path.read_text()) == observed[0]


def test_failed_compensation_is_failure_and_blocks_adoption(ownership_env, monkeypatch):
    store, provider, meta, ws, state, calls, live_ids = ownership_env
    original = provider.start_session

    async def cancelled(*args):
        created = await original(*args)
        store['status'] = 'TERMINATED'
        state['cleanup_failure'] = True
        return created

    monkeypatch.setattr(provider, 'start_session', cancelled)
    result = apply_start()
    assert result.state == 'FAILURE'
    assert store['status'] == 'TERMINATED'
    assert live_ids == {'b' * 64}
    journal = docker_runtime.WorkspaceOwnership(docker_api._workspace_root(), ws)
    assert json.loads(journal.record_path.read_text())['phase'] == 'deleting'
    with pytest.raises(RuntimeError, match='归属状态'):
        asyncio.run(original('newer', 'must not write', dict(meta, session_id='newer')))
    assert sum(c[1] == 'run' for c in calls) == 1
    assert sum(c[1] == 'rm' for c in calls) == 1
    assert (ws / 'main.py').read_text() != 'must not write'


@pytest.mark.parametrize('cancel', [False, True])
def test_nonexpiring_fence_prevents_adoption_during_inflight_delete(ownership_env, monkeypatch, cancel):
    store, provider, meta, ws, state, calls, live_ids = ownership_env
    assert apply_start().state == 'SUCCESS'
    old = deepcopy(store)
    original_run = docker_api._run_async
    original_start = provider.start_session
    newer = dict(meta, session_id='newer', startup_task_id='newer-task')

    async def schedule():
        entered, release = asyncio.Event(), asyncio.Event()

        async def paused_rm(cmd, timeout_s=30):
            if cmd[:3] == ['docker', 'rm', '-f']:
                entered.set()
                await release.wait()
            return await original_run(cmd, timeout_s=timeout_s)

        monkeypatch.setattr(docker_api, '_run_async', paused_rm)
        stopping = asyncio.create_task(provider.terminate_session('synthetic', old))
        await asyncio.wait_for(entered.wait(), timeout=1)
        state['next_id'] = 'c' * 64
        starting = asyncio.create_task(original_start('newer', 'new concurrent code', newer))
        # A no-op Redis lock in docker_env models a lost/expired lease. The real
        # OS fence must exclude the contender during an arbitrary Docker await.
        await asyncio.sleep(0.04)
        assert not starting.done()
        assert sum(c[1] == 'run' for c in calls) == 1
        assert (ws / 'main.py').read_text() != 'new concurrent code'
        if cancel:
            stopping.cancel()
            with pytest.raises(asyncio.CancelledError):
                await stopping
            with pytest.raises(RuntimeError, match='归属状态'):
                await asyncio.wait_for(starting, timeout=1)
            assert live_ids == {'b' * 64}
        else:
            release.set()
            await asyncio.wait_for(stopping, timeout=1)
            newer.update(await asyncio.wait_for(starting, timeout=1))
            assert live_ids == {'c' * 64}
            assert (ws / 'main.py').read_text() == 'new concurrent code'
            assert newer['sandbox_owner_token'] != old['sandbox_owner_token']
            await provider.terminate_session('synthetic', old)
            assert live_ids == {'c' * 64}

    asyncio.run(schedule())


def test_same_session_recreation_fences_old_generation(ownership_env):
    store, provider, _, ws, state, _, live_ids = ownership_env
    assert apply_start().state == 'SUCCESS'
    old = deepcopy(store)
    asyncio.run(provider.terminate_session('synthetic', old))
    state['next_id'] = 'c' * 64
    replacement = asyncio.run(provider.start_session('synthetic', 'same session new resource', old))
    assert replacement['sandbox_owner_token'] != old['sandbox_owner_token']
    asyncio.run(provider.terminate_session('synthetic', old))
    assert live_ids == {'c' * 64}
    assert (ws / 'main.py').read_text() == 'same session new resource'


def test_mutable_workspace_metadata_is_not_delete_authority(ownership_env, monkeypatch):
    store, provider, meta, ws, _, _, live_ids = ownership_env
    assert apply_start().state == 'SUCCESS'
    old = deepcopy(store)
    store['status'] = 'TERMINATED'
    newer = dict(meta, session_id='newer', startup_task_id='newer-task')
    newer.update(asyncio.run(provider.start_session('newer', 'adopted code', newer)))
    (ws / 'meta.json').write_text(json.dumps(old))  # Writable by sandbox UID.
    asyncio.run(provider.terminate_session('synthetic', old))
    assert live_ids == {newer['docker_container_id']}
    assert (ws / 'main.py').read_text() == 'adopted code'


def test_caller_workspace_path_cannot_redirect_deletion(ownership_env, tmp_path):
    store, provider, _, ws, _, _, live_ids = ownership_env
    assert apply_start().state == 'SUCCESS'
    unrelated = tmp_path / 'not-pythonlab-owned'
    unrelated.mkdir()
    (unrelated / 'keep.txt').write_text('keep')
    asyncio.run(provider.terminate_session('synthetic', dict(store, workspace_path=str(unrelated))))
    assert (unrelated / 'keep.txt').read_text() == 'keep'
    assert not live_ids
    assert not ws.exists()


def test_workspace_fence_timeout_cancel_and_release_preserve_inode(tmp_path):
    async def schedule():
        root, ws = tmp_path, tmp_path / 'u1'
        first = docker_runtime.WorkspaceOwnership(root, ws)
        async with first:
            inode = first.lock_path.stat().st_ino
            blocked = docker_runtime.WorkspaceOwnership(root, ws, timeout=0.02)
            with pytest.raises(TimeoutError):
                async with blocked:
                    pytest.fail('entered conflicting claim')
            assert blocked.fd is None
            cancelled = docker_runtime.WorkspaceOwnership(root, ws)
            waiter = asyncio.create_task(cancelled.__aenter__())
            await asyncio.sleep(0.02)
            waiter.cancel()
            with pytest.raises(asyncio.CancelledError):
                await waiter
            assert cancelled.fd is None
        async with docker_runtime.WorkspaceOwnership(root, ws) as successor:
            assert successor.lock_path.stat().st_ino == inode
            record = successor.claim('session', {}, 'synthetic-name', 'precise-id')
            assert successor.read() == record
            assert successor.owns(record, 'session', {
                'sandbox_owner_token': record['token'], 'docker_container_id': 'precise-id',
            })
            assert not successor.owns(record, 'session', {'docker_container_id': 'precise-id'})
    asyncio.run(schedule())


def test_cancelled_create_without_cid_stays_blocked_and_stop_cannot_unlock(ownership_env, monkeypatch):
    _, provider, meta, ws, _, calls, live_ids = ownership_env
    original_run = docker_api._run_async

    async def unknown_create(cmd, timeout_s=30):
        if cmd[:2] == ['docker', 'run']:
            calls.append(list(cmd))
            # Cancellation before the CLI returns/writes its cid does not prove
            # that the daemon did not create a resource. Do not guess by name.
            raise asyncio.CancelledError()
        return await original_run(cmd, timeout_s=timeout_s)

    monkeypatch.setattr(docker_api, '_run_async', unknown_create)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(provider.start_session('synthetic', 'cancelled code', meta))
    journal = docker_runtime.WorkspaceOwnership(docker_api._workspace_root(), ws)
    record = json.loads(journal.record_path.read_text())
    assert record['phase'] == 'creating'
    assert record['container_id'] is None
    for _ in range(2):
        with pytest.raises(RuntimeError, match='归属状态'):
            asyncio.run(provider.start_session('synthetic', 'retry must not write', meta))
        asyncio.run(provider.terminate_session('synthetic', dict(
            meta, sandbox_owner_token=record['token'], docker_container_id=None,
        )))
    assert json.loads(journal.record_path.read_text()) == record
    assert (ws / 'main.py').read_text() == 'cancelled code'
    assert sum(c[1] == 'run' for c in calls) == 1
    assert not any(c[1] == 'rm' for c in calls)
    assert live_ids == set()  # Synthetic daemon only; real outcome stays unknown.


def test_failed_delete_does_not_automatically_recover_even_with_original_token(ownership_env):
    store, provider, meta, ws, state, calls, live_ids = ownership_env
    assert apply_start().state == 'SUCCESS'
    state['cleanup_failure'] = True
    with pytest.raises(RuntimeError, match='清理失败'):
        asyncio.run(provider.terminate_session('synthetic', store))
    journal = docker_runtime.WorkspaceOwnership(docker_api._workspace_root(), ws)
    record = json.loads(journal.record_path.read_text())
    assert record['phase'] == 'deleting'
    state['cleanup_failure'] = False
    asyncio.run(provider.terminate_session('synthetic', store))
    with pytest.raises(RuntimeError, match='归属状态'):
        asyncio.run(provider.start_session('newer', 'must not write', meta))
    assert json.loads(journal.record_path.read_text()) == record
    assert live_ids == {'b' * 64}
    assert sum(c[1] == 'rm' for c in calls) == 1


@pytest.mark.parametrize('with_journal', [False, True])
def test_tokenless_stop_retains_legacy_and_current_generations(ownership_env, with_journal):
    store, provider, meta, ws, state, calls, live_ids = ownership_env
    if with_journal:
        assert apply_start().state == 'SUCCESS'
        legacy = dict(store)
        legacy.pop('sandbox_owner_token')
    else:
        # Pre-upgrade running container; no trusted ownership record exists.
        state['info'] = {'Id': 'a' * 64, 'State': {'Status': 'running'}}
        live_ids.add('a' * 64)
        legacy = dict(meta, docker_container_id='a' * 64)
    before_ids = set(live_ids)
    original_code = (ws / 'main.py').read_text()
    asyncio.run(provider.stop_session('synthetic', legacy))
    asyncio.run(provider.terminate_session('synthetic', legacy))
    assert live_ids == before_ids
    assert (ws / 'main.py').read_text() == original_code
    assert not any(c[1] in {'rm', 'exec'} for c in calls)


@pytest.mark.parametrize('with_journal', [False, True])
def test_cleanup_orphans_fake_meta_retains_resources(ownership_env, monkeypatch, with_journal):
    store, provider, meta, ws, state, calls, live_ids = ownership_env
    if with_journal:
        assert apply_start().state == 'SUCCESS'
    else:
        state['info'] = {'Id': 'a' * 64, 'State': {'Status': 'running'}}
        live_ids.add('a' * 64)
    original_run = docker_api._run_async

    async def orphan_listing(cmd, timeout_s=30):
        if cmd[:2] == ['docker', 'ps']:
            calls.append(list(cmd))
            return 0, provider._container_name(meta) + '\n' + provider.container_namespace + '_legacy\n', ''
        return await original_run(cmd, timeout_s=timeout_s)

    monkeypatch.setattr(docker_api, '_run_async', orphan_listing)
    client = SimpleNamespace(scard=AsyncMock(return_value=0))
    monkeypatch.setattr(tasks.cache, 'get_client', AsyncMock(return_value=client))
    monkeypatch.setattr(tasks, '_get_session_meta', AsyncMock(return_value=None))
    before_ids = set(live_ids)
    original_code = (ws / 'main.py').read_text()
    result = tasks.cleanup_orphans.apply(throw=False)
    assert result.state == 'SUCCESS'  # Scheduler success is NOT resource recovery.
    client.scard.assert_awaited_once()
    assert live_ids == before_ids
    assert (ws / 'main.py').read_text() == original_code
    assert not any(c[1] in {'rm', 'exec'} for c in calls)


@pytest.mark.parametrize('status', ['running', 'exited', 'created'])
def test_external_replacement_does_not_overwrite_live_journal(ownership_env, status):
    store, provider, meta, ws, state, calls, live_ids = ownership_env
    assert apply_start().state == 'SUCCESS'
    journal = docker_runtime.WorkspaceOwnership(docker_api._workspace_root(), ws)
    record = journal.record_path.read_bytes()
    state['info']['Id'] = 'c' * 64
    state['info']['State']['Status'] = status
    live_ids.clear()
    live_ids.add('c' * 64)
    with pytest.raises(RuntimeError, match='外部替换'):
        asyncio.run(provider.start_session('newer', 'do not replace code', meta))
    assert live_ids == {'c' * 64}
    assert journal.record_path.read_bytes() == record
    assert not any(c[1] == 'rm' for c in calls)
    assert sum(c[1] == 'run' for c in calls) == 1
    assert (ws / 'main.py').read_text() != 'do not replace code'


@pytest.mark.parametrize('journal_state', ['missing', 'removed'])
@pytest.mark.parametrize('container_state', ['running', 'exited', 'created'])
def test_writable_legacy_meta_cannot_authorize_external_container(docker_env, journal_state, container_state):
    # Old positive fixtures inferred ownership from writable /workspace/meta.json.
    # New contract requires a host-only LIVE journal and exact container ID.
    # Even a matching session/name/meta cannot revive removed or absent authority.
    provider, meta, ws, state, calls = docker_env
    state['info']['State']['Status'] = container_state
    (ws / 'meta.json').write_text(json.dumps(dict(meta, docker_container_id='a' * 64)))
    journal = docker_runtime.WorkspaceOwnership(ws.parent, ws)

    async def prepare():
        async with journal:
            if journal_state == 'missing':
                journal.record_path.unlink()
            else:
                record = journal.read()
                record.update(phase='removed', session_id='synthetic')
                journal.write(record)
    asyncio.run(prepare())
    before = journal.record_path.read_bytes() if journal.record_path.exists() else None
    with pytest.raises(RuntimeError, match='可信 live 归属'):
        asyncio.run(provider.start_session('synthetic', 'must not write', meta))
    assert state['info']['Id'] == 'a' * 64
    assert (ws / 'main.py').read_text() == 'original active code'
    assert not any(c[1] in {'run', 'rm', 'exec'} for c in calls)
    assert (journal.record_path.read_bytes() if journal.record_path.exists() else None) == before
