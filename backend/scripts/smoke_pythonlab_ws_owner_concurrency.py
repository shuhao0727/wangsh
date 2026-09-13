import asyncio
import json
import os
import sys
import time
from urllib.parse import quote

import aiohttp
import requests

API_URL = os.getenv("API_URL", "http://localhost:8000")
PYTHONLAB_V2_ROOT = "/api/v2/pythonlab"
# 统一使用 PYTHONLAB_SMOKE_USERNAME / PYTHONLAB_SMOKE_PASSWORD（见 README secrets 约定）。
# USERNAME 保留公开默认值 admin；PASSWORD 严禁硬编码 fallback，缺失即参数错误退出。
USERNAME = os.getenv("PYTHONLAB_SMOKE_USERNAME", "admin")
PASSWORD = os.getenv("PYTHONLAB_SMOKE_PASSWORD", "")
OWNER_MODE = os.getenv("OWNER_MODE", "auto").strip().lower()
EXPECT_OWNER_BEHAVIOR = os.getenv("EXPECT_OWNER_BEHAVIOR", "").strip().lower()
TIMEOUT_SECONDS = float(os.getenv("TIMEOUT_SECONDS", "8"))
RUNTIME_CLEANUP_TIMEOUT_SECONDS = float(
    os.getenv("RUNTIME_CLEANUP_TIMEOUT_SECONDS", "45")
)
RUNTIME_RETRY_INTERVAL_SECONDS = float(
    os.getenv("RUNTIME_RETRY_INTERVAL_SECONDS", "1")
)
# Cleanup probing must stay deliberately small: every attempt creates a real
# session and dispatches real Celery work. Backoff is capped even if the base
# interval is overridden by the environment.
RUNTIME_CLEANUP_MAX_ATTEMPTS = 3
RUNTIME_RETRY_MAX_INTERVAL_SECONDS = 4.0
RUNTIME_BUSY_ERROR = "已有会话仍在使用运行环境或状态未知，请先停止旧会话。"
EXIT_OK = 0
EXIT_PARAM = 2
EXIT_NETWORK = 3
EXIT_DETECT = 4
EXIT_ASSERT = 5
EXIT_UNKNOWN = 10


class SmokeFailure(Exception):
    def __init__(self, code: int, category: str, message: str):
        super().__init__(message)
        self.code = code
        self.category = category


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def login() -> str:
    resp = requests.post(
        f"{API_URL}/api/v1/auth/login",
        data={"username": USERNAME, "password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    resp.raise_for_status()
    token = str(resp.json().get("access_token") or "")
    if not token:
        raise RuntimeError("empty access token")
    return token


def _lifecycle_timeout(label: str, attempt: int) -> SmokeFailure:
    return SmokeFailure(
        EXIT_DETECT,
        "lifecycle",
        f"{label} runtime cleanup timeout after {attempt} attempts",
    )


def _bounded_timeout(
    default_timeout: float,
    deadline: float | None,
    label: str,
    attempt: int,
) -> float:
    if deadline is None:
        return default_timeout
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise _lifecycle_timeout(label, attempt)
    return min(default_timeout, remaining)


def create_session(
    token: str,
    *,
    deadline: float | None = None,
    lifecycle_label: str = "session",
    attempt: int = 1,
) -> str:
    code = "import time\nprint('owner smoke')\ntime.sleep(2)\nprint('done')"
    try:
        resp = requests.post(
            f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions",
            json={
                "title": "owner_concurrency_smoke",
                "code": code,
                "entry_path": "main.py",
                "requirements": [],
                "engine": "remote",
                "runtime_mode": "debug",
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=_bounded_timeout(30, deadline, lifecycle_label, attempt),
        )
    except requests.Timeout as exc:
        if deadline is not None:
            raise _lifecycle_timeout(lifecycle_label, attempt) from exc
        raise
    resp.raise_for_status()
    return str(resp.json()["session_id"])


def stop_session(token: str, sid: str) -> None:
    resp = requests.post(
        f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions/{sid}/stop",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    if resp.status_code not in {200, 404}:
        resp.raise_for_status()


def wait_for_ready(
    token: str,
    sid: str,
    *,
    deadline: float | None = None,
    lifecycle_label: str = "session",
    attempt: int = 1,
) -> None:
    ready_deadline = time.monotonic() + 90
    while True:
        now = time.monotonic()
        if deadline is not None and now >= deadline:
            raise _lifecycle_timeout(lifecycle_label, attempt)
        if now >= ready_deadline:
            raise TimeoutError("session ready timeout")

        request_deadline = min(ready_deadline, deadline) if deadline is not None else ready_deadline
        try:
            resp = requests.get(
                f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions/{sid}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=_bounded_timeout(15, request_deadline, lifecycle_label, attempt),
            )
        except requests.Timeout as exc:
            if deadline is not None:
                raise _lifecycle_timeout(lifecycle_label, attempt) from exc
            if time.monotonic() >= ready_deadline:
                raise TimeoutError("session ready timeout") from exc
            raise
        resp.raise_for_status()
        if deadline is not None and time.monotonic() >= deadline:
            raise _lifecycle_timeout(lifecycle_label, attempt)
        data = resp.json()
        status = str(data.get("status") or "")
        if status == "READY":
            return
        if status == "FAILED":
            raise RuntimeError(f"session failed: {data.get('error_detail')}")

        sleep_deadline = min(ready_deadline, deadline) if deadline is not None else ready_deadline
        sleep_seconds = min(0.4, max(0.0, sleep_deadline - time.monotonic()))
        if sleep_seconds <= 0:
            if deadline is not None and time.monotonic() >= deadline:
                raise _lifecycle_timeout(lifecycle_label, attempt)
            raise TimeoutError("session ready timeout")
        time.sleep(sleep_seconds)


def stop_tracked_session(token: str, sid: str, created_sessions: list[str]) -> None:
    """Request stop but retain the session for final idempotent cleanup."""
    stop_session(token, sid)
    # A 200 response only means the asynchronous cleanup task was requested;
    # the endpoint can even return 200 when Celery dispatch fails. Keep every
    # created session in the final cleanup list so main() retries the request.
    if sid not in created_sessions:
        created_sessions.append(sid)
    log(f"session cleanup requested (retained for final retry): {sid}")


def create_ready_session(
    token: str,
    created_sessions: list[str],
    label: str,
    *,
    retry_runtime_busy: bool = False,
) -> str:
    """Create a READY session, retrying only the known async cleanup race."""
    deadline = (
        time.monotonic() + RUNTIME_CLEANUP_TIMEOUT_SECONDS
        if retry_runtime_busy
        else None
    )
    max_attempts = RUNTIME_CLEANUP_MAX_ATTEMPTS if retry_runtime_busy else 1

    for attempt in range(1, max_attempts + 1):
        if deadline is None:
            sid = create_session(token)
        else:
            _bounded_timeout(30, deadline, label, attempt)
            sid = create_session(
                token,
                deadline=deadline,
                lifecycle_label=label,
                attempt=attempt,
            )
        created_sessions.append(sid)
        log(f"{label} session created: {sid} (attempt={attempt}/{max_attempts})")
        try:
            if deadline is None:
                wait_for_ready(token, sid)
            else:
                wait_for_ready(
                    token,
                    sid,
                    deadline=deadline,
                    lifecycle_label=label,
                    attempt=attempt,
                )
        except RuntimeError as exc:
            expected_runtime_busy = f"session failed: {RUNTIME_BUSY_ERROR}"
            if not retry_runtime_busy or str(exc) != expected_runtime_busy:
                raise
            log(f"{label} observed runtime busy: {exc}")
            stop_tracked_session(token, sid, created_sessions)
            if attempt >= max_attempts:
                raise SmokeFailure(
                    EXIT_DETECT,
                    "lifecycle",
                    f"{label} runtime still busy after {attempt} bounded attempts: {exc}",
                ) from exc

            remaining = _bounded_timeout(
                RUNTIME_RETRY_MAX_INTERVAL_SECONDS,
                deadline,
                label,
                attempt,
            )
            base_interval = max(0.0, RUNTIME_RETRY_INTERVAL_SECONDS)
            backoff = min(
                base_interval * (2 ** (attempt - 1)),
                RUNTIME_RETRY_MAX_INTERVAL_SECONDS,
                remaining,
            )
            if backoff > 0:
                log(f"{label} cleanup backoff: {backoff:.2f}s")
                time.sleep(backoff)
            continue
        log(f"{label} session ready")
        return sid

    raise AssertionError("unreachable runtime cleanup retry state")


def ws_url(token: str, sid: str, client_conn_id: str) -> str:
    ws_base = API_URL.replace("http://", "ws://").replace("https://", "wss://")
    return (
        f"{ws_base}{PYTHONLAB_V2_ROOT}/sessions/{sid}/ws"
        f"?client_conn_id={quote(client_conn_id)}&token={quote(token)}"
    )


async def recv_until_close(
    ws: aiohttp.ClientWebSocketResponse,
    timeout_s: float,
    label: str,
) -> tuple[int | None, str]:
    started = time.time()
    last_reason = ""
    while time.time() - started < timeout_s:
        try:
            msg = await ws.receive(timeout=min(1.0, timeout_s))
        except asyncio.TimeoutError:
            continue
        if msg.type == aiohttp.WSMsgType.CLOSE:
            return ws.close_code, str(msg.extra or "") or last_reason
        if msg.type == aiohttp.WSMsgType.CLOSED:
            return ws.close_code, str(ws.close_reason or "") or last_reason
        if msg.type == aiohttp.WSMsgType.ERROR:
            return ws.close_code, str(ws.exception() or "") or last_reason
        if msg.type == aiohttp.WSMsgType.TEXT:
            try:
                data = json.loads(msg.data)
                if data.get("type") == "event" and data.get("event") == "output":
                    body = data.get("body") if isinstance(data.get("body"), dict) else {}
                    out = str(body.get("output") or "").strip()
                    if out:
                        last_reason = out
                        log(f"{label} output: {out}")
            except Exception:
                pass
        await asyncio.sleep(0.05)
    return ws.close_code, last_reason


async def run_owner_mode_smoke(
    token: str,
    sid: str,
    owner_mode: str,
    expect_owner_behavior: str = "",
) -> str:
    url1 = ws_url(token, sid, "smoke_ws_1")
    url2 = ws_url(token, sid, "smoke_ws_2")
    async with aiohttp.ClientSession() as session:
        ws1 = await session.ws_connect(url1)
        log("ws1 connected")
        ws2 = await session.ws_connect(url2)
        log("ws2 connected")

        (code1, reason1), (code2, reason2) = await asyncio.gather(
            recv_until_close(ws1, TIMEOUT_SECONDS, "ws1"),
            recv_until_close(ws2, TIMEOUT_SECONDS, "ws2"),
        )
        detected_behavior = "unknown"
        deny_markers = ("deny_in_use", "其他窗口调试")
        steal_markers = ("taken_over", "已接管当前会话")
        has_deny_marker = any(m in reason1 for m in deny_markers) or any(
            m in reason2 for m in deny_markers
        )
        has_steal_marker = any(m in reason1 for m in steal_markers) or any(
            m in reason2 for m in steal_markers
        )
        if has_deny_marker:
            detected_behavior = "deny"
        elif has_steal_marker:
            detected_behavior = "steal"
        elif code2 == 4429:
            detected_behavior = "deny"
        elif code1 == 4429 and code2 in {1000, 1006, None}:
            detected_behavior = "steal"
        log(
            "owner behavior observed: "
            f"{detected_behavior} (ws1=({code1},{reason1!r}), ws2=({code2},{reason2!r}))"
        )

        if expect_owner_behavior:
            if expect_owner_behavior not in {"deny", "steal"}:
                raise SmokeFailure(
                    EXIT_PARAM,
                    "param",
                    "EXPECT_OWNER_BEHAVIOR must be deny/steal",
                )
            if detected_behavior != expect_owner_behavior:
                raise SmokeFailure(
                    EXIT_ASSERT,
                    "assert",
                    f"expected owner behavior {expect_owner_behavior}, got {detected_behavior}",
                )

        if owner_mode == "deny":
            if detected_behavior != "deny":
                raise SmokeFailure(
                    EXIT_ASSERT,
                    "assert",
                    f"deny mode expected deny behavior, got {detected_behavior}",
                )
            if not ws1.closed:
                await ws1.close()
            log("deny mode assertion passed")
            return detected_behavior

        if owner_mode == "steal":
            if detected_behavior != "steal":
                raise SmokeFailure(
                    EXIT_ASSERT,
                    "assert",
                    f"steal mode expected steal behavior, got {detected_behavior}",
                )
            if not ws2.closed:
                await ws2.close()
            log("steal mode assertion passed")
            return detected_behavior

        if owner_mode == "auto":
            if detected_behavior == "deny":
                if not ws1.closed:
                    await ws1.close()
                log("auto mode detected deny behavior and assertion passed")
                return detected_behavior
            if detected_behavior == "steal":
                if not ws2.closed:
                    await ws2.close()
                log("auto mode detected steal behavior and assertion passed")
                return detected_behavior
            raise SmokeFailure(
                EXIT_DETECT,
                "detect",
                "auto mode did not match deny/steal expectations: "
                f"ws1=({code1},{reason1!r}) ws2=({code2},{reason2!r})",
            )

        raise SmokeFailure(
            EXIT_PARAM,
            "param",
            f"unsupported OWNER_MODE={owner_mode}",
        )


def main() -> int:
    token = ""
    created_sessions: list[str] = []
    exit_code = EXIT_OK
    try:
        if not PASSWORD:
            raise SmokeFailure(
                EXIT_PARAM,
                "param",
                "PYTHONLAB_SMOKE_PASSWORD 未设置（禁止硬编码密码，请通过 secret 注入）",
            )
        if OWNER_MODE not in {"auto", "deny", "steal", "matrix"}:
            raise SmokeFailure(
                EXIT_PARAM,
                "param",
                "OWNER_MODE must be auto/deny/steal/matrix",
            )
        if EXPECT_OWNER_BEHAVIOR and EXPECT_OWNER_BEHAVIOR not in {"deny", "steal"}:
            raise SmokeFailure(
                EXIT_PARAM,
                "param",
                "EXPECT_OWNER_BEHAVIOR must be empty/deny/steal",
            )
        log(f"owner concurrency smoke starting, OWNER_MODE={OWNER_MODE}")
        token = login()
        if OWNER_MODE == "matrix":
            sid_detect = create_ready_session(
                token,
                created_sessions,
                "matrix detect",
            )
            detected = asyncio.run(run_owner_mode_smoke(token, sid_detect, "auto"))
            strict_expect = EXPECT_OWNER_BEHAVIOR or detected
            stop_tracked_session(token, sid_detect, created_sessions)
            sid_strict = create_ready_session(
                token,
                created_sessions,
                "matrix strict",
                retry_runtime_busy=True,
            )
            asyncio.run(run_owner_mode_smoke(token, sid_strict, "auto", strict_expect))
            log(f"matrix strict assertion passed with expected={strict_expect}")
        else:
            sid = create_ready_session(token, created_sessions, "owner")
            asyncio.run(run_owner_mode_smoke(token, sid, OWNER_MODE, EXPECT_OWNER_BEHAVIOR))
        log("owner concurrency smoke passed")
    except SmokeFailure as e:
        log(f"owner concurrency smoke failed: category={e.category} {e}")
        exit_code = e.code
    except (requests.RequestException, aiohttp.ClientError, asyncio.TimeoutError) as e:
        log(f"owner concurrency smoke failed: category=network {type(e).__name__}: {e}")
        exit_code = EXIT_NETWORK
    except Exception as e:
        log(f"owner concurrency smoke failed: {type(e).__name__}: {e}")
        exit_code = EXIT_UNKNOWN
    finally:
        if token:
            for sid in reversed(created_sessions):
                try:
                    stop_session(token, sid)
                    log(f"session cleanup requested: {sid}")
                except Exception as exc:
                    log(f"session cleanup failed: sid={sid} {type(exc).__name__}: {exc}")
                    if exit_code == EXIT_OK:
                        exit_code = EXIT_NETWORK
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
