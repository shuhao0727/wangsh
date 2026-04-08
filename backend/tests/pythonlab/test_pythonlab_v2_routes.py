import importlib
import sys


def _load_app(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("main", None)
    module = importlib.import_module("main")
    return module.app


def _collect_http_route_map(app) -> set[tuple[str, str]]:
    pairs: set[tuple[str, str]] = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if not path or not path.startswith("/api/v2/pythonlab") or not methods:
            continue
        for method in methods:
            pairs.add((path, method))
    return pairs


def _collect_route_paths(app) -> set[str]:
    return {
        path
        for path in (getattr(route, "path", None) for route in app.routes)
        if path and path.startswith("/api/v2/pythonlab")
    }


def test_pythonlab_v2_http_routes_registered(monkeypatch):
    app = _load_app(monkeypatch)
    route_map = _collect_http_route_map(app)

    expected = {
        ("/api/v2/pythonlab/sessions", "POST"),
        ("/api/v2/pythonlab/sessions", "GET"),
        ("/api/v2/pythonlab/sessions/{session_id}", "GET"),
        ("/api/v2/pythonlab/sessions/{session_id}/stop", "POST"),
        ("/api/v2/pythonlab/sessions/cleanup", "POST"),
        ("/api/v2/pythonlab/flow/parse", "POST"),
        ("/api/v2/pythonlab/flow/generate_code", "POST"),
        ("/api/v2/pythonlab/flow/prompt_template", "GET"),
        ("/api/v2/pythonlab/flow/prompt_template", "POST"),
        ("/api/v2/pythonlab/flow/test_agent_connection", "POST"),
        ("/api/v2/pythonlab/ai/chat", "POST"),
        ("/api/v2/pythonlab/syntax/check", "POST"),
        ("/api/v2/pythonlab/cfg/parse", "POST"),
        ("/api/v2/pythonlab/compat/deprecated_usage", "GET"),
        ("/api/v2/pythonlab/optimize/code", "POST"),
        ("/api/v2/pythonlab/optimize/apply/{log_id}", "POST"),
        ("/api/v2/pythonlab/optimize/rollback/{log_id}", "GET"),
    }

    missing = expected - route_map
    assert not missing, f"missing v2 HTTP routes: {sorted(missing)}"


def test_pythonlab_v2_websocket_routes_registered(monkeypatch):
    app = _load_app(monkeypatch)
    paths = _collect_route_paths(app)

    expected = {
        "/api/v2/pythonlab/sessions/{session_id}/ws",
        "/api/v2/pythonlab/sessions/{session_id}/terminal",
    }

    missing = expected - paths
    assert not missing, f"missing v2 websocket routes: {sorted(missing)}"
