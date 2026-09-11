"""Opt-in regression tests for task-local worker-loss recovery semantics.

The real Docker/Redis contract is exercised by the external synthetic runner;
these tests pin the identity and ACK policy without replacing that evidence.
"""
from app.tasks.pythonlab import _start_allowed, start_session
from app.api.pythonlab.constants import SESSION_STATUS_PENDING, SESSION_STATUS_STARTING


def test_redelivery_allows_only_same_startup_generation():
    meta = {"status": SESSION_STATUS_STARTING, "startup_task_id": "t-1"}
    assert _start_allowed(meta, "t-1", retries=0, redelivered=True)
    assert not _start_allowed(meta, "t-2", retries=0, redelivered=True)
    assert not _start_allowed(meta, "t-1", retries=0, redelivered=False)


def test_pending_can_be_claimed_but_old_generation_cannot():
    assert _start_allowed({"status": SESSION_STATUS_PENDING}, "new", 0)
    assert not _start_allowed(
        {"status": SESSION_STATUS_STARTING, "startup_task_id": "new"}, "old", 2, True
    )


def test_ack_policy_is_task_local():
    assert start_session.acks_late is True
    assert start_session.reject_on_worker_lost is True


import pytest
from app.tasks.pythonlab import _validate_start_recovery_owner


def _owner():
    return dict(phase="live", session_id="synthetic", startup_task_id="task",
                container_name="synthetic_u1", container_id="exact-id", token="generation")


def test_trusted_live_owner_is_accepted():
    _validate_start_recovery_owner(_owner(), "synthetic", "task", {}, "synthetic_u1")


@pytest.mark.parametrize("field,value", [
    ("phase", "creating"), ("phase", "removed"), ("phase", "deleting"),
    ("session_id", "new-session"), ("startup_task_id", "new-task"),
    ("container_name", "foreign"), ("container_id", ""), ("token", ""),
])
def test_foreign_or_uncertain_journal_is_not_authority(field, value):
    record = {**_owner(), field: value}
    with pytest.raises(RuntimeError):
        _validate_start_recovery_owner(record, "synthetic", "task", {}, "synthetic_u1")


@pytest.mark.parametrize("meta", [
    {"sandbox_owner_token": "old-token"}, {"docker_container_id": "old-id"},
])
def test_metadata_cannot_override_trusted_generation(meta):
    with pytest.raises(RuntimeError):
        _validate_start_recovery_owner(_owner(), "synthetic", "task", meta, "synthetic_u1")


def test_missing_journal_is_not_authority():
    with pytest.raises(RuntimeError):
        _validate_start_recovery_owner(None, "synthetic", "task", {}, "synthetic_u1")


@pytest.mark.parametrize("status", ["READY", "RUNNING", "STOPPED", "TERMINATED", "FAILED"])
def test_redelivery_after_publication_or_terminal_is_noop(status):
    assert not _start_allowed({"status": status, "startup_task_id": "task"}, "task", 2, True)


# A Docker CLI failure is not always a transport failure. The classifier must
# preserve permanent/unknown errors and must never authorize cleanup or takeover.
import asyncio
import httpx
from app.core.sandbox import docker_runtime
from app.tasks.pythonlab import _start_failure_updates, _START_RETRY_ERRORS


_TRANSPORT_DIAGNOSTICS = [
    'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?',
    'failed to connect to the docker API at unix:///tmp/audit.sock; check if the path is correct and if the daemon is running: dial unix /tmp/audit.sock: connect: no such file or directory',
    'error during connect: Get "http://docker/v1.47/containers/test/json": dial unix /var/run/docker.sock: connect: connection refused',
    'error during connect: read tcp 127.0.0.1:123: connection reset by peer',
    'error during connect: dial tcp 127.0.0.1:2375: i/o timeout',
    'error during connect: dial tcp 127.0.0.1:2375: network is unreachable',
]
_PERMANENT_DIAGNOSTICS = [
    'permission denied while trying to connect to the Docker daemon socket',
    'error during connect: dial unix /var/run/docker.sock: connect: permission denied',
    'Cannot connect to the Docker daemon at unix:///var/run/docker.sock: permission denied',
    'error during connect: x509: certificate signed by unknown authority',
    'error during connect: unauthorized: connection refused',
    'error during connect: malformed HTTP response',
    'Error response from daemon: connection refused',
    'connection refused', 'unexpected Docker failure',
    'error during connect: no such file or directory',
]


def _reuse_fixture():
    host = dict(Memory=96 * 1024**2, MemorySwap=96 * 1024**2,
                CpuPeriod=100000, CpuQuota=25000, PidsLimit=48, Runtime='runc',
                NetworkMode='none')
    expected = dict(mode='plain', image='synthetic-image', mount='/synthetic/workspace',
                    host={k: v for k, v in host.items() if k != 'NetworkMode'})
    info = dict(Id='exact-id', Image='sha256:synthetic', HostConfig=host,
                Config=dict(Image='synthetic-image', User='1000:1000',
                            Labels={'wangsh.pythonlab.runtime-mode': 'plain'}),
                Mounts=[dict(Destination='/workspace', Source='/synthetic/workspace', RW=True)])
    return info, expected


async def _read_failure(boundary, diagnostic):
    async def run(cmd, timeout_s):
        assert cmd[:2] == ['docker', 'inspect'] or cmd[:3] == ['docker', 'image', 'inspect']
        return 1, '', diagnostic
    if boundary == 'container':
        return await docker_runtime.inspect_container(run, 'exact-id')
    info, expected = _reuse_fixture()
    return await docker_runtime.check_reuse(run, info, expected, None, 'synthetic', _owner())


@pytest.mark.parametrize('boundary', ['container', 'image'])
@pytest.mark.parametrize('diagnostic', _TRANSPORT_DIAGNOSTICS)
def test_read_only_docker_transport_is_bounded_retry(boundary, diagnostic):
    with pytest.raises(ConnectionError) as failure:
        asyncio.run(_read_failure(boundary, diagnostic))
    assert isinstance(failure.value, _START_RETRY_ERRORS)
    assert _start_failure_updates(failure.value, 'task', 0, 2)['status'] == 'PENDING'
    assert _start_failure_updates(failure.value, 'task', 2, 2)['status'] == 'FAILED'


@pytest.mark.parametrize('boundary', ['container', 'image'])
@pytest.mark.parametrize('diagnostic', _PERMANENT_DIAGNOSTICS)
def test_unknown_or_forbidden_docker_failure_is_not_retryable(boundary, diagnostic):
    with pytest.raises(RuntimeError) as failure:
        asyncio.run(_read_failure(boundary, diagnostic))
    assert not isinstance(failure.value, _START_RETRY_ERRORS)
    assert _start_failure_updates(failure.value, 'task', 0, 2)['status'] == 'FAILED'


@pytest.mark.parametrize('diagnostic', ['Error: No such object: exact-id', 'Error: No such container: exact-id'])
def test_absent_container_remains_absent(diagnostic):
    assert asyncio.run(_read_failure('container', diagnostic)) is None


def test_bad_inspect_payload_is_permanent():
    async def run(cmd, timeout_s):
        return 0, 'not-json', ''
    with pytest.raises(ValueError) as failure:
        asyncio.run(docker_runtime.inspect_container(run, 'exact-id'))
    assert _start_failure_updates(failure.value, 'task', 0, 2)['status'] == 'FAILED'


@pytest.mark.parametrize('reason', ['owner', 'resource', 'mount'])
def test_unknown_ownership_or_invalid_resource_is_rejected_before_image_transport(reason):
    info, expected = _reuse_fixture()
    owner = _owner()
    if reason == 'owner': owner = None
    elif reason == 'resource': info['HostConfig']['Memory'] = 1
    else: info['Mounts'] = []
    async def run(cmd, timeout_s):
        pytest.fail('invalid ownership/resources must be rejected before contacting image provider')
    with pytest.raises(RuntimeError):
        asyncio.run(docker_runtime.check_reuse(run, info, expected, None, 'synthetic', owner))


@pytest.mark.parametrize('exception', [httpx.ConnectError, httpx.ReadError, httpx.WriteError,
    httpx.CloseError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout])
def test_provider_network_and_timeout_errors_retry_with_limit(exception):
    error = exception('synthetic provider transport failure')
    assert isinstance(error, _START_RETRY_ERRORS)
    assert _start_failure_updates(error, 'task', 1, 2)['status'] == 'PENDING'
    assert _start_failure_updates(error, 'task', 2, 2)['status'] == 'FAILED'


@pytest.mark.parametrize('error', [RuntimeError('connection refused'), PermissionError('denied'),
    ValueError('invalid resources'), httpx.UnsupportedProtocol('invalid'),
    httpx.LocalProtocolError('malformed'), httpx.ProxyError('unauthorized')])
def test_arbitrary_provider_errors_stay_fail_closed(error):
    assert not isinstance(error, _START_RETRY_ERRORS)
    assert _start_failure_updates(error, 'task', 0, 2)['status'] == 'FAILED'


@pytest.mark.parametrize('diagnostic', [
    'Cannot connect to the Docker daemon at unix:///var/run/docker.sock: operation not permitted',
    'Cannot connect to the Docker daemon at unix:///var/run/docker.sock: authorization denied',
    'error during connect: dial tcp: access is denied; connection refused',
])
def test_docker_permission_variants_are_permanent(diagnostic):
    with pytest.raises(RuntimeError) as failure:
        asyncio.run(_read_failure('container', diagnostic))
    assert not isinstance(failure.value, _START_RETRY_ERRORS)
