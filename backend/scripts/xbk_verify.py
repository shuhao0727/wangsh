import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error


BASE_URL = os.getenv("XBK_VERIFY_BASE_URL", "http://localhost:8000")
USERNAME = os.getenv("XBK_VERIFY_USERNAME", os.getenv("SUPER_ADMIN_USERNAME", "admin"))
PASSWORD = os.getenv("XBK_VERIFY_PASSWORD", os.getenv("SUPER_ADMIN_PASSWORD", "change_me"))


def req(method: str, path: str, token: str | None = None, json_body: dict | None = None, form_body: dict | None = None):
    url = BASE_URL.rstrip("/") + path
    headers = {}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif form_body is not None:
        data = urllib.parse.urlencode(form_body).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=8) as resp:
            body = resp.read()
            return resp.status, body
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
        except Exception:
            body = b""
        return int(e.code), body
    except Exception as e:
        raise RuntimeError(f"{method} {path} failed: {e}")


def login() -> str:
    status, body = req(
        "POST",
        "/api/v1/auth/login",
        form_body={"username": USERNAME, "password": PASSWORD},
    )
    if status != 200:
        raise RuntimeError(f"login status={status} body={body[:200]!r}")
    token = json.loads(body.decode("utf-8")).get("access_token")
    if not token:
        raise RuntimeError("login response missing access_token")
    return token


def main() -> int:
    status, _ = req("GET", "/health")
    if status != 200:
        raise RuntimeError("health check failed")

    token = login()

    year = 2026
    term = "上学期"
    suffix = str(int(time.time()) % 100000)
    course_code = "9" + suffix
    cls = "高二(9)班"
    s1 = "V" + suffix + "01"
    s2 = "V" + suffix + "02"

    _, body_courses = req(
        "GET",
        f"/api/v1/xbk/data/courses?year={year}&term={urllib.parse.quote(term)}&search_text={course_code}&page=1&size=5",
        token=token,
    )
    course_items = json.loads(body_courses.decode("utf-8")).get("items", [])
    course_payload = {
        "year": year,
        "term": term,
        "course_code": course_code,
        "course_name": "XBK 验证课程",
        "teacher": "T",
        "quota": 1,
        "location": "L",
    }
    if course_items:
        st, b = req("PUT", f"/api/v1/xbk/data/courses/{course_items[0]['id']}", token=token, json_body=course_payload)
        if st != 200:
            raise RuntimeError(f"update course failed status={st} body={b[:200]!r}")
    else:
        st, b = req("POST", "/api/v1/xbk/data/courses", token=token, json_body=course_payload)
        if st not in [200, 409]:
            raise RuntimeError(f"create course failed status={st} body={b[:200]!r}")
    for sno in [s1, s2]:
        st, _ = req(
            "POST",
            "/api/v1/xbk/data/students",
            token=token,
            json_body={
                "year": year,
                "term": term,
                "class_name": cls,
                "student_no": sno,
                "name": sno,
                "gender": "男",
            },
        )
        if st not in [200, 409]:
            raise RuntimeError(f"create student failed status={st}")

    st_sel, body_sel = req(
        "GET",
        f"/api/v1/xbk/data/selections?year={year}&term={urllib.parse.quote(term)}&search_text={course_code}&page=1&size=200",
        token=token,
    )
    if st_sel != 200:
        raise RuntimeError(f"list selections failed status={st_sel} body={body_sel[:200]!r}")
    items = json.loads(body_sel.decode("utf-8")).get("items", [])
    for it in items:
        sid = it.get("id")
        if sid:
            st, b = req("DELETE", f"/api/v1/xbk/data/selections/{sid}", token=token)
            if st != 200:
                raise RuntimeError(f"delete selection failed status={st} body={b[:200]!r}")

    status1, body1 = req(
        "POST",
        "/api/v1/xbk/data/selections",
        token=token,
        json_body={"year": year, "term": term, "student_no": s1, "name": s1, "course_code": course_code},
    )
    if status1 != 200:
        raise RuntimeError(f"expected 200, got {status1} body={body1[:200]!r} on first selection")

    status2, body2 = req(
        "POST",
        "/api/v1/xbk/data/selections",
        token=token,
        json_body={"year": year, "term": term, "student_no": s2, "name": s2, "course_code": course_code},
    )
    if status2 != 200:
        raise RuntimeError(f"expected 200, got {status2} body={body2[:200]!r}")

    print("xbk_verify_ok")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)
