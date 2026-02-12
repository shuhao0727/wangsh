import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid
from http.cookiejar import CookieJar


_OPENER: urllib.request.OpenerDirector | None = None


def _open(req: urllib.request.Request, *, timeout: int):
    if _OPENER is not None:
        return _OPENER.open(req, timeout=timeout)
    return urllib.request.urlopen(req, timeout=timeout)


def _http_json(method: str, url: str, *, headers: dict | None = None, body: dict | None = None, timeout: int = 20):
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with _open(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return resp.status, None
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if hasattr(e, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def _http_form(method: str, url: str, *, fields: dict, timeout: int = 20):
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with _open(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, json.loads(raw)


def _http_multipart(
    method: str,
    url: str,
    *,
    headers: dict | None = None,
    files: list[tuple[str, str, bytes, str]],
    fields: dict | None = None,
    timeout: int = 30,
):
    boundary = "----smoke-" + uuid.uuid4().hex
    parts: list[bytes] = []

    for k, v in (fields or {}).items():
        parts.append(f"--{boundary}\r\n".encode("utf-8"))
        parts.append(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        parts.append(str(v).encode("utf-8"))
        parts.append(b"\r\n")

    for field_name, filename, content, content_type in files:
        parts.append(f"--{boundary}\r\n".encode("utf-8"))
        parts.append(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8"))
        parts.append(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        parts.append(content)
        parts.append(b"\r\n")

    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    data = b"".join(parts)

    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Accept", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with _open(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if hasattr(e, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def _http_bytes(method: str, url: str, *, headers: dict | None = None, timeout: int = 60):
    req = urllib.request.Request(url, method=method.upper())
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with _open(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def _die(msg: str):
    raise RuntimeError(msg)


def main() -> int:
    base_url = os.environ.get("BASE_URL", "http://localhost:8080/api/v1").rstrip("/")
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    note_id_env = os.environ.get("NOTE_ID")
    use_bearer = os.environ.get("USE_BEARER", "").strip().lower() in {"1", "true", "yes"}

    global _OPENER
    _OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()), urllib.request.ProxyHandler({}))

    created_note_id: int | None = None
    headers: dict[str, str] = {}
    try:
        code, payload = _http_json("GET", base_url + "/health")
        if code != 200:
            _die(f"health failed: http {code} payload={payload}")
        print("[OK] health")

        code, token_payload = _http_form("POST", base_url + "/auth/login", fields={"username": admin_username, "password": admin_password})
        if code != 200 or "access_token" not in token_payload:
            _die(f"login failed: http {code} payload={token_payload}")
        token = token_payload["access_token"]
        headers = {"Authorization": f"Bearer {token}"} if use_bearer else {}
        print("[OK] login")

        if note_id_env:
            note_id = int(note_id_env)
        else:
            title = f"smoke-{uuid.uuid4().hex[:8]}"
            content_typst = '\n'.join(
                [
                    '#import "style/my_style.typ":my_style',
                    '#show: my_style',
                    '= Typst Smoke',
                    '#image("images/smoke.png")',
                ]
            )
            code, created = _http_json(
                "POST",
                base_url + "/informatics/typst-notes",
                headers=headers,
                body={"title": title, "content_typst": content_typst},
            )
            if code != 200 or not isinstance(created, dict) or not created.get("id"):
                _die(f"create note failed: http {code} payload={created}")
            created_note_id = int(created["id"])
            note_id = created_note_id
            print(f"[OK] create note id={note_id}")

        png_1x1 = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==")
        code, asset = _http_multipart(
            "POST",
            base_url + f"/informatics/typst-notes/{note_id}/assets",
            headers=headers,
            fields={"path": "images/smoke.png"},
            files=[("file", "smoke.png", png_1x1, "image/png")],
        )
        if code not in (200, 201):
            _die(f"asset upload failed: http {code} payload={asset}")
        print("[OK] asset upload")

        code, job = _http_json("POST", base_url + f"/informatics/typst-notes/{note_id}/compile-async", headers=headers)
        if code == 400:
            print("[WARN] compile-async disabled, fallback to sync compile")
            code2, pdf = _http_bytes("POST", base_url + f"/informatics/typst-notes/{note_id}/compile", headers=headers, timeout=180)
            if code2 != 200 or not pdf.startswith(b"%PDF-"):
                _die(f"sync compile failed: http {code2}")
            print("[OK] sync compile")
        else:
            if code != 200 or not isinstance(job, dict) or not job.get("job_id"):
                _die(f"compile-async submit failed: http {code} payload={job}")
            job_id = job["job_id"]
            for _ in range(120):
                code, st = _http_json("GET", base_url + f"/informatics/typst-notes/compile-jobs/{job_id}", headers=headers)
                if code != 200:
                    _die(f"job status failed: http {code} payload={st}")
                if st.get("state") == "SUCCESS":
                    break
                if st.get("state") == "FAILURE":
                    _die(f"job failed: {st.get('error')}")
                time.sleep(0.5)
            code, pdf = _http_bytes("GET", base_url + f"/informatics/typst-notes/{note_id}/export.pdf", headers=headers, timeout=60)
            if code != 200 or not pdf.startswith(b"%PDF-"):
                _die(f"export pdf failed: http {code}")
            print("[OK] async compile + export")

        code, m = _http_json("GET", base_url + "/system/typst-metrics", headers=headers)
        if code != 200:
            _die(f"typst-metrics failed: http {code} payload={m}")
        print("[OK] typst-metrics")

        code, metrics_txt = _http_bytes("GET", base_url + "/system/metrics", headers=headers, timeout=20)
        if code != 200 or b"typst_compile_total" not in metrics_txt:
            _die(f"metrics export failed: http {code}")
        print("[OK] metrics export")

        code, clean = _http_json("POST", base_url + "/system/typst-pdf-cleanup?dry_run=true", headers=headers, timeout=30)
        if code != 200:
            _die(f"cleanup dry_run failed: http {code} payload={clean}")
        print("[OK] cleanup dry_run")

        if created_note_id is not None:
            code, deleted = _http_json("DELETE", base_url + f"/informatics/typst-notes/{created_note_id}", headers=headers)
            if code != 200:
                _die(f"delete note failed: http {code} payload={deleted}")
            created_note_id = None
            print("[OK] delete note")

        return 0
    finally:
        if created_note_id is not None:
            try:
                _http_json("DELETE", base_url + f"/informatics/typst-notes/{created_note_id}", headers=headers)
            except Exception:
                pass


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as e:
        print(f"[FAIL] {e}")
        raise SystemExit(1)
