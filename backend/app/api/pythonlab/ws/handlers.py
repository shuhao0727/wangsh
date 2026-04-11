"""
WebSocket 端点处理函数
"""

import asyncio
import json
import os
import re
import sys
import uuid
from typing import Any, Dict, Optional

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
from app.api.pythonlab.ws.validation import _extract_ws_token, _normalize_client_conn_id, _parse_last_seq, _build_dap_host_candidates
from app.api.pythonlab.ws.bridge import _get_or_create_dap_bridge, _DAP_BRIDGES


_HANDLER_DEFAULT_NOW_ISO = now_iso
_HANDLER_DEFAULT_CACHE = cache
_HANDLER_DEFAULT_CELERY_APP = celery_app
_HANDLER_DEFAULT_AUTH_GET_CURRENT_USER = auth_get_current_user
_HANDLER_DEFAULT_GET_OR_CREATE_DAP_BRIDGE = _get_or_create_dap_bridge


def _compat_ws_module():
    return sys.modules.get("app.api.pythonlab.ws")


def _resolve_handler_runtime(name: str, default: Any) -> Any:
    current = globals().get(name, default)
    if current is not default:
        return current
    module = _compat_ws_module()
    if module is None:
        return current
    return getattr(module, name, current)


def _compat_now_iso() -> str:
    fn = _resolve_handler_runtime("now_iso", _HANDLER_DEFAULT_NOW_ISO)
    return fn()


def _compat_cache_backend():
    return _resolve_handler_runtime("cache", _HANDLER_DEFAULT_CACHE)


def _compat_celery_backend():
    return _resolve_handler_runtime("celery_app", _HANDLER_DEFAULT_CELERY_APP)


async def _compat_auth_get_current_user(token: str, db: AsyncSession):
    fn = _resolve_handler_runtime("auth_get_current_user", _HANDLER_DEFAULT_AUTH_GET_CURRENT_USER)
    return await fn(token, db)


def _compat_get_or_create_dap_bridge():
    return _resolve_handler_runtime("_get_or_create_dap_bridge", _HANDLER_DEFAULT_GET_OR_CREATE_DAP_BRIDGE)


def _bridge_tasks(bridge: Any) -> list[asyncio.Task]:
    if bridge is None:
        return []
    return [task for task in (bridge.reader_task, bridge.flush_task) if task is not None]


def _bridge_background_exception(bridge: Any) -> Optional[BaseException]:
    for task in _bridge_tasks(bridge):
        if not task.done() or task.cancelled():
            continue
        try:
            exc = task.exception()
        except BaseException as err:
            return err
        if exc is not None:
            return exc
    return None


async def _allow_bridge_progress(bridge: Any, *, baseline_seq: int, timeout_s: float) -> bool:
    if bridge is None:
        return False
    loop = asyncio.get_running_loop()
    deadline = loop.time() + max(0.0, timeout_s)
    while True:
        if bridge.gateway_seq > baseline_seq or bridge.terminated_seen or bridge.closed:
            return True
        tasks = [task for task in _bridge_tasks(bridge) if not task.done()]
        if not tasks:
            return bridge.gateway_seq > baseline_seq or bridge.terminated_seen or bridge.closed
        remaining = deadline - loop.time()
        if remaining <= 0:
            return bridge.gateway_seq > baseline_seq or bridge.terminated_seen or bridge.closed
        await asyncio.sleep(min(0.01, remaining))


router = APIRouter()


@router.websocket("/sessions/{session_id}/terminal")
async def terminal_ws(websocket: WebSocket, session_id: str, db: AsyncSession = Depends(get_db)):
    """终端 WebSocket 端点"""
    await websocket.accept()
    logger.info("terminal ws accepted: session_id={}", session_id)
    cache_backend = _compat_cache_backend()
    celery_backend = _compat_celery_backend()

    token = _extract_ws_token(websocket)
    if not token:
        logger.warning("terminal ws no token: session_id={}", session_id)
        await websocket.close(code=4401)
        return
    user = await _compat_auth_get_current_user(token, db)
    if not user:
        logger.warning("terminal ws auth failed: session_id={}", session_id)
        await websocket.close(code=4401)
        return

    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    meta = await cache_backend.get(session_key)
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
            meta["last_heartbeat_at"] = _compat_now_iso()
            ttl = int(meta.get("ttl_seconds") or 300)
            await cache_backend.set(session_key, meta, expire_seconds=ttl)
            os.write(
                pty_fd,
                b"python -u /workspace/main.py; printf '\\n__PYTHONLAB_DONE__:%s\\n' $?;\n",
            )
    except Exception as e:
        logger.error(f"Failed to attach TTY: {e}")
        await websocket.close(code=4500)
        return

    async def mark_plain_terminated(exit_code: Optional[int] = None) -> None:
        """标记普通模式会话为已终止"""
        nonlocal plain_finished
        if plain_finished:
            return
        plain_finished = True
        try:
            latest = await cache_backend.get(session_key) or meta
            latest["status"] = SESSION_STATUS_TERMINATED
            latest["last_heartbeat_at"] = _compat_now_iso()
            latest["plain_exit_code"] = exit_code
            await cache_backend.set(session_key, latest, expire_seconds=60)
        except Exception:
            pass
        try:
            celery_backend.send_task("app.tasks.pythonlab.stop_session", args=[session_id])
        except Exception:
            pass

    async def pump_ws_to_tty():
        """将 WebSocket 数据泵送到 TTY"""
        try:
            while True:
                # 从 xterm 接收原始数据
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
        """将 TTY 数据泵送到 WebSocket"""
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
                # 发送文本，使用 replace 错误处理来处理二进制垃圾
                text = data.decode('utf-8', errors='replace')
                if plain_mode and plain_done_marker in text:
                    left, right = text.split(plain_done_marker, 1)
                    if left:
                        await websocket.send_text(left)
                    rc_match = re.search(r"\d+", right)
                    exit_code = int(rc_match.group(0)) if rc_match else None
                    await mark_plain_terminated(exit_code)
                    # 向学生显示友好的退出消息
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
        # 首先关闭 PTY 文件描述符以解除任何挂起的 os.read() 阻塞，然后终止附加子进程
        if pty_fd is not None:
            try:
                os.close(pty_fd)
            except Exception:
                pass
            pty_fd = None
        if process:
            try:
                if process.returncode is None:
                    process.kill()  # 使用 kill() 而不是 terminate() 进行立即清理
            except ProcessLookupError:
                pass
            except Exception:
                pass
        logger.info("terminal ws closed: session_id={}", session_id)


@router.websocket("/sessions/{session_id}/ws")
async def dap_ws(websocket: WebSocket, session_id: str, db: AsyncSession = Depends(get_db)):
    """DAP WebSocket 端点"""
    await websocket.accept()
    conn_started_at = _compat_now_iso()
    conn_id = uuid.uuid4().hex[:12]
    client_conn_id = _normalize_client_conn_id(websocket.query_params.get("client_conn_id"))
    last_seq = _parse_last_seq(websocket)
    user_id = 0
    cache_backend = _compat_cache_backend()
    celery_backend = _compat_celery_backend()

    def _ws_log(event: str, **extra: Any) -> None:
        """WebSocket 日志函数"""
        try:
            payload = {
                "event": event,
                "session_id": session_id,
                "conn_id": conn_id,
                "client_conn_id": client_conn_id,
                "user_id": user_id,
                "ts": _compat_now_iso(),
            }
            payload.update(extra)
            logger.info("pythonlab_dap_ws {}", json.dumps(payload, ensure_ascii=False))
        except Exception:
            pass

    token = _extract_ws_token(websocket)
    if not token:
        _ws_log("ws_auth_missing_token")
        await websocket.close(code=4401)
        return
    user = await _compat_auth_get_current_user(token, db)
    if not user:
        _ws_log("ws_auth_invalid_token")
        await websocket.close(code=4401)
        return
    user_id = int(user.get("id") or 0)
    _ws_log("ws_auth_ok")

    session_key = f"{CACHE_KEY_SESSION_PREFIX}:{session_id}"
    meta = await cache_backend.get(session_key)
    if not meta:
        _ws_log("ws_session_missing")
        await websocket.close(code=4404)
        return

    if int(meta.get("owner_user_id") or 0) != int(user.get("id") or 0):
        _ws_log("ws_owner_forbidden", owner_user_id=int(meta.get("owner_user_id") or 0))
        await websocket.close(code=4403)
        return

    # 为容器启动竞争条件添加 1 秒缓冲
    for _ in range(5):
        status = str(meta.get("status") or "")
        if status in {SESSION_STATUS_READY, SESSION_STATUS_ATTACHED, SESSION_STATUS_RUNNING, SESSION_STATUS_STOPPED}:
            break
        await asyncio.sleep(WS_HEARTBEAT_INTERVAL)
        meta = await cache_backend.get(session_key) or meta

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
    redis_client = await cache_backend.get_client()
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
        """保持所有者状态活跃"""
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
        """保存元数据到缓存"""
        try:
            ttl = int(meta.get("ttl_seconds") or attached_ttl)
            await cache_backend.set(session_key, meta, expire_seconds=ttl)
        except Exception:
            pass

    async def _set_debug_owner(state: str) -> None:
        """设置调试所有者信息"""
        meta["debug_owner"] = {
            "state": state,
            "user_id": int(user.get("id") or 0),
            "conn_id": conn_id,
            "client_conn_id": client_conn_id,
            "ws_epoch": ws_epoch,
            "updated_at": _compat_now_iso(),
        }
        await _save_meta()

    async def _clear_debug_owner() -> None:
        """清除调试所有者信息"""
        owner = meta.get("debug_owner") if isinstance(meta.get("debug_owner"), dict) else None
        if not owner:
            return
        if str(owner.get("conn_id") or "") != conn_id:
            return
        meta.pop("debug_owner", None)
        await _save_meta()

    await _set_debug_owner("active")

    async def _touch() -> None:
        """更新最后心跳时间"""
        meta["last_heartbeat_at"] = _compat_now_iso()
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

    bridge = None
    try:
        bridge_factory = _compat_get_or_create_dap_bridge()
        bridge = await bridge_factory(
            session_id=session_id,
            session_key=session_key,
            meta=meta,
            host_candidates=host_candidates,
            port=port,
            limits=limits,
            attached_ttl=attached_ttl,
            ws_log=lambda event, **extra: _ws_log(event, ws_epoch=ws_epoch, **extra),
            cache_backend=cache_backend,
            celery_backend=celery_backend,
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
            receive_baseline_seq = bridge.gateway_seq
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
            if receive_task in done:
                try:
                    data = receive_task.result()
                except BaseException as receive_exc:
                    progress_made = await _allow_bridge_progress(
                        bridge,
                        baseline_seq=receive_baseline_seq,
                        timeout_s=max(0.05, WS_HEARTBEAT_INTERVAL),
                    )
                    background_exc = _bridge_background_exception(bridge)
                    if isinstance(receive_exc, WebSocketDisconnect):
                        if background_exc is not None and not progress_made:
                            raise background_exc
                        raise receive_exc
                    if background_exc is not None and not progress_made:
                        raise background_exc
                    if progress_made:
                        break
                    raise receive_exc
            else:
                try:
                    await receive_task
                except BaseException:
                    pass
                background_exc = _bridge_background_exception(bridge)
                if background_exc is not None:
                    raise background_exc
                break
            await _touch()
            await bridge.handle_client_text(data)
    except WebSocketDisconnect:
        _ws_log("ws_disconnected", ws_epoch=ws_epoch)
    except Exception as e:
        _ws_log("ws_proxy_error", ws_epoch=ws_epoch, error=f"{type(e).__name__}: {e}")
        bridge_handled_error = isinstance(e, RuntimeError) and str(e) in {"dap message too large", "debug ws ownership lost"}
        if bridge is not None:
            if not (isinstance(e, RuntimeError) and str(e) in {"rate limited", "dap message too large", "debug ws ownership lost"}):
                if isinstance(e, EOFError):
                    await bridge._send_output("调试服务连接已断开，请重试运行（如仍失败请先停止/清理会话）。\n")
                else:
                    await bridge._send_output(f"debug ws proxy error: {type(e).__name__}: {e}\n")
        if not bridge_handled_error:
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
                latest_meta = await cache_backend.get(session_key) or meta
                latest_owner = latest_meta.get("debug_owner") if isinstance(latest_meta.get("debug_owner"), dict) else None
                if latest_owner and str(latest_owner.get("conn_id") or "") != conn_id:
                    _ws_log("ws_finalize_skip_ready_restore_owner_mismatch", ws_epoch=ws_epoch)
                    latest_meta = meta
                current_status = str(latest_meta.get("status") or "")
                attached_marked = bool(bridge.attached_marked) if bridge is not None else False
                if current_status not in {SESSION_STATUS_TERMINATED, SESSION_STATUS_FAILED, SESSION_STATUS_TERMINATING} and attached_marked:
                    latest_meta["status"] = SESSION_STATUS_READY
                    latest_meta["last_heartbeat_at"] = _compat_now_iso()
                    ttl = int(latest_meta.get("ttl_seconds") or attached_ttl)
                    await cache_backend.set(session_key, latest_meta, expire_seconds=ttl)
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
        _ws_log("ws_closed", ws_epoch=ws_epoch)
