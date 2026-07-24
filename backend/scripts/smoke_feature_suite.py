import os
import sys
import time
from dataclasses import dataclass

import httpx

try:
    from scripts._smoke_feature_learning import (
        learning_chapter_smoke,
        learning_content_smoke,
        learning_progress_smoke,
        mindmap_smoke,
        ml_book_smoke,
    )
except ModuleNotFoundError:
    from _smoke_feature_learning import (
        learning_chapter_smoke,
        learning_content_smoke,
        learning_progress_smoke,
        mindmap_smoke,
        ml_book_smoke,
    )


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


def warn(msg: str):
    print(f"[WARN] {msg}", flush=True)


def cleanup_delete(client: httpx.Client, url: str, label: str) -> str | None:
    try:
        r = client.delete(url, timeout=30)
        r.raise_for_status()
        ok(f"cleanup {label}")
        return None
    except Exception as exc:
        return f"{label}: {type(exc).__name__}: {exc}"


def finish_cleanup(errors: list[str], *, primary_failed: bool) -> None:
    if not errors:
        return
    for error in errors:
        warn(f"cleanup failed: {error}")
    if not primary_failed:
        raise RuntimeError("smoke cleanup failed: " + "; ".join(errors))


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
    user_id: int | None = None
    try:
        r = client.post(f"{url}/users/", json=payload, timeout=30)
        r.raise_for_status()
        u = r.json()
        user_id = int(u.get("id") or 0)
        if user_id <= 0:
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
    finally:
        primary_failed = sys.exc_info()[0] is not None
        errors = []
        if user_id is not None:
            error = cleanup_delete(client, f"{url}/users/{user_id}", "user")
            if error:
                errors.append(error)
        finish_cleanup(errors, primary_failed=primary_failed)


def categories_crud(client: httpx.Client, url: str):
    slug = f"smoke-{int(time.time())}"
    payload = {"name": f"Smoke {slug}", "slug": slug, "description": "smoke"}
    category_id: int | None = None
    try:
        r = client.post(f"{url}/categories", json=payload, timeout=30)
        r.raise_for_status()
        c = r.json()
        category_id = int(c.get("id") or 0)
        if category_id <= 0:
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
    finally:
        primary_failed = sys.exc_info()[0] is not None
        errors = []
        if category_id is not None:
            error = cleanup_delete(client, f"{url}/categories/{category_id}", "category")
            if error:
                errors.append(error)
        finish_cleanup(errors, primary_failed=primary_failed)


def xbk_smoke(client: httpx.Client, url: str):
    r = client.get(f"{url}/xbk/public-config", timeout=30)
    r.raise_for_status()
    ok("xbk public-config get")

    year = 2026
    term = "1"
    student_no = f"S{int(time.time())}"
    course_code = f"C{int(time.time())}"

    student_id: int | None = None
    course_id: int | None = None
    selection_id: int | None = None
    try:
        r = client.post(
            f"{url}/xbk/data/students",
            json={"year": year, "term": term, "class_name": "smoke", "student_no": student_no, "name": "smoke"},
            timeout=30,
        )
        r.raise_for_status()
        student_id = int(r.json().get("id") or 0)
        if student_id <= 0:
            raise RuntimeError(f"xbk student id missing: {r.text}")
        ok(f"xbk student create id={student_id}")

        r = client.post(
            f"{url}/xbk/data/courses",
            json={"year": year, "term": term, "course_code": course_code, "course_name": "smoke", "quota": 1},
            timeout=30,
        )
        r.raise_for_status()
        course_id = int(r.json().get("id") or 0)
        if course_id <= 0:
            raise RuntimeError(f"xbk course id missing: {r.text}")
        ok(f"xbk course create id={course_id}")

        r = client.post(
            f"{url}/xbk/data/selections",
            json={"year": year, "term": term, "student_no": student_no, "course_code": course_code},
            timeout=30,
        )
        r.raise_for_status()
        selection_id = int(r.json().get("id") or 0)
        if selection_id <= 0:
            raise RuntimeError(f"xbk selection id missing: {r.text}")
        ok(f"xbk selection create id={selection_id}")

        r = client.get(f"{url}/xbk/data/meta", timeout=30)
        r.raise_for_status()
        ok("xbk meta")

        r = client.get(f"{url}/xbk/analysis/summary?year={year}&term={term}", timeout=30)
        r.raise_for_status()
        ok("xbk analysis summary")
    finally:
        primary_failed = sys.exc_info()[0] is not None
        errors = []
        for item_id, path, label in (
            (selection_id, "selections", "xbk selection"),
            (course_id, "courses", "xbk course"),
            (student_id, "students", "xbk student"),
        ):
            if item_id is None:
                continue
            error = cleanup_delete(client, f"{url}/xbk/data/{path}/{item_id}", label)
            if error:
                errors.append(error)
        finish_cleanup(errors, primary_failed=primary_failed)


def ai_agents_crud(client: httpx.Client, url: str):
    payload = {"name": f"smoke-agent-{int(time.time())}", "agent_type": "openai", "is_active": True}
    agent_id: int | None = None
    try:
        r = client.post(f"{url}/ai-agents/", json=payload, timeout=30)
        r.raise_for_status()
        a = r.json()
        agent_id = int(a.get("id") or 0)
        if agent_id <= 0:
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
    finally:
        primary_failed = sys.exc_info()[0] is not None
        errors = []
        if agent_id is not None:
            error = cleanup_delete(client, f"{url}/ai-agents/{agent_id}", "ai-agent")
            if error:
                errors.append(error)
        finish_cleanup(errors, primary_failed=primary_failed)


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
        learning_content_smoke(client, e.base_url)
        learning_chapter_smoke(client, e.base_url)
        learning_progress_smoke(client, e.base_url)
        mindmap_smoke(client, e.base_url)
        ml_book_smoke(client, e.base_url)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
