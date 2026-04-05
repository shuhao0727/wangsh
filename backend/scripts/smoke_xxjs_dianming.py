import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


BASE_URL = os.environ.get("BASE_URL", "http://localhost:6608/api/v1").rstrip("/")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
PREFIX = os.environ.get("SMOKE_PREFIX", "smoke-dianming")


def _ok(msg: str) -> None:
    print(f"[OK] {msg}", flush=True)


def _fail(msg: str) -> None:
    print(f"[FAIL] {msg}", flush=True)


def _http_json(
    method: str,
    url: str,
    *,
    token: str | None = None,
    body: dict[str, Any] | None = None,
    timeout: int = 20,
) -> tuple[int, Any]:
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if hasattr(e, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def _http_form(url: str, *, fields: dict[str, str], timeout: int = 20) -> tuple[int, Any]:
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if hasattr(e, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def _expect(code: int, payload: Any, expected: int, msg: str) -> None:
    if code != expected:
        raise RuntimeError(f"{msg}: http {code} payload={payload}")


def _login() -> str:
    code, payload = _http_form(
        f"{BASE_URL}/auth/login",
        fields={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    if code != 200 or not isinstance(payload, dict) or not payload.get("access_token"):
        raise RuntimeError(f"login failed code={code} payload={payload}")
    return str(payload["access_token"])


def main() -> int:
    if not ADMIN_PASSWORD:
        raise SystemExit("missing ADMIN_PASSWORD")

    suffix = str(int(time.time()))
    year = "2026"
    class_name = f"{PREFIX}-{suffix}"

    try:
        token = _login()
        _ok("xxjs admin login")

        code, _ = _http_json("GET", f"{BASE_URL}/xxjs/dianming/classes", token=token)
        _expect(code, None, 200, "xxjs list classes before import")
        _ok("xxjs list classes")

        code, imported = _http_json(
            "POST",
            f"{BASE_URL}/xxjs/dianming/import",
            token=token,
            body={
                "year": year,
                "class_name": class_name,
                "names_text": "\n".join([
                    f"{PREFIX}-张三-{suffix}",
                    f"{PREFIX}-李四-{suffix}",
                    f"{PREFIX}-王五-{suffix}",
                ]),
            },
        )
        _expect(code, imported, 200, "xxjs import students")
        if not isinstance(imported, list) or len(imported) != 3:
            raise RuntimeError(f"xxjs import unexpected payload={imported}")
        _ok("xxjs import students")

        query = urllib.parse.urlencode({"year": year, "class_name": class_name})
        code, students = _http_json(
            "GET",
            f"{BASE_URL}/xxjs/dianming/students?{query}",
            token=token,
        )
        _expect(code, students, 200, "xxjs list students after import")
        if not isinstance(students, list) or len(students) != 3:
            raise RuntimeError(f"xxjs students unexpected payload={students}")
        _ok("xxjs list students after import")

        code, updated = _http_json(
            "PUT",
            f"{BASE_URL}/xxjs/dianming/class/students",
            token=token,
            body={
                "year": year,
                "class_name": class_name,
                "names_text": "\n".join([
                    f"{PREFIX}-赵六-{suffix}",
                    f"{PREFIX}-钱七-{suffix}",
                ]),
            },
        )
        _expect(code, updated, 200, "xxjs overwrite students")
        if not isinstance(updated, list) or len(updated) != 2:
            raise RuntimeError(f"xxjs overwrite unexpected payload={updated}")
        _ok("xxjs overwrite students")

        code, classes = _http_json("GET", f"{BASE_URL}/xxjs/dianming/classes", token=token)
        _expect(code, classes, 200, "xxjs list classes after update")
        class_items = [item for item in classes if item.get("class_name") == class_name] if isinstance(classes, list) else []
        if not class_items or int(class_items[0].get("count") or 0) != 2:
            raise RuntimeError(f"xxjs class aggregate unexpected payload={classes}")
        _ok("xxjs class aggregate updated")

        code, deleted = _http_json(
            "DELETE",
            f"{BASE_URL}/xxjs/dianming/class?{query}",
            token=token,
        )
        _expect(code, deleted, 200, "xxjs delete class")
        _ok("xxjs delete class")

        code, students_after = _http_json(
            "GET",
            f"{BASE_URL}/xxjs/dianming/students?{query}",
            token=token,
        )
        _expect(code, students_after, 200, "xxjs list students after delete")
        if not isinstance(students_after, list) or students_after:
            raise RuntimeError(f"xxjs expected empty students after delete payload={students_after}")
        _ok("xxjs cleanup verified")
        return 0
    except Exception as exc:
        _fail(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
