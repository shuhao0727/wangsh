#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "test-results" / "prod-smoke"
STEP_LOG_DIR = OUTPUT_DIR / "step-logs"
SERVICE_LOG_DIR = OUTPUT_DIR / "service-logs"
SCREENSHOT_DIR = OUTPUT_DIR / "screenshots"
OPENAPI_JSON_PATH = OUTPUT_DIR / "openapi.json"
OPENAPI_REPORT_PATH = OUTPUT_DIR / "openapi-sweep.json"
UI_REPORT_PATH = OUTPUT_DIR / "ui-results.json"
SUMMARY_PATH = OUTPUT_DIR / "summary.json"
API_RESULTS_PATH = OUTPUT_DIR / "api-results.json"
SKIPS_PATH = OUTPUT_DIR / "skips.json"
FAILURES_MD_PATH = OUTPUT_DIR / "failures.md"
VENV_PYTHON = ROOT / "backend" / "venv" / "bin" / "python"


MODULE_ORDER = [
    "auth",
    "system/gateway",
    "users",
    "articles/categories",
    "informatics",
    "xbk",
    "xxjs",
    "assessment",
    "classroom/ai-agents",
    "debug/pythonlab",
]

STATUS_RANK = {
    "PASS": 0,
    "SKIP": 1,
    "WARN": 2,
    "FAIL": 3,
}

DEFAULT_LOGIN_THROTTLE_SECONDS = 2.2


@dataclass
class StepRecord:
    name: str
    kind: str
    modules: list[str]
    status: str
    started_at: str
    finished_at: str
    duration_seconds: float
    command: list[str] | None = None
    rc: int | None = None
    log_path: str | None = None
    stdout_path: str | None = None
    checks: list[dict[str, Any]] = field(default_factory=list)
    ok_count: int = 0
    warn_count: int = 0
    fail_count: int = 0
    skip_count: int = 0
    warnings: list[str] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    skips: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    STEP_LOG_DIR.mkdir(parents=True, exist_ok=True)
    SERVICE_LOG_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def parse_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith(("'", '"')) and value.endswith(("'", '"')) and len(value) >= 2:
            value = value[1:-1]
        data[key] = value
    return data


def env_config() -> dict[str, str]:
    merged: dict[str, str] = {}
    merged.update(parse_dotenv(ROOT / ".env"))
    for key, value in os.environ.items():
        if value:
            merged[key] = value
    return merged


def env_get(config: dict[str, str], key: str, default: str = "") -> str:
    value = config.get(key)
    if value is None or str(value).strip() == "":
        return default
    return str(value).strip()


def env_float(config: dict[str, str], key: str, default: float) -> float:
    raw = env_get(config, key, str(default))
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def sanitize_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", name.strip()).strip("-").lower() or "step"


def parse_markers(output: str) -> dict[str, list[str]]:
    markers = {"OK": [], "WARN": [], "FAIL": [], "SKIP": []}
    for raw in output.splitlines():
        line = raw.strip()
        match = re.match(r"^\[(OK|WARN|FAIL|SKIP)\]\s*(.*)$", line)
        if match:
            markers[match.group(1)].append(match.group(2).strip())
    return markers


def worst_status(current: str, new: str) -> str:
    return new if STATUS_RANK[new] > STATUS_RANK[current] else current


def run_subprocess(
    name: str,
    *,
    kind: str,
    modules: list[str],
    command: list[str],
    env: dict[str, str] | None = None,
    cwd: Path = ROOT,
    log_stem: str | None = None,
) -> tuple[StepRecord, str]:
    started = time.time()
    started_at = now_iso()
    proc = subprocess.run(
        command,
        cwd=str(cwd),
        env=env,
        text=True,
        capture_output=True,
    )
    finished_at = now_iso()
    duration = time.time() - started
    output = proc.stdout
    if proc.stderr:
        output = f"{output}\n{proc.stderr}" if output else proc.stderr

    base_name = sanitize_name(log_stem or name)
    log_path = STEP_LOG_DIR / f"{base_name}.log"
    log_path.write_text(output, encoding="utf-8")

    markers = parse_markers(output)
    status = "PASS"
    if proc.returncode != 0 or markers["FAIL"]:
        status = "FAIL"
    elif markers["WARN"]:
        status = "WARN"

    return StepRecord(
        name=name,
        kind=kind,
        modules=modules,
        status=status,
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=round(duration, 3),
        command=command,
        rc=proc.returncode,
        log_path=str(log_path.relative_to(ROOT)),
        ok_count=len(markers["OK"]),
        warn_count=len(markers["WARN"]),
        fail_count=len(markers["FAIL"]),
        skip_count=len(markers["SKIP"]),
        warnings=markers["WARN"],
        failures=markers["FAIL"] if markers["FAIL"] else ([] if proc.returncode == 0 else [f"process exit {proc.returncode}"]),
        skips=markers["SKIP"],
    ), output


def output_has_rate_limit(output: str) -> bool:
    lowered = output.lower()
    return "429" in lowered or "too many requests" in lowered or "rate limit" in lowered


def run_command_step(spec_item: dict[str, Any], *, login_throttle_seconds: float) -> StepRecord:
    retry_on_rate_limit = bool(spec_item.get("retry_on_rate_limit", spec_item.get("login_heavy", False)))
    login_heavy = bool(spec_item.get("login_heavy", False))
    attempt_logs: list[str] = []

    def run_attempt(attempt: int) -> tuple[StepRecord, str]:
        if login_heavy and login_throttle_seconds > 0:
            time.sleep(login_throttle_seconds)
        log_stem = spec_item["name"] if not retry_on_rate_limit else f"{spec_item['name']}-attempt-{attempt}"
        step, output = run_subprocess(
            spec_item["name"],
            kind=spec_item["kind"],
            modules=spec_item["modules"],
            command=spec_item["command"],
            env=spec_item["env"],
            log_stem=log_stem,
        )
        if step.log_path:
            attempt_logs.append(step.log_path)
        return step, output

    step, output = run_attempt(1)
    if retry_on_rate_limit and step.status == "FAIL" and output_has_rate_limit(output):
        retry_step, retry_output = run_attempt(2)
        retry_step.metadata.update(
            {
                "attempt_count": 2,
                "attempt_logs": attempt_logs,
                "retried_after_rate_limit": True,
            }
        )
        retry_step.warnings = [f"attempt 1 hit auth rate limit; retried after {login_throttle_seconds:.1f}s", *retry_step.warnings]
        retry_step.warn_count = len(retry_step.warnings)
        if retry_step.status == "FAIL" and output_has_rate_limit(retry_output):
            retry_step.failures = [*retry_step.failures, "attempt 2 also hit auth rate limit"]
            retry_step.fail_count = len(retry_step.failures)
        return retry_step

    step.metadata.update(
        {
            "attempt_count": 1,
            "attempt_logs": attempt_logs,
            "retried_after_rate_limit": False,
        }
    )
    return step


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
    opener: urllib.request.OpenerDirector | None = None,
    timeout: int = 20,
) -> tuple[int, Any]:
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    try:
        target = opener.open(req, timeout=timeout) if opener else urllib.request.urlopen(req, timeout=timeout)
        with target as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return exc.code, payload


def http_form(
    url: str,
    *,
    fields: dict[str, str],
    opener: urllib.request.OpenerDirector | None = None,
    timeout: int = 20,
) -> tuple[int, Any]:
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("Accept", "application/json")
    try:
        target = opener.open(req, timeout=timeout) if opener else urllib.request.urlopen(req, timeout=timeout)
        with target as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return exc.code, payload


def base_auth_checks(origin: str, admin_username: str, admin_password: str) -> StepRecord:
    started = time.time()
    started_at = now_iso()
    api_v1 = f"{origin}/api/v1"
    cookie_jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    checks: list[dict[str, Any]] = []
    warnings: list[str] = []
    failures: list[str] = []

    def record(name: str, ok: bool, expected: str, actual: str, detail: str = "") -> None:
        status = "PASS" if ok else "FAIL"
        checks.append(
            {
                "name": name,
                "status": status,
                "expected": expected,
                "actual": actual,
                "detail": detail,
            }
        )
        if not ok:
            failures.append(f"{name}: expected {expected}, got {actual} {detail}".strip())

    code, health = http_json("GET", f"{origin}/api/health", opener=opener, timeout=15)
    record("gateway health", code == 200 and isinstance(health, dict) and health.get("status") == "healthy", "200 healthy", f"{code} {health}")

    code, noauth_users = http_json("GET", f"{api_v1}/users/", opener=opener, timeout=15)
    record("users unauthorized", code in {401, 403}, "401/403", str(code))

    code, login = http_form(
        f"{api_v1}/auth/login",
        fields={"username": admin_username, "password": admin_password},
        opener=opener,
    )
    access_token = str((login or {}).get("access_token") or "") if isinstance(login, dict) else ""
    refresh_token = str((login or {}).get("refresh_token") or "") if isinstance(login, dict) else ""
    record("admin login", code == 200 and bool(access_token), "200 access_token", f"{code} token={'yes' if access_token else 'no'}")

    auth_headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    code, me = http_json("GET", f"{api_v1}/auth/me", headers=auth_headers, opener=opener)
    record("auth me", code == 200 and isinstance(me, dict) and me.get("id"), "200 user", f"{code} {me}")

    code, users = http_json("GET", f"{api_v1}/users/", headers=auth_headers, opener=opener)
    record("users authorized", code == 200, "200", str(code))

    if refresh_token:
        code, refreshed = http_json(
            "POST",
            f"{api_v1}/auth/refresh",
            opener=opener,
            body={"refresh_token": refresh_token},
        )
        ok = code == 200 and isinstance(refreshed, dict) and bool(refreshed.get("access_token"))
        record("auth refresh", ok, "200 refreshed token", f"{code} {refreshed}")
    else:
        warnings.append("auth refresh skipped: refresh_token missing from login payload")

    code, logout = http_json("POST", f"{api_v1}/auth/logout", opener=opener)
    record("auth logout", code == 200, "200", f"{code} {logout}")

    finished_at = now_iso()
    duration = time.time() - started
    status = "PASS"
    if failures:
        status = "FAIL"
    elif warnings:
        status = "WARN"

    return StepRecord(
        name="gateway-and-auth-base",
        kind="gateway/base",
        modules=["system/gateway", "auth"],
        status=status,
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=round(duration, 3),
        checks=checks,
        warn_count=len(warnings),
        fail_count=len(failures),
        warnings=warnings,
        failures=failures,
    )


def export_openapi_spec() -> dict[str, Any]:
    command = [
        "docker",
        "compose",
        "exec",
        "-T",
        "backend",
        "python",
        "-c",
        "import json; from main import app; print(json.dumps(app.openapi(), ensure_ascii=False))",
    ]
    proc = subprocess.run(command, cwd=str(ROOT), text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"openapi export failed: {proc.stderr.strip() or proc.stdout.strip()}")
    spec = json.loads(proc.stdout)
    write_json(OPENAPI_JSON_PATH, spec)
    return spec


def ensure_prereqs() -> None:
    missing: list[str] = []
    if not VENV_PYTHON.exists():
        missing.append(str(VENV_PYTHON))
    if shutil.which("node") is None:
        missing.append("node")
    if shutil.which("npm") is None:
        missing.append("npm")
    if not missing:
        return
    raise RuntimeError(f"missing prerequisites: {', '.join(missing)}")


def installability_checks() -> StepRecord:
    started = time.time()
    started_at = now_iso()
    checks: list[dict[str, Any]] = []
    failures: list[str] = []

    def check_python_import(module: str) -> None:
        proc = subprocess.run(
            [str(VENV_PYTHON), "-c", f"import {module}; print('ok')"],
            cwd=str(ROOT),
            text=True,
            capture_output=True,
        )
        ok = proc.returncode == 0
        checks.append(
            {
                "name": f"python import {module}",
                "status": "PASS" if ok else "FAIL",
                "expected": "import ok",
                "actual": proc.stdout.strip() or proc.stderr.strip(),
            }
        )
        if not ok:
            failures.append(f"missing python module: {module}")

    for module in ("httpx", "aiohttp", "requests"):
        check_python_import(module)

    proc = subprocess.run(
        ["node", "-e", "require('playwright'); console.log('ok')"],
        cwd=str(ROOT / "frontend"),
        text=True,
        capture_output=True,
    )
    ok = proc.returncode == 0
    checks.append(
        {
            "name": "node import playwright",
            "status": "PASS" if ok else "FAIL",
            "expected": "import ok",
            "actual": proc.stdout.strip() or proc.stderr.strip(),
        }
    )
    if not ok:
        failures.append("missing node module: playwright")

    finished_at = now_iso()
    duration = time.time() - started
    return StepRecord(
        name="local-test-prereqs",
        kind="preflight",
        modules=["system/gateway"],
        status="FAIL" if failures else "PASS",
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=round(duration, 3),
        checks=checks,
        fail_count=len(failures),
        failures=failures,
    )


def collect_service_logs(run_started_at: str) -> list[str]:
    collected: list[str] = []
    for service in ["gateway", "backend", "frontend", "pythonlab-worker", "typst-worker"]:
        path = SERVICE_LOG_DIR / f"{service}.log"
        command = [
            "docker",
            "compose",
            "logs",
            "--since",
            run_started_at,
            service,
        ]
        proc = subprocess.run(command, cwd=str(ROOT), text=True, capture_output=True)
        content = proc.stdout
        if proc.stderr:
            content = f"{content}\n{proc.stderr}" if content else proc.stderr
        path.write_text(content, encoding="utf-8")
        collected.append(str(path.relative_to(ROOT)))
    return collected


def build_module_matrix(steps: list[StepRecord]) -> dict[str, dict[str, Any]]:
    matrix: dict[str, dict[str, Any]] = {module: {"status": "PASS", "steps": []} for module in MODULE_ORDER}
    for step in steps:
        for module in step.modules:
            info = matrix.setdefault(module, {"status": "PASS", "steps": []})
            info["status"] = worst_status(info["status"], step.status)
            info["steps"].append({"name": step.name, "status": step.status})
    for info in matrix.values():
        if not info["steps"]:
            info["status"] = "SKIP"
    return matrix


def build_failures_md(steps: list[StepRecord], service_logs: list[str]) -> str:
    lines = ["# Production Smoke Failures", ""]
    failed = [step for step in steps if step.status == "FAIL"]
    warned = [step for step in steps if step.status == "WARN"]
    if not failed and not warned:
        lines.append("- No failures or warnings.")
    else:
        if failed:
            lines.append("## Failures")
            for step in failed:
                lines.append(f"- `{step.name}` ({', '.join(step.modules)})")
                for item in step.failures[:10]:
                    lines.append(f"  - {item}")
                if step.log_path:
                    lines.append(f"  - log: `{step.log_path}`")
            lines.append("")
        if warned:
            lines.append("## Warnings")
            for step in warned:
                lines.append(f"- `{step.name}` ({', '.join(step.modules)})")
                for item in step.warnings[:10]:
                    lines.append(f"  - {item}")
                if step.log_path:
                    lines.append(f"  - log: `{step.log_path}`")
            lines.append("")
    lines.append("## Service Logs")
    for item in service_logs:
        lines.append(f"- `{item}`")
    return "\n".join(lines) + "\n"


def main() -> int:
    ensure_dirs()
    ensure_prereqs()
    config = env_config()
    admin_username = env_get(config, "SUPER_ADMIN_USERNAME", "admin")
    admin_password = env_get(config, "SUPER_ADMIN_PASSWORD", "")
    base_origin = env_get(config, "PROD_SMOKE_ORIGIN", "http://localhost:6608")
    login_throttle_seconds = env_float(config, "PROD_SMOKE_LOGIN_THROTTLE_SECONDS", DEFAULT_LOGIN_THROTTLE_SECONDS)
    run_started_at = now_iso()
    steps: list[StepRecord] = []

    prereq_step = installability_checks()
    steps.append(prereq_step)
    if prereq_step.status == "FAIL":
        service_logs = collect_service_logs(run_started_at)
        failures_md = build_failures_md(steps, service_logs)
        FAILURES_MD_PATH.write_text(failures_md, encoding="utf-8")
        write_json(
            SUMMARY_PATH,
            {
                "status": "FAIL",
                "steps": [step.__dict__ for step in steps],
                "modules": build_module_matrix(steps),
            },
        )
        return 1

    base_step = base_auth_checks(base_origin, admin_username, admin_password)
    steps.append(base_step)

    spec = export_openapi_spec()
    path_count = len(spec.get("paths") or {})
    method_count = sum(
        len([m for m in ops if m.lower() in {"get", "post", "put", "patch", "delete"}])
        for ops in (spec.get("paths") or {}).values()
        if isinstance(ops, dict)
    )

    common_env = os.environ.copy()
    common_env.update(
        {
            "ADMIN_USERNAME": admin_username,
            "ADMIN_PASSWORD": admin_password,
            "SUPER_ADMIN_USERNAME": admin_username,
            "SUPER_ADMIN_PASSWORD": admin_password,
            "BASE_URL": f"{base_origin}/api/v1",
            "API_URL": base_origin,
            "ORIGIN": base_origin,
            "API_V1": f"{base_origin}/api/v1",
            "HEALTH_URL": f"{base_origin}/api/health",
            "LOGIN_RETRY_ATTEMPTS": "4",
            "LOGIN_RETRY_SLEEP_SECONDS": f"{login_throttle_seconds:.1f}",
            "OPENAPI_JSON_PATH": str(OPENAPI_JSON_PATH),
            "REPORT_PATH": str(OPENAPI_REPORT_PATH),
        }
    )

    command_specs = [
        {
            "name": "openapi-readonly-sweep",
            "kind": "read-only sweep",
            "modules": MODULE_ORDER,
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_openapi_sweep.py"],
            "env": common_env,
            "login_heavy": True,
        },
        {
            "name": "feature-suite-core",
            "kind": "stateful core APIs",
            "modules": ["users", "articles/categories", "xbk", "classroom/ai-agents"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_feature_suite.py"],
            "env": common_env,
            "login_heavy": True,
        },
        {
            "name": "assessment-flow",
            "kind": "stateful core APIs",
            "modules": ["assessment"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_assessment_flow.py"],
            "env": common_env,
            "login_heavy": True,
        },
        {
            "name": "xxjs-dianming-flow",
            "kind": "stateful core APIs",
            "modules": ["xxjs"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_xxjs_dianming.py"],
            "env": common_env,
            "login_heavy": True,
        },
        {
            "name": "full-deploy-core",
            "kind": "stateful core APIs",
            "modules": ["auth", "articles/categories", "informatics", "classroom/ai-agents"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_full_deploy.py"],
            "env": common_env,
            "login_heavy": True,
        },
        {
            "name": "group-discussion-flow",
            "kind": "stateful core APIs",
            "modules": ["classroom/ai-agents"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_group_discussion.py"],
            "env": common_env,
            "login_heavy": True,
        },
        {
            "name": "typst-pipeline",
            "kind": "async/worker flows",
            "modules": ["informatics"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_typst_pipeline.py"],
            "env": {**common_env, "USE_BEARER": "true"},
            "login_heavy": True,
        },
        {
            "name": "pythonlab-owner-concurrency",
            "kind": "async/worker flows",
            "modules": ["debug/pythonlab"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_pythonlab_ws_owner_concurrency.py"],
            "env": {**common_env, "USERNAME": admin_username, "PASSWORD": admin_password},
            "login_heavy": True,
        },
        {
            "name": "pythonlab-dap-step-watch",
            "kind": "async/worker flows",
            "modules": ["debug/pythonlab"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_pythonlab_dap_step_watch_soak.py"],
            "env": {**common_env, "USERNAME": admin_username, "PASSWORD": admin_password, "ROUNDS": "3"},
            "login_heavy": True,
        },
        {
            "name": "pythonlab-print-visibility",
            "kind": "async/worker flows",
            "modules": ["debug/pythonlab"],
            "command": [str(VENV_PYTHON), "backend/scripts/smoke_pythonlab_print_visibility_probe.py"],
            "env": {**common_env, "USERNAME": admin_username, "PASSWORD": admin_password},
            "login_heavy": True,
        },
        {
            "name": "ui-smoke",
            "kind": "core UI",
            "modules": [
                "system/gateway",
                "articles/categories",
                "informatics",
                "xbk",
                "xxjs",
                "assessment",
                "classroom/ai-agents",
                "debug/pythonlab",
            ],
            "command": [
                "node",
                "frontend/scripts/prod-smoke-ui.mjs",
                "--base-url",
                base_origin,
                "--username",
                admin_username,
                "--password",
                admin_password,
                "--report-path",
                str(UI_REPORT_PATH),
                "--screenshots-dir",
                str(SCREENSHOT_DIR),
            ],
            "env": os.environ.copy(),
            "login_heavy": True,
        },
    ]

    for spec_item in command_specs:
        step = run_command_step(spec_item, login_throttle_seconds=login_throttle_seconds)
        steps.append(step)

    service_logs = collect_service_logs(run_started_at)

    openapi_report = json.loads(OPENAPI_REPORT_PATH.read_text(encoding="utf-8")) if OPENAPI_REPORT_PATH.exists() else {}
    ui_report = json.loads(UI_REPORT_PATH.read_text(encoding="utf-8")) if UI_REPORT_PATH.exists() else {}

    module_matrix = build_module_matrix(steps)
    overall_status = "PASS"
    for step in steps:
        overall_status = worst_status(overall_status, step.status)

    all_skips: list[dict[str, Any]] = []
    for step in steps:
        for item in step.skips:
            all_skips.append({"source": step.name, "message": item})
    if isinstance(ui_report, dict):
        for page in ui_report.get("pages", []):
            page_status = str(page.get("status") or "").upper()
            if page_status != "PASS" and page.get("action", "").startswith("skip-"):
                all_skips.append({"source": f"ui:{page.get('id')}", "message": page.get("action")})

    summary = {
        "status": overall_status,
        "started_at": run_started_at,
        "finished_at": now_iso(),
        "base_origin": base_origin,
        "openapi": {
            "path_count": path_count,
            "method_count": method_count,
            "json_path": str(OPENAPI_JSON_PATH.relative_to(ROOT)),
        },
        "counts": {
            "steps_total": len(steps),
            "pass": len([s for s in steps if s.status == "PASS"]),
            "warn": len([s for s in steps if s.status == "WARN"]),
            "fail": len([s for s in steps if s.status == "FAIL"]),
            "skip_entries": len(all_skips),
        },
        "modules": module_matrix,
        "steps": [step.__dict__ for step in steps],
        "service_logs": service_logs,
    }

    api_results = {
        "base_checks": base_step.checks,
        "openapi_sweep": openapi_report,
        "script_steps": [
            {
                "name": step.name,
                "kind": step.kind,
                "modules": step.modules,
                "status": step.status,
                "log_path": step.log_path,
                "warnings": step.warnings,
                "failures": step.failures,
                "skips": step.skips,
            }
            for step in steps
            if step.kind != "core UI"
        ],
    }

    failures_md = build_failures_md(steps, service_logs)

    write_json(SUMMARY_PATH, summary)
    write_json(API_RESULTS_PATH, api_results)
    write_json(SKIPS_PATH, {"items": all_skips})
    FAILURES_MD_PATH.write_text(failures_md, encoding="utf-8")

    if not UI_REPORT_PATH.exists():
        write_json(UI_REPORT_PATH, {"status": "FAIL", "message": "ui report missing"})

    print(json.dumps(summary["counts"], ensure_ascii=False))
    return 1 if overall_status == "FAIL" else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        sys.stderr.write(f"{exc}\n")
        raise SystemExit(1)
