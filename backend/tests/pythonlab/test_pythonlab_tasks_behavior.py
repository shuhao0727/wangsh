from copy import deepcopy

import app.tasks.pythonlab as pythonlab_tasks


class FakeProvider:
    def __init__(self):
        self.stop_calls: list[tuple[str, dict]] = []
        self.terminate_calls: list[tuple[str, dict]] = []

    async def stop_session(self, session_id: str, meta: dict):
        self.stop_calls.append((session_id, deepcopy(meta)))

    async def terminate_session(self, session_id: str, meta: dict):
        self.terminate_calls.append((session_id, deepcopy(meta)))


class FakeRedisClient:
    def __init__(self):
        self.removed: list[tuple[str, str]] = []

    async def srem(self, key: str, value: str):
        self.removed.append((key, value))


class FakeCache:
    def __init__(self):
        self.client = FakeRedisClient()

    async def get_client(self):
        return self.client


def _patch_stop_session_env(monkeypatch, *, meta, has_other_active=False):
    provider = FakeProvider()
    fake_cache = FakeCache()
    saved_meta: list[tuple[str, dict]] = []

    async def fake_get_session_meta(session_id: str):
        return deepcopy(meta)

    async def fake_owner_has_other_active_session(owner_user_id: int, excluding_session_id: str):
        return has_other_active

    async def fake_set_session_meta(session_id: str, next_meta: dict):
        saved_meta.append((session_id, deepcopy(next_meta)))

    monkeypatch.setattr(pythonlab_tasks, "_get_session_meta", fake_get_session_meta)
    monkeypatch.setattr(pythonlab_tasks, "_owner_has_other_active_session", fake_owner_has_other_active_session)
    monkeypatch.setattr(pythonlab_tasks, "_set_session_meta", fake_set_session_meta)
    monkeypatch.setattr(pythonlab_tasks, "get_sandbox_provider", lambda: provider)
    monkeypatch.setattr(pythonlab_tasks, "cache", fake_cache)
    return provider, fake_cache, saved_meta


def test_debug_stop_hard_terminates_container_when_no_other_active_session(monkeypatch):
    provider, fake_cache, saved_meta = _patch_stop_session_env(
        monkeypatch,
        meta={"session_id": "dbg_done", "owner_user_id": 7, "runtime_mode": "debug", "ttl_seconds": 300},
    )

    pythonlab_tasks.stop_session.run("dbg_done")

    assert provider.terminate_calls == [
        ("dbg_done", {"session_id": "dbg_done", "owner_user_id": 7, "runtime_mode": "debug", "ttl_seconds": 300})
    ]
    assert provider.stop_calls == []
    assert fake_cache.client.removed == [(f"{pythonlab_tasks.CACHE_KEY_USER_SESSIONS_PREFIX}:7:sessions", "dbg_done")]
    assert saved_meta[-1][0] == "dbg_done"
    assert saved_meta[-1][1]["status"] == pythonlab_tasks.SESSION_STATUS_TERMINATED


def test_debug_stop_preserves_container_when_other_session_is_active(monkeypatch):
    provider, fake_cache, saved_meta = _patch_stop_session_env(
        monkeypatch,
        meta={"session_id": "dbg_old", "owner_user_id": 7, "runtime_mode": "debug", "ttl_seconds": 300},
        has_other_active=True,
    )

    pythonlab_tasks.stop_session.run("dbg_old")

    assert provider.terminate_calls == []
    assert provider.stop_calls == []
    assert fake_cache.client.removed == [(f"{pythonlab_tasks.CACHE_KEY_USER_SESSIONS_PREFIX}:7:sessions", "dbg_old")]
    assert saved_meta[-1][1]["status"] == pythonlab_tasks.SESSION_STATUS_TERMINATED


def test_plain_stop_keeps_soft_stop_path(monkeypatch):
    provider, _fake_cache, _saved_meta = _patch_stop_session_env(
        monkeypatch,
        meta={"session_id": "plain_done", "owner_user_id": 8, "runtime_mode": "plain", "ttl_seconds": 300},
    )

    pythonlab_tasks.stop_session.run("plain_done")

    assert provider.stop_calls == [
        ("plain_done", {"session_id": "plain_done", "owner_user_id": 8, "runtime_mode": "plain", "ttl_seconds": 300})
    ]
    assert provider.terminate_calls == []


def test_stop_session_without_meta_uses_session_id_for_legacy_container(monkeypatch):
    provider, _fake_cache, saved_meta = _patch_stop_session_env(monkeypatch, meta=None)

    pythonlab_tasks.stop_session.run("legacy_session")

    assert provider.terminate_calls == [("legacy_session", {"session_id": "legacy_session"})]
    assert provider.stop_calls == []
    assert saved_meta == []
