import asyncio
import json
import os
import uuid
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from loguru import logger

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


def _normalize_client_conn_id(raw: Any) -> Optional[str]:
    s = str(raw or "").strip()
    if not s:
        return None
    s = s[:64]
    if re.fullmatch(r"[A-Za-z0-9._-]+", s):
        return s
    return None

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
    host_candidates: list[str] = []
    for h in [host, "host.docker.internal", "172.17.0.1", "127.0.0.1"]:
        hs = str(h or "").strip()
        if hs and hs not in host_candidates:
            host_candidates.append(hs)
    if os.path.exists("/.dockerenv"):
        host_candidates = [h for h in host_candidates if h != "127.0.0.1"] + ["127.0.0.1"]
    port = int(meta.get("dap_port") or 0)
    if port <= 0:
        _ws_log("ws_dap_port_invalid", dap_port=port)
        await websocket.close(code=4410)
        return
    _raw_limits = meta.get("limits")
    limits: Dict[str, Any] = _raw_limits if isinstance(_raw_limits, dict) else {}
    max_stdout_kb = int(limits.get("max_stdout_kb") or WS_MAX_STDOUT_KB)
    max_output_bytes = max(16 * 1024, max_stdout_kb * 1024)
    max_dap_msg_bytes = int(limits.get("max_dap_msg_bytes") or WS_MAX_DAP_MSG_BYTES)
    output_bytes = 0
    output_truncated = False
    attached_ttl = int(getattr(settings, "PYTHONLAB_SESSION_TTL_SECONDS", 1800) or 1800)
    ws_owner_ttl = max(60, min(attached_ttl, 300))
    ws_owner_mode = str(getattr(settings, "PYTHONLAB_DEBUG_WS_OWNER_MODE", "deny") or "deny").strip().lower()
    if ws_owner_mode not in {"deny", "steal"}:
        ws_owner_mode = "deny"
    rate_limit_per_sec = WS_RATE_LIMIT_PER_SEC
    req_times: list[float] = []
    attached_marked = False
    gateway_seq = 1
    wall_timer_task: Optional[asyncio.Task] = None
    launch_requested = False
    terminated_seen = False
    terminated_event_forwarded = False

    reader: Optional[asyncio.StreamReader] = None
    writer: Optional[asyncio.StreamWriter] = None
    buffer_active = True
    buffer: list[Dict[str, Any]] = []
    buffer_sent_idx = 0
    buffer_event = asyncio.Event()
    first_inbound_event = asyncio.Event()
    conn_lock = asyncio.Lock()
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

    async def _send_output(text: str) -> None:
        try:
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "event",
                        "event": "output",
                        "body": {
                            "category": "stderr",
                            "output": text,
                            "_meta": _msg_meta("gateway"),
                        },
                    },
                    ensure_ascii=False,
                )
            )
        except Exception:
            pass

    def _msg_meta(source: str = "dap") -> Dict[str, Any]:
        return {
            "source": source,
            "ts": now_iso(),
            "ws_epoch": ws_epoch,
            "conn_id": conn_id,
            "client_conn_id": client_conn_id,
        }

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

    async def _mark_terminated(reason: str, fallback: bool = False) -> None:
        nonlocal terminated_seen
        if terminated_seen:
            return
        terminated_seen = True
        if fallback:
            logger.warning("pythonlab terminated fallback triggered: session_id=%s reason=%s", session_id, reason)
        else:
            logger.info("pythonlab terminated event received: session_id=%s reason=%s", session_id, reason)
        meta["status"] = SESSION_STATUS_TERMINATED
        meta["last_heartbeat_at"] = now_iso()
        await _save_meta()
        try:
            celery_app.send_task("app.tasks.pythonlab.stop_session", args=[session_id])
        except Exception:
            pass

    async def _emit_terminated_fallback(reason: str) -> None:
        nonlocal terminated_event_forwarded
        if terminated_seen:
            return
        await _mark_terminated(reason=reason, fallback=True)
        try:
            await websocket.send_text(
                json.dumps(
                    {
                        "seq": _next_seq(),
                        "type": "event",
                        "event": "terminated",
                        "body": {"restart": False, "fallback_reason": reason},
                    },
                    ensure_ascii=False,
                )
            )
            terminated_event_forwarded = True
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
        _raw_args = msg.get("arguments")
        args: Dict[str, Any] = _raw_args if isinstance(_raw_args, dict) else {}
        if cmd == "setBreakpoints":
            _raw_src = args.get("source")
            src: Dict[str, Any] = _raw_src if isinstance(_raw_src, dict) else {}
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
            last_err: Optional[Exception] = None
            for cand in host_candidates:
                try:
                    reader, writer = await asyncio.wait_for(asyncio.open_connection(cand, port), timeout=5.0)
                    _ws_log("dap_tcp_connected", ws_epoch=ws_epoch, host=cand, port=port)
                    return
                except Exception as e:
                    last_err = e
            await _send_output(f"Failed to connect to DAP backend ({host_candidates}:{port}): {last_err}\n")
            raise last_err if last_err else RuntimeError("dap connect failed")

    async def pump_ws_to_tcp():
        nonlocal buffer_active, launch_requested
        while True:
            data = await websocket.receive_text()
            if len(data) > WS_MAX_DAP_MSG_BYTES:
                raise ValueError("message too large")
            msg = json.loads(data)
            _ws_log(
                "ws_client_message",
                ws_epoch=ws_epoch,
                msg_type=str(msg.get("type") or ""),
                command=str(msg.get("command") or ""),
            )
            await _touch()

            # stdin is now handled by terminal_ws
            
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
                    launch_requested = True
                    await _arm_wall_timer()
            if buffer_active:
                buffer.append(msg)
                _ws_log(
                    "ws_buffer_append",
                    ws_epoch=ws_epoch,
                    buffer_size=len(buffer),
                    command=str(msg.get("command") or ""),
                )
                buffer_event.set()
            else:
                await _ensure_conn()
                assert writer is not None  # guaranteed by _ensure_conn
                await _write_dap_message(writer, msg)
                _ws_log(
                    "ws_forward_direct",
                    ws_epoch=ws_epoch,
                    command=str(msg.get("command") or ""),
                )

    async def pump_tcp_to_ws():
        nonlocal output_bytes, output_truncated, buffer_active, buffer_sent_idx, reader, writer, terminated_event_forwarded
        while True:
            await _ensure_conn()
            assert reader is not None  # guaranteed by _ensure_conn
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
                if launch_requested and not terminated_seen:
                    await _emit_terminated_fallback("dap_eof_after_launch")
                    return
                # If terminated seen, it's normal closure
                if terminated_seen:
                    try:
                        await websocket.close()
                    except Exception:
                        pass
                    return
                raise
            if msg.get("type") == "event" and msg.get("event") == "output":
                body = msg.get("body") if isinstance(msg.get("body"), dict) else {}  # type: ignore[union-attr]
                if isinstance(body, dict):
                    body["_meta"] = _msg_meta("dap")
                if isinstance(body, dict) and str(body.get("category") or "") == "telemetry":
                    continue
                out = body.get("output") if isinstance(body, dict) else None
                if isinstance(out, str):
                    if launch_requested and not terminated_seen:
                        for ln in out.splitlines():
                            if ln.strip().lower() == "done":
                                await _emit_terminated_fallback("done_output")
                                return
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
                                    "_meta": _msg_meta("gateway"),
                                },
                            },
                            ensure_ascii=False,
                        )
                        await websocket.send_text(data)
                        continue
            if msg.get("type") == "event":
                ev = str(msg.get("event") or "")
                if ev == "stopped":
                    _ws_log("dap_event_stopped", ws_epoch=ws_epoch)
                    meta["status"] = SESSION_STATUS_STOPPED
                    meta["last_heartbeat_at"] = now_iso()
                    await _save_meta()
                elif ev == "continued":
                    _ws_log("dap_event_continued", ws_epoch=ws_epoch)
                    meta["status"] = SESSION_STATUS_RUNNING
                    meta["last_heartbeat_at"] = now_iso()
                    await _save_meta()
                elif ev == "terminated":
                    _ws_log("dap_event_terminated", ws_epoch=ws_epoch)
                    terminated_event_forwarded = True
                    await _mark_terminated(reason="dap_terminated_event", fallback=False)
                elif ev == "exited" and launch_requested and not terminated_seen:
                    await _emit_terminated_fallback("dap_exited_event")
                    return
            if isinstance(msg, dict):
                msg["_meta"] = _msg_meta("dap")
            _ws_log(
                "dap_message",
                ws_epoch=ws_epoch,
                msg_type=str(msg.get("type") or ""),
                dap_event=str(msg.get("event") or ""),
                command=str(msg.get("command") or ""),
            )
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
            assert writer is not None  # guaranteed by _ensure_conn
            while buffer_sent_idx < len(buffer):
                try:
                    buffered = buffer[buffer_sent_idx]
                    await _write_dap_message(writer, buffered)
                    _ws_log(
                        "ws_buffer_flush",
                        ws_epoch=ws_epoch,
                        flush_idx=buffer_sent_idx,
                        command=str(buffered.get("command") or ""),
                    )
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
        _ws_log("ws_disconnected", ws_epoch=ws_epoch)
        pass
    except Exception as e:
        _ws_log("ws_proxy_error", ws_epoch=ws_epoch, error=f"{type(e).__name__}: {e}")
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
            await _clear_debug_owner()
        except Exception:
            pass
        try:
            if wall_timer_task is not None:
                wall_timer_task.cancel()
        except Exception:
            pass
        try:
            if launch_requested and not terminated_event_forwarded:
                await _emit_terminated_fallback("ws_finalize_without_terminated")
        except Exception:
            pass
        try:
            latest_meta = await cache.get(session_key) or meta
            latest_owner = latest_meta.get("debug_owner") if isinstance(latest_meta.get("debug_owner"), dict) else None
            if latest_owner and str(latest_owner.get("conn_id") or "") != conn_id:
                _ws_log("ws_finalize_skip_ready_restore_owner_mismatch", ws_epoch=ws_epoch)
                latest_meta = meta
            current_status = str(latest_meta.get("status") or "")
            if current_status not in {SESSION_STATUS_TERMINATED, SESSION_STATUS_FAILED, SESSION_STATUS_TERMINATING}:
                if attached_marked:
                    latest_meta["status"] = SESSION_STATUS_READY
                    latest_meta["last_heartbeat_at"] = now_iso()
                    meta.update(latest_meta)
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
        _ws_log("ws_closed", ws_epoch=ws_epoch)
