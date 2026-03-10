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
TIMEOUT_SECONDS = float(os.getenv("TIMEOUT_SECONDS", "20"))
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


def build_probe_code(run_id: str) -> str:
    start = f"PHASEC_PROBE_{run_id}_START"
    end = f"PHASEC_PROBE_{run_id}_END"
    lines = [
        "import sys, time",
        f"print('{start}', flush=True)",
        "for i in range(1, 6):",
        f"    print('PHASEC_PROBE_{run_id}_STEP_' + str(i), flush=True)",
        "    time.sleep(0.15)",
        f"print('{end}', flush=True)",
    ]
    return "\n".join(lines)


def create_session(token: str, run_id: str) -> str:
    resp = requests.post(
        f"{API_URL}/api/v1/debug/sessions",
        json={
            "title": f"phasec_probe_{run_id}",
            "code": build_probe_code(run_id),
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


async def wait_for_response(
    ws: aiohttp.ClientWebSocketResponse,
    command: str,
    timeout_s: float,
    observed_outputs: list[str] | None = None,
    category_count: dict[str, int] | None = None,
) -> dict:
    started = time.time()
    while time.time() - started < timeout_s:
        remain = max(0.5, timeout_s - (time.time() - started))
        msg = await ws.receive(timeout=remain)
        if msg.type in {aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR}:
            raise SmokeFailure(EXIT_DETECT, "detect", f"ws closed before {command} response")
        if msg.type != aiohttp.WSMsgType.TEXT:
            continue
        data = json.loads(msg.data)
        if data.get("type") == "event":
            log(f"event while waiting {command}: {data.get('event')}")
            if data.get("event") == "output":
                body = data.get("body") if isinstance(data.get("body"), dict) else {}
                category = str(body.get("category") or "unknown")
                out = str(body.get("output") or "").strip()
                if observed_outputs is not None and out:
                    observed_outputs.append(out)
                if category_count is not None:
                    category_count[category] = category_count.get(category, 0) + 1
        elif data.get("type") == "response":
            log(
                f"response while waiting {command}: "
                f"command={data.get('command')} success={data.get('success')}"
            )
        if data.get("type") == "response" and data.get("command") == command:
            return data
    raise TimeoutError(f"{command} response timeout")


async def wait_for_initialized(ws: aiohttp.ClientWebSocketResponse, timeout_s: float) -> None:
    started = time.time()
    while time.time() - started < timeout_s:
        remain = max(0.5, timeout_s - (time.time() - started))
        msg = await ws.receive(timeout=remain)
        if msg.type in {aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR}:
            raise SmokeFailure(EXIT_DETECT, "detect", "ws closed before initialized")
        if msg.type != aiohttp.WSMsgType.TEXT:
            continue
        data = json.loads(msg.data)
        if data.get("type") == "event" and data.get("event") == "initialized":
            return
    raise TimeoutError("initialized event timeout")

async def wait_for_attach_ready(ws: aiohttp.ClientWebSocketResponse, timeout_s: float) -> bool:
    started = time.time()
    while time.time() - started < timeout_s:
        remain = max(0.5, timeout_s - (time.time() - started))
        msg = await ws.receive(timeout=remain)
        if msg.type in {aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR}:
            raise SmokeFailure(EXIT_DETECT, "detect", "ws closed before attach ready")
        if msg.type != aiohttp.WSMsgType.TEXT:
            continue
        data = json.loads(msg.data)
        if data.get("type") == "event":
            ev = str(data.get("event") or "")
            log(f"event while waiting attach: {ev}")
            if ev == "initialized":
                return True
            continue
        if data.get("type") == "response":
            log(
                "response while waiting attach: "
                f"command={data.get('command')} success={data.get('success')}"
            )
            if data.get("command") == "attach":
                if not data.get("success"):
                    detail = data.get("message") or data.get("body") or "attach failed"
                    raise SmokeFailure(EXIT_DETECT, "detect", str(detail))
                return False
    raise TimeoutError("attach ready timeout")


async def collect_output_events(
    ws: aiohttp.ClientWebSocketResponse,
    run_id: str,
    timeout_s: float,
    observed: list[str] | None = None,
    category_count: dict[str, int] | None = None,
) -> tuple[list[str], dict[str, int]]:
    target_end = f"PHASEC_PROBE_{run_id}_END"
    observed = observed or []
    category_count = category_count or {}
    started = time.time()
    while time.time() - started < timeout_s:
        msg = await ws.receive(timeout=timeout_s)
        if msg.type == aiohttp.WSMsgType.TEXT:
            data = json.loads(msg.data)
            if data.get("type") != "event" or data.get("event") != "output":
                continue
            body = data.get("body") if isinstance(data.get("body"), dict) else {}
            category = str(body.get("category") or "unknown")
            category_count[category] = category_count.get(category, 0) + 1
            out = str(body.get("output") or "").strip()
            if out:
                observed.append(out)
                log(f"output[{category}]: {out}")
                if target_end in out:
                    return observed, category_count
        elif msg.type in {aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR}:
            break
    return observed, category_count


def verify_markers(observed: list[str], run_id: str) -> tuple[bool, str]:
    expected = [f"PHASEC_PROBE_{run_id}_START"] + [
        f"PHASEC_PROBE_{run_id}_STEP_{i}" for i in range(1, 6)
    ] + [f"PHASEC_PROBE_{run_id}_END"]
    found_positions: list[int] = []
    joined = "\n".join(observed)
    for marker in expected:
        pos = joined.find(marker)
        if pos < 0:
            return False, f"missing marker: {marker}"
        found_positions.append(pos)
    if any(found_positions[i] >= found_positions[i + 1] for i in range(len(found_positions) - 1)):
        return False, "marker order is not monotonic"
    return True, "all markers visible and ordered"


async def run_probe(token: str, sid: str, run_id: str) -> None:
    url = ws_url(token, sid, f"phasec_probe_{run_id}")
    observed_early: list[str] = []
    category_early: dict[str, int] = {}
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(url) as ws:
            log("ws connected")
            init_req = {
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
            await ws.send_str(json.dumps(init_req))
            log("sent initialize")
            init_resp = await wait_for_response(ws, "initialize", 30, observed_early, category_early)
            if not init_resp.get("success"):
                raise SmokeFailure(EXIT_DETECT, "detect", "initialize failed")
            log("initialize ok")
            attach_req = {
                "seq": 2,
                "type": "request",
                "command": "attach",
                "arguments": {
                    "name": "Remote",
                    "type": "python",
                    "request": "attach",
                    "pathMappings": [{"localRoot": "/workspace", "remoteRoot": "/workspace"}],
                    "justMyCode": True,
                    "redirectOutput": True,
                },
            }
            await ws.send_str(json.dumps(attach_req))
            log("sent attach")
            initialized_seen = await wait_for_attach_ready(ws, 30)
            log("attach ready")
            if not initialized_seen:
                await wait_for_initialized(ws, 20)
                log("initialized event observed")
            config_req = {
                "seq": 3,
                "type": "request",
                "command": "configurationDone",
                "arguments": {},
            }
            await ws.send_str(json.dumps(config_req))
            log("sent configurationDone")
            config_resp = await wait_for_response(ws, "configurationDone", 30, observed_early, category_early)
            if not config_resp.get("success"):
                raise SmokeFailure(EXIT_DETECT, "detect", "configurationDone failed")
            log("configurationDone ok")
            threads_req = {"seq": 4, "type": "request", "command": "threads", "arguments": {}}
            await ws.send_str(json.dumps(threads_req))
            log("sent threads")
            threads_resp = await wait_for_response(ws, "threads", 10, observed_early, category_early)
            if threads_resp.get("success"):
                for th in (threads_resp.get("body") or {}).get("threads") or []:
                    tid = int(th.get("id") or 0)
                    if tid <= 0:
                        continue
                    continue_req = {
                        "seq": 100 + tid,
                        "type": "request",
                        "command": "continue",
                        "arguments": {"threadId": tid},
                    }
                    await ws.send_str(json.dumps(continue_req))
                    log(f"sent continue thread={tid}")
                    await wait_for_response(ws, "continue", 10, observed_early, category_early)
            observed, category_count = await collect_output_events(
                ws,
                run_id,
                TIMEOUT_SECONDS,
                observed_early,
                category_early,
            )
            ok, message = verify_markers(observed, run_id)
            log(
                "probe summary: "
                f"outputs={len(observed)} categories={json.dumps(category_count, ensure_ascii=False)} result={message}"
            )
            if not ok:
                raise SmokeFailure(EXIT_ASSERT, "assert", message)


def main() -> None:
    try:
        if TIMEOUT_SECONDS <= 0:
            raise SmokeFailure(EXIT_PARAM, "param", "TIMEOUT_SECONDS must be positive")
        run_id = str(int(time.time() * 1000))
        log(f"phase c probe starting, run_id={run_id}")
        token = login()
        sid = create_session(token, run_id)
        log(f"session created: {sid}")
        wait_for_ready(token, sid)
        log("session ready")
        asyncio.run(asyncio.wait_for(run_probe(token, sid, run_id), timeout=TIMEOUT_SECONDS + 20))
        log("phase c probe passed")
        sys.exit(EXIT_OK)
    except SmokeFailure as e:
        log(f"phase c probe failed: category={e.category} {e}")
        sys.exit(e.code)
    except (requests.RequestException, aiohttp.ClientError, asyncio.TimeoutError) as e:
        log(f"phase c probe failed: category=network {type(e).__name__}: {e}")
        sys.exit(EXIT_NETWORK)
    except Exception as e:
        log(f"phase c probe failed: {type(e).__name__}: {e}")
        sys.exit(EXIT_UNKNOWN)


if __name__ == "__main__":
    main()
