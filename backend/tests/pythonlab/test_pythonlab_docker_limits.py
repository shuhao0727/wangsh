import asyncio
from pathlib import Path

import app.core.sandbox.docker as docker_api


def test_resolve_memory_mb_limit_uses_default_when_request_missing():
    assert docker_api._resolve_memory_mb_limit({}, 512) == 512


def test_resolve_memory_mb_limit_honors_lower_requested_limit():
    assert docker_api._resolve_memory_mb_limit({"memory_mb": 64}, 512) == 64


def test_resolve_memory_mb_limit_keeps_api_minimum_floor():
    assert docker_api._resolve_memory_mb_limit({"memory_mb": 1}, 512) == 32


def test_resolve_host_mount_path_prefers_host_workspace_root_over_mountinfo(monkeypatch):
    provider = docker_api.DockerProvider()
    container_path = Path("/tmp/pythonlab/workspaces/u1")

    async def fake_bind_mounts():
        return []

    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_WORKSPACE_ROOT", "/tmp/pythonlab/workspaces", raising=False)
    monkeypatch.setenv("HOST_WORKSPACE_ROOT", "/home/shuhao/wangsh/data/pythonlab/workspaces")
    monkeypatch.setattr(provider, "_get_current_container_bind_mounts", fake_bind_mounts)
    monkeypatch.setattr(
        provider,
        "_resolve_host_mount_path_from_mountinfo",
        lambda path: Path("/dev/mapper/ubuntu--vg-ubuntu--lv/home/shuhao/wangsh/data/pythonlab/workspaces/u1"),
    )

    resolved = asyncio.run(provider._resolve_host_mount_path(container_path))

    assert resolved == Path("/home/shuhao/wangsh/data/pythonlab/workspaces/u1")


def test_resolve_host_mount_path_preserves_workspace_relative_path(monkeypatch):
    provider = docker_api.DockerProvider()
    container_path = Path("/tmp/pythonlab/workspaces/u1/.python/current.py")

    async def fake_bind_mounts():
        return []

    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_WORKSPACE_ROOT", "/tmp/pythonlab/workspaces", raising=False)
    monkeypatch.setenv("HOST_WORKSPACE_ROOT", "/home/shuhao/wangsh/data/pythonlab/workspaces")
    monkeypatch.setattr(provider, "_get_current_container_bind_mounts", fake_bind_mounts)
    monkeypatch.setattr(provider, "_resolve_host_mount_path_from_mountinfo", lambda path: None)

    resolved = asyncio.run(provider._resolve_host_mount_path(container_path))

    assert resolved == Path("/home/shuhao/wangsh/data/pythonlab/workspaces/u1/.python/current.py")


def test_resolve_host_mount_path_ignores_same_path_host_workspace_root(monkeypatch):
    provider = docker_api.DockerProvider()
    container_path = Path("/tmp/pythonlab/workspaces/u1")

    async def fake_bind_mounts():
        return [(Path("/Users/wsh/wangsh/data/pythonlab/workspaces"), Path("/tmp/pythonlab/workspaces"))]

    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_WORKSPACE_ROOT", "/tmp/pythonlab/workspaces", raising=False)
    monkeypatch.setenv("HOST_WORKSPACE_ROOT", "/tmp/pythonlab/workspaces")
    monkeypatch.setattr(provider, "_get_current_container_bind_mounts", fake_bind_mounts)
    monkeypatch.setattr(provider, "_resolve_host_mount_path_from_mountinfo", lambda path: None)

    resolved = asyncio.run(provider._resolve_host_mount_path(container_path))

    assert resolved == Path("/Users/wsh/wangsh/data/pythonlab/workspaces/u1")


def test_resolve_host_mount_path_from_mountinfo_ignores_device_source(monkeypatch):
    provider = docker_api.DockerProvider()
    original_path_type = type(Path())

    class FakePath(original_path_type):
        _mountinfo_text = ""

        def exists(self):
            if str(self) == "/proc/self/mountinfo":
                return True
            return super().exists()

        def read_text(self, *args, **kwargs):
            if str(self) == "/proc/self/mountinfo":
                return self._mountinfo_text
            return super().read_text(*args, **kwargs)

    FakePath._mountinfo_text = (
        "36 29 253:0 /home/shuhao/wangsh/data/pythonlab/workspaces "
        "/tmp/pythonlab/workspaces rw,relatime - ext4 "
        "/dev/mapper/ubuntu--vg-ubuntu--lv rw\n"
    )

    monkeypatch.setattr(docker_api, "Path", FakePath)

    resolved = provider._resolve_host_mount_path_from_mountinfo(FakePath("/tmp/pythonlab/workspaces/u1"))

    assert resolved is None


def test_plain_session_container_uses_interactive_shell(monkeypatch, tmp_path):
    provider = docker_api.DockerProvider()
    run_calls: list[list[str]] = []

    async def fake_run_async(cmd: list[str], timeout_s: int = 30):
        run_calls.append(list(cmd))
        if cmd[:3] == ["docker", "rm", "-f"]:
            return 0, "", ""
        if cmd[:3] == ["docker", "run", "-d"]:
            return 0, "plain-container-id", ""
        raise AssertionError(f"unexpected command: {cmd}")

    async def fake_is_running(_name: str):
        return False

    async def fake_resolve_host_mount_path(path: Path):
        return path

    async def fake_wait_for_readiness(_container_id: str, _host_port: int, _runtime_mode: str = "debug"):
        return None

    class FakeLock:
        def __init__(self, *_args, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc_val, _exc_tb):
            return None

    monkeypatch.setattr(docker_api, "_run_async", fake_run_async)
    monkeypatch.setattr(provider, "_docker_is_running", fake_is_running)
    monkeypatch.setattr(provider, "_resolve_host_mount_path", fake_resolve_host_mount_path)
    monkeypatch.setattr(provider, "_wait_for_readiness", fake_wait_for_readiness)
    monkeypatch.setattr(docker_api, "RedisDistributedLock", FakeLock)
    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_WORKSPACE_ROOT", str(tmp_path), raising=False)
    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_DEFAULT_CPU_QUOTA", 50000, raising=False)
    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_DEFAULT_MEMORY_MB", 128, raising=False)
    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_CONTAINER_PIDS_LIMIT", 64, raising=False)
    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_LOG_MAX_SIZE", "1m", raising=False)
    monkeypatch.setattr(docker_api.settings, "PYTHONLAB_LOG_MAX_FILE", "1", raising=False)

    result = asyncio.run(provider.start_session(
        "plain_shell",
        "print('hello')\n",
        {
            "session_id": "plain_shell",
            "owner_user_id": 7,
            "runtime_mode": "plain",
            "limits": {},
        },
    ))

    docker_run = next(cmd for cmd in run_calls if cmd[:3] == ["docker", "run", "-d"])
    assert docker_run[-4:] == [provider.image, "sh", "-lc", "exec env PS1= sh -i"]
    assert "tail -f /dev/null" not in docker_run
    assert "--network" in docker_run
    assert result["docker_container_id"] == "plain-container-id"
