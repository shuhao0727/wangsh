import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode
from typing import Any

import httpx


@dataclass(frozen=True)
class Env:
    origin: str
    api_v1: str
    admin_username: str
    admin_password: str
    openapi_json_path: str
    report_path: str


def env() -> Env:
    origin = os.environ.get("ORIGIN", "http://localhost:6608").rstrip("/")
    api_v1 = os.environ.get("API_V1", f"{origin}/api/v1").rstrip("/")
    return Env(
        origin=origin,
        api_v1=api_v1,
        admin_username=os.environ.get("ADMIN_USERNAME", "admin"),
        admin_password=os.environ.get("ADMIN_PASSWORD", ""),
        openapi_json_path=os.environ.get("OPENAPI_JSON_PATH", "").strip(),
        report_path=os.environ.get("REPORT_PATH", "").strip(),
    )


def _substitute_path(path: str) -> str:
    path = re.sub(r"\{[^/]*id[^/]*\}", "1", path, flags=re.IGNORECASE)
    path = re.sub(r"\{[^/]*\}", "1", path)
    return path


def _path_has_params(path: str) -> bool:
    return "{" in path and "}" in path


def _param_list(op: dict[str, Any] | None) -> list[dict[str, Any]]:
    params = (op or {}).get("parameters") or []
    return [p for p in params if isinstance(p, dict)]


def _default_param_value(name: str, where: str) -> str | None:
    lowered = name.lower()
    if where == "query":
        defaults = {
            "limit": "5",
            "skip": "0",
            "page": "1",
            "size": "5",
            "search": "smoke",
            "search_text": "smoke",
            "q": "smoke",
            "keyword": "smoke",
            "sort_by": "created_at",
            "sort_order": "desc",
            "term": "上学期",
            "year": "2026",
            "scope": "students",
        }
        if lowered in defaults:
            return defaults[lowered]
    return None


def _build_url(origin: str, raw_path: str, op: dict[str, Any] | None) -> tuple[str | None, str | None]:
    params = _param_list(op)
    missing_required: list[str] = []
    query_params: dict[str, str] = {}
    for param in params:
        where = str(param.get("in") or "")
        name = str(param.get("name") or "")
        required = bool(param.get("required"))
        if where == "query":
            default_value = _default_param_value(name, where)
            if default_value is not None:
                query_params[name] = default_value
            elif required:
                missing_required.append(f"query:{name}")
        elif where in {"header", "cookie"} and required:
            missing_required.append(f"{where}:{name}")

    if missing_required:
        return None, f"required runtime params: {', '.join(missing_required)}"

    path = _substitute_path(str(raw_path))
    url = f"{origin}{path}"
    if query_params:
        url = f"{url}?{urlencode(query_params)}"
    return url, None


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


def _expected_skip_status(raw_path: str, path: str, status_code: int, payload: Any) -> tuple[bool, str]:
    detail = ""
    if isinstance(payload, dict):
        detail = str(payload.get("detail") or payload.get("message") or "")

    if status_code == 403 and path == "/api/v1/config" and "仅在开发环境可用" in detail:
        return True, "dev-only endpoint disabled in production"

    if status_code == 422:
        return True, "probe input incomplete for this endpoint"

    if status_code == 404 and _path_has_params(raw_path):
        return True, "no stable fixture for parameterized read"

    return False, ""


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


def _load_spec(client: httpx.Client, e: Env) -> dict[str, Any]:
    if e.openapi_json_path:
        return json.loads(Path(e.openapi_json_path).read_text(encoding="utf-8"))
    openapi_url = f"{e.api_v1}/openapi.json"
    r = client.get(openapi_url, timeout=20)
    r.raise_for_status()
    return r.json()


def _write_report(report_path: str, payload: dict[str, Any]) -> None:
    if not report_path:
        return
    path = Path(report_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    e = env()
    if not e.admin_password:
        raise SystemExit("missing ADMIN_PASSWORD")

    with httpx.Client(follow_redirects=True) as client:
        spec = _load_spec(client, e)
        _ok("openapi spec loaded")

        token = _login(client, e.api_v1, e.admin_username, e.admin_password)
        _ok("login ok")

        paths: dict[str, Any] = spec.get("paths") or {}
        results: list[dict[str, Any]] = []
        failures: list[str] = []
        warnings: list[str] = []

        for raw_path, ops in sorted(paths.items()):
            if not isinstance(ops, dict):
                continue
            for method, op in ops.items():
                method_u = str(method).upper()
                if method_u != "GET":
                    continue
                if str(raw_path).endswith("/openapi.json"):
                    continue

                path = _substitute_path(str(raw_path))
                if _should_skip_path(path):
                    results.append(
                        {
                            "method": method_u,
                            "path": path,
                            "status": "SKIP",
                            "reason": "pattern-skip",
                        }
                    )
                    continue

                url, skip_reason = _build_url(e.origin, str(raw_path), op if isinstance(op, dict) else None)
                if skip_reason:
                    results.append(
                        {
                            "method": method_u,
                            "path": path,
                            "status": "SKIP",
                            "reason": skip_reason,
                            "operation_id": (op or {}).get("operationId"),
                        }
                    )
                    continue

                assert url is not None
                headers: dict[str, str] = {"Accept": "application/json"}
                if not _is_public_get(path):
                    headers["Authorization"] = f"Bearer {token}"

                record: dict[str, Any] = {
                    "method": method_u,
                    "path": path,
                    "url": url,
                    "operation_id": (op or {}).get("operationId"),
                }
                try:
                    resp = client.request(method_u, url, headers=headers, timeout=15)
                    record["http_status"] = resp.status_code
                    try:
                        payload = resp.json()
                    except Exception:
                        payload = resp.text

                    if 200 <= resp.status_code < 300:
                        record["status"] = "OK"
                    else:
                        should_skip, reason = _expected_skip_status(str(raw_path), path, resp.status_code, payload)
                        if should_skip:
                            record["status"] = "SKIP"
                            record["reason"] = reason
                        elif resp.status_code in {401, 403, 404, 405, 422}:
                            record["status"] = "WARN"
                            record["reason"] = "unexpected-client-or-auth-status"
                            warnings.append(f"{method_u} {path} -> {resp.status_code}")
                        elif resp.status_code >= 500:
                            record["status"] = "FAIL"
                            record["reason"] = "server-error"
                            failures.append(f"{method_u} {path} -> {resp.status_code}")
                        else:
                            record["status"] = "WARN"
                            record["reason"] = "unexpected-non-5xx-status"
                            warnings.append(f"{method_u} {path} -> {resp.status_code}")
                except Exception as ex:
                    record["status"] = "FAIL"
                    record["reason"] = "exception"
                    record["error"] = f"{type(ex).__name__}: {ex}"
                    failures.append(f"{method_u} {path} -> exception {type(ex).__name__}")

                results.append(record)

        summary = {
            "total": len([r for r in results if r.get("status") != "SKIP"]),
            "ok": len([r for r in results if r.get("status") == "OK"]),
            "warn": len([r for r in results if r.get("status") == "WARN"]),
            "fail": len([r for r in results if r.get("status") == "FAIL"]),
            "skip": len([r for r in results if r.get("status") == "SKIP"]),
            "failures": failures,
            "warnings": warnings,
        }
        _write_report(
            e.report_path,
            {
                "summary": summary,
                "results": results,
            },
        )

        _ok(
            "sweep done "
            f"total={summary['total']} ok={summary['ok']} "
            f"warn={summary['warn']} fail={summary['fail']} skip={summary['skip']}"
        )
        if failures:
            _fail("server-side failures:")
            for item in failures[:50]:
                print(item)
            raise SystemExit(2)
        if warnings:
            for item in warnings[:10]:
                _warn(item)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
