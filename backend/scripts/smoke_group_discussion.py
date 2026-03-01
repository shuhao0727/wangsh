import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import uuid


def _http_json(method: str, url: str, *, headers: dict | None = None, body: dict | None = None, timeout: int = 12):
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return resp.status, None
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, {"raw": raw}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if hasattr(e, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def _http_form(method: str, url: str, *, fields: dict, timeout: int = 12):
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
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


def _http_multipart(
    method: str,
    url: str,
    *,
    headers: dict | None = None,
    files: list[tuple[str, str, bytes, str]],
    fields: dict | None = None,
    timeout: int = 20,
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
        parts.append(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8")
        )
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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


def _die(msg: str):
    print(f"[FAIL] {msg}")
    sys.exit(1)


def _parse_dotenv(path: str) -> dict[str, str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except Exception:
        return {}
    out: dict[str, str] = {}
    for raw in lines:
        s = (raw or "").strip()
        if not s or s.startswith("#"):
            continue
        if "=" not in s:
            continue
        k, v = s.split("=", 1)
        key = (k or "").strip()
        if not key:
            continue
        val = (v or "").strip()
        if val.startswith(("'", '"')) and val.endswith(("'", '"')) and len(val) >= 2:
            val = val[1:-1]
        out[key] = val
    return out


def _load_env_candidates() -> dict[str, str]:
    here = os.path.abspath(os.path.dirname(__file__))
    backend_root = os.path.abspath(os.path.join(here, ".."))
    d: dict[str, str] = {}
    for name in [".env.dev", ".env"]:
        p = os.path.join(backend_root, name)
        if os.path.exists(p):
            d.update(_parse_dotenv(p))
    return d


def _env_get(dotenv: dict[str, str], *keys: str) -> str:
    for k in keys:
        v = os.environ.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
        dv = dotenv.get(k)
        if dv is not None and str(dv).strip():
            return str(dv).strip()
    return ""


def _normalize_api_v1(base_url: str) -> str:
    u = (base_url or "").strip().rstrip("/")
    if not u:
        return "http://localhost:8000/api/v1"
    if u.endswith("/api/v1"):
        return u
    if u.endswith("/api"):
        return u + "/v1"
    if u.endswith("/api/v1/"):
        return u[:-1]
    if "/api/v1" in u:
        return u
    return u + "/api/v1"


def _root_url_from_api_v1(api_v1: str) -> str:
    u = (api_v1 or "").rstrip("/")
    if u.endswith("/api/v1"):
        return u[: -len("/api/v1")]
    return u.replace("/api/v1", "")


def _expect(code: int, payload: object, want_code: int, msg: str):
    if code != want_code:
        _die(f"{msg}: http {code} payload={payload}")


def _extract_access_token(payload: object) -> str:
    if isinstance(payload, dict):
        v = payload.get("access_token")
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _today_iso() -> str:
    return time.strftime("%Y-%m-%d")


def _ensure_active_agent(base_url: str, *, prefer_agent_id: str | None = None) -> int:
    if prefer_agent_id and str(prefer_agent_id).strip():
        try:
            return int(str(prefer_agent_id).strip())
        except Exception:
            pass
    code, active_agents = _http_json("GET", f"{base_url}/ai-agents/active", timeout=12)
    if code == 200 and isinstance(active_agents, list):
        for a in active_agents:
            if isinstance(a, dict) and a.get("is_active") is not False:
                try:
                    return int(a.get("id"))
                except Exception:
                    continue
    suffix = str(int(time.time()))
    code, created = _http_json(
        "POST",
        f"{base_url}/ai-agents/",
        body={
            "name": f"smoke-agent-{suffix}",
            "agent_type": "general",
            "description": "smoke",
            "model_name": "debug",
            "is_active": True,
        },
        timeout=20,
    )
    if code != 201 or not isinstance(created, dict) or "id" not in created:
        _die(f"create fallback agent failed: http {code} payload={created}")
    try:
        return int(created["id"])
    except Exception:
        _die(f"create fallback agent invalid id: payload={created}")
    return 0


def _admin_login(base_url: str, *, username: str, password_candidates: list[str]) -> str:
    tried: list[str] = []
    for pw in password_candidates:
        p = (pw or "").strip()
        if not p:
            continue
        if p in tried:
            continue
        tried.append(p)
        code, payload = _http_form(
            "POST",
            f"{base_url}/auth/login",
            fields={"username": username, "password": p},
        )
        if code != 200:
            continue
        token = _extract_access_token(payload)
        if token:
            return token
    _die("admin login failed (all password candidates rejected)")
    return ""


def _student_login(base_url: str, *, full_name: str, student_id: str) -> str:
    code, payload = _http_form(
        "POST",
        f"{base_url}/auth/login",
        fields={"username": full_name, "password": student_id},
    )
    if code != 200:
        _die(f"student login failed: http {code} payload={payload}")
    token = _extract_access_token(payload)
    if not token:
        _die(f"student login response missing access_token: payload={payload}")
    return token


def _run_round(
    base_url: str,
    *,
    admin_username: str,
    admin_password_candidates: list[str],
    agent_id: int,
    round_i: int,
):
    suffix = f"{int(time.time())}-{round_i}"
    today = _today_iso()

    admin_token = _admin_login(base_url, username=admin_username, password_candidates=admin_password_candidates)

    code, pub = _http_json("GET", f"{base_url}/ai-agents/group-discussion/public-config", timeout=12)
    _expect(code, pub, 200, "public-config get failed")
    code, pub2 = _http_json(
        "PUT",
        f"{base_url}/ai-agents/group-discussion/public-config",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={"enabled": True, "join_lock_seconds": 300, "rate_limit_seconds": 2},
        timeout=12,
    )
    _expect(code, pub2, 200, "public-config put failed")
    if not (isinstance(pub2, dict) and pub2.get("enabled") is True):
        _die(f"public-config put response invalid: payload={pub2}")

    class_name = f"冒烟班级{suffix}"
    admin_class_name = f"冒烟管理班级{suffix}"
    s1_full_name = f"讨论冒烟学生{suffix}A"
    s1_student_id = f"smoke{int(time.time())}{round_i}01"

    def create_student(full_name: str, student_id: str):
        code, payload = _http_json(
            "POST",
            f"{base_url}/users/",
            headers={"Authorization": f"Bearer {admin_token}"},
            body={
                "student_id": student_id,
                "full_name": full_name,
                "role_code": "student",
                "class_name": class_name,
                "is_active": True,
            },
            timeout=20,
        )
        _expect(code, payload, 200, "create student failed")

    create_student(s1_full_name, s1_student_id)

    code, a1 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/join",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={"group_no": "11", "class_name": admin_class_name, "group_name": f"管理创建{suffix}一"},
        timeout=20,
    )
    _expect(code, a1, 200, "admin join(create session1) failed")
    if not (isinstance(a1, dict) and "session_id" in a1):
        _die(f"admin join response invalid: payload={a1}")
    admin_session_1 = int(a1["session_id"])

    code, a2 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/join",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={"group_no": "12", "class_name": admin_class_name, "group_name": f"管理创建{suffix}二"},
        timeout=20,
    )
    _expect(code, a2, 200, "admin join(create session2) failed")
    if not (isinstance(a2, dict) and "session_id" in a2):
        _die(f"admin join response invalid: payload={a2}")
    admin_session_2 = int(a2["session_id"])

    code, am1 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/messages",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={"session_id": admin_session_1, "content": f"管理端冒烟消息 {suffix} A"},
        timeout=20,
    )
    _expect(code, am1, 200, "admin post-message(session1) failed")
    code, am2 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/messages",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={"session_id": admin_session_2, "content": f"管理端冒烟消息 {suffix} B"},
        timeout=20,
    )
    _expect(code, am2, 200, "admin post-message(session2) failed")

    code, g_student = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/groups?limit=50",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, g_student, 200, "groups list failed")

    q1 = urllib.parse.urlencode({"date": today, "class_name": admin_class_name, "limit": 200})
    code, g1 = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/groups?{q1}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, g1, 200, "admin groups list(date+class) failed")

    q2 = urllib.parse.urlencode({"class_name": admin_class_name, "keyword": "11", "limit": 200})
    code, g2 = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/groups?{q2}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, g2, 200, "admin groups list(class+keyword) failed")

    q3 = urllib.parse.urlencode(
        {"date": today, "class_name": admin_class_name, "keyword": f"管理创建{suffix}", "limit": 200}
    )
    code, g3 = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/groups?{q3}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, g3, 200, "admin groups list(date+class+keyword) failed")

    code, sessions_admin_today = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/admin/sessions?start_date={today}&end_date={today}&class_name={urllib.parse.quote(admin_class_name)}&page=1&size=50",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, sessions_admin_today, 200, "admin sessions list(date range + class) failed")

    s1_token = _student_login(base_url, full_name=s1_full_name, student_id=s1_student_id)

    code, sj = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/join",
        headers={"Authorization": f"Bearer {s1_token}"},
        body={"group_no": "1", "group_name": f"冒烟组{suffix}一"},
        timeout=20,
    )
    _expect(code, sj, 200, "student join failed")
    if not (isinstance(sj, dict) and "session_id" in sj):
        _die(f"student join response invalid: payload={sj}")
    student_session = int(sj["session_id"])

    msg_text = f"冒烟测试消息 round={round_i} ts={int(time.time())}"
    code, msg = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/messages",
        headers={"Authorization": f"Bearer {s1_token}"},
        body={"session_id": student_session, "content": msg_text},
        timeout=20,
    )
    _expect(code, msg, 200, "student post-message failed")
    if not (isinstance(msg, dict) and "id" in msg):
        _die(f"student post-message response invalid: payload={msg}")
    student_msg_id = int(msg["id"])

    code, lst1 = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/messages?session_id={student_session}&after_id=0&limit=50",
        headers={"Authorization": f"Bearer {s1_token}"},
        timeout=20,
    )
    _expect(code, lst1, 200, "student poll messages(after_id=0) failed")
    items1 = lst1.get("items") if isinstance(lst1, dict) else None
    if not (
        isinstance(items1, list)
        and any(int(x.get("id", 0)) == student_msg_id for x in items1 if isinstance(x, dict))
    ):
        _die(f"student poll messages missing sent message: payload={lst1}")

    code, sg = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/groups?limit=50",
        headers={"Authorization": f"Bearer {s1_token}"},
        timeout=20,
    )
    _expect(code, sg, 200, "student groups list failed")
    sg_items = (sg or {}).get("items") if isinstance(sg, dict) else None
    if not (
        isinstance(sg_items, list)
        and any(int(x.get("session_id", 0)) == student_session for x in sg_items if isinstance(x, dict))
    ):
        _die(f"student groups list missing session: payload={sg}")

    admin_token = _admin_login(base_url, username=admin_username, password_candidates=admin_password_candidates)

    code, classes_today = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/admin/classes?date={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, classes_today, 200, "admin classes(date=today) failed")
    if not (isinstance(classes_today, list) and class_name in [str(x) for x in classes_today]):
        _die(f"admin classes missing class_name: payload={classes_today}")
    if not (isinstance(classes_today, list) and admin_class_name in [str(x) for x in classes_today]):
        _die(f"admin classes missing admin_class_name: payload={classes_today}")

    code, classes_none = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/admin/classes?date=2000-01-01",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, classes_none, 200, "admin classes(date=no groups) failed")
    if not isinstance(classes_none, list):
        _die(f"admin classes(date=no groups) invalid payload: {classes_none}")

    code, admin_msgs = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/admin/messages?session_id={student_session}&page=1&size=200",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, admin_msgs, 200, "admin messages list failed")
    am_items = admin_msgs.get("items") if isinstance(admin_msgs, dict) else None
    if not (isinstance(am_items, list) and any(int(x.get("id", 0)) == student_msg_id for x in am_items if isinstance(x, dict))):
        _die(f"admin messages missing student_msg_id: payload={admin_msgs}")

    code, cmp1 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/admin/compare-analyze",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "session_ids": [admin_session_1, admin_session_2],
            "agent_id": int(agent_id),
            "bucket_seconds": 180,
            "analysis_type": "learning_compare",
            "use_cache": True,
        },
        timeout=90,
    )
    _expect(code, cmp1, 200, "compare analyze failed")
    if not (isinstance(cmp1, dict) and "analysis_id" in cmp1):
        _die(f"compare analyze response invalid: payload={cmp1}")
    analysis_id_1 = int(cmp1["analysis_id"] or 0)
    if analysis_id_1 <= 0:
        _die(f"compare analyze analysis_id invalid: payload={cmp1}")

    code, cmp2 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/admin/compare-analyze",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "session_ids": [admin_session_1, admin_session_2],
            "agent_id": int(agent_id),
            "bucket_seconds": 180,
            "analysis_type": "learning_compare",
            "use_cache": True,
        },
        timeout=90,
    )
    _expect(code, cmp2, 200, "compare analyze(cache) failed")
    analysis_id_2 = int(cmp2.get("analysis_id") or 0) if isinstance(cmp2, dict) else 0
    if analysis_id_2 != analysis_id_1:
        _die(f"compare analyze cache miss: {analysis_id_1} vs {analysis_id_2}")

    code, analyses = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/admin/analyses?session_id={admin_session_1}&limit=20",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    _expect(code, analyses, 200, "admin analyses list failed")
    a_items = analyses.get("items") if isinstance(analyses, dict) else None
    if not (isinstance(a_items, list) and any(int(x.get("id", 0)) == analysis_id_1 for x in a_items if isinstance(x, dict))):
        _die(f"admin analyses missing analysis_id: payload={analyses}")

    print(
        f"[OK] round={round_i} public-config,list,admin/classes,join/create,post-message,poll,compare "
        f"(student_session={student_session} admin_sessions={admin_session_1},{admin_session_2} analysis_id={analysis_id_1})"
    )


def main() -> int:
    dotenv = _load_env_candidates()
    base_url = _normalize_api_v1(_env_get(dotenv, "BASE_URL") or "http://localhost:8000/api/v1")
    admin_username = _env_get(dotenv, "ADMIN_USERNAME", "SUPER_ADMIN_USERNAME") or "admin"
    admin_password = _env_get(dotenv, "ADMIN_PASSWORD", "SUPER_ADMIN_PASSWORD") or ""
    analysis_agent_id = _env_get(dotenv, "ANALYSIS_AGENT_ID") or ""

    print(f"[INFO] base_url={base_url}")

    root_url = _root_url_from_api_v1(base_url)
    code, payload = _http_json("GET", root_url + "/health")
    if code != 200 or not (isinstance(payload, dict) and payload.get("status")):
        code2, payload2 = _http_json("GET", root_url + "/api/health")
        if code2 != 200 or not (isinstance(payload2, dict) and payload2.get("status")):
            _die(f"health check failed: http {code} payload={payload} / fallback http {code2} payload={payload2}")
    print("[OK] health")

    admin_password_candidates = [admin_password, "dev_admin_password", "change_me", "wangshuhao0727"]
    _admin_login(base_url, username=admin_username, password_candidates=admin_password_candidates)
    print("[OK] admin login")

    agent_id = _ensure_active_agent(base_url, prefer_agent_id=analysis_agent_id or None)
    print(f"[OK] analysis agent resolved: agent_id={agent_id}")

    for i in [1, 2, 3]:
        print(f"[INFO] round {i}/3")
        _run_round(
            base_url,
            admin_username=admin_username,
            admin_password_candidates=admin_password_candidates,
            agent_id=agent_id,
            round_i=i,
        )

    print("[DONE] smoke ok (3 rounds)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
