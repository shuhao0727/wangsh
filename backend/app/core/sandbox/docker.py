import asyncio
import os
import subprocess
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.sandbox.base import SandboxProvider

logger = logging.getLogger(__name__)

def _run(cmd: List[str], timeout_s: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout_s)

def _workspace_root() -> Path:
    p = Path(str(getattr(settings, "PYTHONLAB_WORKSPACE_ROOT", "/var/lib/pythonlab/workspaces") or "/var/lib/pythonlab/workspaces"))
    return p

class DockerProvider(SandboxProvider):
    def __init__(self):
        self.runtime = getattr(settings, "PYTHONLAB_DOCKER_RUNTIME", "runc")
        self.image = getattr(settings, "PYTHONLAB_SANDBOX_IMAGE", "pythonlab-sandbox:py311")
        self.debugpy_port = int(getattr(settings, "PYTHONLAB_DEBUGPY_PORT", 5678) or 5678)
        self._available_runtimes = None

    def _get_available_runtimes(self) -> List[str]:
        if self._available_runtimes is not None:
            return self._available_runtimes
        try:
            # Output example: {"runc":{"path":"runc"},"runsc":{"path":"runsc"}}
            proc = _run(["docker", "info", "--format", "{{json .Runtimes}}"], timeout_s=5)
            if proc.returncode == 0 and proc.stdout.strip():
                import json
                data = json.loads(proc.stdout)
                self._available_runtimes = list(data.keys())
            else:
                self._available_runtimes = ["runc"]
        except Exception as e:
            logger.warning(f"Failed to detect docker runtimes: {e}")
            self._available_runtimes = ["runc"]
        return self._available_runtimes

    def _container_name(self, meta: Dict[str, Any]) -> str:
        user_id = meta.get("owner_user_id")
        if user_id:
            return f"pythonlab_u{user_id}"
        return f"pythonlab_{meta.get('session_id')}"

    def _ws_path_for_session(self, meta: Dict[str, Any]) -> Path:
        user_id = meta.get("owner_user_id")
        ws_root = _workspace_root()
        if user_id:
            return ws_root / f"u{user_id}"
        return ws_root / str(meta.get("session_id"))

    async def start_session(self, session_id: str, code: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start a Docker container for the session (with User-based Reuse Strategy).
        """
        ws_path = self._ws_path_for_session(meta)
        name = self._container_name(meta)
        
        # 1. Prepare Workspace Files (always overwrite)
        self._prepare_workspace_files(ws_path, code, meta)

        mem_mb = int(meta.get("limits", {}).get("memory_mb") or 512)
        
        # 2. Check if container exists and is running (Reuse)
        if self._docker_is_running(name):
            logger.info(f"Reusing existing container: {name}")
            # Soft restart: kill debugpy adapter loop to force reload
            try:
                _run(["docker", "exec", name, "pkill", "-f", "debugpy"], timeout_s=5)
            except Exception:
                pass
            
            # Resolve port
            host_port = self._get_dynamic_port(name)
            if host_port > 0:
                # Wait for readiness (fast check)
                try:
                    await self._wait_for_readiness(name, host_port)
                    return {
                        "docker_container_id": name, # Use name as ID for easier lookup
                        "dap_host": getattr(settings, "DAP_HOST_IP", "host.docker.internal"),
                        "dap_port": host_port,
                        "workspace_path": str(ws_path)
                    }
                except Exception as e:
                    logger.warning(f"Reuse failed readiness check: {e}, recreating...")
                    # Fallthrough to recreate
            
            # If port resolution failed or readiness failed, kill and recreate
            _run(["docker", "rm", "-f", name], timeout_s=30)

        # Cleanup stopped/dead container with same name
        try:
            _run(["docker", "rm", "-f", name], timeout_s=30)
        except Exception:
            pass

        # 3. Build Command
        host_ws_root_str = os.getenv("HOST_WORKSPACE_ROOT")
        if host_ws_root_str:
            # Map logic: /var/lib/pythonlab/workspaces/u123 -> $HOST_ROOT/u123
            mount_path = Path(host_ws_root_str) / ws_path.name
        else:
            mount_path = ws_path
        
        # Resource Limits
        limits = meta.get("limits", {})
        cpu_quota = int(limits.get("cpu_quota") or settings.PYTHONLAB_DEFAULT_CPU_QUOTA)
        mem_mb = int(limits.get("memory_mb") or settings.PYTHONLAB_DEFAULT_MEMORY_MB)

        loop_cmd = (
            "i=0; "
            "while true; do "
            "i=$((i+1)); "
            f"python -m debugpy.adapter --host 0.0.0.0 --port {self.debugpy_port} --log-stderr; "
            "rc=$?; "
            'echo "debugpy.adapter exited rc=$rc (iter=$i)" 1>&2; '
            "sleep 0.2; "
            "done"
        )
        
        cmd = [
            "docker", "run", "-d", "-i", "-t",
            "--name", name,
            "--security-opt", "no-new-privileges",
            "--cap-drop", "ALL",
            "--user", "1000:1000",
            "--pids-limit", str(settings.PYTHONLAB_CONTAINER_PIDS_LIMIT),
            "--memory", f"{mem_mb}m",
            "--memory-swap", "-1",
            "--cpu-period", "100000",
            "--cpu-quota", str(cpu_quota),
            "--log-driver", "json-file",
            "--log-opt", f"max-size={settings.PYTHONLAB_LOG_MAX_SIZE}",
            "--log-opt", f"max-file={settings.PYTHONLAB_LOG_MAX_FILE}",
            "-e", "PYTHONPATH=/workspace",
            "-e", "PYTHONUNBUFFERED=1",
            "-p", f"{self.debugpy_port}",
            "-v", f"{str(mount_path)}:/workspace:rw",
        ]
        
        if self.runtime and self.runtime != "runc":
            available = self._get_available_runtimes()
            if self.runtime in available:
                cmd.extend(["--runtime", self.runtime])

        cmd.extend([self.image, "sh", "-lc", loop_cmd])

        # 4. Run Container
        try:
            proc = _run(cmd, timeout_s=60)
            if proc.returncode != 0:
                raise RuntimeError(f"Docker start failed: {(proc.stderr or proc.stdout or '').strip()[:1000]}")
            container_id = (proc.stdout or "").strip()
        except Exception as e:
            raise RuntimeError(f"Docker start exception: {str(e)}")

        # 5. Get Dynamic Port
        host_port = 0
        for _ in range(5): 
            host_port = self._get_dynamic_port(container_id)
            if host_port > 0:
                break
            await asyncio.sleep(0.5)

        if host_port <= 0:
             logs_res = _run(["docker", "logs", "--tail", "50", container_id], timeout_s=5)
             logs = (logs_res.stdout or "") + (logs_res.stderr or "")
             try:
                _run(["docker", "rm", "-f", container_id], timeout_s=30)
             except: pass
             raise RuntimeError(f"Failed to resolve dynamic port. Logs: {logs[:500]}")

        # 6. Wait for Readiness
        await self._wait_for_readiness(container_id, host_port)

        return {
            "docker_container_id": container_id,
            "dap_host": getattr(settings, "DAP_HOST_IP", "host.docker.internal"),
            "dap_port": host_port,
            "workspace_path": str(ws_path)
        }

    async def stop_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        """Soft stop: kill process but keep container."""
        name = self._container_name(meta)
        try:
            # Only kill debugpy, loop will restart it and wait for next connection
            _run(["docker", "exec", name, "pkill", "-f", "debugpy"], timeout_s=10)
        except Exception:
            pass
        # Do NOT remove workspace or container

    async def terminate_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        """Hard stop: remove container and workspace."""
        name = self._container_name(meta)
        try:
            _run(["docker", "rm", "-f", name], timeout_s=30)
        except Exception:
            pass
        
        ws_path = meta.get("workspace_path")
        if not ws_path:
            ws_path = self._ws_path_for_session(meta)
        
        try:
            p = Path(ws_path)
            if p.exists() and p.is_dir():
                shutil.rmtree(str(p), ignore_errors=True)
        except Exception:
            pass

    async def list_active_sessions(self) -> List[str]:
        try:
            # Returns list of user_ids (e.g. "u123") derived from container names
            proc = _run(["docker", "ps", "-a", "--filter", "name=pythonlab_", "--format", "{{.Names}}"], timeout_s=20)
            if proc.returncode != 0:
                return []
            names = [x.strip() for x in (proc.stdout or "").splitlines() if x.strip()]
            # pythonlab_u123 -> u123
            # pythonlab_sessionuuid -> sessionuuid
            return [name[len("pythonlab_") :] for name in names if name.startswith("pythonlab_")]
        except Exception:
            return []

    async def is_healthy(self, session_id: str, meta: Dict[str, Any]) -> bool:
        name = self._container_name(meta)
        return self._docker_is_running(name)

    def _prepare_workspace_files(self, ws_path: Path, code: str, meta: Dict[str, Any]):
        import json
        ws_path.mkdir(parents=True, exist_ok=True)
        (ws_path / "main.py").write_text(code, encoding="utf-8")
        (ws_path / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        from app.core.sandbox.base import get_sitecustomize_content
        (ws_path / "sitecustomize.py").write_text(
            get_sitecustomize_content(), encoding="utf-8"
        )
        try:
            ws_path.chmod(0o755)
            (ws_path / "main.py").chmod(0o644)
            (ws_path / "meta.json").chmod(0o644)
            (ws_path / "sitecustomize.py").chmod(0o644)
        except Exception:
            pass

    def _get_dynamic_port(self, container_id: str) -> int:
        try:
            cmd = ["docker", "port", container_id, f"{self.debugpy_port}/tcp"]
            proc_port = _run(cmd, timeout_s=10)
            if proc_port.returncode != 0:
                return 0
            out = (proc_port.stdout or "").strip()
            if out:
                lines = out.splitlines()
                for line in lines:
                    parts = line.strip().split(":")
                    if len(parts) >= 2:
                        try:
                            port = int(parts[-1])
                            if port > 0:
                                return port
                        except ValueError:
                            continue
        except Exception as e:
            logger.error(f"Error getting dynamic port: {e}")
            pass
        return 0

    def _docker_is_running(self, container_id: str) -> bool:
        try:
            proc = _run(["docker", "inspect", "-f", "{{.State.Status}}", container_id], timeout_s=5)
            if proc.returncode != 0:
                return False
            return (proc.stdout or "").strip() == "running"
        except Exception:
            return False
            
    def _debugpy_is_listening(self, container_id: str, port: int) -> bool:
        try:
            # Check if port is listening on HOST side (faster than docker exec)
            # But we are in a container (backend), so we can't check host ports easily unless we use mapped IP
            # We can try to connect to dap_host:port
            
            # Fallback to docker exec for reliability if network is tricky
            proc = _run(["docker", "exec", container_id, "cat", "/proc/net/tcp", "/proc/net/tcp6"], timeout_s=5)
            if proc.returncode != 0:
                return False
            
            port_hex = f"{int(port):04X}"
            for line in proc.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 4:
                    if f":{port_hex}" in parts[1] and parts[3] == "0A":
                        return True
            return False
        except Exception:
            return False

    async def _wait_for_readiness(self, container_id: str, host_port: int):
        # logger.info(f"Waiting for debugpy readiness on {container_id}:{host_port}")
        
        for _ in range(150): # 30 seconds
            if not self._docker_is_running(container_id):
                 raise RuntimeError(f"Container exited prematurely.")

            if self._debugpy_is_listening(container_id, self.debugpy_port):
                return
            
            await asyncio.sleep(0.2)
        
        raise RuntimeError(f"debugpy readiness timeout after 30s")
