"""Preserve runtime dependency replacement across auth import refactors."""

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.core import session_guard
from app.services import auth
from app.utils import security


def test_password_verification_uses_runtime_security_function(monkeypatch):
    verify = Mock(return_value=True)
    monkeypatch.setattr(security, "verify_password", verify)

    assert auth.verify_password("synthetic-password", "synthetic-hash") is True
    verify.assert_called_once_with("synthetic-password", "synthetic-hash")


def test_password_hashing_uses_runtime_security_function(monkeypatch):
    hash_password = Mock(return_value="synthetic-hash")
    monkeypatch.setattr(security, "get_password_hash", hash_password)

    assert auth.get_password_hash("synthetic-password") == "synthetic-hash"
    hash_password.assert_called_once_with("synthetic-password")


@pytest.fixture
def offline_snapshot(monkeypatch):
    async def unexpected_cache_access():
        raise AssertionError("runtime snapshot replacement was bypassed")

    monkeypatch.setattr(session_guard.cache, "get_client", unexpected_cache_access)

    def replace(values):
        snapshot = AsyncMock(return_value=values)
        monkeypatch.setattr(session_guard, "get_auth_snapshot_strict", snapshot)
        return snapshot

    return replace


def test_cutover_collects_runtime_snapshot_without_resetting_deadline(offline_snapshot):
    user = SimpleNamespace(id=7, is_active=True, is_deleted=False)
    deadline = datetime.now(timezone.utc) + timedelta(minutes=5)
    cached = {"ip": "192.0.2.7", "nonce": "A" * 22}
    key = session_guard._key_user(user.id)
    snapshot = offline_snapshot({key: (cached, deadline)})

    result = asyncio.run(auth._collect_cutover_sessions(None, [user], {7}, frozenset()))

    assert result == ({7: cached}, {7: deadline}, set())
    snapshot.assert_awaited_once_with([key])


def test_cutover_prunes_with_runtime_ip_snapshot(offline_snapshot):
    deadline = datetime.now(timezone.utc) + timedelta(minutes=5)
    binding_deadline = deadline - timedelta(minutes=1)
    ip = "192.0.2.7"
    sessions = {
        7: {"ip": ip, "nonce": "A" * 22},
        8: {"ip": ip, "nonce": "B" * 22},
    }
    winner = sessions[7].copy()
    deadlines = {7: deadline, 8: deadline}
    uncertain = set()
    key = session_guard._key_ip(ip)
    snapshot = offline_snapshot({key: ({"user_id": 7, "nonce": "A" * 22}, binding_deadline)})

    asyncio.run(auth._prune_ip_contested_sessions(None, sessions, deadlines, uncertain))

    assert sessions == {7: winner}
    assert deadlines[7] == binding_deadline
    assert uncertain == set()
    snapshot.assert_awaited_once_with([key])
