import asyncio
import importlib.util
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"


def _load_script(name: str):
    path = SCRIPTS_DIR / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Response:
    def __init__(self, payload=None, *, status_code=200, error=None):
        self._payload = payload or {}
        self.status_code = status_code
        self._error = error
        self.text = str(self._payload)

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self._error:
            raise self._error
        if self.status_code >= 400:
            raise RuntimeError(f"http {self.status_code}")


def test_full_deploy_refresh_switches_to_rotated_access_token():
    module = _load_script("smoke_full_deploy")

    class Client:
        def __init__(self):
            self.headers = {"Authorization": "Bearer old"}

        def post(self, *_args, **_kwargs):
            return _Response({"access_token": "new-access", "refresh_token": "new-refresh"})

    client = Client()
    payload = module.verify_refresh(client, "http://example/api/v1", "old-refresh")

    assert payload["refresh_token"] == "new-refresh"
    assert client.headers["Authorization"] == "Bearer new-access"


def test_full_deploy_waits_for_typst_job_terminal_success(monkeypatch):
    module = _load_script("smoke_full_deploy")
    monkeypatch.setattr(module.time, "sleep", lambda _seconds: None)

    class Client:
        def __init__(self):
            self.states = iter(["PENDING", "STARTED", "SUCCESS"])

        def get(self, *_args, **_kwargs):
            return _Response({"state": next(self.states)})

    module.wait_typst_job(
        Client(),
        "http://example/api/v1",
        "job-1",
        attempts=3,
        interval_seconds=0,
    )


def test_feature_suite_cleans_created_user_after_mid_flow_failure():
    module = _load_script("smoke_feature_suite")

    class Client:
        def __init__(self):
            self.deleted = []
            self.get_calls = 0

        def post(self, *_args, **_kwargs):
            return _Response({"id": 42})

        def get(self, *_args, **_kwargs):
            self.get_calls += 1
            if self.get_calls == 2:
                return _Response(status_code=500)
            return _Response({"id": 42})

        def put(self, *_args, **_kwargs):
            return _Response({"id": 42})

        def delete(self, url, **_kwargs):
            self.deleted.append(url)
            return _Response({"success": True})

    client = Client()

    with pytest.raises(RuntimeError, match="http 500"):
        module.users_crud(client, "http://example/api/v1")

    assert client.deleted == ["http://example/api/v1/users/42"]


def test_xxjs_failure_path_deletes_imported_class(monkeypatch):
    module = _load_script("smoke_xxjs_dianming")
    monkeypatch.setattr(module, "ADMIN_PASSWORD", "secret")
    monkeypatch.setattr(module, "_login", lambda: "token")
    calls = []

    def fake_http(method, url, **kwargs):
        calls.append((method, url, kwargs))
        if method == "GET":
            return 200, []
        if method == "POST":
            return 200, [{"id": 1}, {"id": 2}, {"id": 3}]
        if method == "PUT":
            return 500, {"detail": "forced"}
        if method == "DELETE":
            return 200, {"success": True, "deleted": 3}
        raise AssertionError(method)

    monkeypatch.setattr(module, "_http_json", fake_http)

    assert module.main() == 1
    assert any(method == "DELETE" and "/xxjs/dianming/class?" in url for method, url, _ in calls)


def test_owner_concurrency_main_stops_created_session(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    monkeypatch.setattr(module, "PASSWORD", "secret")
    monkeypatch.setattr(module, "OWNER_MODE", "auto")
    monkeypatch.setattr(module, "EXPECT_OWNER_BEHAVIOR", "")
    monkeypatch.setattr(module, "login", lambda: "token")
    monkeypatch.setattr(module, "create_session", lambda _token: "session-1")
    monkeypatch.setattr(module, "wait_for_ready", lambda *_args: None)

    async def fake_run(*_args, **_kwargs):
        return "deny"

    stopped = []
    monkeypatch.setattr(module, "run_owner_mode_smoke", fake_run)
    monkeypatch.setattr(module, "stop_session", lambda token, sid: stopped.append((token, sid)))

    assert module.main() == module.EXIT_OK
    assert stopped == [("token", "session-1")]


def test_dap_round_stops_session_when_ready_wait_fails(monkeypatch):
    module = _load_script("smoke_pythonlab_dap_step_watch_soak")
    monkeypatch.setattr(module, "create_session", lambda *_args: "session-2")

    def fail_ready(*_args):
        raise RuntimeError("not ready")

    stopped = []
    monkeypatch.setattr(module, "wait_ready", fail_ready)
    monkeypatch.setattr(module, "stop_session", lambda token, sid: stopped.append((token, sid)))

    with pytest.raises(RuntimeError, match="not ready"):
        asyncio.run(module.run_round("token", 1))

    assert stopped == [("token", "session-2")]
