import asyncio
import json
import math
import os
import statistics
import time
from datetime import datetime
from pathlib import Path

import aiohttp
import requests

BASE = "http://localhost:8000"
CONCURRENCY = 60
TIMEOUT_READY = 300
TIMEOUT_WS = 240
MEMORY_MB = int(os.getenv("PYLAB_MEMORY_MB", "32"))

CODE = """import time
acc = 0
for i in range(2200000):
    acc += (i * i) % 97
print('acc', acc)
for _ in range(3):
    time.sleep(0.5)
print('done')
"""


def q(vals, p):
    if not vals:
        return None
    s = sorted(vals)
    idx = min(len(s) - 1, max(0, int(math.ceil(len(s) * p) - 1)))
    return s[idx]


def admin_login_and_students():
    r = requests.post(
        f"{BASE}/api/v1/auth/login",
        data={"username": "admin", "password": "wangshuhao0727"},
        timeout=20,
    )
    r.raise_for_status()
    token = r.json()["access_token"]
    users = []
    skip = 0
    while True:
        rr = requests.get(
            f"{BASE}/api/v1/users/?limit=100&skip={skip}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        rr.raise_for_status()
        js = rr.json()
        users.extend(js.get("users", []))
        if not js.get("has_more"):
            break
        skip += 100
    students = [
        u
        for u in users
        if u.get("role_code") == "student"
        and u.get("full_name")
        and u.get("student_id")
    ]
    if len(students) < CONCURRENCY:
        raise RuntimeError(f"可用学生账号不足: {len(students)} < {CONCURRENCY}")
    return students[:CONCURRENCY]


async def run_one(user, idx):
    out = {
        "idx": idx,
        "user": user.get("full_name"),
        "student_id": user.get("student_id"),
        "ok": False,
    }
    t0 = time.perf_counter()
    try:
        timeout = aiohttp.ClientTimeout(total=TIMEOUT_WS)
        async with aiohttp.ClientSession(timeout=timeout) as sess:
            form = aiohttp.FormData()
            form.add_field("username", user["full_name"])
            form.add_field("password", user["student_id"])
            async with sess.post(f"{BASE}/api/v1/auth/login", data=form) as r:
                txt = await r.text()
                if r.status != 200:
                    out.update(
                        {
                            "status": r.status,
                            "error": f"login_failed:{txt[:180]}",
                            "stage": "login",
                        }
                    )
                    return out
                token = json.loads(txt)["access_token"]

            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "title": f"p0-load-{idx}",
                "code": CODE,
                "entry_path": "main.py",
                "requirements": [],
                "limits": {"memory_mb": MEMORY_MB},
            }
            create_start = time.perf_counter()
            async with sess.post(
                f"{BASE}/api/v1/debug/sessions", json=payload, headers=headers
            ) as r:
                txt = await r.text()
                out["create_http_s"] = time.perf_counter() - create_start
                if r.status != 200:
                    out.update(
                        {
                            "status": r.status,
                            "error": f"create_failed:{txt[:180]}",
                            "stage": "create",
                        }
                    )
                    return out
                sid = json.loads(txt)["session_id"]
                out["session_id"] = sid

            ready_deadline = time.perf_counter() + TIMEOUT_READY
            while True:
                async with sess.get(
                    f"{BASE}/api/v1/debug/sessions/{sid}", headers=headers
                ) as r:
                    txt = await r.text()
                    if r.status != 200:
                        out.update(
                            {
                                "status": r.status,
                                "error": f"poll_failed:{txt[:180]}",
                                "stage": "poll",
                            }
                        )
                        return out
                    meta = json.loads(txt)
                    st = str(meta.get("status") or "").upper()
                    if st == "READY":
                        break
                    if st == "FAILED":
                        out.update(
                            {
                                "status": 500,
                                "error": f"session_failed:{meta.get('error_detail')}",
                                "stage": "ready",
                            }
                        )
                        return out
                if time.perf_counter() > ready_deadline:
                    out.update({"status": 408, "error": "ready_timeout", "stage": "ready"})
                    return out
                await asyncio.sleep(0.2)

            ws_url = f"ws://localhost:8000/api/v1/debug/sessions/{sid}/ws?token={token}"
            seq = 1
            launch_ts = None
            first_output_ts = None
            term_ts = None
            done_output_ts = None
            try:
                async with sess.ws_connect(ws_url, timeout=TIMEOUT_WS) as ws:
                    await ws.send_str(
                        json.dumps(
                            {
                                "seq": seq,
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
                    seq += 1
                    ws_deadline = time.perf_counter() + TIMEOUT_WS
                    async for msg in ws:
                        if msg.type != aiohttp.WSMsgType.TEXT:
                            continue
                        data = json.loads(msg.data)
                        if (
                            data.get("type") == "response"
                            and data.get("command") == "initialize"
                            and data.get("success")
                        ):
                            await ws.send_str(
                                json.dumps(
                                    {
                                        "seq": seq,
                                        "type": "request",
                                        "command": "launch",
                                        "arguments": {
                                            "name": "PythonLab",
                                            "type": "python",
                                            "request": "launch",
                                            "program": "/workspace/main.py",
                                            "console": "internalConsole",
                                            "justMyCode": True,
                                            "redirectOutput": True,
                                        },
                                    }
                                )
                            )
                            launch_ts = time.perf_counter()
                            seq += 1
                        elif data.get("type") == "event" and data.get("event") == "initialized":
                            await ws.send_str(
                                json.dumps(
                                    {
                                        "seq": seq,
                                        "type": "request",
                                        "command": "configurationDone",
                                    }
                                )
                            )
                            seq += 1
                        elif data.get("type") == "event" and data.get("event") == "output":
                            if launch_ts and first_output_ts is None:
                                first_output_ts = time.perf_counter()
                            out_text = str((data.get("body") or {}).get("output") or "")
                            if "done" in out_text.lower():
                                done_output_ts = time.perf_counter()
                        elif data.get("type") == "event" and data.get("event") == "terminated":
                            term_ts = time.perf_counter()
                            break

                        if time.perf_counter() > ws_deadline:
                            out.update({"status": 408, "error": "ws_timeout", "stage": "exec"})
                            return out
            finally:
                async with sess.post(
                    f"{BASE}/api/v1/debug/sessions/{sid}/stop", headers=headers
                ) as r:
                    await r.text()

            if not launch_ts:
                out.update({"status": 500, "error": "no_terminated_event", "stage": "exec"})
                return out
            if not term_ts and done_output_ts:
                term_ts = done_output_ts
            if not term_ts:
                out.update({"status": 500, "error": "no_terminated_event", "stage": "exec"})
                return out

            out["exec_terminated_s"] = term_ts - launch_ts
            out["exec_first_output_s"] = (
                (first_output_ts - launch_ts) if first_output_ts else None
            )
            out["total_case_s"] = time.perf_counter() - t0
            out["ok"] = True
            return out
    except Exception as e:
        out.update({"status": 500, "error": f"exception:{e}", "stage": out.get("stage", "unknown")})
        return out


async def main():
    students = admin_login_and_students()
    start = time.perf_counter()
    tasks = [asyncio.create_task(run_one(students[i], i + 1)) for i in range(CONCURRENCY)]
    results = await asyncio.gather(*tasks)
    total_s = time.perf_counter() - start

    ok = [r for r in results if r.get("ok")]
    fail = [r for r in results if not r.get("ok")]
    exec_vals = [r["exec_terminated_s"] for r in ok if r.get("exec_terminated_s") is not None]
    first_vals = [r["exec_first_output_s"] for r in ok if r.get("exec_first_output_s") is not None]

    summary = {
        "concurrency": CONCURRENCY,
        "total": len(results),
        "ok": len(ok),
        "failed": len(fail),
        "success_rate": round(len(ok) / len(results) * 100, 2) if results else 0,
        "total_duration_s": round(total_s, 3),
        "exec_terminated_s": {
            "p50": round(q(exec_vals, 0.5), 3) if exec_vals else None,
            "p95": round(q(exec_vals, 0.95), 3) if exec_vals else None,
            "avg": round(statistics.mean(exec_vals), 3) if exec_vals else None,
            "max": round(max(exec_vals), 3) if exec_vals else None,
            "n": len(exec_vals),
        },
        "exec_first_output_s": {
            "p50": round(q(first_vals, 0.5), 3) if first_vals else None,
            "p95": round(q(first_vals, 0.95), 3) if first_vals else None,
            "avg": round(statistics.mean(first_vals), 3) if first_vals else None,
            "max": round(max(first_vals), 3) if first_vals else None,
            "n": len(first_vals),
        },
        "fail_top": {},
    }
    for r in fail:
        key = f"{r.get('status')}|{r.get('stage')}"
        summary["fail_top"][key] = summary["fail_top"].get(key, 0) + 1

    prev = None
    prev_path = Path("/tmp/wangsh/pythonlab_latency60_results.json")
    if prev_path.exists():
        try:
            pj = json.loads(prev_path.read_text())
            if "round2_steady" in pj:
                s = pj["round2_steady"]["summary"]
                prev = {
                    "source": "round2_steady",
                    "ok": s.get("ok"),
                    "total": s.get("total"),
                    "success_rate": round((s.get("ok", 0) / s.get("total", 1)) * 100, 2),
                    "exec_terminated_p50": s.get("exec_terminated_s", {}).get("p50"),
                    "exec_terminated_p95": s.get("exec_terminated_s", {}).get("p95"),
                    "total_duration_s": pj["round2_steady"].get("duration_s"),
                }
        except Exception:
            prev = None

    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = {
        "timestamp": now,
        "base_url": BASE,
        "profile": "P0(current-env)",
        "memory_mb": MEMORY_MB,
        "python_payload": "real_python_loop+sleep",
        "summary": summary,
        "previous_round": prev,
        "results": results,
    }
    out_path = Path(f"/tmp/wangsh/pythonlab_p0_load60_{now}.json")
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"RESULT_FILE {out_path}")
    print(json.dumps({"summary": summary, "previous_round": prev}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
