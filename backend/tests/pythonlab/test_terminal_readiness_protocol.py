"""Terminal readiness controls remain session-authenticated, never stdout."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import WebSocketDisconnect

from app.api.pythonlab.ws.connection_auth import SessionWebSocket


@pytest.mark.parametrize('protocol,plain,expected', [('1', False, 1), ('1', True, 0), (None, False, 0)])
def test_terminal_ready_frame_is_opt_in_and_debug_only(protocol, plain, expected):
    raw = SimpleNamespace(query_params={'terminal_protocol': protocol}, send_bytes=AsyncMock())
    socket = SessionWebSocket(raw, 'synthetic-token', {'id': 1})
    socket.check_session = AsyncMock()
    asyncio.run(socket.notify_terminal_ready(plain_mode=plain))
    assert raw.send_bytes.call_count == expected
    if expected:
        assert raw.send_bytes.call_args.args == (b'{"type":"pythonlab.terminal.ready","version":1}',)
    socket.check_session.assert_awaited()


def test_revoked_terminal_never_sends_ready_or_binary_output():
    raw = SimpleNamespace(query_params={'terminal_protocol': '1'}, send_bytes=AsyncMock())
    socket = SessionWebSocket(raw, 'synthetic-token', {'id': 1})
    socket.check_session = AsyncMock(side_effect=WebSocketDisconnect(code=4401))
    with pytest.raises(WebSocketDisconnect):
        asyncio.run(socket.notify_terminal_ready(plain_mode=False))
    raw.send_bytes.assert_not_awaited()


def test_ownership_mismatch_never_opens_docker_transport(tmp_path, monkeypatch):
    from app.core.sandbox import docker as module
    from app.core.sandbox.docker_runtime import WorkspaceOwnership
    root = tmp_path / 'workspaces'
    workspace = root / 'u1'
    workspace.mkdir(parents=True)
    monkeypatch.setattr(module, '_workspace_root', lambda: root)
    provider = module.DockerProvider()
    meta = {'owner_user_id': 1, 'runtime_mode': 'debug', 'docker_container_id': 'a' * 64, 'sandbox_owner_token': 'old'}
    async def scenario():
        async with WorkspaceOwnership(root, workspace) as owner:
            owner.claim('new-session', meta, provider._container_name(meta), 'b' * 64)
        attach = AsyncMock()
        monkeypatch.setattr(module, 'attach_docker_tty', attach)
        with pytest.raises(RuntimeError, match='归属'):
            await provider.attach_tty('old-session', meta)
        attach.assert_not_awaited()
    asyncio.run(scenario())


def test_current_ownership_checks_each_generation_field(tmp_path, monkeypatch):
    from app.core.sandbox import docker as module
    from app.core.sandbox.docker_runtime import WorkspaceOwnership
    root = tmp_path / 'workspaces'
    workspace = root / 'u1'
    workspace.mkdir(parents=True)
    monkeypatch.setattr(module, '_workspace_root', lambda: root)
    provider = module.DockerProvider()
    meta = {'owner_user_id': 1, 'runtime_mode': 'debug', 'docker_container_id': 'a' * 64}
    async def scenario():
        async with WorkspaceOwnership(root, workspace) as owner:
            record = owner.claim('session', meta, provider._container_name(meta), 'a' * 64)
        meta['sandbox_owner_token'] = record['token']
        attach = AsyncMock()
        monkeypatch.setattr(module, 'attach_docker_tty', attach)
        for field, value in [('docker_container_id', 'b' * 64), ('sandbox_owner_token', 'stale')]:
            with pytest.raises(RuntimeError, match='归属'):
                await provider.attach_tty('session', {**meta, field: value})
        attach.assert_not_awaited()
    asyncio.run(scenario())


def test_owned_terminal_uses_exact_id_after_fence(tmp_path, monkeypatch):
    from app.core.sandbox import docker as module
    from app.core.sandbox.docker_runtime import WorkspaceOwnership
    root = tmp_path / 'workspaces'
    workspace = root / 'u1'
    workspace.mkdir(parents=True)
    monkeypatch.setattr(module, '_workspace_root', lambda: root)
    provider = module.DockerProvider()
    meta = {'owner_user_id': 1, 'runtime_mode': 'debug', 'docker_container_id': 'a' * 64}
    async def scenario():
        async with WorkspaceOwnership(root, workspace) as owner:
            record = owner.claim('session', meta, provider._container_name(meta), 'a' * 64)
            meta['sandbox_owner_token'] = record['token']
        monkeypatch.setattr(provider, '_docker_is_running', AsyncMock(return_value=True))
        attach = AsyncMock(return_value=('synthetic-process', 11))
        monkeypatch.setattr(module, 'attach_docker_tty', attach)
        assert await provider.attach_tty('session', meta) == ('synthetic-process', 11)
        attach.assert_awaited_once_with('a' * 64)
    asyncio.run(scenario())
