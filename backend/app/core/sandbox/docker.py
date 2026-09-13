import asyncio
import os
import pty
import shutil
import json
import time
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings
from app.core.sandbox.base import SandboxProvider, get_sitecustomize_content
from app.core.sandbox.docker_runtime import (
    RedisDistributedLock, WorkspaceOwnership,
    inspect_container, check_reuse, remove_owned_container,
    run_async as _run_async,
)

from loguru import logger

from app.core.sandbox.docker_paths import DockerMountMixin, _workspace_root

def _resolve_memory_mb_limit(limits: Dict[str, Any], default_mem: int) -> int:
    requested_raw = limits.get("memory_mb") if isinstance(limits, dict) else None
    try:
        requested = int(requested_raw or 0)
    except Exception:
        logger.debug("Docker 资源限制值解析失败，使用默认值 0")
        requested = 0
    if requested > 0:
        return max(32, requested)
    return max(32, int(default_mem or 0))

class DockerProvider(DockerMountMixin, SandboxProvider):
    def __init__(self):
        self.runtime = getattr(settings, "PYTHONLAB_DOCKER_RUNTIME", "runc")
        self.image = getattr(settings, "PYTHONLAB_SANDBOX_IMAGE", "pythonlab-sandbox:py311")
        self.container_namespace = (
            str(getattr(settings, "PYTHONLAB_CONTAINER_NAMESPACE", "pythonlab") or "pythonlab").strip()
            or "pythonlab"
        )
        self.debugpy_port = int(getattr(settings, "PYTHONLAB_DEBUGPY_PORT", 5678) or 5678)
        self.readiness_timeout = float(os.getenv("PYTHONLAB_READINESS_TIMEOUT_SECONDS", None) or getattr(settings, "PYTHONLAB_READINESS_TIMEOUT_SECONDS", 60) or 60)
        self._available_runtimes = None
        self._bind_mount_cache: Optional[List[Tuple[Path, Path]]] = None

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

    async def _get_current_container_bind_mounts(self) -> List[Tuple[Path, Path]]:
        if self._bind_mount_cache is not None:
            return self._bind_mount_cache

        container_id = str(os.getenv("HOSTNAME") or "").strip()
        if not container_id:
            try:
                container_id = Path("/etc/hostname").read_text(encoding="utf-8").strip()
            except Exception:
                logger.debug("无法读取容器 hostname，bind mount 缓存禁用")
                container_id = ""
        if not container_id:
            self._bind_mount_cache = []
            return self._bind_mount_cache

        try:
            rc, out, _ = await _run_async(
                ["docker", "inspect", container_id, "--format", "{{json .Mounts}}"],
                timeout_s=10,
            )
            if rc != 0 or not out:
                self._bind_mount_cache = []
                return self._bind_mount_cache

            mounts = json.loads(out)
            bind_mounts: List[Tuple[Path, Path]] = []
            for mount in mounts:
                if str(mount.get("Type") or "") != "bind":
                    continue
                source = str(mount.get("Source") or "").strip()
                destination = str(mount.get("Destination") or "").strip()
                if not source or not destination:
                    continue
                bind_mounts.append((Path(source), Path(destination)))
            bind_mounts.sort(key=lambda item: len(str(item[1])), reverse=True)
            self._bind_mount_cache = bind_mounts
        except Exception as e:
            logger.warning(f"Failed to inspect current container mounts: {e}")
            self._bind_mount_cache = []
        return self._bind_mount_cache

    async def _resolve_host_mount_path(self, container_path: Path) -> Path:
        configured_resolved = self._resolve_host_mount_path_from_workspace_root(container_path)
        if configured_resolved is not None:
            return configured_resolved

        for source, destination in await self._get_current_container_bind_mounts():
            try:
                relative = container_path.relative_to(destination)
            except ValueError:
                continue
            resolved = source / relative
            logger.info("Resolved host path %s via bind mount %s -> %s", container_path, destination, source)
            return resolved

        mountinfo_resolved = self._resolve_host_mount_path_from_mountinfo(container_path)
        if mountinfo_resolved is not None:
            return mountinfo_resolved

        return container_path

    def _container_name(self, meta: Dict[str, Any]) -> str:
        user_id = meta.get("owner_user_id")
        if user_id:
            return f"{self.container_namespace}_u{user_id}"
        return f"{self.container_namespace}_{meta.get('session_id')}"

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
            "    if p.isdigit() and p not in (str(os.getpid()), '1'): "
            "      try: "
            "        with open(f'/proc/{p}/cmdline', 'rb') as f: "
            "          cmd = f.read(); "
            "          if b'debugpy' in cmd and cmd.startswith(b'python'): "
            "            os.kill(int(p), signal.SIGKILL) "
            "      except: pass "
            "except: pass"
        )
        await _run_async(["docker", "exec", container_id, "python", "-c", kill_py], timeout_s=8)

    async def start_session(self, session_id: str, code: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start or reuse a user container under a non-expiring workspace fence.
        The trusted journal records the generation before the fence is released.
        """
        name = self._container_name(meta)
        runtime_mode = str(meta.get("runtime_mode") or "debug").lower()
        
        ws_path = self._ws_path_for_session(meta)
        async with WorkspaceOwnership(_workspace_root(), ws_path, timeout=120) as ownership, RedisDistributedLock(name, timeout=120):
            record = ownership.read()
            if record and (record.get('phase') not in {'live', 'removed'}
                           or record.get('container_name') != name):
                raise RuntimeError('运行环境归属状态待核对，拒绝覆盖。')
            
            if runtime_mode not in {"plain", "debug"}:
                raise ValueError("Unsupported sandbox runtime mode")
            limits = meta.get("limits") or {}
            cpu_quota = int(limits.get("cpu_quota") or settings.PYTHONLAB_DEFAULT_CPU_QUOTA)
            mem_mb = _resolve_memory_mb_limit(limits, int(settings.PYTHONLAB_DEFAULT_MEMORY_MB))
            mount_path = await self._resolve_host_mount_path(ws_path)
            effective_runtime = self.runtime or "runc"
            if effective_runtime != "runc" and effective_runtime not in await self._get_available_runtimes():
                effective_runtime = "runc"
            expected = {
                "mode": runtime_mode, "image": self.image, "mount": str(mount_path),
                "host": {"Memory": mem_mb * 1024**2, "MemorySwap": mem_mb * 1024**2,
                         "CpuPeriod": 100000, "CpuQuota": cpu_quota,
                         "PidsLimit": settings.PYTHONLAB_CONTAINER_PIDS_LIMIT,
                         "Runtime": effective_runtime},
            }
            existing = await inspect_container(_run_async, name)
            if existing and existing.get("State", {}).get("Status") == "running":
                return await self._reuse_running_container(
                    session_id, code, meta, existing=existing, expected=expected,
                    ws_path=ws_path, ownership=ownership, record=record,
                )
            if existing:
                await self._retire_existing_container(session_id, meta, name, existing, ownership)

            quota_mb = settings.PYTHONLAB_WORKSPACE_DISK_QUOTA_MB
            if mount_path.exists():
                total_size = sum(f.stat().st_size for f in mount_path.rglob('*') if f.is_file())
                if total_size > quota_mb * 1024 * 1024:
                    raise RuntimeError(f"Workspace exceeds disk quota: {total_size / 1024 / 1024:.1f}MB > {quota_mb}MB")
            record = ownership.claim(session_id, meta, name)
            self._prepare_workspace_files(ws_path, code, {**meta, "session_id": session_id})

            if runtime_mode == "debug":
                # Use python to kill debugpy since ps/pkill might be missing
                kill_py = (
                    "import os, signal; "
                    "try: "
                    " for p in os.listdir('/proc'): "
                    "  if p.isdigit() and p not in (str(os.getpid()),'1'): "
                    "   try: "
                    "    with open('/proc/%s/cmdline'%p,'rb') as f: "
                    "     cmd=f.read(); "
                    "     if b'debugpy' in cmd and cmd.startswith(b'python'): os.kill(int(p), signal.SIGKILL) "
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
                    f"python -Xfrozen_modules=off -m debugpy --listen 0.0.0.0:{self.debugpy_port} --wait-for-client /workspace/main.py; "
                    f"rc=$?; "
                    f"echo \"debugpy exited rc=$rc (iter=$i)\" 1>&2; "
                    f"sleep 0.8; "
                    f"done"
                )
            else:
                # Plain sessions are driven through the terminal WebSocket by
                # writing a command to the container TTY after attach. Keep a
                # real shell on stdin; `tail -f /dev/null` ignores stdin, so
                # attached commands would never start the student's program.
                # Start with echo off so the hidden launch command is not
                # mistaken for program output; it is re-enabled before Python.
                loop_cmd = "stty -echo 2>/dev/null || true; exec env PS1= sh -i"
            
            cmd = [
                "docker", "run", "-d", "-i", "-t",
                "--name", name,
                "--label", f"wangsh.pythonlab.runtime-mode={runtime_mode}",
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
                # Limit /tmp writes to 100MB tmpfs to prevent disk-fill attacks
                "--tmpfs", "/tmp:rw,noexec,nosuid,size=100m",
                "-e", "PYTHONPATH=/workspace",
                "-e", "PYTHONUNBUFFERED=1",
                "-w", "/workspace",  # Force working directory
                "-v", f"{str(mount_path)}:/workspace:rw",
            ]
            if runtime_mode == "debug":
                # NET_BIND_SERVICE needed for debugpy to bind to its port
                cmd.extend(["--cap-add", "NET_BIND_SERVICE"])
                cmd.extend(["-p", f"{self.debugpy_port}"])
            else:
                # Plain mode: fully isolate network to prevent student code from accessing external services
                cmd.extend(["--network", "none"])
            
            if self.runtime and self.runtime != "runc":
                available = await self._get_available_runtimes()
                if self.runtime in available:
                    cmd.extend(["--runtime", self.runtime])

            cmd.extend([self.image, "sh", "-lc", loop_cmd])

            return await self._start_new_container(cmd, runtime_mode, ws_path, ownership, record)

    @staticmethod
    def _live_owner_record(record: Optional[Dict[str, Any]], container_id: str) -> Optional[Dict[str, Any]]:
        if not record or record.get('phase') != 'live':
            raise RuntimeError('已有运行环境缺少可信 live 归属，拒绝接管或删除。')
        if record.get('container_id') != container_id:
            raise RuntimeError('运行环境已被外部替换，拒绝接管。')
        return record

    async def _reuse_running_container(
        self, session_id: str, code: str, meta: Dict[str, Any], *,
        existing: Dict[str, Any], expected: Dict[str, Any], ws_path: Path,
        ownership: WorkspaceOwnership, record: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Validate and transfer a running generation while holding its fence."""
        runtime_mode = expected["mode"]
        name = self._container_name(meta)
        live_owner = self._live_owner_record(record, existing['Id'])
        same_session = await check_reuse(_run_async, existing, expected, ws_path, session_id, live_owner)
        if same_session and live_owner and record.get('startup_task_id') != meta.get('startup_task_id'):
            raise RuntimeError('同会话的另一个启动任务仍拥有运行环境。')
        container_id = existing["Id"]
        host_port = await self._get_dynamic_port(container_id) if runtime_mode == "debug" else 0
        if runtime_mode == "debug" and host_port <= 0:
            raise RuntimeError("已有调试环境端口不可用，请先停止旧会话。")
        if not (same_session and live_owner):
            record = ownership.claim(session_id, meta, name, container_id)
        if not same_session:
            self._prepare_workspace_files(ws_path, code, {**meta, 'session_id': session_id})
        return {**self._start_result(container_id, ws_path, host_port), 'sandbox_owner_token': record['token']}

    async def _retire_existing_container(
        self, session_id: str, meta: Dict[str, Any], name: str,
        existing: Dict[str, Any], ownership: WorkspaceOwnership,
    ) -> None:
        """Persist a deletion barrier before removing an inspected predecessor."""
        # A terminal state is not permission to delete an externally replaced ID.
        self._live_owner_record(ownership.read(), existing['Id'])
        # Never remove a paused/restarting/unknown-state resource.
        if existing.get("State", {}).get("Status") not in {"exited", "dead", "created"}:
            raise RuntimeError("已有运行环境状态未知，拒绝覆盖。")
        record = ownership.claim(session_id, meta, name, existing['Id'])
        record['phase'] = 'deleting'
        ownership.write(record)
        await remove_owned_container(_run_async, existing["Id"])
        record['phase'] = 'removed'
        ownership.write(record)

    def _start_result(self, container_id: str, ws_path: Path, host_port: int) -> Dict[str, Any]:
        return {
            "docker_container_id": container_id,
            "dap_host": getattr(settings, "DAP_HOST_IP", "host.docker.internal") if host_port else None,
            "dap_port": host_port or None,
            "workspace_path": str(ws_path),
        }

    async def _start_new_container(self, cmd: List[str], runtime_mode: str, ws_path: Path, ownership: WorkspaceOwnership, record: Dict[str, Any]) -> Dict[str, Any]:
        # Docker writes the ID before start: even a timed-out CLI can leave a
        # created container. The private cidfile identifies only this attempt,
        # never a same-name container owned by another session/worker.
        with tempfile.TemporaryDirectory(prefix="pythonlab-start-") as temp_dir:
            cidfile = Path(temp_dir) / "container.cid"
            cmd[3:3] = ["--cidfile", str(cidfile)]
            container_id = ""
            try:
                rc, out, err = await _run_async(cmd, timeout_s=60)
                if rc:
                    logger.error("Docker start failed: {}", (err or out or "")[:1000])
                    raise RuntimeError("运行环境启动失败，请联系老师检查配置。")
                container_id = out.strip()
                if not container_id:
                    raise RuntimeError("运行环境创建未返回资源标识。")
                record.update(container_id=container_id, phase='live')
                ownership.write(record)
                host_port = 0
                if runtime_mode == "debug":
                    for _ in range(5):
                        host_port = await self._get_dynamic_port(container_id)
                        if host_port > 0:
                            break
                        await asyncio.sleep(0.5)
                    if host_port <= 0:
                        raise TimeoutError("调试端口分配超时，请重试运行。")
                await self._wait_for_readiness(container_id, host_port, runtime_mode)
                return {**self._start_result(container_id, ws_path, host_port), 'sandbox_owner_token': record['token']}
            except BaseException:
                owned_id = container_id or (cidfile.read_text().strip() if cidfile.exists() else "")
                if owned_id:
                    # Persist the deletion barrier BEFORE awaiting Docker. If a
                    # cancelled/failed CLI leaves daemon work in flight, subsequent
                    # starts must not adopt that id after the fence is released.
                    record.update(container_id=owned_id, phase='deleting')
                    ownership.write(record)
                    await remove_owned_container(_run_async, owned_id)
                    record.update(container_id=owned_id, phase='removed')
                    ownership.write(record)
                # Without a cid the creating journal remains an explicit unknown;
                # do not automatically create another possibly orphaned resource.
                raise

    async def _stop_owned(self, session_id: str, meta: Dict[str, Any], *, force: bool) -> None:
        name = self._container_name(meta)
        ws_path = self._ws_path_for_session(meta)
        async with WorkspaceOwnership(_workspace_root(), ws_path) as ownership, RedisDistributedLock(name, timeout=30):
            record = ownership.read()
            if not ownership.owns(record, session_id, meta) or record.get('container_name') != name:
                # Missing/legacy metadata and stale generations are not deletion authority.
                logger.warning("Preserving sandbox without current ownership: {}", session_id)
                return
            container_id = record['container_id']
            if not force and str(meta.get('runtime_mode') or 'debug').lower() != 'plain':
                await self._kill_debugpy_in_container(container_id)
                return
            record['phase'] = 'deleting'
            ownership.write(record)
            await remove_owned_container(_run_async, container_id)
            # Do not trust a caller-supplied workspace_path for recursive deletion.
            # Keep the fence until both resource and workspace operations finish.
            if force and ws_path.exists():
                shutil.rmtree(ws_path)
            record['phase'] = 'removed'
            ownership.write(record)

    async def stop_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        """Stop only the exact resource generation still owned by this session."""
        await self._stop_owned(session_id, meta, force=False)

    async def terminate_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        """Compare ownership and delete under the same non-expiring fence."""
        await self._stop_owned(session_id, meta, force=True)

    async def list_active_sessions(self) -> List[str]:
        try:
            prefix = f"{self.container_namespace}_"
            # Returns list of user_ids (e.g. "u123") derived from container names
            rc, out, _ = await _run_async(
                [
                    "docker",
                    "ps",
                    "-a",
                    "--filter",
                    f"name=^/{prefix}",
                    "--format",
                    "{{.Names}}",
                ],
                timeout_s=20,
            )
            if rc != 0:
                return []
            names = [x.strip() for x in (out or "").splitlines() if x.strip()]
            return [name[len(prefix) :] for name in names if name.startswith(prefix)]
        except Exception:
            logger.warning("Docker: 列出活动 PythonLab 会话失败")
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
        deadline = time.monotonic() + 5
        while not await self._docker_is_running(name):
            if time.monotonic() >= deadline:
                raise RuntimeError("Container not running")
            await asyncio.sleep(0.1)
        
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

    async def exec_tty(self, session_id: str, meta: Dict[str, Any], command: List[str]) -> Tuple[Any, int]:
        """
        Run a command inside the session container with an interactive TTY.

        Plain PythonLab runs use this instead of attaching to the idle shell and
        typing a launch command. That avoids leaking the internal launch command
        into the student's terminal and prevents its newline from being consumed
        by input().
        """
        name = self._container_name(meta)
        deadline = time.monotonic() + 5
        while not await self._docker_is_running(name):
            if time.monotonic() >= deadline:
                raise RuntimeError("Container not running")
            await asyncio.sleep(0.1)

        cmd = ["docker", "exec", "-i", "-t", name, *command]
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
        (ws_path / ".pythonlab_plain_run.sh").write_text(
            "\n".join(
                [
                    "#!/bin/sh",
                    "stty echo 2>/dev/null || true",
                    "python -u /workspace/main.py",
                    "rc=$?",
                    "printf '\\n__PYTHONLAB_DONE__:%s\\n' \"$rc\"",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        # Inject sitecustomize.py to block network access at Python level (defense-in-depth)
        (ws_path / "sitecustomize.py").write_text(get_sitecustomize_content(), encoding="utf-8")
        try:
            ws_path.chmod(0o755)
            (ws_path / "main.py").chmod(0o644)
            (ws_path / "meta.json").chmod(0o644)
            (ws_path / ".pythonlab_plain_run.sh").chmod(0o755)
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
            rc, out, err = await _run_async(["docker", "inspect", "-f", "{{.State.Status}}", container_id], timeout_s=5)
            if rc != 0:
                detail = (err or out or "").strip()
                logger.warning(
                    "Docker inspect failed for container {} rc={} detail={}",
                    container_id,
                    rc,
                    detail[:500],
                )
                return False
            return (out or "").strip() == "running"
        except Exception:
            logger.debug("Docker inspect 容器 %s 状态失败", container_id)
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
            logger.debug("Debugpy 监听检查失败 (容器 %s, 端口 %s)", container_id, port)
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
            logger.debug("DAP 就绪检查失败 (host_port=%s)", host_port)
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
            info = await inspect_container(_run_async, container_id)
            if not info or info.get("State", {}).get("Status") != "running":
                raise RuntimeError("运行环境异常退出，请重试。如持续失败请联系老师。")
            if runtime_mode != "debug":
                return
            listening = await self._debugpy_is_listening(container_id, self.debugpy_port)
            if listening:
                # 额外等待确保 debugpy 完全就绪接受 DAP 协议
                await asyncio.sleep(1.5)
                return
            await asyncio.sleep(0.2)
        # The creator owns cleanup; readiness must not remove a reused resource.
        raise TimeoutError("调试服务启动超时，请重试运行。如持续失败请联系老师检查服务状态。")
