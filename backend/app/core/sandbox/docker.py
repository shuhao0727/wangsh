import asyncio
import os
import logging
import shutil
import json
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings
from app.core.sandbox.base import SandboxProvider
from app.utils.cache import cache

logger = logging.getLogger(__name__)

class RedisDistributedLock:
    """Distributed lock implementation using Redis."""
    def __init__(self, lock_name: str, timeout: int = 30, retry_interval: float = 0.1):
        self.lock_key = f"lock:docker_pool:{lock_name}"
        self.timeout = timeout  # Lock expiry in seconds
        self.retry_interval = retry_interval
        self.identifier = str(uuid.uuid4())
        self._locked = False

    async def __aenter__(self):
        client = await cache.get_client()
        end_time = time.time() + self.timeout
        while time.time() < end_time:
            # NX=True: set only if not exists
            # PX: set expiry in milliseconds
            if await client.set(self.lock_key, self.identifier, nx=True, px=self.timeout * 1000):
                self._locked = True
                return self
            await asyncio.sleep(self.retry_interval)
        
        raise TimeoutError(f"Could not acquire lock for {self.lock_key}")

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._locked:
            try:
                client = await cache.get_client()
                # Lua script for atomic release: delete only if value matches identifier
                script = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
                """
                await client.eval(script, 1, self.lock_key, self.identifier)
            except Exception as e:
                logger.error(f"Error releasing lock {self.lock_key}: {e}")
            finally:
                self._locked = False

async def _run_async(cmd: List[str], timeout_s: int = 30) -> Tuple[int, str, str]:
    """
    Asynchronously run a subprocess command.
    Returns (returncode, stdout, stderr)
    """
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_s)
            return (
                process.returncode or 0,
                stdout.decode().strip() if stdout else "",
                stderr.decode().strip() if stderr else ""
            )
        except asyncio.TimeoutError:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            raise RuntimeError(f"Command timed out after {timeout_s}s: {' '.join(cmd)}")
    except Exception as e:
        raise RuntimeError(f"Failed to run command {' '.join(cmd)}: {e}")

def _workspace_root() -> Path:
    p = Path(str(getattr(settings, "PYTHONLAB_WORKSPACE_ROOT", "/var/lib/pythonlab/workspaces") or "/var/lib/pythonlab/workspaces"))
    return p

class DockerProvider(SandboxProvider):
    def __init__(self):
        self.runtime = getattr(settings, "PYTHONLAB_DOCKER_RUNTIME", "runc")
        self.image = getattr(settings, "PYTHONLAB_SANDBOX_IMAGE", "pythonlab-sandbox:py311")
        self.debugpy_port = int(getattr(settings, "PYTHONLAB_DEBUGPY_PORT", 5678) or 5678)
        self._available_runtimes = None

    async def _get_available_runtimes(self) -> List[str]:
        if self._available_runtimes is not None:
            return self._available_runtimes
        try:
            # Output example: {"runc":{"path":"runc"},"runsc":{"path":"runsc"}}
            rc, out, _ = await _run_async(["docker", "info", "--format", "{{json .Runtimes}}"], timeout_s=5)
            if rc == 0 and out:
                data = json.loads(out)
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
        Uses Redis Distributed Lock to handle concurrency.
        """
        name = self._container_name(meta)
        
        async with RedisDistributedLock(name, timeout=30):
            ws_path = self._ws_path_for_session(meta)
            
            # 1. Prepare Workspace Files (always overwrite)
            # TODO: Consider making this async with aiofiles if disk I/O becomes a bottleneck
            self._prepare_workspace_files(ws_path, code, meta)

            # 2. Check if container exists and is running (Reuse)
            if await self._docker_is_running(name):
                logger.info(f"Reusing existing container: {name}")
                # Soft restart: kill debugpy adapter loop to force reload
                try:
                    await _run_async(["docker", "exec", name, "pkill", "-f", "debugpy"], timeout_s=5)
                except Exception:
                    pass
                
                # Resolve port
                host_port = await self._get_dynamic_port(name)
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
                await _run_async(["docker", "rm", "-f", name], timeout_s=30)

            # Cleanup stopped/dead container with same name
            try:
                await _run_async(["docker", "rm", "-f", name], timeout_s=30)
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
            # Force 32MB limit per Phase 1 optimization, but respect stricter limits if provided
            mem_mb_limit = int(limits.get("memory_mb") or settings.PYTHONLAB_DEFAULT_MEMORY_MB)
            mem_mb = min(mem_mb_limit, 32) if mem_mb_limit > 0 else 32

            # Use tini as entrypoint (defined in Dockerfile), so we just run the loop
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
                available = await self._get_available_runtimes()
                if self.runtime in available:
                    cmd.extend(["--runtime", self.runtime])

            cmd.extend([self.image, "sh", "-lc", loop_cmd])

            # 4. Run Container
            try:
                rc, out, err = await _run_async(cmd, timeout_s=60)
                if rc != 0:
                    raise RuntimeError(f"Docker start failed: {(err or out or '').strip()[:1000]}")
                container_id = (out or "").strip()
            except Exception as e:
                raise RuntimeError(f"Docker start exception: {str(e)}")

            # 5. Get Dynamic Port
            host_port = 0
            for _ in range(5): 
                host_port = await self._get_dynamic_port(container_id)
                if host_port > 0:
                    break
                await asyncio.sleep(0.5)

            if host_port <= 0:
                 rc, out, err = await _run_async(["docker", "logs", "--tail", "50", container_id], timeout_s=5)
                 logs = (out or "") + (err or "")
                 try:
                    await _run_async(["docker", "rm", "-f", container_id], timeout_s=30)
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
        async with RedisDistributedLock(name, timeout=15):
            try:
                # Only kill debugpy, loop will restart it and wait for next connection
                await _run_async(["docker", "exec", name, "pkill", "-f", "debugpy"], timeout_s=10)
            except Exception:
                pass
            # Do NOT remove workspace or container

    async def terminate_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        """Hard stop: remove container and workspace."""
        name = self._container_name(meta)
        async with RedisDistributedLock(name, timeout=30):
            try:
                await _run_async(["docker", "rm", "-f", name], timeout_s=30)
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
            rc, out, _ = await _run_async(["docker", "ps", "-a", "--filter", "name=pythonlab_", "--format", "{{.Names}}"], timeout_s=20)
            if rc != 0:
                return []
            names = [x.strip() for x in (out or "").splitlines() if x.strip()]
            # pythonlab_u123 -> u123
            # pythonlab_sessionuuid -> sessionuuid
            return [name[len("pythonlab_") :] for name in names if name.startswith("pythonlab_")]
        except Exception:
            return []

    async def is_healthy(self, session_id: str, meta: Dict[str, Any]) -> bool:
        name = self._container_name(meta)
        return await self._docker_is_running(name)

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

    async def _get_dynamic_port(self, container_id: str) -> int:
        try:
            cmd = ["docker", "port", container_id, f"{self.debugpy_port}/tcp"]
            rc, out, _ = await _run_async(cmd, timeout_s=10)
            if rc != 0:
                return 0
            out = (out or "").strip()
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

    async def _docker_is_running(self, container_id: str) -> bool:
        try:
            rc, out, _ = await _run_async(["docker", "inspect", "-f", "{{.State.Status}}", container_id], timeout_s=5)
            if rc != 0:
                return False
            return (out or "").strip() == "running"
        except Exception:
            return False
            
    async def _debugpy_is_listening(self, container_id: str, port: int) -> bool:
        try:
            # Fallback to docker exec for reliability if network is tricky
            rc, out, _ = await _run_async(["docker", "exec", container_id, "cat", "/proc/net/tcp", "/proc/net/tcp6"], timeout_s=5)
            if rc != 0:
                return False
            
            port_hex = f"{int(port):04X}"
            for line in out.splitlines():
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
            if not await self._docker_is_running(container_id):
                 raise RuntimeError(f"Container exited prematurely.")

            if await self._debugpy_is_listening(container_id, self.debugpy_port):
                return
            
            await asyncio.sleep(0.2)
        
        raise RuntimeError(f"debugpy readiness timeout after 30s")
