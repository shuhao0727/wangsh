import asyncio
import json
import os
import time
from pathlib import Path
from urllib.parse import quote

import aiohttp
import requests

API_URL = os.getenv("API_URL", "http://localhost:8000")
PYTHONLAB_V2_ROOT = "/api/v2/pythonlab"
USERNAME = os.getenv("USERNAME", "admin")
PASSWORD = os.getenv("PASSWORD", "wangshuhao0727")
ROUNDS = int(os.getenv("ROUNDS", "10"))
TIMEOUT_SECONDS = float(os.getenv("TIMEOUT_SECONDS", "20"))
LOG_DIR = Path(os.getenv("LOG_DIR", "/tmp/pythonlab_stepwatch_soak"))


def now() -> str:
    return time.strftime("%H:%M:%S")


def log(msg: str) -> None:
    print(f"[{now()}] {msg}", flush=True)


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


def probe_code() -> str:
    return "\n".join(
        [
            "import time",
            "",
            "def inc(v):",
            "    x = v + 1",
            "    return x",
            "",
            "a = 1",
            "b = inc(a)",
            "c = inc(b)",
            "print('RESULT', c, flush=True)",
            "time.sleep(0.1)",
        ]
    )


def create_session(token: str, title: str) -> str:
    resp = requests.post(
        f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions",
        json={
            "title": title,
            "code": probe_code(),
            "entry_path": "main.py",
            "requirements": [],
            "engine": "remote",
            "runtime_mode": "debug",
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    return str(resp.json()["session_id"])


def wait_ready(token: str, sid: str) -> None:
    started = time.time()
    while time.time() - started < 90:
        resp = requests.get(
            f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions/{sid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        st = str(data.get("status") or "")
        if st == "READY":
            return
        if st == "FAILED":
            raise RuntimeError(f"session failed: {data.get('error_detail')}")
        time.sleep(0.4)
    raise TimeoutError("session ready timeout")


def ws_url(token: str, sid: str, client_conn_id: str) -> str:
    ws_base = API_URL.replace("http://", "ws://").replace("https://", "wss://")
    return (
        f"{ws_base}{PYTHONLAB_V2_ROOT}/sessions/{sid}/ws"
        f"?client_conn_id={quote(client_conn_id)}&token={quote(token)}"
    )


async def recv_json(ws: aiohttp.ClientWebSocketResponse, timeout_s: float) -> dict:
    try:
        msg = await ws.receive(timeout=timeout_s)
    except asyncio.TimeoutError:
        return {"_timeout": True}
    if msg.type in {aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR}:
        raise RuntimeError("ws closed")
    if msg.type != aiohttp.WSMsgType.TEXT:
        return {}
    return json.loads(msg.data)


async def wait_response(
    ws: aiohttp.ClientWebSocketResponse,
    command: str,
    timeout_s: float,
    events: list[str],
) -> dict:
    started = time.time()
    while time.time() - started < timeout_s:
        data = await recv_json(ws, max(0.5, timeout_s - (time.time() - started)))
        if not data or data.get("_timeout"):
            continue
        if data.get("type") == "event":
            ev = str(data.get("event") or "")
            events.append(ev)
            continue
        if data.get("type") == "response" and str(data.get("command") or "") == command:
            return data
    raise TimeoutError(f"{command} response timeout")


async def wait_event(
    ws: aiohttp.ClientWebSocketResponse,
    event_name: str,
    timeout_s: float,
    events: list[str],
) -> dict:
    started = time.time()
    while time.time() - started < timeout_s:
        data = await recv_json(ws, max(0.5, timeout_s - (time.time() - started)))
        if not data or data.get("_timeout"):
            continue
        if data.get("type") == "event":
            ev = str(data.get("event") or "")
            events.append(ev)
            if ev == event_name:
                return data
    raise TimeoutError(f"{event_name} event timeout")


async def wait_attach_ready(ws: aiohttp.ClientWebSocketResponse, timeout_s: float, events: list[str]) -> None:
    started = time.time()
    while time.time() - started < timeout_s:
        data = await recv_json(ws, max(0.5, timeout_s - (time.time() - started)))
        if not data or data.get("_timeout"):
            continue
        if data.get("type") == "event":
            ev = str(data.get("event") or "")
            events.append(ev)
            if ev == "initialized":
                return
            continue
        if data.get("type") == "response" and str(data.get("command") or "") == "attach":
            if not data.get("success"):
                raise RuntimeError(f"attach failed: {data.get('message') or data.get('body') or ''}")
            return
    raise TimeoutError("attach ready timeout")


async def run_round(token: str, idx: int) -> dict:
    sid = create_session(token, f"stepwatch_round_{idx}")
    wait_ready(token, sid)
    commands_ok: list[str] = []
    events_seen: list[str] = []
    t0 = time.time()
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(ws_url(token, sid, f"stepwatch_{idx}")) as ws:
            await ws.send_str(
                json.dumps(
                    {
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
                )
            )
            r = await wait_response(ws, "initialize", 20, events_seen)
            if not r.get("success"):
                raise RuntimeError("initialize failed")
            commands_ok.append("initialize")

            await ws.send_str(
                json.dumps(
                    {
                        "seq": 2,
                        "type": "request",
                        "command": "attach",
                        "arguments": {
                            "name": "Remote",
                            "type": "python",
                            "request": "attach",
                            "pathMappings": [{"localRoot": "/workspace", "remoteRoot": "/workspace"}],
                            "justMyCode": True,
                        },
                    }
                )
            )
            await wait_attach_ready(ws, 20, events_seen)
            commands_ok.append("attach")

            await ws.send_str(
                json.dumps(
                    {
                        "seq": 3,
                        "type": "request",
                        "command": "setBreakpoints",
                        "arguments": {
                            "source": {"path": "/workspace/main.py"},
                            "breakpoints": [{"line": 9}],
                        },
                    }
                )
            )
            sb = await wait_response(ws, "setBreakpoints", 20, events_seen)
            if not sb.get("success"):
                raise RuntimeError("setBreakpoints failed")
            commands_ok.append("setBreakpoints")

            await ws.send_str(json.dumps({"seq": 4, "type": "request", "command": "configurationDone", "arguments": {}}))
            await wait_response(ws, "configurationDone", 20, events_seen)
            commands_ok.append("configurationDone")

            stopped = await wait_event(ws, "stopped", 20, events_seen)
            thread_id = int((stopped.get("body") or {}).get("threadId") or 1)

            await ws.send_str(
                json.dumps(
                    {"seq": 5, "type": "request", "command": "stackTrace", "arguments": {"threadId": thread_id, "startFrame": 0, "levels": 20}}
                )
            )
            st = await wait_response(ws, "stackTrace", 10, events_seen)
            commands_ok.append("stackTrace")
            frames = ((st.get("body") or {}).get("stackFrames") or [])
            if not frames:
                raise RuntimeError("empty stackFrames")
            frame_id = int(frames[0].get("id") or 0)
            if frame_id <= 0:
                raise RuntimeError("invalid frame id")

            await ws.send_str(json.dumps({"seq": 6, "type": "request", "command": "scopes", "arguments": {"frameId": frame_id}}))
            scopes_resp = await wait_response(ws, "scopes", 10, events_seen)
            commands_ok.append("scopes")
            scopes = ((scopes_resp.get("body") or {}).get("scopes") or [])
            vars_ref = 0
            for s in scopes:
                vr = int(s.get("variablesReference") or 0)
                if vr > 0:
                    vars_ref = vr
                    break
            if vars_ref <= 0:
                raise RuntimeError("variablesReference missing")

            await ws.send_str(
                json.dumps({"seq": 7, "type": "request", "command": "variables", "arguments": {"variablesReference": vars_ref}})
            )
            vr = await wait_response(ws, "variables", 10, events_seen)
            if not vr.get("success"):
                raise RuntimeError("variables failed")
            commands_ok.append("variables")

            await ws.send_str(
                json.dumps(
                    {
                        "seq": 8,
                        "type": "request",
                        "command": "evaluate",
                        "arguments": {"expression": "b", "frameId": frame_id, "context": "watch"},
                    }
                )
            )
            ev = await wait_response(ws, "evaluate", 10, events_seen)
            if not ev.get("success"):
                raise RuntimeError("evaluate failed")
            commands_ok.append("evaluate")

            await ws.send_str(json.dumps({"seq": 9, "type": "request", "command": "stepIn", "arguments": {"threadId": thread_id}}))
            await wait_response(ws, "stepIn", 10, events_seen)
            commands_ok.append("stepIn")
            await wait_event(ws, "stopped", 10, events_seen)

            await ws.send_str(json.dumps({"seq": 10, "type": "request", "command": "stepOut", "arguments": {"threadId": thread_id}}))
            await wait_response(ws, "stepOut", 10, events_seen)
            commands_ok.append("stepOut")
            await wait_event(ws, "stopped", 10, events_seen)

            await ws.send_str(json.dumps({"seq": 11, "type": "request", "command": "next", "arguments": {"threadId": thread_id}}))
            await wait_response(ws, "next", 10, events_seen)
            commands_ok.append("next")

            await ws.send_str(json.dumps({"seq": 12, "type": "request", "command": "continue", "arguments": {"threadId": thread_id}}))
            await wait_response(ws, "continue", 10, events_seen)
            commands_ok.append("continue")
            await wait_event(ws, "terminated", 20, events_seen)

    requests.post(
        f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions/{sid}/stop",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    return {
        "round": idx,
        "session_id": sid,
        "passed": True,
        "commands_ok": commands_ok,
        "events_seen": events_seen,
        "elapsed_s": round(time.time() - t0, 2),
    }


def main() -> int:
    if ROUNDS <= 0:
        log("ROUNDS must be positive")
        return 2
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    token = login()
    records: list[dict] = []
    passed = 0
    for i in range(1, ROUNDS + 1):
        try:
            rec = asyncio.run(run_round(token, i))
            passed += 1
            records.append(rec)
            log(f"round={i} passed elapsed={rec['elapsed_s']} commands={','.join(rec['commands_ok'])}")
        except Exception as e:
            rec = {"round": i, "passed": False, "error": f"{type(e).__name__}: {e}"}
            records.append(rec)
            log(f"round={i} failed error={rec['error']}")
    summary = {
        "rounds": ROUNDS,
        "passed": passed,
        "failed": ROUNDS - passed,
        "pass_rate": round(passed * 100.0 / ROUNDS, 1),
        "log_dir": str(LOG_DIR),
    }
    (LOG_DIR / "summary.json").write_text(
        json.dumps({"summary": summary, "records": records}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log("SUMMARY " + json.dumps(summary, ensure_ascii=False))
    return 0 if passed == ROUNDS else 1


if __name__ == "__main__":
    raise SystemExit(main())
