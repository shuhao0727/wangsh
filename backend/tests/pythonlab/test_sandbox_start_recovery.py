"""Offline startup recovery contracts; no broker/worker or Docker daemon needed."""
import asyncio
import json
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.sandbox import docker as docker_api
from app.core.sandbox import docker_runtime
from app.tasks import pythonlab as tasks


class AtomicStartStore:
    """Offline Redis protocol double; actual task GET/JSON/Lua call remain loaded.

    eval has no await between comparison and commit. Real Lua/Redis concurrency
    is covered separately by test_sandbox_state_recovery_atomic.py.
    """
    def __init__(self, store, writes):
        self.store, self.writes = store, writes

    async def get(self, key):
        if key.endswith(':code'):
            return json.dumps("print('synthetic')")
        assert key == 'debug:session:synthetic'
        return json.dumps(self.store, ensure_ascii=False) if self.store else None

    async def eval(self, script, numkeys, key, expected, replacement, ttl):
        assert numkeys == 1 and key == 'debug:session:synthetic'
        assert "redis.call('GET', KEYS[1]) ~= ARGV[1]" in script
        assert "redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])" in script
        assert ttl > 0
        raw = json.dumps(self.store, ensure_ascii=False) if self.store else None
        if raw != expected:
            return 0
        self.store.clear()
        self.store.update(json.loads(replacement))
        self.writes.append(deepcopy(self.store))
        return 1


@pytest.fixture
def task_env(monkeypatch):
    store = {'session_id': 'synthetic', 'owner_user_id': 701, 'status': 'PENDING', 'runtime_mode': 'plain'}
    writes = []
    client = AtomicStartStore(store, writes)
    provider = SimpleNamespace(
        start_session=AsyncMock(return_value={'docker_container_id': 'synthetic-id', 'sandbox_owner_token': 'synthetic-generation'}),
        terminate_session=AsyncMock(),
    )
    monkeypatch.setattr(tasks, 'cache', SimpleNamespace(get_client=AsyncMock(return_value=client)))
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    monkeypatch.setattr(tasks, '_run_async', asyncio.run)
    monkeypatch.setitem(tasks.celery_app.conf, 'task_always_eager', True)
    monkeypatch.setitem(tasks.celery_app.conf, 'task_store_eager_result', False)
    return store, writes, provider


def apply_start(**kwargs):
    # Invoke the registered real Celery task, not __wrapped__ or extracted source.
    return tasks.start_session.apply(args=['synthetic'], task_id='synthetic-task', throw=False, **kwargs)


@pytest.mark.parametrize('error', [TimeoutError('temporary'), ConnectionError('temporary')])
def test_transient_provider_failure_retries_to_ready(task_env, error):
    store, writes, provider = task_env
    provider.start_session.side_effect = [error, {'docker_container_id': 'synthetic-id'}]
    result = apply_start()
    assert result.state == 'SUCCESS'
    assert provider.start_session.await_count == 2
    assert store['status'] == 'READY'
    assert store['error_code'] is None
    assert any(m['status'] == 'PENDING' for m in writes)


def test_retry_exhaustion_is_failed_in_celery_and_business(task_env):
    store, _, provider = task_env
    provider.start_session.side_effect = TimeoutError('temporary')
    result = apply_start()
    assert provider.start_session.await_count == 3
    assert result.state == 'FAILURE'
    assert store['status'] == 'FAILED'


@pytest.mark.parametrize('error', [RuntimeError('invalid resource'), FileNotFoundError('docker unavailable'), PermissionError('workspace denied')])
def test_permanent_error_is_not_retried(task_env, error):
    store, _, provider = task_env
    provider.start_session.side_effect = error
    result = apply_start()
    assert provider.start_session.await_count == 1
    assert result.state == 'FAILURE'
    assert store['status'] == 'FAILED'


@pytest.mark.parametrize('status', ['READY', 'RUNNING', 'STOPPED', 'TERMINATING', 'TERMINATED', 'FAILED'])
def test_terminal_or_live_state_is_not_restarted(task_env, status):
    store, _, provider = task_env
    store['status'] = status
    apply_start()
    provider.start_session.assert_not_awaited()
    assert store['status'] == status


def test_cancel_during_start_is_not_overwritten(task_env):
    store, _, provider = task_env
    async def start(*_):
        store['status'] = 'TERMINATING'
        raise TimeoutError('temporary')
    provider.start_session.side_effect = start
    apply_start()
    assert provider.start_session.await_count == 1
    assert store['status'] == 'TERMINATING'


def test_retry_after_starting_write_lost_ack(task_env, monkeypatch):
    store, _, provider = task_env
    original = tasks._cas_start_meta
    failed = False
    async def flaky(sid, expected, meta):
        nonlocal failed
        result = await original(sid, expected, meta)
        if not failed and meta['status'] == 'STARTING':
            failed = True
            raise ConnectionError('write committed; acknowledgment lost')
        return result
    monkeypatch.setattr(tasks, '_cas_start_meta', flaky)
    result = apply_start()
    assert result.state == 'SUCCESS'
    assert provider.start_session.await_count == 1
    assert store['status'] == 'READY'


def test_command_timeout_preserves_type_and_reaps_child(monkeypatch):
    process = SimpleNamespace(returncode=None, communicate=AsyncMock(side_effect=TimeoutError()), kill=lambda: None, wait=AsyncMock())
    monkeypatch.setattr(asyncio, 'create_subprocess_exec', AsyncMock(return_value=process))
    with pytest.raises(TimeoutError):
        asyncio.run(docker_runtime.run_async(['synthetic-command'], timeout_s=1))
    process.wait.assert_awaited_once()


@pytest.fixture
def docker_env(monkeypatch, tmp_path):
    import json
    # Match the synthetic inspect contract, independently of app/runner defaults.
    # Patch before construction: the provider snapshots runtime/image/namespace.
    for name, value in {
        'PYTHONLAB_DOCKER_RUNTIME': 'runc',
        'PYTHONLAB_SANDBOX_IMAGE': 'synthetic-sandbox:local',
        'PYTHONLAB_CONTAINER_NAMESPACE': 'ops_repair_synthetic',
        'PYTHONLAB_DEBUGPY_PORT': 5678,
        'PYTHONLAB_WORKSPACE_ROOT': str(tmp_path),
        'PYTHONLAB_WORKSPACE_DISK_QUOTA_MB': 100,
        'PYTHONLAB_DEFAULT_CPU_QUOTA': 50000,
        'PYTHONLAB_DEFAULT_MEMORY_MB': 128,
        'PYTHONLAB_CONTAINER_PIDS_LIMIT': 64,
        'PYTHONLAB_LOG_MAX_SIZE': '1m',
        'PYTHONLAB_LOG_MAX_FILE': '1',
        'DAP_HOST_IP': 'host.docker.internal',
    }.items():
        monkeypatch.setattr(docker_api.settings, name, value)
    monkeypatch.setenv('PYTHONLAB_READINESS_TIMEOUT_SECONDS', '60')
    monkeypatch.delenv('HOST_WORKSPACE_ROOT', raising=False)
    provider = docker_api.DockerProvider()
    meta = {'session_id': 'synthetic', 'owner_user_id': 701, 'runtime_mode': 'plain', 'limits': {}}
    ws = tmp_path / 'u701'
    ws.mkdir()
    (ws / 'main.py').write_text('original active code')
    (ws / 'meta.json').write_text(json.dumps({'session_id': 'previous'}))
    info = {
        'Id': 'a' * 64, 'State': {'Status': 'running'}, 'Image': 'sha256:local-image',
        'Config': {'Image': provider.image, 'User': '1000:1000', 'Labels': {'wangsh.pythonlab.runtime-mode': 'plain'}},
        'HostConfig': {'Memory': 128 * 1024**2, 'MemorySwap': 128 * 1024**2, 'CpuPeriod': 100000,
                       'CpuQuota': 50000, 'PidsLimit': 64, 'NetworkMode': 'none', 'Runtime': 'runc'},
        'Mounts': [{'Source': str(ws), 'Destination': '/workspace', 'RW': True}],
    }
    calls = []
    state = {'info': info, 'failure': None, 'readiness': None, 'cleanup_failure': False}
    async def run(cmd, timeout_s=30):
        calls.append(list(cmd))
        if cmd[:2] == ['docker', 'inspect']:
            if state['info'] is None:
                return 1, '', 'Error: No such object: synthetic'
            if '{{.State.Status}}' in cmd:
                return 0, state['info']['State']['Status'], ''
            return 0, json.dumps([state['info']]), ''
        if cmd[:3] == ['docker', 'image', 'inspect']:
            return 0, 'sha256:local-image', ''
        if cmd[:2] == ['docker', 'run']:
            if '--cidfile' in cmd:
                from pathlib import Path
                Path(cmd[cmd.index('--cidfile') + 1]).write_text('b' * 64)
            if state['failure']:
                raise state['failure']
            return 0, 'b' * 64, ''
        if cmd[:2] == ['docker', 'rm']:
            return (1, '', 'cleanup denied') if state['cleanup_failure'] else (0, '', '')
        if cmd[:2] == ['docker', 'port']:
            return 0, '0.0.0.0:45678', ''
        if cmd[:2] == ['docker', 'logs']:
            return 0, 'synthetic logs', ''
        raise AssertionError(f'unexpected Docker command: {cmd}')
    async def ready(*_):
        if state['readiness']:
            raise state['readiness']
    class Lock:
        def __init__(self, *a, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
    monkeypatch.setattr(docker_api, '_run_async', run)
    monkeypatch.setattr(docker_api, 'RedisDistributedLock', Lock)
    monkeypatch.setattr(docker_runtime, 'cache', SimpleNamespace(get=AsyncMock(return_value={'status': 'TERMINATED'})))
    monkeypatch.setattr(provider, '_wait_for_readiness', ready)
    monkeypatch.setattr(provider, '_resolve_host_mount_path', AsyncMock(side_effect=lambda path: path))
    seed_live_owner(provider, meta, ws, info['Id'], session_id='previous')
    return provider, meta, ws, state, calls


def seed_live_owner(provider, meta, ws, container_id, *, session_id='synthetic'):
    # Legacy meta.json-only adoption is deliberately no longer authority. Positive
    # reuse tests now provide the host-only live journal with the exact Docker ID.
    async def seed():
        async with docker_runtime.WorkspaceOwnership(ws.parent, ws) as owner:
            return owner.claim(session_id, meta, provider._container_name(meta), container_id)
    return asyncio.run(seed())


def start_docker(env):
    provider, meta, *_ = env
    return asyncio.run(provider.start_session('synthetic', 'new synthetic code', meta))


@pytest.mark.parametrize('change', ['mode', 'memory', 'swap', 'cpu', 'period', 'pids', 'image', 'image-id', 'network', 'runtime', 'missing-label', 'mount', 'user'])
def test_running_incompatible_container_is_not_reused_or_destroyed(docker_env, change):
    provider, meta, ws, state, calls = docker_env
    info = state['info']
    if change == 'mode': info['Config']['Labels']['wangsh.pythonlab.runtime-mode'] = 'debug'
    elif change == 'memory': meta['limits']['memory_mb'] = 256
    elif change == 'swap': info['HostConfig']['MemorySwap'] = -1
    elif change == 'cpu': meta['limits']['cpu_quota'] = 25000
    elif change == 'period': info['HostConfig']['CpuPeriod'] = 50000
    elif change == 'pids': info['HostConfig']['PidsLimit'] = 128
    elif change == 'image': info['Config']['Image'] = 'old:image'
    elif change == 'image-id': info['Image'] = 'sha256:old-image'
    elif change == 'network': info['HostConfig']['NetworkMode'] = 'bridge'
    elif change == 'runtime': info['HostConfig']['Runtime'] = 'other'
    elif change == 'missing-label': info['Config']['Labels'] = {}
    elif change == 'mount': info['Mounts'][0]['Source'] = '/unrelated'
    elif change == 'user': info['Config']['User'] = 'root'
    with pytest.raises(RuntimeError):
        start_docker(docker_env)
    assert (ws/'main.py').read_text() == 'original active code'
    assert not any(cmd[1] in ('rm', 'run', 'exec') for cmd in calls)


def test_compatible_plain_container_reused_after_previous_session_terminated(docker_env):
    result = start_docker(docker_env)
    assert result['docker_container_id'] == 'a' * 64
    assert (docker_env[2]/'main.py').read_text() == 'new synthetic code'
    assert not any(cmd[1] in ('rm', 'run') for cmd in docker_env[4])


@pytest.mark.parametrize('status', ['READY', 'RUNNING', 'STOPPED', 'STARTING', 'TERMINATING', None])
def test_compatible_container_does_not_overwrite_another_live_session(docker_env, monkeypatch, status):
    monkeypatch.setattr(docker_runtime.cache, 'get', AsyncMock(return_value={'status': status} if status else None))
    with pytest.raises(RuntimeError):
        start_docker(docker_env)
    assert (docker_env[2]/'main.py').read_text() == 'original active code'
    assert not any(cmd[1] in ('rm', 'run', 'exec') for cmd in docker_env[4])


@pytest.mark.parametrize('mode', ['debug', 'plain'])
def test_same_session_redelivery_does_not_rewrite_running_workspace(docker_env, mode):
    import json
    _, meta, ws, state, calls = docker_env
    meta['runtime_mode'] = mode
    state['info']['Config']['Labels']['wangsh.pythonlab.runtime-mode'] = mode
    state['info']['HostConfig']['NetworkMode'] = 'bridge' if mode == 'debug' else 'none'
    (ws/'meta.json').write_text(json.dumps(meta))
    seed_live_owner(docker_env[0], meta, ws, state['info']['Id'])
    start_docker(docker_env)
    assert (ws/'main.py').read_text() == 'original active code'
    assert not any(cmd[1] in ('rm', 'run', 'exec') for cmd in calls)


@pytest.mark.parametrize('mode', ['plain', 'debug'])
def test_new_container_keeps_existing_network_and_dap_contract(docker_env, mode):
    _, meta, _, state, calls = docker_env
    meta['runtime_mode'] = mode
    state['info'] = None
    result = start_docker(docker_env)
    cmd = next(c for c in calls if c[1] == 'run')
    assert f'wangsh.pythonlab.runtime-mode={mode}' in cmd
    if mode == 'debug':
        assert '--network' not in cmd
        assert cmd[cmd.index('-p')+1] == '5678'
        assert result['dap_port'] == 45678
        assert '--listen 0.0.0.0:5678' in cmd[-1]
    else:
        assert cmd[cmd.index('--network')+1] == 'none'
        assert '-p' not in cmd
        assert result['dap_port'] is None


@pytest.mark.parametrize('failure', ['start-timeout', 'readiness-timeout', 'readiness-exit'])
def test_failed_new_container_cleans_only_attempt_owned_id(docker_env, failure):
    _, _, _, state, calls = docker_env
    state['info'] = None
    error = RuntimeError('exited') if failure == 'readiness-exit' else TimeoutError('temporary')
    state['failure' if failure == 'start-timeout' else 'readiness'] = error
    with pytest.raises(type(error)):
        start_docker(docker_env)
    removes = [c for c in calls if c[1] == 'rm']
    assert removes == [['docker', 'rm', '-f', 'b' * 64]]


def test_cleanup_failure_blocks_automatic_recreation(docker_env):
    _, _, _, state, _ = docker_env
    state.update(info=None, readiness=TimeoutError('temporary'), cleanup_failure=True)
    with pytest.raises(RuntimeError, match='清理'):
        start_docker(docker_env)

@pytest.mark.parametrize('persistent', [False, True])
def test_starting_write_failure_before_commit_retries_and_exhausts(task_env, monkeypatch, persistent):
    store, _, provider = task_env
    original = tasks._cas_start_meta
    failures = 0
    async def flaky(sid, expected, meta):
        nonlocal failures
        if meta['status'] == 'STARTING' and (persistent or failures == 0):
            failures += 1
            raise ConnectionError('write not committed')
        return await original(sid, expected, meta)
    monkeypatch.setattr(tasks, '_cas_start_meta', flaky)
    result = apply_start()
    assert result.state == ('FAILURE' if persistent else 'SUCCESS')
    assert store['status'] == ('FAILED' if persistent else 'READY')
    assert failures == (3 if persistent else 1)
    assert provider.start_session.await_count == (0 if persistent else 1)


@pytest.mark.parametrize('committed', [False, True])
def test_ready_write_failure_reconciles_without_blind_recreation(task_env, monkeypatch, committed):
    store, _, provider = task_env
    original = tasks._cas_start_meta
    failed = False
    async def flaky(sid, expected, meta):
        nonlocal failed
        if meta['status'] == 'READY' and not failed:
            failed = True
            if committed:
                await original(sid, expected, meta)
            raise ConnectionError('ready write acknowledgment lost')
        return await original(sid, expected, meta)
    monkeypatch.setattr(tasks, '_cas_start_meta', flaky)
    result = apply_start()
    # Old contract retried uncommitted READY by creating again. New contract
    # reconciles a committed generation or fences FAILED and compensates exactly
    # once; recreating an uncertain resource is explicitly forbidden.
    assert failed
    assert result.state == ('SUCCESS' if committed else 'FAILURE')
    assert store['status'] == ('READY' if committed else 'FAILED')
    assert provider.start_session.await_count == 1
    if committed:
        provider.terminate_session.assert_not_awaited()
    else:
        assert store['error_code'] == 'SANDBOX_PUBLICATION_FAILED'
        assert isinstance(result.result, RuntimeError)
        provider.terminate_session.assert_awaited_once()
        sid, claimed = provider.terminate_session.await_args.args
        assert sid == 'synthetic'
        assert claimed['docker_container_id'] == 'synthetic-id'
        assert claimed['sandbox_owner_token'] == 'synthetic-generation'



def test_cleanup_timeout_is_not_automatically_retried():
    with pytest.raises(RuntimeError, match='清理'):
        asyncio.run(docker_runtime.remove_owned_container(AsyncMock(side_effect=TimeoutError('cleanup unknown')), 'owned-id'))


def test_permanent_provider_error_is_not_reclassified_by_failed_status_write(task_env, monkeypatch):
    _, _, provider = task_env
    provider.start_session.side_effect = RuntimeError('invalid resource')
    original = tasks._cas_start_meta
    async def fail_outcome(sid, expected, meta):
        if meta['status'] == 'FAILED':
            raise ConnectionError('cannot record outcome')
        return await original(sid, expected, meta)
    monkeypatch.setattr(tasks, '_cas_start_meta', fail_outcome)
    result = apply_start()
    assert result.state == 'FAILURE'
    assert isinstance(result.result, RuntimeError)
    assert provider.start_session.await_count == 1


def test_readiness_inspection_timeout_preserves_retry_class(docker_env, monkeypatch):
    provider = docker_env[0]
    monkeypatch.setattr(docker_api, '_run_async', AsyncMock(side_effect=TimeoutError('inspect timeout')))
    with pytest.raises(TimeoutError):
        asyncio.run(docker_api.DockerProvider._wait_for_readiness(provider, 'owned-id', 0, 'plain'))


# Keep the production startup store functions so these tests exercise their
# serialization/error propagation, not only the higher-level state-machine fake.
_REAL_GET_START_VALUE = tasks._get_start_value
_REAL_GET_START_META = tasks._get_start_meta
_REAL_SET_START_META = tasks._set_start_meta


@pytest.mark.parametrize('stage', ['session-read', 'code-read', 'starting-write', 'ready-write'])
def test_strict_store_transport_failures_reach_real_celery_wrapper(task_env, monkeypatch, stage):
    import json
    from redis.exceptions import ConnectionError as RedisConnectionError
    store, _, provider = task_env
    failed = False
    async def get(key):
        nonlocal failed
        is_code = key.endswith(':code')
        if not failed and stage == ('code-read' if is_code else 'session-read'):
            failed = True
            raise RedisConnectionError('synthetic transport failure')
        return "print('synthetic')" if is_code else json.dumps(store)
    atomic = AtomicStartStore(store, [])
    async def eval_value(script, numkeys, key, expected, value, ttl):
        nonlocal failed
        meta = json.loads(value)
        assert ttl > 0
        if not failed and stage == f"{meta['status'].lower()}-write":
            failed = True
            raise RedisConnectionError('synthetic transport failure')
        return await atomic.eval(script, numkeys, key, expected, value, ttl)
    client = SimpleNamespace(get=get, eval=eval_value)
    monkeypatch.setattr(tasks, 'cache', SimpleNamespace(get_client=AsyncMock(return_value=client)))
    monkeypatch.setattr(tasks, '_get_start_value', _REAL_GET_START_VALUE)
    monkeypatch.setattr(tasks, '_get_start_meta', _REAL_GET_START_META)
    monkeypatch.setattr(tasks, '_set_start_meta', _REAL_SET_START_META)
    result = apply_start()
    assert failed
    # READY-after-create errors are not ordinary retryable pre-create errors.
    # Preserve the transport scenario, assert the stronger no-recreation policy.
    ready_failed = stage == 'ready-write'
    assert result.state == ('FAILURE' if ready_failed else 'SUCCESS')
    assert store['status'] == ('FAILED' if ready_failed else 'READY')
    assert provider.start_session.await_count == 1
    assert provider.terminate_session.await_count == int(ready_failed)
    if ready_failed:
        assert store['error_code'] == 'SANDBOX_PUBLICATION_FAILED'
        claimed = provider.terminate_session.await_args.args[1]
        assert claimed['docker_container_id'] == 'synthetic-id'
        assert claimed['sandbox_owner_token'] == 'synthetic-generation'



def test_retry_uses_bounded_celery_backoff(task_env, monkeypatch):
    _, _, provider = task_env
    provider.start_session.side_effect = TimeoutError('temporary')
    observed = []
    original = tasks.start_session.retry
    def retry(*args, **kwargs):
        observed.append((tasks.start_session.request.retries, kwargs['countdown']))
        return original(*args, **kwargs)
    monkeypatch.setattr(tasks.start_session, 'retry', retry)
    result = apply_start()
    assert result.state == 'FAILURE'
    assert [n for n, _ in observed] == [0, 1, 2]
    assert all(0 <= countdown <= 2 ** n for n, countdown in observed)


@pytest.mark.parametrize('exhausted', [False, True])
def test_real_provider_creation_cleanup_and_task_retry_compose(task_env, docker_env, monkeypatch, exhausted):
    store, _, _ = task_env
    provider, meta, _, state, calls = docker_env
    store.update(meta)
    state['info'] = None
    state['failure'] = TimeoutError('docker start timeout')
    original = docker_api._run_async
    async def run(cmd, timeout_s=30):
        result = await original(cmd, timeout_s=timeout_s)
        if cmd[1] == 'rm' and not exhausted:
            state['failure'] = None
        return result
    monkeypatch.setattr(docker_api, '_run_async', run)
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    result = apply_start()
    assert result.state == ('FAILURE' if exhausted else 'SUCCESS')
    assert store['status'] == ('FAILED' if exhausted else 'READY')
    assert sum(c[1] == 'run' for c in calls) == (3 if exhausted else 2)
    assert sum(c[1] == 'rm' for c in calls) == (3 if exhausted else 1)


def test_real_provider_cleanup_failure_stops_celery_retry(task_env, docker_env, monkeypatch):
    store, _, _ = task_env
    provider, meta, _, state, calls = docker_env
    store.update(meta)
    state.update(info=None, failure=TimeoutError('start'), cleanup_failure=True)
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    result = apply_start()
    assert result.state == 'FAILURE'
    assert store['status'] == 'FAILED'
    assert sum(c[1] == 'run' for c in calls) == 1


def test_existing_plain_shell_contract_with_new_inspect_fixture(monkeypatch, tmp_path):
    # Reuse all assertions from the pre-existing maintenance test, supplying only
    # the newly mandatory read-only inspection. The old file is outside our write set.
    from test_pythonlab_docker_limits import test_plain_session_container_uses_interactive_shell
    inspect = AsyncMock(return_value=None)
    monkeypatch.setattr(docker_api, 'inspect_container', inspect)
    test_plain_session_container_uses_interactive_shell(monkeypatch, tmp_path)
    inspect.assert_awaited_once()


@pytest.mark.parametrize('status', ['PENDING', 'STARTING'])
def test_another_start_task_cannot_take_over(task_env, status):
    store, _, provider = task_env
    store.update(status=status, startup_task_id='other-task')
    apply_start(retries=1)
    provider.start_session.assert_not_awaited()
    assert store['startup_task_id'] == 'other-task'


def test_success_after_cancellation_does_not_resurrect_session(task_env):
    store, _, provider = task_env
    async def start(*_):
        store['status'] = 'TERMINATING'
        return {'docker_container_id': 'synthetic-id'}
    provider.start_session.side_effect = start
    apply_start()
    assert store['status'] == 'TERMINATING'
    assert 'docker_container_id' not in store


@pytest.mark.parametrize('error', [RuntimeError('daemon unavailable'), TimeoutError('inspect timed out')])
def test_inspect_error_preserves_existing_workspace_and_resources(docker_env, monkeypatch, error):
    _, _, ws, _, calls = docker_env
    monkeypatch.setattr(docker_api, 'inspect_container', AsyncMock(side_effect=error))
    with pytest.raises(type(error)):
        start_docker(docker_env)
    assert (ws/'main.py').read_text() == 'original active code'
    assert not any(c[1] in ('rm', 'run', 'exec') for c in calls)


def test_plain_to_debug_rejects_without_destroying_plain(docker_env):
    docker_env[1]['runtime_mode'] = 'debug'
    with pytest.raises(RuntimeError, match='模式'):
        start_docker(docker_env)
    assert not any(c[1] in ('rm', 'run', 'exec') for c in docker_env[4])


@pytest.mark.parametrize('cancel_status', ['TERMINATING', 'other-task'])
def test_success_losing_ownership_compensates_only_claimed_generation(task_env, docker_env, monkeypatch, cancel_status):
    # Publication loss now invokes generation-checked cleanup; it must not
    # resurrect the session or delete by the shared owner name.
    store, _, _ = task_env
    provider, meta, _, state, calls = docker_env
    store.update(meta)
    state['info'] = None
    async def ready(*_):
        if cancel_status == 'other-task':
            store.update(status='STARTING', startup_task_id='other-task')
        else:
            store['status'] = cancel_status
    monkeypatch.setattr(provider, '_wait_for_readiness', ready)
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    result = apply_start()
    assert result.state == 'SUCCESS'  # Superseded, not a retryable provider failure.
    assert sum(c[1] == 'run' for c in calls) == 1
    assert [c for c in calls if c[1] == 'rm'] == [['docker', 'rm', '-f', 'b' * 64]]
    assert 'docker_container_id' not in store  # Newly created resource unpublished.
    assert store['status'] == ('STARTING' if cancel_status == 'other-task' else cancel_status)


def test_cancelled_start_releases_reused_container_only_after_claim(task_env, docker_env, monkeypatch):
    import json
    store, _, _ = task_env
    provider, meta, ws, _, calls = docker_env
    store.update(meta)
    (ws/'meta.json').write_text(json.dumps(meta))
    seed_live_owner(provider, dict(meta, startup_task_id='synthetic-task'), ws, 'a' * 64)
    original = provider.start_session
    async def start(*args):
        result = await original(*args)
        store['status'] = 'TERMINATING'
        return result
    monkeypatch.setattr(provider, 'start_session', start)
    monkeypatch.setattr(tasks, 'get_sandbox_provider', lambda: provider)
    apply_start()
    assert store['status'] == 'TERMINATING'
    assert not any(c[1] in ('run', 'exec') for c in calls)
    assert [c for c in calls if c[1] == 'rm'] == [['docker', 'rm', '-f', 'a' * 64]]
    assert not ws.exists()


@pytest.mark.parametrize('code', [None, '', '   '])
def test_missing_code_fails_without_start_or_retry(task_env, monkeypatch, code):
    store, _, provider = task_env
    monkeypatch.setattr(tasks, '_get_start_value', AsyncMock(return_value=code))
    apply_start()
    assert store['status'] == 'FAILED'
    assert store['error_code'] == 'CODE_MISSING'
    provider.start_session.assert_not_awaited()


@pytest.mark.parametrize('status', ['paused', 'restarting', 'removing', 'unknown'])
def test_nonrunning_uncertain_state_is_not_removed(docker_env, status):
    docker_env[3]['info']['State']['Status'] = status
    with pytest.raises(RuntimeError):
        start_docker(docker_env)
    assert not any(c[1] in ('rm', 'run', 'exec') for c in docker_env[4])
    assert (docker_env[2]/'main.py').read_text() == 'original active code'


def test_failed_create_without_cid_never_removes_by_name(docker_env, monkeypatch):
    _, _, _, state, calls = docker_env
    state['info'] = None
    original = docker_api._run_async
    async def run(cmd, timeout_s=30):
        if cmd[1] == 'run':
            calls.append(list(cmd))
            raise TimeoutError('no known daemon resource yet')
        return await original(cmd, timeout_s=timeout_s)
    monkeypatch.setattr(docker_api, '_run_async', run)
    with pytest.raises(TimeoutError):
        start_docker(docker_env)
    assert not any(c[1] == 'rm' for c in calls)


def test_actual_readiness_deadline_is_retryable_and_does_not_own_cleanup(docker_env):
    provider = docker_env[0]
    provider.readiness_timeout = 0
    with pytest.raises(TimeoutError):
        asyncio.run(docker_api.DockerProvider._wait_for_readiness(provider, 'owned-id', 45678))
    assert not any(c[1] == 'rm' for c in docker_env[4])


@pytest.mark.parametrize('boundary', ['STARTING', 'READY'])
@pytest.mark.parametrize('winner', ['TERMINATED', 'STARTING'])
def test_atomic_fixture_preserves_winner_between_read_and_eval(task_env, monkeypatch, boundary, winner):
    store, _, provider = task_env
    client = asyncio.run(tasks.cache.get_client())
    original = client.eval
    winning_meta = {'status': winner, 'startup_task_id': 'newer-task', 'revision': 'newer'}
    injected = False

    async def race(script, numkeys, key, expected, replacement, ttl):
        nonlocal injected
        if not injected and json.loads(replacement)['status'] == boundary:
            injected = True
            store.clear()
            store.update(winning_meta)
        return await original(script, numkeys, key, expected, replacement, ttl)

    monkeypatch.setattr(client, 'eval', race)
    assert apply_start().state == 'SUCCESS'
    assert injected
    assert store == winning_meta
    assert provider.start_session.await_count == int(boundary == 'READY')
    assert provider.terminate_session.await_count == int(boundary == 'READY')


def test_atomic_fixture_compares_raw_value_not_json_equivalence(task_env):
    store, writes, _ = task_env
    raw = json.dumps(store, separators=(',', ':'))
    assert json.loads(raw) == store  # Equal JSON is not equal raw Redis value.
    assert not asyncio.run(tasks._cas_start_meta('synthetic', raw, {'status': 'READY'}))
    assert store['status'] == 'PENDING'
    assert writes == []
