import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.celery_app import celery_app
from app.db.database import get_db
from app.services.auth import get_current_user as auth_get_current_user
from app.utils.cache import cache
from app.api.endpoints.debug.constants import (
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
from app.api.endpoints.debug.utils import now_iso

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


@router.websocket("/sessions/{session_id}/ws")
async def dap_ws(websocket: WebSocket, session_id: str, db: AsyncSession = Depends(get_db)):
    await websocket.accept()

    token = _extract_ws_token(websocket)
    if not token:
        # print(f"WS 4401: No token found. Params: {websocket.query_params}, Cookies: {websocket.cookies.keys()}")
        await websocket.close(code=4401)
        return
    user = await auth_get_current_user(token, db)
    if not user:
        # print(f"WS 4401: Token invalid or user not found. Token len: {len(token)}")
        await websocket.close(code=4401)
        return

    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    meta = await cache.get(session_key)
    if not meta:
        await websocket.close(code=4404)
        return

    if int(meta.get("owner_user_id") or 0) != int(user.get("id") or 0):
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
        await websocket.close(code=4409)
        return

    host = meta.get("dap_host") or DAP_HOST_DEFAULT
    port = int(meta.get("dap_port") or 0)
    if port <= 0:
        await websocket.close(code=4410)
        return
    limits = meta.get("limits") if isinstance(meta.get("limits"), dict) else {}
    max_stdout_kb = int(limits.get("max_stdout_kb") or WS_MAX_STDOUT_KB)
    max_output_bytes = max(16 * 1024, max_stdout_kb * 1024)
    max_dap_msg_bytes = int(limits.get("max_dap_msg_bytes") or WS_MAX_DAP_MSG_BYTES)
    output_bytes = 0
    output_truncated = False
    attached_ttl = int(getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", 1800) or 1800)
    rate_limit_per_sec = WS_RATE_LIMIT_PER_SEC
    req_times: list[float] = []
    attached_marked = False
    gateway_seq = 1
    wall_timer_task: Optional[asyncio.Task] = None

    reader: Optional[asyncio.StreamReader] = None
    writer: Optional[asyncio.StreamWriter] = None
    buffer_active = True
    buffer: list[Dict[str, Any]] = []
    buffer_sent_idx = 0
    buffer_event = asyncio.Event()
    first_inbound_event = asyncio.Event()
    conn_lock = asyncio.Lock()

    async def _send_output(text: str) -> None:
        try:
            await websocket.send_text(
                json.dumps(
                    {"type": "event", "event": "output", "body": {"category": "stderr", "output": text}},
                    ensure_ascii=False,
                )
            )
        except Exception:
            pass

    def _next_seq() -> int:
        nonlocal gateway_seq
        s = gateway_seq
        gateway_seq += 1
        return s

    async def _save_meta() -> None:
        try:
            ttl = int(meta.get("ttl_seconds") or attached_ttl)
            await cache.set(session_key, meta, expire_seconds=ttl)
        except Exception:
            pass

    async def _touch() -> None:
        meta["last_heartbeat_at"] = now_iso()
        await _save_meta()

    async def _mark_attached_if_needed() -> None:
        nonlocal attached_marked
        if attached_marked:
            return
        attached_marked = True
        if str(meta.get("status") or "") == SESSION_STATUS_READY:
            meta["status"] = SESSION_STATUS_ATTACHED
            meta["ttl_seconds"] = attached_ttl
            meta["last_heartbeat_at"] = now_iso()
            await _save_meta()

    async def _send_error_response(req: Dict[str, Any], message: str) -> None:
        try:
            await websocket.send_text(
                json.dumps(
                    {
                        "seq": _next_seq(),
                        "type": "response",
                        "request_seq": int(req.get("seq") or 0),
                        "success": False,
                        "command": str(req.get("command") or ""),
                        "message": message,
                    },
                    ensure_ascii=False,
                )
            )
        except Exception:
            pass

    def _is_valid_source_path(p: Any) -> bool:
        return str(p or "") == WORKSPACE_MAIN_PY

    def _is_debugpy_noise(out: str) -> bool:
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

    async def _arm_wall_timer() -> None:
        nonlocal wall_timer_task
        wall_ms = int(limits.get("wall_ms") or (attached_ttl * 1000))
        if wall_ms <= 0:
            return
        if wall_timer_task is not None:
            wall_timer_task.cancel()
            try:
                await wall_timer_task
            except Exception:
                pass

        async def kill_later():
            await asyncio.sleep(max(0.1, wall_ms / 1000.0))
            await _send_output(f"运行超时（超过 {wall_ms}ms），会话已终止\n")
            try:
                celery_app.send_task("app.tasks.pythonlab.stop_session", args=[session_id])
            except Exception:
                pass
            try:
                await websocket.close(code=1011)
            except Exception:
                pass

        wall_timer_task = asyncio.create_task(kill_later())

    async def _validate_request(msg: Dict[str, Any]) -> bool:
        if msg.get("type") != "request":
            return True
        cmd = str(msg.get("command") or "")
        args = msg.get("arguments") if isinstance(msg.get("arguments"), dict) else {}
        if cmd == "setBreakpoints":
            src = args.get("source") if isinstance(args.get("source"), dict) else {}
            if not _is_valid_source_path(src.get("path")):
                await _send_error_response(msg, f"source.path 仅允许 {WORKSPACE_MAIN_PY}")
                return False
        if cmd == "launch":
            if not _is_valid_source_path(args.get("program")):
                await _send_error_response(msg, f"program 仅允许 {WORKSPACE_MAIN_PY}")
                return False
            if str(args.get("cwd") or "") not in {"", WORKSPACE_DIR}:
                await _send_error_response(msg, f"cwd 仅允许 {WORKSPACE_DIR}")
                return False
        return True

    async def _ensure_conn(force: bool = False) -> None:
        nonlocal reader, writer
        async with conn_lock:
            if not force and reader is not None and writer is not None:
                return
            if writer is not None:
                try:
                    writer.close()
                    await writer.wait_closed()
                except Exception:
                    pass
            # Increase timeout to 5s to be safe
            try:
                reader, writer = await asyncio.wait_for(asyncio.open_connection(str(host), port), timeout=5.0)
            except Exception as e:
                # Log detailed error for debugging
                await _send_output(f"Failed to connect to DAP backend ({host}:{port}): {e}\n")
                raise

    async def pump_ws_to_tcp():
        nonlocal buffer_active
        while True:
            data = await websocket.receive_text()
            if len(data) > WS_MAX_DAP_MSG_BYTES:
                raise ValueError("message too large")
            msg = json.loads(data)
            await _touch()
            if msg.get("type") == "request":
                now = asyncio.get_running_loop().time()
                req_times.append(now)
                cutoff = now - 1.0
                while req_times and req_times[0] < cutoff:
                    req_times.pop(0)
                if len(req_times) > rate_limit_per_sec:
                    await _send_output("请求过于频繁，已触发限流断开\n")
                    await websocket.close(code=1011)
                    return
                await _mark_attached_if_needed()
                ok = await _validate_request(msg)
                if not ok:
                    continue
                if str(msg.get("command") or "") == "launch":
                    await _arm_wall_timer()
            if buffer_active:
                buffer.append(msg)
                buffer_event.set()
            else:
                await _ensure_conn()
                await _write_dap_message(writer, msg)

    async def pump_tcp_to_ws():
        nonlocal output_bytes, output_truncated, buffer_active, buffer_sent_idx, reader, writer
        while True:
            await _ensure_conn()
            try:
                msg = await _read_dap_message(reader)
            except EOFError:
                if buffer_active and not first_inbound_event.is_set():
                    buffer_sent_idx = 0
                    reader = None
                    writer = None
                    await _send_output("调试服务正在启动或重启，正在重试连接...\n")
                    await asyncio.sleep(WS_HEARTBEAT_INTERVAL)
                    continue
                raise
            if msg.get("type") == "event" and msg.get("event") == "output":
                body = msg.get("body") if isinstance(msg.get("body"), dict) else {}
                if str(body.get("category") or "") == "telemetry":
                    continue
                out = body.get("output")
                if isinstance(out, str):
                    if _is_debugpy_noise(out):
                        continue
                    if out.strip() in {"ptvsd", "debugpy"}:
                        continue
                    if output_truncated:
                        continue
                    output_bytes += len(out.encode("utf-8", errors="ignore"))
                    if output_bytes > max_output_bytes:
                        output_truncated = True
                        data = json.dumps(
                            {
                                "type": "event",
                                "event": "output",
                                "body": {
                                    "category": "stderr",
                                    "output": f"stdout/stderr 输出已截断（超过 {max_stdout_kb}KB）\n",
                                },
                            },
                            ensure_ascii=False,
                        )
                        await websocket.send_text(data)
                        continue
            if msg.get("type") == "event":
                ev = str(msg.get("event") or "")
                if ev == "stopped":
                    meta["status"] = SESSION_STATUS_STOPPED
                    meta["last_heartbeat_at"] = now_iso()
                    await _save_meta()
                elif ev == "continued":
                    meta["status"] = SESSION_STATUS_RUNNING
                    meta["last_heartbeat_at"] = now_iso()
                    await _save_meta()
                elif ev == "terminated":
                    meta["status"] = SESSION_STATUS_TERMINATED
                    meta["last_heartbeat_at"] = now_iso()
                    await _save_meta()
                    try:
                        celery_app.send_task("app.tasks.pythonlab.stop_session", args=[session_id])
                    except Exception:
                        pass
            data = json.dumps(msg, ensure_ascii=False)
            if len(data.encode("utf-8", errors="ignore")) > max_dap_msg_bytes:
                if msg.get("type") == "response":
                    rid = int(msg.get("request_seq") or 0)
                    cmd = str(msg.get("command") or "")
                    await websocket.send_text(
                        json.dumps(
                            {
                                "seq": _next_seq(),
                                "type": "response",
                                "request_seq": rid,
                                "success": False,
                                "command": cmd,
                                "message": "response too large",
                            },
                            ensure_ascii=False,
                        )
                    )
                    continue
                await _send_output("DAP 消息过大，连接已断开\n")
                await websocket.close(code=1011)
                return
            await websocket.send_text(data)
            if msg.get("type") == "response" and not first_inbound_event.is_set():
                first_inbound_event.set()
                buffer_active = False

    async def pump_buffer_to_tcp():
        nonlocal buffer_sent_idx, reader, writer
        connect_attempts = 0
        while True:
            await buffer_event.wait()
            buffer_event.clear()
            if not buffer_active:
                return
            if not buffer:
                continue
            await _ensure_conn()
            while buffer_sent_idx < len(buffer):
                try:
                    await _write_dap_message(writer, buffer[buffer_sent_idx])
                    buffer_sent_idx += 1
                except Exception:
                    connect_attempts += 1
                    if connect_attempts >= 8:
                        raise
                    reader = None
                    writer = None
                    buffer_sent_idx = 0
                    await asyncio.sleep(0.15)
                    await _ensure_conn(force=True)
                    break

    try:
        await asyncio.gather(pump_ws_to_tcp(), pump_tcp_to_ws(), pump_buffer_to_tcp())
    except WebSocketDisconnect:
        pass
    except Exception as e:
        if isinstance(e, EOFError):
            await _send_output("调试服务连接已断开，请重试运行（如仍失败请先停止/清理会话）。\n")
        else:
            await _send_output(f"debug ws proxy error: {type(e).__name__}: {e}\n")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
        try:
            if writer is not None:
                writer.close()
                await writer.wait_closed()
        except Exception:
            pass
        return
    finally:
        try:
            if wall_timer_task is not None:
                wall_timer_task.cancel()
        except Exception:
            pass
        try:
            current_status = str(meta.get("status") or "")
            if current_status not in {SESSION_STATUS_TERMINATED, SESSION_STATUS_FAILED, SESSION_STATUS_TERMINATING}:
                if attached_marked:
                    meta["status"] = SESSION_STATUS_READY
                    meta["last_heartbeat_at"] = now_iso()
                    await _save_meta()
        except Exception:
            pass
        try:
            if writer is not None:
                writer.close()
                await writer.wait_closed()
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
