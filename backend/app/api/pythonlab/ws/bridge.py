"""
DAP 会话桥接器
"""

import asyncio
import json
import os
import sys
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, Optional

from loguru import logger
from fastapi import WebSocket

from app.core.config import settings
from app.core.celery_app import celery_app
from app.utils.cache import cache
from app.api.pythonlab.constants import (
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
from app.api.pythonlab.ws.connection import _read_dap_message, _write_dap_message
from app.api.pythonlab.ws.validation import _validate_dap_request_payload, _build_dap_host_candidates


def _compat_ws_module():
    return sys.modules.get("app.api.pythonlab.ws")


def _compat_attr(name: str, fallback: Any) -> Any:
    module = _compat_ws_module()
    if module is None:
        return fallback
    return getattr(module, name, fallback)


def _compat_now_iso() -> str:
    return _compat_attr("now_iso", now_iso)()


async def _compat_read_dap_message(reader: asyncio.StreamReader) -> Dict[str, Any]:
    fn = _compat_attr("_read_dap_message", _read_dap_message)
    return await fn(reader)


async def _compat_write_dap_message(writer: asyncio.StreamWriter, msg: Dict[str, Any]) -> None:
    fn = _compat_attr("_write_dap_message", _write_dap_message)
    await fn(writer, msg)


def _compat_validate_dap_request_payload(msg: Dict[str, Any]) -> Optional[str]:
    fn = _compat_attr("_validate_dap_request_payload", _validate_dap_request_payload)
    return fn(msg)


# 全局桥接器存储
_DAP_BRIDGES: Dict[str, "DapSessionBridge"] = {}
_DAP_BRIDGES_LOCK = asyncio.Lock()


class DapSessionBridge:
    """DAP 会话桥接器，管理客户端 WebSocket 与 DAP 后端 TCP 连接之间的通信"""

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
        cache_backend=None,
        celery_backend=None,
    ) -> None:
        self.session_id = session_id
        self.session_key = session_key
        self.meta = meta
        self.host_candidates = list(host_candidates)
        self.port = int(port)
        self.limits = dict(limits)
        self.attached_ttl = int(attached_ttl)
        self.ws_log = ws_log
        self.cache_backend = cache_backend or cache
        self.celery_backend = celery_backend or celery_app
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

        self.rate_limit_per_sec = int(_compat_attr("WS_RATE_LIMIT_PER_SEC", WS_RATE_LIMIT_PER_SEC) or WS_RATE_LIMIT_PER_SEC)
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
        cache_backend=None,
        celery_backend=None,
    ) -> None:
        """刷新运行时配置"""
        self.meta = meta
        self.host_candidates = list(host_candidates)
        self.port = int(port)
        self.limits = dict(limits)
        self.attached_ttl = int(attached_ttl)
        if cache_backend is not None:
            self.cache_backend = cache_backend
        if celery_backend is not None:
            self.celery_backend = celery_backend
        self.max_stdout_kb = int(self.limits.get("max_stdout_kb") or WS_MAX_STDOUT_KB)
        self.max_output_bytes = max(16 * 1024, self.max_stdout_kb * 1024)
        self.max_dap_msg_bytes = int(self.limits.get("max_dap_msg_bytes") or WS_MAX_DAP_MSG_BYTES)
        self.rate_limit_per_sec = int(_compat_attr("WS_RATE_LIMIT_PER_SEC", WS_RATE_LIMIT_PER_SEC) or WS_RATE_LIMIT_PER_SEC)

    def should_preserve_runtime(self) -> bool:
        """判断是否应该保留运行时状态"""
        return not self.closed and self.dap_initialized and not self.terminated_seen

    async def start(self) -> None:
        """启动桥接器后台任务"""
        if self.closed:
            raise RuntimeError("bridge closed")
        if self.reader_task is None or self.reader_task.done():
            self.reader_task = self._spawn_background_task(self._pump_tcp_to_client(), "pump_tcp_to_client")
        if self.flush_task is None or self.flush_task.done():
            self.flush_task = self._spawn_background_task(self._pump_buffer_to_tcp(), "pump_buffer_to_tcp")

    def _spawn_background_task(self, coro: Any, name: str) -> asyncio.Task:
        """创建后台任务"""
        task = asyncio.create_task(coro)
        task.add_done_callback(lambda done: self._handle_background_task_done(name, done))
        return task

    def _handle_background_task_done(self, name: str, task: asyncio.Task) -> None:
        """处理后台任务完成"""
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
        """附加客户端到桥接器"""
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
        """从桥接器分离客户端"""
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
        """关闭桥接器"""
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
        """发送消息到当前客户端"""
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
        """关闭已知的 WebSocket 连接"""
        websocket = self.client_websocket or self.last_known_websocket
        if websocket is None:
            return
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            pass

    def _msg_meta(self, source: str = "dap") -> Dict[str, Any]:
        """构建消息元数据"""
        payload: Dict[str, Any] = {
            "source": source,
            "ts": _compat_now_iso(),
        }
        if self.current_ws_epoch is not None:
            payload["ws_epoch"] = self.current_ws_epoch
        if self.current_conn_id is not None:
            payload["conn_id"] = self.current_conn_id
        if self.current_client_conn_id is not None:
            payload["client_conn_id"] = self.current_client_conn_id
        return payload

    def _next_seq(self) -> int:
        """获取下一个序列号"""
        value = self.gateway_seq
        self.gateway_seq += 1
        return value

    async def _publish(self, payload: Dict[str, Any], *, source: str) -> None:
        """发布消息到客户端"""
        msg = dict(payload)
        msg["seq"] = self._next_seq()
        meta = dict(msg.get("_meta") or {})
        normalized = self._msg_meta(source)
        normalized.update(meta)
        msg["_meta"] = normalized
        self.outbound_buffer.append(dict(msg))
        await self._send_to_current_client(msg)

    async def _send_output(self, text: str) -> None:
        """发送输出消息"""
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
        """发送错误响应"""
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
        """保存会话元数据到缓存"""
        try:
            ttl = int(self.meta.get("ttl_seconds") or self.attached_ttl)
            await self.cache_backend.set(self.session_key, self.meta, expire_seconds=ttl)
        except Exception:
            pass

    async def _mark_attached_if_needed(self) -> None:
        """标记会话为已附加状态"""
        if self.attached_marked:
            return
        self.attached_marked = True
        if str(self.meta.get("status") or "") == SESSION_STATUS_READY:
            self.meta["status"] = SESSION_STATUS_ATTACHED
            self.meta["ttl_seconds"] = self.attached_ttl
            self.meta["last_heartbeat_at"] = _compat_now_iso()
            await self._save_meta()

    async def _mark_terminated(self, reason: str, fallback: bool = False) -> None:
        """标记会话为已终止状态"""
        if self.terminated_seen:
            return
        self.terminated_seen = True
        if fallback:
            logger.warning("pythonlab terminated fallback triggered: session_id=%s reason=%s", self.session_id, reason)
        else:
            logger.info("pythonlab terminated event received: session_id=%s reason=%s", self.session_id, reason)
        self.meta["status"] = SESSION_STATUS_TERMINATED
        self.meta["last_heartbeat_at"] = _compat_now_iso()
        await self._save_meta()
        try:
            self.celery_backend.send_task("app.tasks.pythonlab.stop_session", args=[self.session_id])
        except Exception:
            pass

    async def _emit_terminated_fallback(self, reason: str) -> None:
        """发送终止回退事件"""
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
        """设置运行超时定时器"""
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
                self.celery_backend.send_task("app.tasks.pythonlab.stop_session", args=[self.session_id])
            except Exception:
                pass

        self.wall_timer_task = asyncio.create_task(_kill_later())

    def _is_debugpy_noise(self, out: str) -> bool:
        """判断是否为 debugpy 噪音输出"""
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
        """判断是否为可重试的连接错误"""
        if isinstance(err, ConnectionRefusedError):
            return True
        if isinstance(err, OSError):
            return int(getattr(err, "errno", 0) or 0) in {111, 61}
        return False

    async def _ensure_conn(self, force: bool = False) -> None:
        """确保 TCP 连接已建立"""
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
        """在重连引导后重放状态"""
        if self.current_client_last_seq is not None:
            return
        if str(self.meta.get("status") or "") == SESSION_STATUS_STOPPED and self.last_stopped_event is not None:
            await self._publish(dict(self.last_stopped_event), source="replay")

    async def _maybe_handle_reconnect_bootstrap(self, msg: Dict[str, Any]) -> bool:
        """处理重连引导请求"""
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
        """处理客户端文本消息"""
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
            error_message = _compat_validate_dap_request_payload(msg)
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
            await _compat_write_dap_message(self.writer, msg)
        self.ws_log("ws_forward_direct", command=str(msg.get("command") or ""))

    async def _pump_buffer_to_tcp(self) -> None:
        """将缓冲区消息泵送到 TCP 连接"""
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
                        await _compat_write_dap_message(self.writer, buffered)
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
        """将 TCP 消息泵送到客户端"""
        while not self.closed:
            await self._ensure_conn()
            assert self.reader is not None
            try:
                msg = await _compat_read_dap_message(self.reader)
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
                    self.meta["last_heartbeat_at"] = _compat_now_iso()
                    self.last_stopped_event = {
                        "type": "event",
                        "event": "stopped",
                        "body": dict(msg.get("body") or {}),
                    }
                    await self._save_meta()
                elif ev == "continued":
                    self.ws_log("dap_event_continued")
                    self.meta["status"] = SESSION_STATUS_RUNNING
                    self.meta["last_heartbeat_at"] = _compat_now_iso()
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
    cache_backend=None,
    celery_backend=None,
) -> DapSessionBridge:
    """获取或创建 DAP 桥接器"""
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
                cache_backend=cache_backend,
                celery_backend=celery_backend,
            )
            _DAP_BRIDGES[session_id] = bridge
            return bridge
        bridge.refresh_runtime(
            meta=meta,
            host_candidates=host_candidates,
            port=port,
            limits=limits,
            attached_ttl=attached_ttl,
            cache_backend=cache_backend,
            celery_backend=celery_backend,
        )
        bridge.ws_log = ws_log
        return bridge
