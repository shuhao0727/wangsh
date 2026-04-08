import asyncio
import json
import os
import uuid
import re
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, Optional

from loguru import logger

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.celery_app import celery_app
from app.db.database import get_db
from app.services.auth import get_current_user as auth_get_current_user
from app.utils.cache import cache
from app.api.pythonlab.constants import (
    CACHE_KEY_SESSION_PREFIX,
    DAP_HOST_DEFAULT,
    WORKSPACE_MAIN_PY,
    WORKSPACE_DIR,
    WS_HEARTBEAT_INTERVAL,
    WS_MAX_DAP_MSG_BYTES,
    WS_MAX_STDOUT_KB,
    WS_RATE_LIMIT_PER_SEC,
    SESSION_STATUS_READY,
    SESSION_STATUS_ATTACHED,
    SESSION_STATUS_RUNNING,
    SESSION_STATUS_STOPPED,
    SESSION_STATUS_TERMINATED,
    SESSION_STATUS_FAILED,
    SESSION_STATUS_TERMINATING,
)
from app.api.pythonlab.utils import now_iso

router = APIRouter()


def _extract_ws_token(websocket: WebSocket) -> Optional[str]:
    token = websocket.query_params.get("token")
    if token:
        return token
    for k in [settings.ACCESS_TOKEN_COOKIE_NAME, "access_token", "ws_access_token"]:
        v = websocket.cookies.get(k)
        if v:
            return v
    return None


async def _read_dap_message(reader: asyncio.StreamReader) -> Dict[str, Any]:
    headers: Dict[str, str] = {}
    while True:
        line = await reader.readline()
        if not line:
            raise EOFError("dap header eof")
        s = line.decode("utf-8", errors="replace").strip()
        if s == "":
            break
        if ":" in s:
            k, v = s.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    n = int(headers.get("content-length") or "0")
    if n <= 0:
        raise ValueError("dap content-length missing")
    body = await reader.readexactly(n)
    return json.loads(body.decode("utf-8", errors="replace"))


async def _write_dap_message(writer: asyncio.StreamWriter, msg: Dict[str, Any]) -> None:
    raw = json.dumps(msg, ensure_ascii=False).encode("utf-8")
    header = f"Content-Length: {len(raw)}\r\n\r\n".encode("utf-8")
    writer.write(header)
    writer.write(raw)
    await writer.drain()


def _normalize_client_conn_id(raw: Any) -> Optional[str]:
    s = str(raw or "").strip()
    if not s:
        return None
    s = s[:64]
    if re.fullmatch(r"[A-Za-z0-9._-]+", s):
        return s
    return None


def _validate_dap_request_payload(msg: Dict[str, Any]) -> Optional[str]:
    if msg.get("type") != "request":
        return None
    cmd = str(msg.get("command") or "")
    _raw_args = msg.get("arguments")
    args: Dict[str, Any] = _raw_args if isinstance(_raw_args, dict) else {}
    if cmd == "setBreakpoints":
        _raw_src = args.get("source")
        src: Dict[str, Any] = _raw_src if isinstance(_raw_src, dict) else {}
        if str(src.get("path") or "") != WORKSPACE_MAIN_PY:
            return f"source.path 仅允许 {WORKSPACE_MAIN_PY}"
    if cmd == "launch":
        if str(args.get("program") or "") != WORKSPACE_MAIN_PY:
            return f"program 仅允许 {WORKSPACE_MAIN_PY}"
        if str(args.get("cwd") or "") not in {"", WORKSPACE_DIR}:
            return f"cwd 仅允许 {WORKSPACE_DIR}"
    return None


def _build_dap_host_candidates(host: Any, *, in_docker: bool) -> list[str]:
    host_candidates: list[str] = []
    for raw_host in [host, "host.docker.internal", "172.17.0.1", "127.0.0.1"]:
        normalized = str(raw_host or "").strip()
        if normalized and normalized not in host_candidates:
            host_candidates.append(normalized)
    if in_docker:
        host_candidates = [item for item in host_candidates if item != "127.0.0.1"] + ["127.0.0.1"]
    return host_candidates


def _parse_last_seq(websocket: WebSocket) -> Optional[int]:
    raw = str(websocket.query_params.get("last_seq") or "").strip()
    if not raw:
        return None
    try:
        value = int(raw)
    except Exception:
        return None
    return value if value >= 0 else None


_DAP_BRIDGES: Dict[str, "DapSessionBridge"] = {}
_DAP_BRIDGES_LOCK = asyncio.Lock()


class DapSessionBridge:
    def __init__(
        self,
        *,
        session_id: str,
        session_key: str,
        meta: Dict[str, Any],
        host_candidates: list[str],
        port: int,
        limits: Dict[str, Any],
        attached_ttl: int,
        ws_log,
    ) -> None:
        self.session_id = session_id
        self.session_key = session_key
        self.meta = meta
        self.host_candidates = list(host_candidates)
        self.port = int(port)
        self.limits = dict(limits)
        self.attached_ttl = int(attached_ttl)
        self.ws_log = ws_log
        self.max_stdout_kb = int(self.limits.get("max_stdout_kb") or WS_MAX_STDOUT_KB)
        self.max_output_bytes = max(16 * 1024, self.max_stdout_kb * 1024)
        self.max_dap_msg_bytes = int(self.limits.get("max_dap_msg_bytes") or WS_MAX_DAP_MSG_BYTES)
        self.reconnect_window_s = max(
            5,
            min(
                int(getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", 1800) or 1800),
                int(getattr(settings, "PYTHONLAB_DEBUG_WS_RECONNECT_WINDOW_SECONDS", 30) or 30),
            ),
        )

        self.rate_limit_per_sec = WS_RATE_LIMIT_PER_SEC
        self.req_times: list[float] = []
        self.attached_marked = False
        self.gateway_seq = 1
        self.launch_requested = False
        self.terminated_seen = False
        self.terminated_event_forwarded = False
        self.dap_initialized = False
        self.cached_initialize_body: Optional[Dict[str, Any]] = None
        self.last_stopped_event: Optional[Dict[str, Any]] = None
        self.reconnect_bootstrap_pending = False
        self.current_client_last_seq: Optional[int] = None
        self.output_bytes = 0
        self.output_truncated = False

        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.conn_lock = asyncio.Lock()
        self.writer_lock = asyncio.Lock()
        self.client_send_lock = asyncio.Lock()
        self.buffer_active = True
        self.buffer: list[Dict[str, Any]] = []
        self.buffer_sent_idx = 0
        self.buffer_event = asyncio.Event()
        self.first_inbound_event = asyncio.Event()
        self.client_websocket: Optional[WebSocket] = None
        self.client_conn_token: Optional[str] = None
        self.last_known_websocket: Optional[WebSocket] = None
        self.current_ws_epoch: Optional[int] = None
        self.current_conn_id: Optional[str] = None
        self.current_client_conn_id: Optional[str] = None
        self.client_connected_once = False
        self.closed = False
        self.close_lock = asyncio.Lock()
        self.outbound_buffer: Deque[Dict[str, Any]] = deque(maxlen=100)
        self.reader_task: Optional[asyncio.Task] = None
        self.flush_task: Optional[asyncio.Task] = None
        self.wall_timer_task: Optional[asyncio.Task] = None
        self.idle_expiry_task: Optional[asyncio.Task] = None

    def refresh_runtime(
        self,
        *,
        meta: Dict[str, Any],
        host_candidates: list[str],
        port: int,
        limits: Dict[str, Any],
        attached_ttl: int,
    ) -> None:
        self.meta = meta
        self.host_candidates = list(host_candidates)
        self.port = int(port)
        self.limits = dict(limits)
        self.attached_ttl = int(attached_ttl)
        self.max_stdout_kb = int(self.limits.get("max_stdout_kb") or WS_MAX_STDOUT_KB)
        self.max_output_bytes = max(16 * 1024, self.max_stdout_kb * 1024)
        self.max_dap_msg_bytes = int(self.limits.get("max_dap_msg_bytes") or WS_MAX_DAP_MSG_BYTES)

    def should_preserve_runtime(self) -> bool:
        return not self.closed and self.dap_initialized and not self.terminated_seen

    async def start(self) -> None:
        if self.closed:
            raise RuntimeError("bridge closed")
        if self.reader_task is None or self.reader_task.done():
            self.reader_task = self._spawn_background_task(self._pump_tcp_to_client(), "pump_tcp_to_client")
        if self.flush_task is None or self.flush_task.done():
            self.flush_task = self._spawn_background_task(self._pump_buffer_to_tcp(), "pump_buffer_to_tcp")

    def _spawn_background_task(self, coro: Any, name: str) -> asyncio.Task:
        task = asyncio.create_task(coro)
        task.add_done_callback(lambda done: self._handle_background_task_done(name, done))
        return task

    def _handle_background_task_done(self, name: str, task: asyncio.Task) -> None:
        if task.cancelled():
            return
        try:
            exc = task.exception()
        except asyncio.CancelledError:
            return
        if exc is None:
            return
        self.ws_log("bridge_task_error", task=name, error=f"{type(exc).__name__}: {exc}")
        if self.closed:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self.close(reason=f"{name}_error"))

    async def attach_client(
        self,
        websocket: WebSocket,
        conn_token: str,
        *,
        last_seq: Optional[int],
        ws_epoch: Optional[int],
        conn_id: Optional[str],
        client_conn_id: Optional[str],
    ) -> None:
        if self.idle_expiry_task is not None and not self.idle_expiry_task.done():
            self.idle_expiry_task.cancel()
            try:
                await self.idle_expiry_task
            except BaseException:
                pass
        self.client_websocket = websocket
        self.last_known_websocket = websocket
        self.client_conn_token = conn_token
        self.current_client_last_seq = last_seq
        self.current_ws_epoch = ws_epoch
        self.current_conn_id = conn_id
        self.current_client_conn_id = client_conn_id
        self.reconnect_bootstrap_pending = self.client_connected_once and self.dap_initialized and not self.terminated_seen
        self.client_connected_once = True

        if last_seq is not None:
            replay = [item for item in list(self.outbound_buffer) if int(item.get("seq") or 0) > last_seq]
            for item in replay:
                await self._send_to_current_client(item)

    async def detach_client(self, conn_token: str) -> None:
        if self.client_conn_token != conn_token:
            return
        self.client_websocket = None
        self.client_conn_token = None
        self.current_client_last_seq = None
        self.current_ws_epoch = None
        self.current_conn_id = None
        self.current_client_conn_id = None
        self.reconnect_bootstrap_pending = False
        if self.closed or self.terminated_seen:
            await self.close(reason="detached_after_terminated")
            return
        if not self.dap_initialized and not self.first_inbound_event.is_set():
            await self.close(reason="detached_before_initialize")
            return

        async def _expire_if_idle() -> None:
            await asyncio.sleep(max(1, self.reconnect_window_s))
            if self.client_websocket is None and not self.closed and not self.terminated_seen:
                await self.close(reason="reconnect_window_expired")

        self.idle_expiry_task = asyncio.create_task(_expire_if_idle())

    async def close(self, reason: str) -> None:
        async with self.close_lock:
            if self.closed:
                return
            self.closed = True
            self.ws_log("bridge_closing", reason=reason)
            current = asyncio.current_task()
            for task in [self.reader_task, self.flush_task, self.wall_timer_task, self.idle_expiry_task]:
                if task is None or task.done() or task is current:
                    continue
                task.cancel()
            if self.writer is not None:
                try:
                    self.writer.close()
                    await self.writer.wait_closed()
                except Exception:
                    pass
            self.reader = None
            self.writer = None
            async with _DAP_BRIDGES_LOCK:
                if _DAP_BRIDGES.get(self.session_id) is self:
                    _DAP_BRIDGES.pop(self.session_id, None)

    async def _send_to_current_client(self, msg: Dict[str, Any]) -> None:
        websocket = self.client_websocket
        token = self.client_conn_token
        if websocket is None or token is None:
            return
        data = json.dumps(msg, ensure_ascii=False)
        try:
            async with self.client_send_lock:
                if websocket is not self.client_websocket or token != self.client_conn_token:
                    return
                await websocket.send_text(data)
        except Exception:
            pass

    async def _close_known_websocket(self, code: int = 1000, reason: Optional[str] = None) -> None:
        websocket = self.client_websocket or self.last_known_websocket
        if websocket is None:
            return
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            pass

    def _msg_meta(self, source: str = "dap") -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "source": source,
            "ts": now_iso(),
        }
        if self.current_ws_epoch is not None:
            payload["ws_epoch"] = self.current_ws_epoch
        if self.current_conn_id is not None:
            payload["conn_id"] = self.current_conn_id
        if self.current_client_conn_id is not None:
            payload["client_conn_id"] = self.current_client_conn_id
        return payload

    def _next_seq(self) -> int:
        value = self.gateway_seq
        self.gateway_seq += 1
        return value

    async def _publish(self, payload: Dict[str, Any], *, source: str) -> None:
        msg = dict(payload)
        msg["seq"] = self._next_seq()
        meta = dict(msg.get("_meta") or {})
        normalized = self._msg_meta(source)
        normalized.update(meta)
        msg["_meta"] = normalized
        self.outbound_buffer.append(dict(msg))
        await self._send_to_current_client(msg)

    async def _send_output(self, text: str) -> None:
        await self._publish(
            {
                "type": "event",
                "event": "output",
                "body": {
                    "category": "stderr",
                    "output": text,
                },
            },
            source="gateway",
        )

    async def _send_error_response(self, req: Dict[str, Any], message: str) -> None:
        await self._publish(
            {
                "type": "response",
                "request_seq": int(req.get("seq") or 0),
                "success": False,
                "command": str(req.get("command") or ""),
                "message": message,
            },
            source="gateway",
        )

    async def _save_meta(self) -> None:
        try:
            ttl = int(self.meta.get("ttl_seconds") or self.attached_ttl)
            await cache.set(self.session_key, self.meta, expire_seconds=ttl)
        except Exception:
            pass

    async def _mark_attached_if_needed(self) -> None:
        if self.attached_marked:
            return
        self.attached_marked = True
        if str(self.meta.get("status") or "") == SESSION_STATUS_READY:
            self.meta["status"] = SESSION_STATUS_ATTACHED
            self.meta["ttl_seconds"] = self.attached_ttl
            self.meta["last_heartbeat_at"] = now_iso()
            await self._save_meta()

    async def _mark_terminated(self, reason: str, fallback: bool = False) -> None:
        if self.terminated_seen:
            return
        self.terminated_seen = True
        if fallback:
            logger.warning("pythonlab terminated fallback triggered: session_id=%s reason=%s", self.session_id, reason)
        else:
            logger.info("pythonlab terminated event received: session_id=%s reason=%s", self.session_id, reason)
        self.meta["status"] = SESSION_STATUS_TERMINATED
        self.meta["last_heartbeat_at"] = now_iso()
        await self._save_meta()
        try:
            celery_app.send_task("app.tasks.pythonlab.stop_session", args=[self.session_id])
        except Exception:
            pass

    async def _emit_terminated_fallback(self, reason: str) -> None:
        if self.terminated_seen:
            return
        await self._mark_terminated(reason=reason, fallback=True)
        await self._publish(
            {
                "type": "event",
                "event": "terminated",
                "body": {"restart": False, "fallback_reason": reason},
            },
            source="gateway",
        )
        self.terminated_event_forwarded = True

    async def _arm_wall_timer(self) -> None:
        wall_ms = int(self.limits.get("wall_ms") or (self.attached_ttl * 1000))
        if wall_ms <= 0:
            return
        if self.wall_timer_task is not None and not self.wall_timer_task.done():
            self.wall_timer_task.cancel()
            try:
                await self.wall_timer_task
            except Exception:
                pass

        async def _kill_later() -> None:
            await asyncio.sleep(max(0.1, wall_ms / 1000.0))
            await self._send_output(f"运行超时（超过 {wall_ms}ms），会话已终止\n")
            try:
                celery_app.send_task("app.tasks.pythonlab.stop_session", args=[self.session_id])
            except Exception:
                pass

        self.wall_timer_task = asyncio.create_task(_kill_later())

    def _is_debugpy_noise(self, out: str) -> bool:
        try:
            for ln in str(out or "").splitlines():
                t = ln.strip()
                if not t:
                    continue
                if t.lower().startswith("server is not available"):
                    return True
                if ("server[pid=" in t.lower() and "disconnected unexpectedly" in t.lower()):
                    return True
                return t.startswith(("I+000", "D+000", "ptvsddebugpyI+", "ptvsddebugpyD+"))
        except Exception:
            return False
        return False

    def _is_retryable_connect_error(self, err: Exception) -> bool:
        if isinstance(err, ConnectionRefusedError):
            return True
        if isinstance(err, OSError):
            return int(getattr(err, "errno", 0) or 0) in {111, 61}
        return False

    async def _ensure_conn(self, force: bool = False) -> None:
        async with self.conn_lock:
            if self.closed:
                raise RuntimeError("bridge closed")
            if not force and self.reader is not None and self.writer is not None:
                return
            if self.writer is not None:
                try:
                    self.writer.close()
                    await self.writer.wait_closed()
                except Exception:
                    pass
            self.reader = None
            self.writer = None
            startup_phase = not self.first_inbound_event.is_set()
            max_rounds = 12 if startup_phase else 2
            last_err: Optional[Exception] = None
            last_host: Optional[str] = None
            for round_idx in range(max_rounds):
                for cand in self.host_candidates:
                    try:
                        self.reader, self.writer = await asyncio.wait_for(asyncio.open_connection(cand, self.port), timeout=5.0)
                        self.ws_log("dap_tcp_connected", host=cand, port=self.port)
                        return
                    except Exception as exc:
                        last_err = exc
                        last_host = cand
                if (
                    startup_phase
                    and round_idx < max_rounds - 1
                    and last_err is not None
                    and self._is_retryable_connect_error(last_err)
                ):
                    self.ws_log(
                        "dap_tcp_connect_retry",
                        host=last_host,
                        port=self.port,
                        attempt=round_idx + 1,
                        max_attempts=max_rounds,
                        error=f"{type(last_err).__name__}: {last_err}",
                    )
                    await asyncio.sleep(min(1.0, 0.15 + 0.1 * round_idx))
                    continue
                break
            await self._send_output(f"Failed to connect to DAP backend ({self.host_candidates}:{self.port}): {last_err}\n")
            raise last_err if last_err else RuntimeError("dap connect failed")

    async def _replay_state_after_reconnect_bootstrap(self) -> None:
        if self.current_client_last_seq is not None:
            return
        if str(self.meta.get("status") or "") == SESSION_STATUS_STOPPED and self.last_stopped_event is not None:
            await self._publish(dict(self.last_stopped_event), source="replay")

    async def _maybe_handle_reconnect_bootstrap(self, msg: Dict[str, Any]) -> bool:
        if msg.get("type") != "request" or not self.reconnect_bootstrap_pending or self.terminated_seen:
            return False
        cmd = str(msg.get("command") or "")
        request_seq = int(msg.get("seq") or 0)
        if cmd == "initialize" and self.cached_initialize_body is not None:
            await self._publish(
                {
                    "type": "response",
                    "request_seq": request_seq,
                    "success": True,
                    "command": "initialize",
                    "body": self.cached_initialize_body,
                },
                source="gateway",
            )
            return True
        if cmd == "attach" and self.dap_initialized:
            await self._publish(
                {
                    "type": "response",
                    "request_seq": request_seq,
                    "success": True,
                    "command": "attach",
                    "body": {},
                },
                source="gateway",
            )
            await self._publish({"type": "event", "event": "initialized"}, source="gateway")
            return True
        if cmd == "configurationDone" and self.dap_initialized:
            await self._publish(
                {
                    "type": "response",
                    "request_seq": request_seq,
                    "success": True,
                    "command": "configurationDone",
                },
                source="gateway",
            )
            self.reconnect_bootstrap_pending = False
            await self._replay_state_after_reconnect_bootstrap()
            return True
        return False

    async def handle_client_text(self, data: str) -> None:
        await self.start()
        if len(data) > WS_MAX_DAP_MSG_BYTES:
            raise ValueError("message too large")
        msg = json.loads(data)
        self.ws_log(
            "ws_client_message",
            msg_type=str(msg.get("type") or ""),
            command=str(msg.get("command") or ""),
        )
        if msg.get("type") == "request":
            now = asyncio.get_running_loop().time()
            self.req_times.append(now)
            cutoff = now - 1.0
            while self.req_times and self.req_times[0] < cutoff:
                self.req_times.pop(0)
            if len(self.req_times) > self.rate_limit_per_sec:
                await self._send_output("请求过于频繁，已触发限流断开\n")
                raise RuntimeError("rate limited")
            await self._mark_attached_if_needed()
            error_message = _validate_dap_request_payload(msg)
            if error_message is not None:
                await self._send_error_response(msg, error_message)
                return
            if str(msg.get("command") or "") == "launch":
                self.launch_requested = True
                await self._arm_wall_timer()
            if await self._maybe_handle_reconnect_bootstrap(msg):
                return
        if self.buffer_active:
            self.buffer.append(msg)
            self.ws_log("ws_buffer_append", buffer_size=len(self.buffer), command=str(msg.get("command") or ""))
            self.buffer_event.set()
            return
        await self._ensure_conn()
        assert self.writer is not None
        async with self.writer_lock:
            await _write_dap_message(self.writer, msg)
        self.ws_log("ws_forward_direct", command=str(msg.get("command") or ""))

    async def _pump_buffer_to_tcp(self) -> None:
        connect_attempts = 0
        while not self.closed:
            await self.buffer_event.wait()
            self.buffer_event.clear()
            if self.closed or not self.buffer_active:
                continue
            if not self.buffer:
                continue
            await self._ensure_conn()
            assert self.writer is not None
            while self.buffer_sent_idx < len(self.buffer) and not self.closed:
                try:
                    buffered = self.buffer[self.buffer_sent_idx]
                    async with self.writer_lock:
                        await _write_dap_message(self.writer, buffered)
                    self.ws_log("ws_buffer_flush", flush_idx=self.buffer_sent_idx, command=str(buffered.get("command") or ""))
                    self.buffer_sent_idx += 1
                except Exception:
                    connect_attempts += 1
                    if connect_attempts >= 8:
                        raise
                    self.reader = None
                    self.writer = None
                    self.buffer_sent_idx = 0
                    await asyncio.sleep(0.15)
                    await self._ensure_conn(force=True)
                    break

    async def _pump_tcp_to_client(self) -> None:
        while not self.closed:
            await self._ensure_conn()
            assert self.reader is not None
            try:
                msg = await _read_dap_message(self.reader)
            except EOFError:
                if not self.first_inbound_event.is_set():
                    self.buffer_sent_idx = 0
                    self.reader = None
                    self.writer = None
                    await self._send_output("调试服务正在启动或重启，正在重试连接...\n")
                    await asyncio.sleep(WS_HEARTBEAT_INTERVAL)
                    continue
                if self.launch_requested and not self.terminated_seen:
                    await self._emit_terminated_fallback("dap_eof_after_launch")
                    return
                if self.terminated_seen:
                    return
                raise
            if msg.get("type") == "response" and not self.first_inbound_event.is_set():
                self.first_inbound_event.set()
                self.buffer_active = False
                self.buffer = []
                self.buffer_sent_idx = 0
            if msg.get("type") == "response" and str(msg.get("command") or "") == "initialize":
                body = msg.get("body") if isinstance(msg.get("body"), dict) else {}
                self.cached_initialize_body = dict(body or {})
                self.dap_initialized = True
            if msg.get("type") == "event" and str(msg.get("event") or "") == "initialized":
                self.dap_initialized = True
            if msg.get("type") == "event" and msg.get("event") == "output":
                body = msg.get("body") if isinstance(msg.get("body"), dict) else {}
                if isinstance(body, dict) and str(body.get("category") or "") == "telemetry":
                    continue
                out = body.get("output") if isinstance(body, dict) else None
                if isinstance(out, str):
                    if self.launch_requested and not self.terminated_seen:
                        for ln in out.splitlines():
                            if ln.strip().lower() == "done":
                                await self._emit_terminated_fallback("done_output")
                                return
                    if self._is_debugpy_noise(out):
                        continue
                    if out.strip() in {"ptvsd", "debugpy"}:
                        continue
                    if self.output_truncated:
                        continue
                    self.output_bytes += len(out.encode("utf-8", errors="ignore"))
                    if self.output_bytes > self.max_output_bytes:
                        self.output_truncated = True
                        await self._send_output(f"stdout/stderr 输出已截断（超过 {self.max_stdout_kb}KB）\n")
                        continue
            if msg.get("type") == "event":
                ev = str(msg.get("event") or "")
                if ev == "stopped":
                    self.ws_log("dap_event_stopped")
                    self.meta["status"] = SESSION_STATUS_STOPPED
                    self.meta["last_heartbeat_at"] = now_iso()
                    self.last_stopped_event = {
                        "type": "event",
                        "event": "stopped",
                        "body": dict(msg.get("body") or {}),
                    }
                    await self._save_meta()
                elif ev == "continued":
                    self.ws_log("dap_event_continued")
                    self.meta["status"] = SESSION_STATUS_RUNNING
                    self.meta["last_heartbeat_at"] = now_iso()
                    self.last_stopped_event = None
                    await self._save_meta()
                elif ev == "terminated":
                    self.ws_log("dap_event_terminated")
                    self.terminated_event_forwarded = True
                    self.last_stopped_event = None
                    await self._mark_terminated(reason="dap_terminated_event", fallback=False)
                elif ev == "exited" and self.launch_requested and not self.terminated_seen:
                    await self._emit_terminated_fallback("dap_exited_event")
                    return
            payload = dict(msg)
            self.ws_log(
                "dap_message",
                msg_type=str(payload.get("type") or ""),
                dap_event=str(payload.get("event") or ""),
                command=str(payload.get("command") or ""),
            )
            encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8", errors="ignore")
            if len(encoded) > self.max_dap_msg_bytes:
                if payload.get("type") == "response":
                    await self._publish(
                        {
                            "type": "response",
                            "request_seq": int(payload.get("request_seq") or 0),
                            "success": False,
                            "command": str(payload.get("command") or ""),
                            "message": "response too large",
                        },
                        source="gateway",
                    )
                    continue
                await self._send_output("DAP 消息过大，连接已断开\n")
                await self._close_known_websocket(code=1011)
                raise RuntimeError("dap message too large")
            await self._publish(payload, source="dap")


async def _get_or_create_dap_bridge(
    *,
    session_id: str,
    session_key: str,
    meta: Dict[str, Any],
    host_candidates: list[str],
    port: int,
    limits: Dict[str, Any],
    attached_ttl: int,
    ws_log,
) -> DapSessionBridge:
    async with _DAP_BRIDGES_LOCK:
        bridge = _DAP_BRIDGES.get(session_id)
        if bridge is None or bridge.closed:
            bridge = DapSessionBridge(
                session_id=session_id,
                session_key=session_key,
                meta=meta,
                host_candidates=host_candidates,
                port=port,
                limits=limits,
                attached_ttl=attached_ttl,
                ws_log=ws_log,
            )
            _DAP_BRIDGES[session_id] = bridge
            return bridge
        bridge.refresh_runtime(
            meta=meta,
            host_candidates=host_candidates,
            port=port,
            limits=limits,
            attached_ttl=attached_ttl,
        )
        bridge.ws_log = ws_log
        return bridge

@router.websocket("/sessions/{session_id}/terminal")
async def terminal_ws(websocket: WebSocket, session_id: str, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    logger.info("terminal ws accepted: session_id={}", session_id)
    
    token = _extract_ws_token(websocket)
    if not token:
        logger.warning("terminal ws no token: session_id={}", session_id)
        await websocket.close(code=4401)
        return
    user = await auth_get_current_user(token, db)
    if not user:
        logger.warning("terminal ws auth failed: session_id={}", session_id)
        await websocket.close(code=4401)
        return

    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    meta = await cache.get(session_key)
    if not meta:
        logger.warning("terminal ws session missing: session_id={}", session_id)
        await websocket.close(code=4404)
        return

    if int(meta.get("owner_user_id") or 0) != int(user.get("id") or 0):
        logger.warning(
            "terminal ws forbidden: session_id={} user_id={} owner_user_id={}",
            session_id,
            user.get("id"),
            meta.get("owner_user_id"),
        )
        await websocket.close(code=4403)
        return

    from app.core.sandbox.docker import DockerProvider
    provider = DockerProvider()
    
    process = None
    pty_fd: Optional[int] = None
    plain_mode = str(meta.get("runtime_mode") or "debug").lower() == "plain"
    plain_done_marker = "__PYTHONLAB_DONE__:"
    plain_finished = False
    try:
        process, pty_fd = await provider.attach_tty(session_id, meta)
        logger.info("terminal ws attached tty: session_id={}", session_id)
        if plain_mode and pty_fd is not None and not bool(meta.get("plain_started")):
            meta["plain_started"] = True
            meta["status"] = SESSION_STATUS_RUNNING
            meta["last_heartbeat_at"] = now_iso()
            ttl = int(meta.get("ttl_seconds") or 300)
            await cache.set(session_key, meta, expire_seconds=ttl)
            os.write(
                pty_fd,
                b"python -u /workspace/main.py; printf '\\n__PYTHONLAB_DONE__:%s\\n' $?;\n",
            )
    except Exception as e:
        logger.error(f"Failed to attach TTY: {e}")
        await websocket.close(code=4500)
        return

    async def mark_plain_terminated(exit_code: Optional[int] = None) -> None:
        nonlocal plain_finished
        if plain_finished:
            return
        plain_finished = True
        try:
            latest = await cache.get(session_key) or meta
            latest["status"] = SESSION_STATUS_TERMINATED
            latest["last_heartbeat_at"] = now_iso()
            latest["plain_exit_code"] = exit_code
            await cache.set(session_key, latest, expire_seconds=60)
        except Exception:
            pass
        try:
            celery_app.send_task("app.tasks.pythonlab.stop_session", args=[session_id])
        except Exception:
            pass

    async def pump_ws_to_tty():
        try:
            while True:
                # Receive raw data from xterm
                # xterm-addon-attach sends text data by default
                data = await websocket.receive_text()
                if pty_fd is not None:
                    try:
                        os.write(pty_fd, data.encode("utf-8"))
                    except OSError as e:
                        if getattr(e, "errno", None) == 5:
                            break
                        raise
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"Error pumping WS to TTY: {e}")
            try:
                await websocket.send_text(f"\r\nError writing to TTY: {e}\r\n")
            except Exception: pass
    async def pump_tty_to_ws():
        try:
            loop = asyncio.get_running_loop()
            while True:
                if pty_fd is None:
                    break
                try:
                    data = await loop.run_in_executor(None, os.read, pty_fd, 4096)
                except OSError as e:
                    if getattr(e, "errno", None) == 5:
                        break
                    raise
                if not data:
                    logger.info("terminal ws tty eof: session_id={} returncode={}", session_id, process.returncode)
                    if plain_mode:
                        await mark_plain_terminated()
                    break
                # Send text. decoding with replace handles binary junk gracefully.
                text = data.decode('utf-8', errors='replace')
                if plain_mode and plain_done_marker in text:
                    left, right = text.split(plain_done_marker, 1)
                    if left:
                        await websocket.send_text(left)
                    rc_match = re.search(r"\d+", right)
                    exit_code = int(rc_match.group(0)) if rc_match else None
                    await mark_plain_terminated(exit_code)
                    # Show friendly exit message to student
                    if exit_code == 0:
                        await websocket.send_text("\r\n\033[32m程序运行结束（退出码: 0）\033[0m\r\n")
                    elif exit_code is not None:
                        await websocket.send_text(f"\r\n\033[31m程序运行结束（退出码: {exit_code}）\033[0m\r\n")
                    else:
                        await websocket.send_text("\r\n程序运行结束\r\n")
                    rest = right.split("\n", 1)
                    if len(rest) > 1 and rest[1]:
                        await websocket.send_text(rest[1])
                    continue
                await websocket.send_text(text)
        except Exception as e:
            logger.error(f"Error pumping TTY to WS: {e}")
        finally:
            try:
                await websocket.close()
            except Exception:
                pass

    try:
        await asyncio.gather(pump_ws_to_tty(), pump_tty_to_ws())
    except Exception as e:
        logger.error(f"Terminal WS loop error: {e}")
    finally:
        # Close PTY fd first to unblock any pending os.read(), then kill the
        # attach subprocess.  Reversing this order can leave the fd dangling
        # if the process is already gone (ProcessLookupError).
        if pty_fd is not None:
            try:
                os.close(pty_fd)
            except Exception:
                pass
            pty_fd = None
        if process:
            try:
                if process.returncode is None:
                    process.kill()  # Use kill() not terminate() for immediate cleanup
            except ProcessLookupError:
                pass
            except Exception:
                pass
        logger.info("terminal ws closed: session_id={}", session_id)


@router.websocket("/sessions/{session_id}/ws")
async def dap_ws(websocket: WebSocket, session_id: str, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    conn_started_at = now_iso()
    conn_id = uuid.uuid4().hex[:12]
    client_conn_id = _normalize_client_conn_id(websocket.query_params.get("client_conn_id"))
    last_seq = _parse_last_seq(websocket)
    user_id = 0

    def _ws_log(event: str, **extra: Any) -> None:
        try:
            payload = {
                "event": event,
                "session_id": session_id,
                "conn_id": conn_id,
                "client_conn_id": client_conn_id,
                "user_id": user_id,
                "ts": now_iso(),
            }
            payload.update(extra)
            logger.info("pythonlab_dap_ws {}", json.dumps(payload, ensure_ascii=False))
        except Exception:
            pass

    token = _extract_ws_token(websocket)
    if not token:
        _ws_log("ws_auth_missing_token")
        # print(f"WS 4401: No token found. Params: {websocket.query_params}, Cookies: {websocket.cookies.keys()}")
        await websocket.close(code=4401)
        return
    user = await auth_get_current_user(token, db)
    if not user:
        _ws_log("ws_auth_invalid_token")
        # print(f"WS 4401: Token invalid or user not found. Token len: {len(token)}")
        await websocket.close(code=4401)
        return
    user_id = int(user.get("id") or 0)
    _ws_log("ws_auth_ok")

    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    meta = await cache.get(session_key)
    if not meta:
        _ws_log("ws_session_missing")
        await websocket.close(code=4404)
        return

    if int(meta.get("owner_user_id") or 0) != int(user.get("id") or 0):
        _ws_log("ws_owner_forbidden", owner_user_id=int(meta.get("owner_user_id") or 0))
        await websocket.close(code=4403)
        return

    # Add 1s buffer for container startup race condition
    for _ in range(5):
        status = str(meta.get("status") or "")
        if status in {SESSION_STATUS_READY, SESSION_STATUS_ATTACHED, SESSION_STATUS_RUNNING, SESSION_STATUS_STOPPED}:
            break
        await asyncio.sleep(WS_HEARTBEAT_INTERVAL)
        meta = await cache.get(session_key) or meta

    status = str(meta.get("status") or "")
    if status not in {SESSION_STATUS_READY, SESSION_STATUS_ATTACHED, SESSION_STATUS_RUNNING, SESSION_STATUS_STOPPED}:
        _ws_log("ws_session_not_ready", status=status)
        await websocket.close(code=4409)
        return

    host = str(meta.get("dap_host") or DAP_HOST_DEFAULT)
    host_candidates = _build_dap_host_candidates(host, in_docker=os.path.exists("/.dockerenv"))
    port = int(meta.get("dap_port") or 0)
    if port <= 0:
        _ws_log("ws_dap_port_invalid", dap_port=port)
        await websocket.close(code=4410)
        return
    _raw_limits = meta.get("limits")
    limits: Dict[str, Any] = _raw_limits if isinstance(_raw_limits, dict) else {}
    attached_ttl = int(getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", 1800) or 1800)
    ws_owner_ttl = max(60, min(attached_ttl, 300))
    ws_owner_mode = str(getattr(settings, "PYTHONLAB_DEBUG_WS_OWNER_MODE", "deny") or "deny").strip().lower()
    if ws_owner_mode not in {"deny", "steal"}:
        ws_owner_mode = "deny"
    ws_owner_key = f"debug:session:{session_id}:ws_owner"
    ws_owner_value = f"{int(user.get('id') or 0)}:{uuid.uuid4().hex}"
    redis_client = await cache.get_client()
    ws_epoch_key = f"debug:session:{session_id}:ws_epoch"
    ws_epoch = 0
    try:
        ws_epoch = int(await redis_client.incr(ws_epoch_key) or 0)
        await redis_client.expire(ws_epoch_key, attached_ttl)
    except Exception:
        ws_epoch = 0
    owner_keepalive_task: Optional[asyncio.Task] = None
    _ws_log(
        "ws_connected",
        ws_epoch=ws_epoch,
        ws_owner_mode=ws_owner_mode,
        status=status,
        dap_host_candidates=host_candidates,
        dap_port=port,
        connected_at=conn_started_at,
        last_seq=last_seq,
    )

    acquired_owner = await redis_client.set(ws_owner_key, ws_owner_value, nx=True, px=ws_owner_ttl * 1000)
    if not acquired_owner:
        if ws_owner_mode == "steal":
            _ws_log("ws_owner_steal", ws_epoch=ws_epoch)
            await redis_client.set(ws_owner_key, ws_owner_value, px=ws_owner_ttl * 1000)
            acquired_owner = True
            try:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "event",
                            "event": "output",
                            "body": {
                                "category": "stderr",
                                "output": "检测到并发调试连接，已接管当前会话。\n",
                            },
                        },
                        ensure_ascii=False,
                    )
                )
            except Exception:
                pass
        else:
            _ws_log("ws_owner_deny", ws_epoch=ws_epoch)
            try:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "event",
                            "event": "output",
                            "body": {
                                "category": "stderr",
                                "output": "该会话正在其他窗口调试，请先停止原会话或稍后重试。\n",
                            },
                        },
                        ensure_ascii=False,
                    )
                )
            except Exception:
                pass
            await websocket.close(code=4429, reason="deny_in_use")
            return

    async def _owner_keepalive() -> None:
        while True:
            await asyncio.sleep(max(1.0, WS_HEARTBEAT_INTERVAL))
            try:
                owner = await redis_client.get(ws_owner_key)
                if str(owner or "") != ws_owner_value:
                    _ws_log("ws_owner_lost_keepalive", ws_epoch=ws_epoch)
                    try:
                        await websocket.close(code=4429, reason="taken_over")
                    except Exception:
                        pass
                    return
                await redis_client.pexpire(ws_owner_key, ws_owner_ttl * 1000)
            except Exception:
                return

    owner_keepalive_task = asyncio.create_task(_owner_keepalive())

    async def _save_meta() -> None:
        try:
            ttl = int(meta.get("ttl_seconds") or attached_ttl)
            await cache.set(session_key, meta, expire_seconds=ttl)
        except Exception:
            pass

    async def _set_debug_owner(state: str) -> None:
        meta["debug_owner"] = {
            "state": state,
            "user_id": int(user.get("id") or 0),
            "conn_id": conn_id,
            "client_conn_id": client_conn_id,
            "ws_epoch": ws_epoch,
            "updated_at": now_iso(),
        }
        await _save_meta()

    async def _clear_debug_owner() -> None:
        owner = meta.get("debug_owner") if isinstance(meta.get("debug_owner"), dict) else None
        if not owner:
            return
        if str(owner.get("conn_id") or "") != conn_id:
            return
        meta.pop("debug_owner", None)
        await _save_meta()

    await _set_debug_owner("active")

    async def _touch() -> None:
        meta["last_heartbeat_at"] = now_iso()
        await _save_meta()
        try:
            owner = await redis_client.get(ws_owner_key)
            if str(owner or "") != ws_owner_value:
                _ws_log("ws_owner_lost_touch", ws_epoch=ws_epoch)
                try:
                    await websocket.close(code=4429, reason="taken_over")
                except Exception:
                    pass
                raise RuntimeError("debug ws ownership lost")
            await redis_client.pexpire(ws_owner_key, ws_owner_ttl * 1000)
        except RuntimeError:
            raise
        except Exception:
            pass

    bridge: Optional[DapSessionBridge] = None
    try:
        bridge = await _get_or_create_dap_bridge(
            session_id=session_id,
            session_key=session_key,
            meta=meta,
            host_candidates=host_candidates,
            port=port,
            limits=limits,
            attached_ttl=attached_ttl,
            ws_log=lambda event, **extra: _ws_log(event, ws_epoch=ws_epoch, **extra),
        )
        await bridge.attach_client(
            websocket,
            conn_id,
            last_seq=last_seq,
            ws_epoch=ws_epoch,
            conn_id=conn_id,
            client_conn_id=client_conn_id,
        )
        await _set_debug_owner("active")
        while True:
            receive_task = asyncio.create_task(websocket.receive_text())
            watch_tasks = {receive_task}
            if bridge.reader_task is not None:
                watch_tasks.add(bridge.reader_task)
            if bridge.flush_task is not None:
                watch_tasks.add(bridge.flush_task)
            done, pending = await asyncio.wait(watch_tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                if task is receive_task:
                    task.cancel()
            if receive_task not in done:
                try:
                    await receive_task
                except BaseException:
                    pass
                background_exc: Optional[BaseException] = None
                for task in done:
                    if task is receive_task:
                        continue
                    if task.cancelled():
                        continue
                    try:
                        exc = task.exception()
                    except BaseException as err:
                        background_exc = err
                        break
                    if exc is not None:
                        background_exc = exc
                        break
                if background_exc is not None:
                    raise background_exc
                break
            data = receive_task.result()
            await _touch()
            await bridge.handle_client_text(data)
    except WebSocketDisconnect:
        _ws_log("ws_disconnected", ws_epoch=ws_epoch)
    except Exception as e:
        _ws_log("ws_proxy_error", ws_epoch=ws_epoch, error=f"{type(e).__name__}: {e}")
        if bridge is not None:
            if not (isinstance(e, RuntimeError) and str(e) == "rate limited"):
                if isinstance(e, EOFError):
                    await bridge._send_output("调试服务连接已断开，请重试运行（如仍失败请先停止/清理会话）。\n")
                else:
                    await bridge._send_output(f"debug ws proxy error: {type(e).__name__}: {e}\n")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
        return
    finally:
        _ws_log("ws_finalizing", ws_epoch=ws_epoch)
        try:
            if owner_keepalive_task is not None:
                owner_keepalive_task.cancel()
                await owner_keepalive_task
        except BaseException:
            pass
        try:
            script = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """
            await redis_client.eval(script, 1, ws_owner_key, ws_owner_value)  # type: ignore[misc]
        except Exception:
            pass
        try:
            if bridge is not None:
                await bridge.detach_client(conn_id)
        except Exception:
            pass
        try:
            preserve_runtime = bridge.should_preserve_runtime() if bridge is not None else False
            if preserve_runtime:
                await _set_debug_owner("detached")
            else:
                await _clear_debug_owner()
        except Exception:
            pass
        try:
            preserve_runtime = bridge.should_preserve_runtime() if bridge is not None else False
            if not preserve_runtime:
                latest_meta = await cache.get(session_key) or meta
                latest_owner = latest_meta.get("debug_owner") if isinstance(latest_meta.get("debug_owner"), dict) else None
                if latest_owner and str(latest_owner.get("conn_id") or "") != conn_id:
                    _ws_log("ws_finalize_skip_ready_restore_owner_mismatch", ws_epoch=ws_epoch)
                    latest_meta = meta
                current_status = str(latest_meta.get("status") or "")
                attached_marked = bool(bridge.attached_marked) if bridge is not None else False
                if current_status not in {SESSION_STATUS_TERMINATED, SESSION_STATUS_FAILED, SESSION_STATUS_TERMINATING} and attached_marked:
                    latest_meta["status"] = SESSION_STATUS_READY
                    latest_meta["last_heartbeat_at"] = now_iso()
                    ttl = int(latest_meta.get("ttl_seconds") or attached_ttl)
                    await cache.set(session_key, latest_meta, expire_seconds=ttl)
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
        _ws_log("ws_closed", ws_epoch=ws_epoch)
