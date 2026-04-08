import os
import sys
import time

import requests

API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
PYTHONLAB_V2_ROOT = "/api/v2/pythonlab"
USERNAME = os.getenv("USERNAME", "admin")
PASSWORD = os.getenv("PASSWORD", "wangshuhao0727")
MEMORY_MB = int(os.getenv("MEMORY_MB", "64"))
EXPECT_DETAIL = os.getenv("EXPECT_DETAIL", "调试服务启动超时")
POLL_TIMEOUT_SECONDS = float(os.getenv("POLL_TIMEOUT_SECONDS", "90"))


def log(message: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


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


def cleanup_sessions(headers: dict[str, str]) -> None:
    requests.post(f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions/cleanup", headers=headers, timeout=20)


def create_session(headers: dict[str, str]) -> str:
    resp = requests.post(
        f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions",
        json={
            "title": "pythonlab_low_memory_probe",
            "code": "print('low memory probe')\n",
            "entry_path": "main.py",
            "requirements": [],
            "engine": "remote",
            "runtime_mode": "debug",
            "limits": {
                "memory_mb": MEMORY_MB,
                "cpu_ms": 15000,
                "wall_ms": 20000,
            },
        },
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return str(resp.json()["session_id"])


def wait_terminal_status(headers: dict[str, str], sid: str) -> dict:
    deadline = time.time() + POLL_TIMEOUT_SECONDS
    latest = {}
    while time.time() < deadline:
        resp = requests.get(
            f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions/{sid}",
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        latest = resp.json()
        status = str(latest.get("status") or "")
        if status in {"READY", "FAILED", "TERMINATED"}:
            return latest
        time.sleep(0.5)
    raise TimeoutError(f"session {sid} did not reach terminal status within {POLL_TIMEOUT_SECONDS}s")


def main() -> int:
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    cleanup_sessions(headers)

    sid = create_session(headers)
    log(f"created session {sid} with memory_mb={MEMORY_MB}")

    try:
        meta = wait_terminal_status(headers, sid)
        status = str(meta.get("status") or "")
        detail = str(meta.get("error_detail") or "")
        log(f"terminal status={status} error_code={meta.get('error_code')} detail={detail!r}")

        if status != "FAILED":
            raise RuntimeError(f"expected FAILED, got {status}")
        if EXPECT_DETAIL and EXPECT_DETAIL not in detail:
            raise RuntimeError(f"expected error_detail to contain {EXPECT_DETAIL!r}, got {detail!r}")

        log("low-memory start failure smoke passed")
        return 0
    finally:
        try:
            requests.post(f"{API_URL}{PYTHONLAB_V2_ROOT}/sessions/{sid}/stop", headers=headers, timeout=20)
        except Exception:
            pass


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"low-memory start failure smoke failed: {type(exc).__name__}: {exc}")
        raise SystemExit(1)
