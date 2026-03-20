import asyncio
import os
import pty
import logging
import shutil
import json
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings
from app.core.sandbox.base import SandboxProvider, get_sitecustomize_content
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
                await client.eval(script, 1, self.lock_key, self.identifier)  # type: ignore[misc]
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
        self.readiness_timeout = float(getattr(settings, "PYTHONLAB_READINESS_TIMEOUT_SECONDS", 30) or 30)
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

    async def _kill_debugpy_in_container(self, container_id: str) -> None:
        kill_py = (
            "import os, signal; "
            "try: "
            "  for p in os.listdir('/proc'): "
            "    if p.isdigit() and p != str(os.getpid()): "
            "      try: "
            "        with open(f'/proc/{p}/cmdline', 'rb') as f: "
            "          if b'debugpy' in f.read(): "
            "            os.kill(int(p), signal.SIGKILL) "
            "      except: pass "
            "except: pass"
        )
        await _run_async(["docker", "exec", container_id, "python", "-c", kill_py], timeout_s=8)

    async def start_session(self, session_id: str, code: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start a Docker container for the session (with User-based Reuse Strategy).
        Uses Redis Distributed Lock to handle concurrency.
        """
        name = self._container_name(meta)
        runtime_mode = str(meta.get("runtime_mode") or "debug").lower()
        
        async with RedisDistributedLock(name, timeout=120):
            ws_path = self._ws_path_for_session(meta)
            
            # 1. Prepare Workspace Files (always overwrite)
            # TODO: Consider making this async with aiofiles if disk I/O becomes a bottleneck
            self._prepare_workspace_files(ws_path, code, meta)

            # 2. Check if container exists and is running (Reuse)
            if await self._docker_is_running(name):
                logger.info(f"Reusing existing container: {name}")
                if runtime_mode == "debug":
                    try:
                        await self._kill_debugpy_in_container(name)
                    except Exception:
                        pass
                    host_port = await self._get_dynamic_port(name)
                    if host_port > 0:
                        try:
                            await self._wait_for_readiness(name, host_port, runtime_mode)
                            return {
                                "docker_container_id": name,
                                "dap_host": getattr(settings, "DAP_HOST_IP", "host.docker.internal"),
                                "dap_port": host_port,
                                "workspace_path": str(ws_path)
                            }
                        except Exception as e:
                            logger.warning(f"Reuse failed readiness check: {e}, recreating...")
                    await _run_async(["docker", "rm", "-f", name], timeout_s=30)
                else:
                    return {
                        "docker_container_id": name,
                        "dap_host": None,
                        "dap_port": None,
                        "workspace_path": str(ws_path)
                    }

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
            mem_mb_limit = int(limits.get("memory_mb") or settings.PYTHONLAB_DEFAULT_MEMORY_MB)
            mem_mb = mem_mb_limit if mem_mb_limit > 0 else int(settings.PYTHONLAB_DEFAULT_MEMORY_MB)

            if runtime_mode == "debug":
                # Use python to kill debugpy since ps/pkill might be missing
                kill_py = (
                    "import os, signal; "
                    "try: "
                    " for p in os.listdir('/proc'): "
                    "  if p.isdigit() and p!=str(os.getpid()): "
                    "   try: "
                    "    with open('/proc/%s/cmdline'%p,'rb') as f: "
                    "     if b'debugpy' in f.read(): os.kill(int(p), signal.SIGKILL) "
                    "   except: pass "
                    "except: pass"
                )
                loop_cmd = (
                    f"i=0; "
                    f"while true; do "
                    f"i=$((i+1)); "
                    f"python -c \"{kill_py}\" >/dev/null 2>&1 || true; "
                    f"sleep 0.25; "
                    f"env PYDEVD_DISABLE_FILE_VALIDATION=1 PYDEVD_CONNECT_TIMEOUT=15 "
                    f"python -Xfrozen_modules=off -m debugpy --log-to /tmp/debugpy --listen 0.0.0.0:{self.debugpy_port} --wait-for-client /workspace/main.py; "
                    f"rc=$?; "
                    f"echo \"debugpy exited rc=$rc (iter=$i)\" 1>&2; "
                    f"sleep 0.8; "
                    f"done"
                )
            else:
                loop_cmd = "exec tail -f /dev/null"
            
            cmd = [
                "docker", "run", "-d", "-i", "-t",
                "--name", name,
                "--security-opt", "no-new-privileges",
                "--cap-drop", "ALL",
                "--user", "1000:1000",
                "--pids-limit", str(settings.PYTHONLAB_CONTAINER_PIDS_LIMIT),
                "--memory", f"{mem_mb}m",
                "--memory-swap", f"{mem_mb}m",
                "--cpu-period", "100000",
                "--cpu-quota", str(cpu_quota),
                "--log-driver", "json-file",
                "--log-opt", f"max-size={settings.PYTHONLAB_LOG_MAX_SIZE}",
                "--log-opt", f"max-file={settings.PYTHONLAB_LOG_MAX_FILE}",
                # Limit /tmp writes to 50MB tmpfs to prevent disk-fill attacks
                "--tmpfs", "/tmp:rw,noexec,nosuid,size=50m",
                "-e", "PYTHONPATH=/workspace",
                "-e", "PYTHONUNBUFFERED=1",
                "-w", "/workspace",  # Force working directory
                "-v", f"{str(mount_path)}:/workspace:rw",
            ]
            if runtime_mode == "debug":
                cmd.extend(["-p", f"{self.debugpy_port}"])
            else:
                # Plain mode: fully isolate network to prevent student code from accessing external services
                cmd.extend(["--network", "none"])
            
            if self.runtime and self.runtime != "runc":
                available = await self._get_available_runtimes()
                if self.runtime in available:
                    cmd.extend(["--runtime", self.runtime])

            cmd.extend([self.image, "sh", "-lc", loop_cmd])

            # 4. Run Container
            try:
                rc, out, err = await _run_async(cmd, timeout_s=60)
                if rc != 0:
                    logger.error(f"Docker start failed: {(err or out or '').strip()[:1000]}")
                    raise RuntimeError("运行环境启动失败，请稍后重试。如持续失败请联系老师。")
                container_id = (out or "").strip()
            except Exception as e:
                logger.error(f"Docker start exception: {e}")
                raise RuntimeError("运行环境启动异常，请稍后重试。")

            if runtime_mode == "debug":
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
                    except Exception:
                        pass
                    logger.error(f"Failed to resolve dynamic port. Logs: {logs[:500]}")
                    raise RuntimeError("调试端口分配失败，请重试运行。")
                await self._wait_for_readiness(container_id, host_port, runtime_mode)
                return {
                    "docker_container_id": container_id,
                    "dap_host": getattr(settings, "DAP_HOST_IP", "host.docker.internal"),
                    "dap_port": host_port,
                    "workspace_path": str(ws_path)
                }
            await self._wait_for_readiness(container_id, 0, runtime_mode)
            return {
                "docker_container_id": container_id,
                "dap_host": None,
                "dap_port": None,
                "workspace_path": str(ws_path)
            }

    async def stop_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        """Soft stop: kill process but keep container."""
        name = self._container_name(meta)
        runtime_mode = str(meta.get("runtime_mode") or "debug").lower()
        async with RedisDistributedLock(name, timeout=15):
            if runtime_mode == "plain":
                try:
                    await _run_async(["docker", "rm", "-f", name], timeout_s=30)
                except Exception:
                    pass
                return
            try:
                await self._kill_debugpy_in_container(name)
            except Exception:
                pass

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

    async def attach_tty(self, session_id: str, meta: Dict[str, Any]) -> Tuple[Any, int]:
        """
        Attach to the session's TTY using docker attach.
        Returns a (reader, writer) pair or process object.
        Actually, we return the process object so caller can access stdin/stdout.
        """
        name = self._container_name(meta)
        if not await self._docker_is_running(name):
             raise RuntimeError("Container not running")
        
        # Use docker attach with a pseudo-tty so docker won't reject non-tty stdin.
        cmd = ["docker", "attach", name]
        master_fd, slave_fd = pty.openpty()
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                close_fds=True
            )
        except Exception:
            os.close(master_fd)
            os.close(slave_fd)
            raise
        os.close(slave_fd)
        return process, master_fd

    def _prepare_workspace_files(self, ws_path: Path, code: str, meta: Dict[str, Any]):
        import json
        ws_path.mkdir(parents=True, exist_ok=True)

        (ws_path / "main.py").write_text(code, encoding="utf-8")
        (ws_path / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        # Inject sitecustomize.py to block network access at Python level (defense-in-depth)
        (ws_path / "sitecustomize.py").write_text(get_sitecustomize_content(), encoding="utf-8")
        try:
            ws_path.chmod(0o755)
            (ws_path / "main.py").chmod(0o644)
            (ws_path / "meta.json").chmod(0o644)
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

    async def _debugpy_dap_ready(self, host_port: int) -> bool:
        if host_port <= 0:
            return False
        writer: Optional[asyncio.StreamWriter] = None
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection("127.0.0.1", int(host_port)),
                timeout=1.0,
            )
            req = {
                "seq": 1,
                "type": "request",
                "command": "initialize",
                "arguments": {
                    "adapterID": "python",
                    "linesStartAt1": True,
                    "columnsStartAt1": True,
                    "pathFormat": "path",
                },
            }
            raw = json.dumps(req, ensure_ascii=False).encode("utf-8")
            writer.write(f"Content-Length: {len(raw)}\r\n\r\n".encode("utf-8"))
            writer.write(raw)
            await writer.drain()
            deadline = time.monotonic() + 3.0
            while time.monotonic() < deadline:
                headers: Dict[str, str] = {}
                while True:
                    line = await asyncio.wait_for(reader.readline(), timeout=1.0)
                    if not line:
                        raise RuntimeError("dap header eof")
                    s = line.decode("utf-8", errors="replace").strip()
                    if s == "":
                        break
                    if ":" in s:
                        k, v = s.split(":", 1)
                        headers[k.strip().lower()] = v.strip()
                n = int(headers.get("content-length") or "0")
                if n <= 0:
                    raise RuntimeError("dap content-length missing")
                body = await asyncio.wait_for(reader.readexactly(n), timeout=1.0)
                msg = json.loads(body.decode("utf-8", errors="replace"))
                if msg.get("type") == "response" and msg.get("command") == "initialize":
                    return True
            return False
        except Exception:
            return False
        finally:
            if writer is not None:
                try:
                    writer.close()
                    await writer.wait_closed()
                except Exception:
                    pass

    async def _wait_for_readiness(self, container_id: str, host_port: int, runtime_mode: str = "debug"):
        deadline = time.monotonic() + self.readiness_timeout
        while time.monotonic() < deadline:
            if not await self._docker_is_running(container_id):
                 raise RuntimeError("运行环境异常退出，请重试。如持续失败请联系老师。")
            if runtime_mode != "debug":
                return
            listening = await self._debugpy_is_listening(container_id, self.debugpy_port)
            if listening:
                return
            await asyncio.sleep(0.2)
        # Timeout: cleanup the container to avoid orphans
        try:
            await _run_async(["docker", "rm", "-f", container_id], timeout_s=10)
        except Exception:
            pass
        raise RuntimeError("调试服务启动超时，请重试运行。如持续失败请联系老师检查服务状态。")
