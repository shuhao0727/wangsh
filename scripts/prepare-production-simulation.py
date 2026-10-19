#!/usr/bin/env python3
"""Create an isolated Compose document without loading app settings or executing Docker."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
import re
import sys


PROJECT = "wangsh_sim"
NETWORK = "wangsh-network"
SOCKET = "/var/run/docker.sock"
WORKSPACE_TARGET = "/tmp/pythonlab/workspaces"
MOUNTS = {
    "postgres": {"/var/lib/postgresql/data": "simulation_postgres"},
    "redis": {"/data": "simulation_redis"},
    "backend": {
        "/app/data/typst_pdfs": "typst_pdfs",
        "/app/uploads": "uploads_data",
        SOCKET: "socket",
        WORKSPACE_TARGET: "workspace",
    },
    "typst-worker": {"/app/data/typst_pdfs": "typst_pdfs"},
    "pythonlab-worker": {SOCKET: "socket", WORKSPACE_TARGET: "workspace"},
    "pythonlab-sandbox": {},
    "frontend": {},
    "gateway": {},
}
FORBIDDEN_SERVICE_FIELDS = {
    "configs", "secrets", "env_file", "label_file", "extends", "provider",
    "volumes_from", "network_mode", "external_links", "links",
    "devices", "device_cgroup_rules", "privileged", "pid", "ipc", "uts",
    "tmpfs", "use_api_socket", "credential_spec",
}


class SimulationConfigError(ValueError):
    """An unsafe or unsupported input, with a message that contains no input values."""


def _workspace_path(workspace: str, repo_root: Path) -> str:
    candidate = Path(workspace)
    root = repo_root.resolve()
    simulation_root = root / "data/pythonlab/simulations"
    if not candidate.is_absolute() or not re.fullmatch(r"run\.[A-Za-z0-9_-]+", candidate.name):
        raise SimulationConfigError("workspace must be an absolute simulation run directory")
    if candidate.parent != simulation_root:
        raise SimulationConfigError("workspace must belong to this repository's simulation directory")
    current = root
    for part in candidate.relative_to(root).parts:
        current /= part
        if current.is_symlink():
            raise SimulationConfigError("workspace cannot contain symbolic links")
    if not candidate.is_dir():
        raise SimulationConfigError("workspace must already exist as a directory")
    return str(candidate)


def _simulation_port(port: str | int) -> int:
    if isinstance(port, bool) or not re.fullmatch(r"[0-9]+", str(port)):
        raise SimulationConfigError("invalid simulation port")
    value = int(port)
    if not 1 <= value <= 65535 or value in {6608, 8000, 5432, 6379}:
        raise SimulationConfigError("simulation port is invalid or reserved for normal services")
    return value


def _isolated_mount(mount: dict, source: str, workspace: str) -> dict:
    if mount.get("type") not in {"bind", "volume"} or not isinstance(mount.get("source"), str):
        raise SimulationConfigError("unsupported service mount source")
    target = mount["target"]
    if source == "socket":
        if mount["type"] != "bind" or mount["source"] != SOCKET:
            raise SimulationConfigError("Docker socket must use its exact source and target")
        return {"type": "bind", "source": SOCKET, "target": SOCKET}
    if source == "workspace":
        if mount["type"] != "bind":
            raise SimulationConfigError("PythonLab workspace must be a bind mount")
        return {"type": "bind", "source": workspace, "target": target}
    return {"type": "volume", "source": source, "target": target}


def _service_mounts(volumes: list, allowed_mounts: dict, workspace: str) -> list:
    if not isinstance(volumes, list):
        raise SimulationConfigError("service mounts must use normalized Compose objects")
    seen_targets = set()
    result = []
    for mount in volumes:
        if not isinstance(mount, dict):
            raise SimulationConfigError("service mounts must use normalized Compose objects")
        target = mount.get("target")
        if not isinstance(target, str) or target not in allowed_mounts or target in seen_targets:
            raise SimulationConfigError("unknown or duplicate service mount target")
        seen_targets.add(target)
        result.append(_isolated_mount(mount, allowed_mounts[target], workspace))
    if seen_targets != set(allowed_mounts):
        raise SimulationConfigError("required simulation service mounts are missing")
    return result


def _isolated_service(original: dict, name: str, workspace: str, port: int) -> dict:
    if not isinstance(original, dict):
        raise SimulationConfigError("service configuration must be an object")
    if any(key in original for key in FORBIDDEN_SERVICE_FIELDS):
        raise SimulationConfigError("unsupported service input or host access")
    if not isinstance(original.get("image"), str) or not original["image"]:
        raise SimulationConfigError("each simulation service must have a resolved image")
    service = copy.deepcopy(original)
    for key in ("container_name", "build", "ports"):
        service.pop(key, None)
    service["networks"] = {NETWORK: {}}
    mounts = _service_mounts(service.pop("volumes", []), MOUNTS[name], workspace)
    if mounts:
        service["volumes"] = mounts
    if name == "gateway":
        service["ports"] = [{
            "host_ip": "127.0.0.1", "target": 80,
            "published": str(port), "protocol": "tcp",
        }]
    return service


def prepare_simulation(
    config: dict,
    *,
    workspace: str,
    port: str | int,
    repo_root: Path | None = None,
) -> dict:
    """Return an isolated copy of a normalized Compose JSON document."""
    workspace_source = _workspace_path(
        workspace, repo_root if repo_root is not None else Path(__file__).resolve().parents[1]
    )
    published_port = _simulation_port(port)
    if not isinstance(config, dict):
        raise SimulationConfigError("Compose input must be an object")
    for key in config:
        if key not in {"name", "version", "services", "networks", "volumes"} and not key.startswith("x-"):
            raise SimulationConfigError("unsupported top-level Compose field")
    services = config.get("services")
    if not isinstance(services, dict) or set(services) != set(MOUNTS):
        raise SimulationConfigError("Compose input must contain exactly the eight production services")

    result = {
        "name": PROJECT,
        "services": {},
        "networks": {NETWORK: {"driver": "bridge"}},
        "volumes": {
            "simulation_postgres": {},
            "simulation_redis": {},
            "typst_pdfs": {},
            "uploads_data": {},
        },
    }
    for name in MOUNTS:
        result["services"][name] = _isolated_service(
            services[name], name, workspace_source, published_port
        )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--port", required=True)
    args = parser.parse_args()
    try:
        config = json.load(sys.stdin)
        result = prepare_simulation(config, workspace=args.workspace, port=args.port)
    except (SimulationConfigError, ValueError, OSError, TypeError):
        # Never echo the document, exception text, paths, secrets or a traceback.
        sys.stderr.write("Refusing unsafe or invalid production simulation configuration.\n")
        return 2
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
