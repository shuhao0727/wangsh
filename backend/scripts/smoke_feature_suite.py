import os
import time
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class Env:
    base_url: str
    admin_username: str
    admin_password: str


def env() -> Env:
    return Env(
        base_url=os.environ.get("BASE_URL", "http://localhost:6608/api/v1").rstrip("/"),
        admin_username=os.environ.get("ADMIN_USERNAME", "admin"),
        admin_password=os.environ.get("ADMIN_PASSWORD", ""),
    )


def ok(msg: str):
    print(f"[OK] {msg}", flush=True)


def login(client: httpx.Client, url: str, username: str, password: str) -> str:
    r = client.post(
        f"{url}/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    r.raise_for_status()
    token = r.json().get("access_token")
    if not token:
        raise RuntimeError("login response missing access_token")
    ok("login")
    return token


def users_crud(client: httpx.Client, url: str):
    payload = {"full_name": f"smoke-user-{int(time.time())}", "role_code": "student", "is_active": True}
    r = client.post(f"{url}/users/", json=payload, timeout=30)
    r.raise_for_status()
    u = r.json()
    user_id = u.get("id")
    if not user_id:
        raise RuntimeError(f"user id missing: {u}")
    ok(f"users create id={user_id}")

    r = client.get(f"{url}/users/{user_id}", timeout=30)
    r.raise_for_status()
    ok("users get")

    r = client.get(f"{url}/users/", timeout=30)
    r.raise_for_status()
    ok("users list")

    r = client.put(f"{url}/users/{user_id}", json={"full_name": f"{payload['full_name']}-2"}, timeout=30)
    r.raise_for_status()
    ok("users update")

    r = client.delete(f"{url}/users/{user_id}", timeout=30)
    r.raise_for_status()
    ok("users delete")


def categories_crud(client: httpx.Client, url: str):
    slug = f"smoke-{int(time.time())}"
    payload = {"name": f"Smoke {slug}", "slug": slug, "description": "smoke"}
    r = client.post(f"{url}/categories", json=payload, timeout=30)
    r.raise_for_status()
    c = r.json()
    category_id = c.get("id")
    if not category_id:
        raise RuntimeError(f"category id missing: {c}")
    ok(f"categories create id={category_id}")

    r = client.get(f"{url}/categories/{category_id}", timeout=30)
    r.raise_for_status()
    ok("categories get")

    r = client.get(f"{url}/categories", timeout=30)
    r.raise_for_status()
    ok("categories list")

    r = client.put(f"{url}/categories/{category_id}", json={"description": "smoke-2"}, timeout=30)
    r.raise_for_status()
    ok("categories update")

    r = client.delete(f"{url}/categories/{category_id}", timeout=30)
    r.raise_for_status()
    ok("categories delete")


def xbk_smoke(client: httpx.Client, url: str):
    r = client.get(f"{url}/xbk/public-config", timeout=30)
    r.raise_for_status()
    ok("xbk public-config get")

    year = 2026
    term = "1"
    student_no = f"S{int(time.time())}"
    course_code = f"C{int(time.time())}"

    r = client.post(
        f"{url}/xbk/data/students",
        json={"year": year, "term": term, "class_name": "smoke", "student_no": student_no, "name": "smoke"},
        timeout=30,
    )
    r.raise_for_status()
    student_id = r.json().get("id")
    if not student_id:
        raise RuntimeError(f"xbk student id missing: {r.text}")
    ok(f"xbk student create id={student_id}")

    r = client.post(
        f"{url}/xbk/data/courses",
        json={"year": year, "term": term, "course_code": course_code, "course_name": "smoke", "quota": 1},
        timeout=30,
    )
    r.raise_for_status()
    course_id = r.json().get("id")
    if not course_id:
        raise RuntimeError(f"xbk course id missing: {r.text}")
    ok(f"xbk course create id={course_id}")

    r = client.post(
        f"{url}/xbk/data/selections",
        json={"year": year, "term": term, "student_no": student_no, "course_code": course_code},
        timeout=30,
    )
    r.raise_for_status()
    selection_id = r.json().get("id")
    if not selection_id:
        raise RuntimeError(f"xbk selection id missing: {r.text}")
    ok(f"xbk selection create id={selection_id}")

    r = client.get(f"{url}/xbk/data/meta", timeout=30)
    r.raise_for_status()
    ok("xbk meta")

    r = client.get(f"{url}/xbk/analysis/summary?year={year}&term={term}", timeout=30)
    r.raise_for_status()
    ok("xbk analysis summary")

    r = client.delete(f"{url}/xbk/data/selections/{selection_id}", timeout=30)
    r.raise_for_status()
    ok("xbk selection delete")

    r = client.delete(f"{url}/xbk/data/courses/{course_id}", timeout=30)
    r.raise_for_status()
    ok("xbk course delete")

    r = client.delete(f"{url}/xbk/data/students/{student_id}", timeout=30)
    r.raise_for_status()
    ok("xbk student delete")


def ai_agents_crud(client: httpx.Client, url: str):
    payload = {"name": f"smoke-agent-{int(time.time())}", "agent_type": "openai", "is_active": True}
    r = client.post(f"{url}/ai-agents/", json=payload, timeout=30)
    r.raise_for_status()
    a = r.json()
    agent_id = a.get("id")
    if not agent_id:
        raise RuntimeError(f"ai-agent id missing: {a}")
    ok(f"ai-agents create id={agent_id}")

    r = client.get(f"{url}/ai-agents/{agent_id}", timeout=30)
    r.raise_for_status()
    ok("ai-agents get")

    r = client.get(f"{url}/ai-agents/", timeout=30)
    r.raise_for_status()
    ok("ai-agents list")

    r = client.put(f"{url}/ai-agents/{agent_id}", json={"is_active": False}, timeout=30)
    r.raise_for_status()
    ok("ai-agents update")

    r = client.delete(f"{url}/ai-agents/{agent_id}", timeout=30)
    r.raise_for_status()
    ok("ai-agents delete")


def main() -> int:
    e = env()
    if not e.admin_password:
        raise SystemExit("missing ADMIN_PASSWORD")

    with httpx.Client(follow_redirects=True) as client:
        token = login(client, e.base_url, e.admin_username, e.admin_password)
        client.headers.update({"Authorization": f"Bearer {token}"})

        users_crud(client, e.base_url)
        categories_crud(client, e.base_url)
        xbk_smoke(client, e.base_url)
        ai_agents_crud(client, e.base_url)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
