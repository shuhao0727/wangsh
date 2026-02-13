import os
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class Env:
    origin: str
    api_v1: str
    admin_username: str
    admin_password: str


def env() -> Env:
    origin = os.environ.get("ORIGIN", "http://localhost:6608").rstrip("/")
    api_v1 = os.environ.get("API_V1", f"{origin}/api/v1").rstrip("/")
    return Env(
        origin=origin,
        api_v1=api_v1,
        admin_username=os.environ.get("ADMIN_USERNAME", "admin"),
        admin_password=os.environ.get("ADMIN_PASSWORD", ""),
    )


def _substitute_path(path: str) -> str:
    path = re.sub(r"\{[^/]*id[^/]*\}", "1", path, flags=re.IGNORECASE)
    path = re.sub(r"\{[^/]*\}", "1", path)
    return path


def _is_public_get(path: str) -> bool:
    if path.endswith("/health"):
        return True
    if path.endswith("/openapi.json"):
        return True
    if path.startswith("/api/v1/public"):
        return True
    if path.startswith("/api/v1/model-discovery/"):
        return True
    return False


def _should_skip_path(path: str) -> bool:
    if "/stream" in path:
        return True
    if "/export" in path:
        return True
    if "/assets" in path:
        return True
    if "/compile" in path:
        return True
    if "/metrics" in path and not path.endswith("/health"):
        return True
    return False


def _ok(msg: str):
    print(f"[OK] {msg}", flush=True)


def _warn(msg: str):
    print(f"[WARN] {msg}", flush=True)


def _fail(msg: str):
    print(f"[FAIL] {msg}", flush=True)


def _login(client: httpx.Client, api_v1: str, username: str, password: str) -> str:
    r = client.post(
        f"{api_v1}/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()
    token = data.get("access_token")
    if not token:
        raise RuntimeError("login response missing access_token")
    return token


def main() -> int:
    e = env()
    if not e.admin_password:
        raise SystemExit("missing ADMIN_PASSWORD")

    openapi_url = f"{e.api_v1}/openapi.json"
    with httpx.Client(follow_redirects=True) as client:
        r = client.get(openapi_url, timeout=20)
        r.raise_for_status()
        spec: dict[str, Any] = r.json()
        _ok("openapi.json fetched")

        token = _login(client, e.api_v1, e.admin_username, e.admin_password)
        _ok("login ok")

        paths: dict[str, Any] = spec.get("paths") or {}

        total = 0
        ok = 0
        warn = 0
        fail = 0
        failures: list[str] = []

        for raw_path, ops in sorted(paths.items()):
            if not isinstance(ops, dict):
                continue
            for method, op in ops.items():
                method_u = str(method).upper()
                if method_u not in {"GET"}:
                    continue
                if str(raw_path).endswith("/openapi.json"):
                    continue

                path = _substitute_path(str(raw_path))
                if _should_skip_path(path):
                    continue
                url = f"{e.origin}{path}"

                headers: dict[str, str] = {"Accept": "application/json"}
                if not _is_public_get(path):
                    headers["Authorization"] = f"Bearer {token}"

                total += 1
                try:
                    resp = client.request(method_u, url, headers=headers, timeout=15)
                    status = resp.status_code

                    if 200 <= status < 300:
                        ok += 1
                        continue

                    if status in {401, 403, 404, 405, 422}:
                        warn += 1
                        continue

                    if 500 <= status:
                        fail += 1
                        failures.append(f"{method_u} {path} -> {status}")
                        continue

                    warn += 1
                except Exception as ex:
                    fail += 1
                    failures.append(f"{method_u} {path} -> exception {type(ex).__name__}")

        _ok(f"sweep done total={total} ok={ok} warn={warn} fail={fail}")
        if failures:
            _fail("server-side failures:")
            for item in failures[:50]:
                print(item)
            raise SystemExit(2)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
