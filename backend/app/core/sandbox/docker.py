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

    async def start_session(self, session_id: str, code: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start a Docker container for the session.
        Supports custom runtimes (gVisor/Kata) via self.runtime.
        """
        # 1. Prepare Workspace
        ws_root = _workspace_root()
        ws_path = ws_root / session_id
        
        # ... (File writing logic same as before, simplified for provider) ...
        # Note: The file writing logic is technically "storage" logic, but for local docker it's filesystem.
        # In K8s, this might need to be a PVC or ConfigMap. 
        # For now, we assume shared filesystem or volume mount logic stays here for Docker.
        
        # We need to ensure the directory exists and has files. 
        # Since the original code did this in the task, we should do it here or helper.
        # To keep it simple, I'll replicate the file creation here.
        
        self._prepare_workspace_files(ws_path, code, meta)

        mem_mb = int(meta.get("limits", {}).get("memory_mb") or 512)
        name = f"pythonlab_{session_id}"
        
        # Cleanup existing
        try:
            _run(["docker", "rm", "-f", name], timeout_s=30)
        except Exception:
            pass

        # 2. Build Command
        host_ws_root_str = os.getenv("HOST_WORKSPACE_ROOT")
        if host_ws_root_str:
             mount_path = Path(host_ws_root_str) / session_id
        else:
             mount_path = ws_path

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
            "--pids-limit", "128",
            "--memory", f"{mem_mb}m",
            # "--network", "none", # Cannot use none if we want to expose ports
            "-e", "PYTHONPATH=/workspace",
            "-e", "PYTHONUNBUFFERED=1",
            "-p", f"{self.debugpy_port}",
            "-v", f"{str(mount_path)}:/workspace:rw",
        ]
        
        # Apply Runtime (Phase 3: gVisor/Kata support)
        if self.runtime and self.runtime != "runc":
            available = self._get_available_runtimes()
            if self.runtime not in available:
                logger.warning(f"Requested runtime '{self.runtime}' not found in {available}, falling back to default")
            else:
                cmd.extend(["--runtime", self.runtime])

        cmd.extend([self.image, "sh", "-lc", loop_cmd])

        # 3. Run Container
        try:
            proc = _run(cmd, timeout_s=60)
            if proc.returncode != 0:
                raise RuntimeError(f"Docker start failed: {(proc.stderr or proc.stdout or '').strip()[:1000]}")
            container_id = (proc.stdout or "").strip()
        except Exception as e:
            raise RuntimeError(f"Docker start exception: {str(e)}")

        # 4. Get Dynamic Port
        host_port = 0
        for _ in range(5): # Retry 5 times (total 2.5s)
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
             raise RuntimeError(f"Failed to resolve dynamic port. Container logs: {logs[:500]}")

        # 5. Wait for Readiness
        await self._wait_for_readiness(container_id, host_port)

        return {
            "docker_container_id": container_id,
            "dap_host": getattr(settings, "DAP_HOST_IP", "host.docker.internal"),
            "dap_port": host_port,
            "workspace_path": str(ws_path)
        }

    async def stop_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        container_id = meta.get("docker_container_id")
        name = f"pythonlab_{session_id}"
        try:
            if container_id:
                _run(["docker", "rm", "-f", str(container_id)], timeout_s=30)
            else:
                _run(["docker", "rm", "-f", name], timeout_s=30)
        except Exception:
            pass
        
        # Cleanup Files
        ws_path = meta.get("workspace_path")
        if not ws_path:
            ws_path = _workspace_root() / session_id
        
        try:
            p = Path(ws_path)
            if p.exists() and p.is_dir():
                shutil.rmtree(str(p), ignore_errors=True)
        except Exception:
            pass

    async def list_active_sessions(self) -> List[str]:
        try:
            proc = _run(["docker", "ps", "-a", "--filter", "name=pythonlab_", "--format", "{{.Names}}"], timeout_s=20)
            if proc.returncode != 0:
                return []
            names = [x.strip() for x in (proc.stdout or "").splitlines() if x.strip()]
            return [name[len("pythonlab_") :] for name in names if name.startswith("pythonlab_")]
        except Exception:
            return []

    async def is_healthy(self, session_id: str, meta: Dict[str, Any]) -> bool:
        cid = meta.get("docker_container_id")
        if not cid:
            return False
        return self._docker_is_running(str(cid))

    def _prepare_workspace_files(self, ws_path: Path, code: str, meta: Dict[str, Any]):
        import json
        ws_path.mkdir(parents=True, exist_ok=True)
        (ws_path / "main.py").write_text(code, encoding="utf-8")
        (ws_path / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        from app.core.sandbox.base import get_sitecustomize_content
        # Sitecustomize (Networking block)
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
            
            # If docker port fails, it might be too early, return 0 to retry later or let caller handle
            if proc_port.returncode != 0:
                logger.warning(f"docker port failed: {proc_port.stderr}")
                return 0

            out = (proc_port.stdout or "").strip()
            if out:
                # Handle multiple lines (e.g. IPv4 and IPv6)
                # 0.0.0.0:55637
                # [::]:55637
                lines = out.splitlines()
                for line in lines:
                    parts = line.strip().split(":")
                    if len(parts) >= 2:
                        try:
                            port = int(parts[-1])
                            # Basic validation: avoid 0 or weird ports
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
            # Parse /proc/net/tcp directly to avoid shell pipe issues
            proc = _run(["docker", "exec", container_id, "cat", "/proc/net/tcp", "/proc/net/tcp6"], timeout_s=5)
            if proc.returncode != 0:
                return False
            
            port_hex = f"{int(port):04X}"
            for line in proc.stdout.splitlines():
                parts = line.strip().split()
                # 0: sl, 1: local_address, 2: rem_address, 3: st
                if len(parts) >= 4:
                    if f":{port_hex}" in parts[1] and parts[3] == "0A":
                        return True
            return False
        except Exception:
            return False

    async def _wait_for_readiness(self, container_id: str, host_port: int):
        logger.info(f"Waiting for debugpy readiness on {container_id}:{host_port}")
        start_time = asyncio.get_event_loop().time()
        
        for _ in range(150): # 30 seconds
            # Check if container is running first
            if not self._docker_is_running(container_id):
                 logs = _run(["docker", "logs", "--tail", "50", container_id], timeout_s=5)
                 tail = (logs.stdout or logs.stderr or "").strip()[:500]
                 raise RuntimeError(f"Container exited prematurely. Logs: {tail}")

            # Check internal listening port
            if self._debugpy_is_listening(container_id, self.debugpy_port):
                return
            
            await asyncio.sleep(0.2)
        
        # Timeout handling
        logs = _run(["docker", "logs", "--tail", "80", container_id], timeout_s=10)
        tail = (logs.stdout or logs.stderr or "").strip()[:1000]
        raise RuntimeError(f"debugpy readiness timeout after 30s. Logs: {tail}")


