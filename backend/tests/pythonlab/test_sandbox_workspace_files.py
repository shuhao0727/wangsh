import stat
from pathlib import Path

import pytest

from app.core.sandbox.docker import DockerProvider


def test_prepare_workspace_files_replaces_symlinks_without_following(tmp_path):
    root = tmp_path / "workspaces"
    victim_dir = root / "u2"
    victim_dir.mkdir(parents=True)
    victim_main = victim_dir / "main.py"
    victim_main.write_text("victim\n", encoding="utf-8")
    victim_meta = victim_dir / "meta.json"
    victim_meta.write_text("victim-meta\n", encoding="utf-8")

    ws = root / "u1"
    ws.mkdir()
    (ws / "main.py").symlink_to(victim_main)
    (ws / "meta.json").symlink_to("../u2/meta.json")
    (ws / "sitecustomize.py").symlink_to(victim_main)

    provider = DockerProvider()
    provider._prepare_workspace_files(ws, "attacker\n", {"session_id": "s1"})

    assert victim_main.read_text(encoding="utf-8") == "victim\n"
    assert victim_meta.read_text(encoding="utf-8") == "victim-meta\n"
    assert not (ws / "main.py").is_symlink()
    assert (ws / "main.py").read_text(encoding="utf-8") == "attacker\n"
    assert not (ws / "meta.json").is_symlink()
    assert '"session_id": "s1"' in (ws / "meta.json").read_text(encoding="utf-8")
    assert not (ws / "sitecustomize.py").is_symlink()
    assert (ws / "sitecustomize.py").read_text(encoding="utf-8").strip()
    assert not list(root.glob(".u1.*.tmp"))


def test_prepare_workspace_files_rejects_symlink_workspace(tmp_path):
    root = tmp_path / "workspaces"
    root.mkdir()
    target = root / "u2"
    target.mkdir()
    ws = root / "u1"
    ws.symlink_to(target, target_is_directory=True)

    provider = DockerProvider()
    with pytest.raises(RuntimeError):
        provider._prepare_workspace_files(ws, "attacker\n", {})

    assert not (target / "main.py").exists()


def test_prepare_workspace_files_restores_unwritable_workspace(tmp_path):
    """学生把自己的 workspace 改成只读后，worker 仍应能写入并恢复权限。

    学生容器与 worker 同 UID，chmod 掉目录写权限会让 os.replace 失败；
    这不是拒绝写入的理由，工作区必须能自愈。
    """
    root = tmp_path / "workspaces"
    root.mkdir()
    ws = root / "u1"
    ws.mkdir()
    ws.chmod(0o500)

    provider = DockerProvider()
    provider._prepare_workspace_files(ws, "print('hi')\n", {"session_id": "s1"})

    assert (ws / "main.py").read_text(encoding="utf-8") == "print('hi')\n"
    assert (ws / "sitecustomize.py").read_text(encoding="utf-8").strip()
    assert stat.S_IMODE(ws.stat().st_mode) == 0o755
    assert not list(root.glob(".u1.*.tmp"))
