import app.core.sandbox.docker as docker_api


def test_resolve_memory_mb_limit_uses_default_when_request_missing():
    assert docker_api._resolve_memory_mb_limit({}, 512) == 512


def test_resolve_memory_mb_limit_honors_lower_requested_limit():
    assert docker_api._resolve_memory_mb_limit({"memory_mb": 64}, 512) == 64


def test_resolve_memory_mb_limit_keeps_api_minimum_floor():
    assert docker_api._resolve_memory_mb_limit({"memory_mb": 1}, 512) == 32
