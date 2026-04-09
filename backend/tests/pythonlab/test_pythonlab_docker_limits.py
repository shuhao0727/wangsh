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
