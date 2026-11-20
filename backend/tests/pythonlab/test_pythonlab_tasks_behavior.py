import asyncio
from copy import deepcopy
from unittest.mock import AsyncMock, Mock

import pytest

import app.tasks.pythonlab as pythonlab_tasks
from test_pythonlab_v2_sessions_behavior import FakeCache


class FakeProvider:
    def __init__(self):
        self.stop_calls: list[tuple[str, dict]] = []
        self.terminate_calls: list[tuple[str, dict]] = []

    async def stop_session(self, session_id: str, meta: dict):
        self.stop_calls.append((session_id, deepcopy(meta)))

    async def terminate_session(self, session_id: str, meta: dict):
        self.terminate_calls.append((session_id, deepcopy(meta)))


@pytest.fixture
def stop_worker_env(monkeypatch):
    provider = FakeProvider()
    fake_cache = FakeCache()
    monkeypatch.setattr(pythonlab_tasks, "_run_async", asyncio.run)
    monkeypatch.setattr(pythonlab_tasks, "get_sandbox_provider", lambda: provider)
    monkeypatch.setattr(pythonlab_tasks, "cache", fake_cache)
    return provider, fake_cache


@pytest.mark.parametrize(("runtime_mode", "force", "hard_stop"), [
    ("debug", False, True),
    ("plain", False, False),
    ("plain", True, True),
])
def test_stop_worker_selects_existing_provider_operation(stop_worker_env, monkeypatch, runtime_mode, force, hard_stop):
    provider, fake_cache = stop_worker_env
    meta = {"session_id": "dbg_done", "owner_user_id": 7, "status": "TERMINATING",
            "runtime_mode": runtime_mode, "ttl_seconds": 300}
    fake_cache.store["debug:session:dbg_done"] = meta
    fake_cache.client.sets["debug:user:7:sessions"] = {"dbg_done"}
    monkeypatch.setattr(pythonlab_tasks, "_confirm_stopped_resource", AsyncMock(return_value=True))

    pythonlab_tasks.stop_session.run("dbg_done", force=force)

    assert provider.terminate_calls == ([("dbg_done", meta)] if hard_stop else [])
    assert provider.stop_calls == ([] if hard_stop else [("dbg_done", meta)])
    assert fake_cache.client.sets["debug:user:7:sessions"] == set()
    assert fake_cache.store["debug:session:dbg_done"]["status"] == "TERMINATED"


def test_debug_stop_preserves_container_when_other_session_is_active(stop_worker_env, monkeypatch):
    provider, fake_cache = stop_worker_env
    fake_cache.store["debug:session:dbg_old"] = {"session_id": "dbg_old", "owner_user_id": 7, "status": "TERMINATING"}
    fake_cache.store["debug:session:dbg_current"] = {"session_id": "dbg_current", "owner_user_id": 7, "status": "RUNNING"}
    fake_cache.client.sets["debug:user:7:sessions"] = {"dbg_old", "dbg_current"}
    monkeypatch.setattr(pythonlab_tasks, "_confirm_stopped_resource", AsyncMock(return_value=False))

    with pytest.raises(RuntimeError, match="could not confirm"):
        pythonlab_tasks.stop_session.run("dbg_old", force=True)

    assert provider.terminate_calls == []
    assert provider.stop_calls == []
    assert fake_cache.client.sets["debug:user:7:sessions"] == {"dbg_old", "dbg_current"}
    assert fake_cache.store["debug:session:dbg_old"]["error_code"] == "SANDBOX_STOP_FAILED"


def test_stop_session_without_meta_uses_session_id_for_legacy_container(stop_worker_env):
    provider, fake_cache = stop_worker_env

    pythonlab_tasks.stop_session.run("legacy_session")

    assert provider.terminate_calls == [("legacy_session", {"session_id": "legacy_session"})]
    assert provider.stop_calls == []
    assert fake_cache.store == {}


def test_stale_cleanup_skips_non_metadata_keys_and_retries_dispatch(stop_worker_env, monkeypatch):
    _, fake_cache = stop_worker_env
    key = "debug:session:dbg_stale"
    original = {"session_id": "dbg_stale", "owner_user_id": 7, "status": "RUNNING",
                "created_at": "2026-01-01T00:00:00+00:00", "ttl_seconds": 300}
    fake_cache.store.update({f"{key}:code": "print('synthetic')", f"{key}:ws_owner": "conn:synthetic", key: original})
    fake_cache.client.scan = AsyncMock(return_value=(0, list(fake_cache.store)))
    publish = Mock(side_effect=[ConnectionError("offline broker"), None])
    monkeypatch.setattr(pythonlab_tasks.celery_app, "send_task", publish)

    pythonlab_tasks.cleanup_stale_sessions.run()
    assert fake_cache.store[key] == original

    pythonlab_tasks.cleanup_stale_sessions.run()
    assert fake_cache.store[key]["status"] == "TERMINATING"
    assert publish.call_count == 2
    assert publish.call_args.kwargs["args"] == ["dbg_stale", True]
