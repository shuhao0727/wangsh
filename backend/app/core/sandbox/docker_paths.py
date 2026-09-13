"""PythonLab 容器路径解析（host mount 推导）。

从 ``docker.py`` 拆出的内聚职责：把容器内工作区路径解析成宿主机路径，
供 ``docker run -v`` 与调试器使用。实现与拆分前完全一致，只是模块边界
从 DockerProvider 收窄为 mixin；调用方（DockerProvider 及其实例级测试
patch）接口不变。
"""
import os
from pathlib import Path
from typing import Optional

from loguru import logger

from app.core.config import settings


def _workspace_root() -> Path:
    p = Path(str(getattr(settings, "PYTHONLAB_WORKSPACE_ROOT", "/var/lib/pythonlab/workspaces") or "/var/lib/pythonlab/workspaces"))
    return p


class DockerMountMixin:
    def _resolve_host_mount_path_from_mountinfo(self, container_path: Path) -> Optional[Path]:
        mountinfo = Path("/proc/self/mountinfo")
        if not mountinfo.exists():
            return None

        best_match: Optional[tuple[Path, str, str]] = None
        try:
            for raw_line in mountinfo.read_text(encoding="utf-8").splitlines():
                if " - " not in raw_line:
                    continue
                left, right = raw_line.split(" - ", 1)
                left_fields = left.split()
                right_fields = right.split()
                if len(left_fields) < 5 or len(right_fields) < 2:
                    continue
                root = left_fields[3]
                mount_point = Path(left_fields[4])
                mount_source = right_fields[1]
                try:
                    container_path.relative_to(mount_point)
                except ValueError:
                    continue
                if best_match is None or len(str(mount_point)) > len(str(best_match[0])):
                    best_match = (mount_point, root, mount_source)
        except Exception as e:
            logger.warning(f"Failed to parse /proc/self/mountinfo: {e}")
            return None

        if best_match is None:
            return None

        mount_point, root, mount_source = best_match
        relative = container_path.relative_to(mount_point)
        root_clean = str(root or "").strip()
        source_clean = str(mount_source or "").strip()
        root_rel = root_clean.lstrip("/")

        if source_clean.startswith("/run/host_mark/"):
            host_anchor = Path("/") / Path(source_clean).name
            base = host_anchor / root_rel if root_rel else host_anchor
            resolved = base / relative
            logger.info("Resolved host path %s via mountinfo host_mark -> %s", container_path, resolved)
            return resolved

        if source_clean.startswith("/host_mnt/"):
            base = Path(source_clean)
            if root_clean not in {"", "/"}:
                base = base / root_rel
            resolved = base / relative
            logger.info("Resolved host path %s via mountinfo host_mnt -> %s", container_path, resolved)
            return resolved

        if source_clean.startswith("/") and not source_clean.startswith("/run/"):
            if source_clean.startswith("/dev/"):
                logger.warning(
                    "Skipping mountinfo absolute source for %s because %s is a device path",
                    container_path,
                    source_clean,
                )
                return None
            base = Path(source_clean)
            if root_clean not in {"", "/"}:
                base = base / root_rel
            resolved = base / relative
            logger.info("Resolved host path %s via mountinfo absolute source -> %s", container_path, resolved)
            return resolved

        return None

    def _resolve_host_mount_path_from_workspace_root(self, container_path: Path) -> Optional[Path]:
        host_ws_root_str = str(os.getenv("HOST_WORKSPACE_ROOT") or "").strip()
        if not host_ws_root_str:
            return None

        ws_root = _workspace_root()
        # In containerized deployments the default HOST_WORKSPACE_ROOT used to
        # match the in-container workspace path. Passing that through to
        # `docker run -v` makes Docker mount an empty host path (for example
        # `/tmp/pythonlab/workspaces/...`) instead of the real bind-mounted
        # project directory, so debugpy cannot see `/workspace/main.py`.
        if Path(host_ws_root_str) == ws_root:
            logger.warning(
                "Ignoring HOST_WORKSPACE_ROOT=%s because it matches PYTHONLAB_WORKSPACE_ROOT; "
                "falling back to bind mount / mountinfo resolution",
                host_ws_root_str,
            )
            return None

        try:
            relative = container_path.relative_to(ws_root)
        except ValueError:
            return None

        host_ws_root = Path(host_ws_root_str)
        resolved = host_ws_root / relative
        logger.info("Resolved host path %s via HOST_WORKSPACE_ROOT -> %s", container_path, resolved)
        return resolved
