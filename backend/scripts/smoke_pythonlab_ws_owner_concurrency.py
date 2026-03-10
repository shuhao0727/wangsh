import asyncio
import json
import os
import sys
import time
from urllib.parse import quote

import aiohttp
import requests

API_URL = os.getenv("API_URL", "http://localhost:8000")
USERNAME = os.getenv("USERNAME", "admin")
PASSWORD = os.getenv("PASSWORD", "wangshuhao0727")
OWNER_MODE = os.getenv("OWNER_MODE", "auto").strip().lower()
EXPECT_OWNER_BEHAVIOR = os.getenv("EXPECT_OWNER_BEHAVIOR", "").strip().lower()
TIMEOUT_SECONDS = float(os.getenv("TIMEOUT_SECONDS", "8"))
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


def create_session(token: str) -> str:
    code = "import time\nprint('owner smoke')\ntime.sleep(2)\nprint('done')"
    resp = requests.post(
        f"{API_URL}/api/v1/debug/sessions",
        json={
            "title": "owner_concurrency_smoke",
            "code": code,
            "entry_path": "main.py",
            "requirements": [],
            "runtime_mode": "debug",
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    return str(resp.json()["session_id"])


def wait_for_ready(token: str, sid: str) -> None:
    started = time.time()
    while time.time() - started < 90:
        resp = requests.get(
            f"{API_URL}/api/v1/debug/sessions/{sid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        status = str(data.get("status") or "")
        if status == "READY":
            return
        if status == "FAILED":
            raise RuntimeError(f"session failed: {data.get('error_detail')}")
        time.sleep(0.4)
    raise TimeoutError("session ready timeout")


def ws_url(token: str, sid: str, client_conn_id: str) -> str:
    ws_base = API_URL.replace("http://", "ws://").replace("https://", "wss://")
    return (
        f"{ws_base}/api/v1/debug/sessions/{sid}/ws"
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


def main() -> None:
    try:
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
            sid_detect = create_session(token)
            log(f"matrix detect session created: {sid_detect}")
            wait_for_ready(token, sid_detect)
            log("matrix detect session ready")
            detected = asyncio.run(run_owner_mode_smoke(token, sid_detect, "auto"))
            strict_expect = EXPECT_OWNER_BEHAVIOR or detected
            sid_strict = create_session(token)
            log(f"matrix strict session created: {sid_strict}")
            wait_for_ready(token, sid_strict)
            log("matrix strict session ready")
            asyncio.run(run_owner_mode_smoke(token, sid_strict, "auto", strict_expect))
            log(f"matrix strict assertion passed with expected={strict_expect}")
        else:
            sid = create_session(token)
            log(f"session created: {sid}")
            wait_for_ready(token, sid)
            log("session ready")
            asyncio.run(run_owner_mode_smoke(token, sid, OWNER_MODE, EXPECT_OWNER_BEHAVIOR))
        log("owner concurrency smoke passed")
        sys.exit(EXIT_OK)
    except SmokeFailure as e:
        log(f"owner concurrency smoke failed: category={e.category} {e}")
        sys.exit(e.code)
    except (requests.RequestException, aiohttp.ClientError, asyncio.TimeoutError) as e:
        log(f"owner concurrency smoke failed: category=network {type(e).__name__}: {e}")
        sys.exit(EXIT_NETWORK)
    except Exception as e:
        log(f"owner concurrency smoke failed: {type(e).__name__}: {e}")
        sys.exit(EXIT_UNKNOWN)


if __name__ == "__main__":
    main()
