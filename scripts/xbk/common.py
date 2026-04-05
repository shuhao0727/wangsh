from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import httpx

ROOT_DIR = Path(__file__).resolve().parents[2]


def _load_env_file_fallback(path: Path, override: bool = False) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not override and key in os.environ:
            continue
        os.environ[key] = value


def load_project_env() -> None:
    env_path = ROOT_DIR / ".env"
    env_dev_path = ROOT_DIR / ".env.dev"

    try:
        from dotenv import load_dotenv  # type: ignore

        if env_path.exists():
            load_dotenv(env_path, override=False)
        elif env_dev_path.exists():
            load_dotenv(env_dev_path, override=False)
    except Exception:
        if env_path.exists():
            _load_env_file_fallback(env_path, override=False)
        elif env_dev_path.exists():
            _load_env_file_fallback(env_dev_path, override=False)


@dataclass(frozen=True)
class Settings:
    api_base: str
    admin_user: str
    admin_pass: str
    db_host: str
    db_port: int
    db_user: str
    db_password: str
    db_name: str
    year: int
    term: str
    test_result_dir: Path
    sample_dir: Path
    export_dir: Path


def get_settings() -> Settings:
    load_project_env()

    api_base = os.environ.get("API_BASE", "http://localhost:8000/api/v1").rstrip("/")
    admin_user = os.environ.get("SUPER_ADMIN_USERNAME") or os.environ.get("ADMIN_USER") or "admin"
    admin_pass = os.environ.get("SUPER_ADMIN_PASSWORD") or os.environ.get("ADMIN_PASS") or ""

    db_host = os.environ.get("POSTGRES_HOST", "127.0.0.1")
    db_port = int(os.environ.get("POSTGRES_PORT", "5432"))
    db_user = os.environ.get("POSTGRES_USER", "admin")
    db_password = os.environ.get("POSTGRES_PASSWORD", "")
    db_name = os.environ.get("POSTGRES_DB", "wangsh_db")

    year = int(os.environ.get("XBK_YEAR", "2026"))
    term = os.environ.get("XBK_TERM", "上学期")

    test_result_dir = ROOT_DIR / "test-results" / "xbk"
    sample_dir = ROOT_DIR / "test-results" / "xbk-import-samples"
    export_dir = ROOT_DIR / "test-results" / "xbk-exports"

    return Settings(
        api_base=api_base,
        admin_user=admin_user,
        admin_pass=admin_pass,
        db_host=db_host,
        db_port=db_port,
        db_user=db_user,
        db_password=db_password,
        db_name=db_name,
        year=year,
        term=term,
        test_result_dir=test_result_dir,
        sample_dir=sample_dir,
        export_dir=export_dir,
    )


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def dump_json(path: Path, data: Dict[str, Any]) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_http_client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0))


def login_admin(client: httpx.Client, settings: Settings) -> str:
    if not settings.admin_pass:
        raise RuntimeError("Missing admin password. Set SUPER_ADMIN_PASSWORD or ADMIN_PASS.")

    for attempt in range(5):
        resp = client.post(
            f"{settings.api_base}/auth/login",
            data={"username": settings.admin_user, "password": settings.admin_pass},
        )
        if resp.status_code == 429 and attempt < 4:
            time.sleep(2.2)
            continue
        resp.raise_for_status()
        token = (resp.json() or {}).get("access_token")
        if not token:
            raise RuntimeError("Login succeeded but access_token is missing.")
        return str(token)

    raise RuntimeError("Admin login failed after retries.")


def auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
