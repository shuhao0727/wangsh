import json
import os
import sys
import time
import urllib.parse
import urllib.request
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
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, json.loads(raw)


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


def main() -> int:
    base_url = os.environ.get("BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    analysis_agent_id = os.environ.get("ANALYSIS_AGENT_ID", "").strip()
    allow_skip_compare = os.environ.get("SMOKE_ALLOW_SKIP_COMPARE", "").strip() in {"1", "true", "TRUE", "yes", "YES"}
    force_skip_compare = os.environ.get("SMOKE_FORCE_SKIP_COMPARE", "").strip() in {"1", "true", "TRUE", "yes", "YES"}

    print(f"[INFO] base_url={base_url}")

    root_url = base_url.replace("/api/v1", "")
    code, payload = _http_json("GET", root_url + "/health")
    if code != 200 or not (isinstance(payload, dict) and payload.get("status")):
        code2, payload2 = _http_json("GET", root_url + "/api/health")
        if code2 != 200 or not (isinstance(payload2, dict) and payload2.get("status")):
            _die(f"health check failed: http {code} payload={payload} / fallback http {code2} payload={payload2}")
        code, payload = code2, payload2
    print("[OK] health")

    if not admin_password:
        print("[SKIP] admin login (ADMIN_PASSWORD not set)")
        return 0

    code, login = _http_form(
        "POST",
        f"{base_url}/auth/login",
        fields={"username": admin_username, "password": admin_password},
    )
    if code != 200 or not isinstance(login, dict) or "access_token" not in login:
        _die("admin login failed")
    admin_token = str(login["access_token"])
    print("[OK] admin login")

    code, me = _http_json(
        "GET",
        f"{base_url}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(me, dict) or "id" not in me:
        _die(f"admin me failed: http {code} payload={me}")
    admin_id = int(me.get("id") or 0)
    if admin_id <= 0:
        _die("admin me invalid id")

    code, a1 = _http_json(
        "GET",
        f"{base_url}/articles?page=1&size=1&published_only=false&include_relations=false",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200:
        _die(f"admin articles list failed: http {code} payload={a1}")
    code, a2 = _http_json(
        "GET",
        f"{base_url}/articles?page=1&size=1&published_only=false&include_relations=false",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200:
        _die(f"admin articles list (cache) failed: http {code} payload={a2}")
    print("[OK] admin articles list")

    suffix = str(int(time.time()))
    article_slug = f"smoke-article-{suffix}"
    code, created = _http_json(
        "POST",
        f"{base_url}/articles",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "title": f"冒烟测试文章{suffix}",
            "slug": article_slug,
            "content": f"# 冒烟测试文章\n\n创建于 {suffix}",
            "summary": "smoke",
            "published": False,
            "author_id": admin_id,
        },
        timeout=30,
    )
    if code != 201 or not isinstance(created, dict) or "id" not in created:
        _die(f"admin article create failed: http {code} payload={created}")
    article_id = int(created.get("id") or 0)
    if article_id <= 0:
        _die("admin article create invalid id")

    code, a3 = _http_json(
        "GET",
        f"{base_url}/articles?page=1&size=1&published_only=false&include_relations=false",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(a3, dict):
        _die(f"admin articles list after create failed: http {code} payload={a3}")
    top_slug = None
    try:
        top_slug = str((a3.get("articles") or [])[0].get("slug"))
    except Exception:
        top_slug = None
    if top_slug != article_slug:
        _die(f"admin articles cache not refreshed (top slug {top_slug} != {article_slug})")

    code, pub = _http_json(
        "POST",
        f"{base_url}/articles/{article_id}/publish?published=true",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    if code != 200 or not isinstance(pub, dict) or pub.get("published") is not True:
        _die(f"admin article publish failed: http {code} payload={pub}")
    code, pub_list = _http_json(
        "GET",
        f"{base_url}/articles?page=1&size=5&published_only=true&include_relations=false",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(pub_list, dict):
        _die(f"admin articles list published_only failed: http {code} payload={pub_list}")
    pub_articles = pub_list.get("articles") or []
    if not any(str(x.get("slug", "")) == article_slug for x in pub_articles if isinstance(x, dict)):
        _die("published article not found in published_only list")
    code, unpub = _http_json(
        "POST",
        f"{base_url}/articles/{article_id}/publish?published=false",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    if code != 200 or not isinstance(unpub, dict) or unpub.get("published") is not False:
        _die(f"admin article unpublish failed: http {code} payload={unpub}")
    print("[OK] admin article publish toggle")

    code, d1 = _http_json(
        "DELETE",
        f"{base_url}/articles/{article_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    if code != 204:
        _die(f"admin article delete failed: http {code} payload={d1}")
    code, g1 = _http_json(
        "GET",
        f"{base_url}/articles/{article_id}?include_relations=false",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 404:
        _die(f"admin article should be deleted: http {code} payload={g1}")
    print("[OK] admin article write")

    code, u1 = _http_json(
        "GET",
        f"{base_url}/users/?skip=0&limit=1",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200:
        _die(f"admin users list failed: http {code} payload={u1}")
    code, u2 = _http_json(
        "GET",
        f"{base_url}/users/?skip=0&limit=1",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200:
        _die(f"admin users list (repeat) failed: http {code} payload={u2}")
    print("[OK] admin users list")

    u_full_name = f"冒烟写用户{suffix}"
    u_student_id = f"smokeu{suffix}"
    code, u_created = _http_json(
        "POST",
        f"{base_url}/users/",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "student_id": u_student_id,
            "full_name": u_full_name,
            "role_code": "student",
            "class_name": "冒烟写入班级",
            "is_active": True,
        },
        timeout=20,
    )
    if code != 200 or not isinstance(u_created, dict) or "id" not in u_created:
        _die(f"admin user create failed: http {code} payload={u_created}")
    u_id = int(u_created.get("id") or 0)
    if u_id <= 0:
        _die("admin user create invalid id")
    code, u_list1 = _http_json(
        "GET",
        f"{base_url}/users/?skip=0&limit=5&search={urllib.parse.quote(u_student_id)}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(u_list1, dict):
        _die(f"admin user list after create failed: http {code} payload={u_list1}")
    users_arr = u_list1.get("users") or []
    if not any(int(x.get("id", 0)) == u_id for x in users_arr if isinstance(x, dict)):
        _die("admin user not found after create")

    new_full_name = f"{u_full_name}改"
    code, u_updated = _http_json(
        "PUT",
        f"{base_url}/users/{u_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={"full_name": new_full_name},
        timeout=20,
    )
    if code != 200 or not isinstance(u_updated, dict) or str(u_updated.get("full_name")) != new_full_name:
        _die(f"admin user update failed: http {code} payload={u_updated}")
    code, u_deleted = _http_json(
        "DELETE",
        f"{base_url}/users/{u_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(u_deleted, dict) or u_deleted.get("success") is not True:
        _die(f"admin user delete failed: http {code} payload={u_deleted}")
    code, u_list2 = _http_json(
        "GET",
        f"{base_url}/users/?skip=0&limit=5&search={urllib.parse.quote(u_student_id)}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(u_list2, dict):
        _die(f"admin user list after delete failed: http {code} payload={u_list2}")
    users_arr2 = u_list2.get("users") or []
    if any(int(x.get("id", 0)) == u_id for x in users_arr2 if isinstance(x, dict)):
        _die("admin user still present after delete")
    print("[OK] admin user write")

    b1_full_name = f"冒烟批量删用户{suffix}A"
    b1_student_id = f"smokeb{suffix}01"
    b2_full_name = f"冒烟批量删用户{suffix}B"
    b2_student_id = f"smokeb{suffix}02"
    code, b1 = _http_json(
        "POST",
        f"{base_url}/users/",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "student_id": b1_student_id,
            "full_name": b1_full_name,
            "role_code": "student",
            "class_name": "冒烟批量班级",
            "is_active": True,
        },
        timeout=20,
    )
    if code != 200 or not isinstance(b1, dict) or "id" not in b1:
        _die(f"admin batch user1 create failed: http {code} payload={b1}")
    b1_id = int(b1.get("id") or 0)
    code, b2 = _http_json(
        "POST",
        f"{base_url}/users/",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "student_id": b2_student_id,
            "full_name": b2_full_name,
            "role_code": "student",
            "class_name": "冒烟批量班级",
            "is_active": True,
        },
        timeout=20,
    )
    if code != 200 or not isinstance(b2, dict) or "id" not in b2:
        _die(f"admin batch user2 create failed: http {code} payload={b2}")
    b2_id = int(b2.get("id") or 0)
    code, bd = _http_json(
        "POST",
        f"{base_url}/users/batch-delete",
        headers={"Authorization": f"Bearer {admin_token}"},
        body=[b1_id, b2_id],
        timeout=30,
    )
    if code != 200 or not isinstance(bd, dict) or bd.get("success") is not True:
        _die(f"admin users batch delete failed: http {code} payload={bd}")
    code, b_list = _http_json(
        "GET",
        f"{base_url}/users/?skip=0&limit=5&search={urllib.parse.quote(b1_student_id)}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(b_list, dict):
        _die(f"admin user list after batch delete failed: http {code} payload={b_list}")
    b_users = b_list.get("users") or []
    if any(int(x.get("id", 0)) in {b1_id, b2_id} for x in b_users if isinstance(x, dict)):
        _die("admin users still present after batch delete")
    print("[OK] admin users batch delete")

    import_student_id = f"smokei{suffix}"
    import_csv = (
        "学号,姓名,学年,班级,状态,用户名\n"
        f"{import_student_id},冒烟导入用户{suffix},2026,冒烟导入班级,true,\n"
    ).encode("utf-8")
    code, imp = _http_multipart(
        "POST",
        f"{base_url}/users/import",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=[("file", f"smoke_{suffix}.csv", import_csv, "text/csv")],
        timeout=60,
    )
    if code != 200 or not isinstance(imp, dict) or imp.get("success") is not True:
        _die(f"admin users import failed: http {code} payload={imp}")
    code, imp_list = _http_json(
        "GET",
        f"{base_url}/users/?skip=0&limit=5&search={urllib.parse.quote(import_student_id)}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if code != 200 or not isinstance(imp_list, dict):
        _die(f"admin user list after import failed: http {code} payload={imp_list}")
    imp_users = imp_list.get("users") or []
    if not any(str(x.get("student_id", "")) == import_student_id for x in imp_users if isinstance(x, dict)):
        _die("imported user not found")
    print("[OK] admin users import")

    s1_full_name = f"讨论冒烟学生{suffix}A"
    s1_student_id = f"smoke{suffix}01"
    s2_full_name = f"讨论冒烟学生{suffix}B"
    s2_student_id = f"smoke{suffix}02"

    def ensure_student(full_name: str, student_id: str, class_name: str):
        _http_json(
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
        )

    ensure_student(s1_full_name, s1_student_id, "冒烟测试班级")
    ensure_student(s2_full_name, s2_student_id, "冒烟测试班级")

    code, s1_login = _http_form(
        "POST",
        f"{base_url}/auth/login",
        fields={"username": s1_full_name, "password": s1_student_id},
    )
    if code != 200 or "access_token" not in s1_login:
        _die("student1 login failed")
    s1_token = str(s1_login["access_token"])

    code, s2_login = _http_form(
        "POST",
        f"{base_url}/auth/login",
        fields={"username": s2_full_name, "password": s2_student_id},
    )
    if code != 200 or "access_token" not in s2_login:
        _die("student2 login failed")
    s2_token = str(s2_login["access_token"])
    print("[OK] student logins")

    code, j1 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/join",
        headers={"Authorization": f"Bearer {s1_token}"},
        body={"group_no": "1"},
    )
    if code != 200 or not isinstance(j1, dict) or "session_id" not in j1:
        _die("student1 join failed")
    session1 = int(j1["session_id"])

    code, j2 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/join",
        headers={"Authorization": f"Bearer {s2_token}"},
        body={"group_no": "2"},
    )
    if code != 200 or not isinstance(j2, dict) or "session_id" not in j2:
        _die("student2 join failed")
    session2 = int(j2["session_id"])
    print("[OK] joins")

    code, msg = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/messages",
        headers={"Authorization": f"Bearer {s1_token}"},
        body={"session_id": session1, "content": "冒烟测试消息"},
    )
    if code != 200 or not isinstance(msg, dict) or "id" not in msg:
        _die("send message failed")
    msg_id = int(msg["id"])
    print("[OK] send message")

    code, lst = _http_json(
        "GET",
        f"{base_url}/ai-agents/group-discussion/messages?session_id={session1}&after_id=0&limit=50",
        headers={"Authorization": f"Bearer {s1_token}"},
    )
    if code != 200 or not isinstance(lst, dict) or "items" not in lst:
        _die("list messages failed")
    items = lst.get("items") or []
    if not any(int(x.get("id", 0)) == msg_id for x in items if isinstance(x, dict)):
        _die("list messages missing sent message")
    print("[OK] list messages")

    if force_skip_compare:
        print("[SKIP] compare analyze (forced)")
        print("[DONE] smoke ok")
        return 0

    aid: int | None = None
    if analysis_agent_id:
        aid = int(analysis_agent_id)
    else:
        code, active_agents = _http_json("GET", f"{base_url}/ai-agents/active", timeout=12)
        if code == 200 and isinstance(active_agents, list) and active_agents:
            for a in active_agents:
                if not isinstance(a, dict):
                    continue
                if a.get("is_active") is False:
                    continue
                try:
                    aid = int(a.get("id"))
                    break
                except Exception:
                    continue

    if aid is None:
        msg = "no active agent found for compare analyze"
        if allow_skip_compare:
            print(f"[SKIP] compare analyze ({msg})")
            print("[DONE] smoke ok")
            return 0
        _die(msg)

    code, payload = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/admin/compare-analyze",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "session_ids": [session1, session2],
            "agent_id": aid,
            "bucket_seconds": 180,
            "analysis_type": "learning_compare",
            "use_cache": True,
        },
        timeout=90,
    )
    if code != 200:
        if allow_skip_compare:
            print(f"[SKIP] compare analyze http {code}: {payload}")
            print("[DONE] smoke ok")
            return 0
        _die(f"compare analyze failed: http {code} payload={payload}")
    if not isinstance(payload, dict) or "analysis_id" not in payload:
        _die("compare analyze response invalid")
    analysis_id_1 = int(payload["analysis_id"] or 0)
    if analysis_id_1 <= 0:
        _die("compare analyze analysis_id invalid")

    code, payload2 = _http_json(
        "POST",
        f"{base_url}/ai-agents/group-discussion/admin/compare-analyze",
        headers={"Authorization": f"Bearer {admin_token}"},
        body={
            "session_ids": [session1, session2],
            "agent_id": aid,
            "bucket_seconds": 180,
            "analysis_type": "learning_compare",
            "use_cache": True,
        },
        timeout=90,
    )
    if code != 200 or not isinstance(payload2, dict) or "analysis_id" not in payload2:
        _die("compare analyze cache hit failed")
    analysis_id_2 = int(payload2["analysis_id"] or 0)
    if analysis_id_2 != analysis_id_1:
        _die(f"compare analyze cache miss (expected same analysis_id): {analysis_id_1} vs {analysis_id_2}")
    print(f"[OK] compare analyze (agent_id={aid}, cache_hit=yes)")

    print("[DONE] smoke ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
