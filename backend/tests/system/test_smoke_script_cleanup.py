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
            self.get_calls = 0
            self.post_calls = []

        def get(self, *_args, **_kwargs):
            self.get_calls += 1
            return _Response({"state": next(self.states)})

        def post(self, *args, **kwargs):
            self.post_calls.append((args, kwargs))
            return _Response()

    client = Client()
    module.wait_typst_job(
        client,
        "http://example/api/v1",
        "job-1",
        attempts=3,
        interval_seconds=0,
    )

    assert client.get_calls == 3
    assert client.post_calls == []


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


def test_owner_concurrency_stop_200_retains_final_cleanup_eligibility(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    stopped = []
    tracked = []
    monkeypatch.setattr(
        module,
        "stop_session",
        lambda token, sid: stopped.append((token, sid)),
    )

    module.stop_tracked_session("token", "session-1", tracked)
    module.stop_tracked_session("token", "session-1", tracked)

    assert stopped == [("token", "session-1"), ("token", "session-1")]
    assert tracked == ["session-1"]


def test_owner_concurrency_matrix_retains_all_sessions_for_final_cleanup(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    monkeypatch.setattr(module, "PASSWORD", "secret")
    monkeypatch.setattr(module, "OWNER_MODE", "matrix")
    monkeypatch.setattr(module, "EXPECT_OWNER_BEHAVIOR", "steal")
    monkeypatch.setattr(module, "RUNTIME_RETRY_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(module, "login", lambda: "token")

    sessions = iter(["detect", "strict-busy", "strict-ready"])
    events = []

    def fake_create(_token, **_kwargs):
        sid = next(sessions)
        events.append(("create", sid))
        return sid

    def fake_wait(_token, sid, **_kwargs):
        events.append(("wait", sid))
        if sid == "strict-busy":
            raise RuntimeError(f"session failed: {module.RUNTIME_BUSY_ERROR}")

    async def fake_run(_token, sid, mode, expected=""):
        events.append(("run", sid, mode, expected))
        return "steal"

    def fake_stop(token, sid):
        events.append(("stop", token, sid))

    monkeypatch.setattr(module, "create_session", fake_create)
    monkeypatch.setattr(module, "wait_for_ready", fake_wait)
    monkeypatch.setattr(module, "run_owner_mode_smoke", fake_run)
    monkeypatch.setattr(module, "stop_session", fake_stop)

    assert module.main() == module.EXIT_OK
    assert events == [
        ("create", "detect"),
        ("wait", "detect"),
        ("run", "detect", "auto", ""),
        ("stop", "token", "detect"),
        ("create", "strict-busy"),
        ("wait", "strict-busy"),
        ("stop", "token", "strict-busy"),
        ("create", "strict-ready"),
        ("wait", "strict-ready"),
        ("run", "strict-ready", "auto", "steal"),
        # A successful HTTP stop is only an asynchronous cleanup request. The
        # final pass retries every created session, including earlier stops.
        ("stop", "token", "strict-ready"),
        ("stop", "token", "strict-busy"),
        ("stop", "token", "detect"),
    ]


def test_owner_concurrency_cleanup_deadline_caps_create_request(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    clock = {"now": 100.0}
    captured_timeouts = []
    monkeypatch.setattr(module.time, "monotonic", lambda: clock["now"])

    def timeout_post(*_args, timeout, **_kwargs):
        captured_timeouts.append(timeout)
        raise module.requests.Timeout("synthetic create timeout")

    monkeypatch.setattr(module.requests, "post", timeout_post)

    with pytest.raises(module.SmokeFailure) as exc_info:
        module.create_session(
            "token",
            deadline=105.0,
            lifecycle_label="matrix strict",
            attempt=2,
        )

    assert captured_timeouts == [5.0]
    assert exc_info.value.code == module.EXIT_DETECT
    assert exc_info.value.category == "lifecycle"


def test_owner_concurrency_cleanup_deadline_caps_ready_wait(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    clock = {"now": 200.0}
    captured_timeouts = []
    monkeypatch.setattr(module.time, "monotonic", lambda: clock["now"])

    def timeout_get(*_args, timeout, **_kwargs):
        captured_timeouts.append(timeout)
        raise module.requests.Timeout("synthetic status timeout")

    monkeypatch.setattr(module.requests, "get", timeout_get)

    with pytest.raises(module.SmokeFailure) as exc_info:
        module.wait_for_ready(
            "token",
            "session-1",
            deadline=204.0,
            lifecycle_label="matrix strict",
            attempt=1,
        )

    assert captured_timeouts == [4.0]
    assert exc_info.value.code == module.EXIT_DETECT
    assert exc_info.value.category == "lifecycle"


def test_owner_concurrency_ready_observed_after_cleanup_deadline_is_lifecycle(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    clock = {"now": 225.0}
    monkeypatch.setattr(module.time, "monotonic", lambda: clock["now"])

    def late_ready(*_args, **_kwargs):
        clock["now"] = 230.0
        return _Response({"status": "READY"})

    monkeypatch.setattr(module.requests, "get", late_ready)

    with pytest.raises(module.SmokeFailure) as exc_info:
        module.wait_for_ready(
            "token",
            "session-1",
            deadline=230.0,
            lifecycle_label="matrix strict",
            attempt=1,
        )

    assert exc_info.value.code == module.EXIT_DETECT
    assert exc_info.value.category == "lifecycle"


def test_owner_concurrency_late_create_is_tracked_before_lifecycle_timeout(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    monkeypatch.setattr(module, "RUNTIME_CLEANUP_TIMEOUT_SECONDS", 5)
    clock = {"now": 400.0}
    get_calls = []
    monkeypatch.setattr(module.time, "monotonic", lambda: clock["now"])

    def late_create(*_args, **_kwargs):
        clock["now"] = 406.0
        return _Response({"session_id": "late-session"})

    monkeypatch.setattr(module.requests, "post", late_create)
    monkeypatch.setattr(
        module.requests,
        "get",
        lambda *_args, **_kwargs: get_calls.append(True),
    )

    tracked = []
    with pytest.raises(module.SmokeFailure) as exc_info:
        module.create_ready_session(
            "token",
            tracked,
            "matrix strict",
            retry_runtime_busy=True,
        )

    assert tracked == ["late-session"]
    assert get_calls == []
    assert exc_info.value.code == module.EXIT_DETECT
    assert exc_info.value.category == "lifecycle"


def test_owner_concurrency_cleanup_deadline_prevents_another_create(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    monkeypatch.setattr(module, "RUNTIME_CLEANUP_MAX_ATTEMPTS", 3)
    monkeypatch.setattr(module, "RUNTIME_CLEANUP_TIMEOUT_SECONDS", 1)
    monkeypatch.setattr(module, "RUNTIME_RETRY_INTERVAL_SECONDS", 5)

    clock = {"now": 250.0}
    created = []
    monkeypatch.setattr(module.time, "monotonic", lambda: clock["now"])
    monkeypatch.setattr(
        module.time,
        "sleep",
        lambda seconds: clock.__setitem__("now", clock["now"] + seconds),
    )

    def fake_create(_token, **_kwargs):
        created.append("busy-1")
        return "busy-1"

    def fake_wait(_token, _sid, **_kwargs):
        raise RuntimeError(f"session failed: {module.RUNTIME_BUSY_ERROR}")

    monkeypatch.setattr(module, "create_session", fake_create)
    monkeypatch.setattr(module, "wait_for_ready", fake_wait)
    monkeypatch.setattr(module, "stop_session", lambda *_args: None)

    with pytest.raises(module.SmokeFailure) as exc_info:
        module.create_ready_session(
            "token",
            [],
            "matrix strict",
            retry_runtime_busy=True,
        )

    assert created == ["busy-1"]
    assert exc_info.value.code == module.EXIT_DETECT
    assert exc_info.value.category == "lifecycle"
    assert "timeout" in str(exc_info.value)


def test_owner_concurrency_runtime_busy_retry_requires_exact_error(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    created = []
    stopped = []

    def fake_create(_token, **_kwargs):
        sid = f"session-{len(created) + 1}"
        created.append(sid)
        return sid

    def fake_wait(_token, _sid, **_kwargs):
        raise RuntimeError(
            f"session failed: {module.RUNTIME_BUSY_ERROR} cleanup permanently failed"
        )

    monkeypatch.setattr(module, "create_session", fake_create)
    monkeypatch.setattr(module, "wait_for_ready", fake_wait)
    monkeypatch.setattr(module, "stop_session", lambda _token, sid: stopped.append(sid))

    tracked = []
    with pytest.raises(RuntimeError, match="cleanup permanently failed"):
        module.create_ready_session(
            "token",
            tracked,
            "matrix strict",
            retry_runtime_busy=True,
        )

    assert created == ["session-1"]
    assert tracked == created
    assert stopped == []


def test_owner_concurrency_runtime_busy_retry_is_bounded_and_backed_off(monkeypatch):
    module = _load_script("smoke_pythonlab_ws_owner_concurrency")
    monkeypatch.setattr(module, "RUNTIME_CLEANUP_MAX_ATTEMPTS", 3)
    monkeypatch.setattr(module, "RUNTIME_CLEANUP_TIMEOUT_SECONDS", 60)
    monkeypatch.setattr(module, "RUNTIME_RETRY_INTERVAL_SECONDS", 1)
    monkeypatch.setattr(module, "RUNTIME_RETRY_MAX_INTERVAL_SECONDS", 1.5)

    clock = {"now": 300.0}
    sleeps = []
    created = []
    stopped = []
    monkeypatch.setattr(module.time, "monotonic", lambda: clock["now"])

    def fake_sleep(seconds):
        sleeps.append(seconds)
        clock["now"] += seconds

    def fake_create(_token, **_kwargs):
        sid = f"busy-{len(created) + 1}"
        created.append(sid)
        return sid

    def fake_wait(_token, _sid, **_kwargs):
        raise RuntimeError(f"session failed: {module.RUNTIME_BUSY_ERROR}")

    monkeypatch.setattr(module.time, "sleep", fake_sleep)
    monkeypatch.setattr(module, "create_session", fake_create)
    monkeypatch.setattr(module, "wait_for_ready", fake_wait)
    monkeypatch.setattr(module, "stop_session", lambda _token, sid: stopped.append(sid))

    tracked = []
    with pytest.raises(module.SmokeFailure) as exc_info:
        module.create_ready_session(
            "token",
            tracked,
            "matrix strict",
            retry_runtime_busy=True,
        )

    assert created == ["busy-1", "busy-2", "busy-3"]
    assert stopped == created
    assert tracked == created
    assert sleeps == [1, 1.5]
    assert exc_info.value.code == module.EXIT_DETECT
    assert exc_info.value.category == "lifecycle"
    assert "3 bounded attempts" in str(exc_info.value)


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
