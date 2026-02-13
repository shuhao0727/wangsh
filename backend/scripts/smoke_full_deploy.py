import os
import time
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class Env:
    base_url: str
    admin_username: str
    admin_password: str
    openrouter_api_key: str | None
    openrouter_api_url: str


def env() -> Env:
    return Env(
        base_url=os.environ.get("BASE_URL", "http://localhost:6608/api/v1").rstrip("/"),
        admin_username=os.environ.get("ADMIN_USERNAME", "admin"),
        admin_password=os.environ.get("ADMIN_PASSWORD", ""),
        openrouter_api_key=os.environ.get("OPENROUTER_API_KEY") or None,
        openrouter_api_url=os.environ.get("OPENROUTER_API_URL", "https://openrouter.ai"),
    )


def ok(msg: str):
    print(f"[OK] {msg}", flush=True)


def wait_health(client: httpx.Client, url: str, timeout_s: int = 60):
    deadline = time.time() + timeout_s
    last_err: Exception | None = None
    while time.time() < deadline:
        try:
            r = client.get(f"{url}/health", timeout=10)
            r.raise_for_status()
            ok("health")
            return
        except Exception as e:
            last_err = e
            time.sleep(1)
    raise RuntimeError(f"health check failed: {last_err}")


def login(client: httpx.Client, url: str, username: str, password: str):
    r = client.post(
        f"{url}/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    r.raise_for_status()
    ok("login")
    return r.json()


def me(client: httpx.Client, url: str):
    r = client.get(f"{url}/auth/me", timeout=20)
    r.raise_for_status()
    ok("auth/me")
    return r.json()


def verify_refresh(client: httpx.Client, url: str):
    r = client.post(f"{url}/auth/refresh", json={}, timeout=20)
    r.raise_for_status()
    ok("auth/refresh")
    return r.json()


def typst_note_smoke(client: httpx.Client, url: str):
    payload = {"title": "smoke-typst", "content_typst": "= Smoke\nHello"}
    r = client.post(f"{url}/informatics/typst-notes", json=payload, timeout=30)
    r.raise_for_status()
    note = r.json()
    note_id = note.get("id")
    if not note_id:
        raise RuntimeError(f"typst note id missing: {note}")
    ok(f"create typst-note id={note_id}")

    r = client.get(f"{url}/informatics/typst-notes/{note_id}", timeout=30)
    r.raise_for_status()
    ok("get typst-note")

    r = client.post(f"{url}/informatics/typst-notes/{note_id}/compile-async", timeout=30)
    if r.status_code == 400:
        ok("compile-async disabled (skip)")
    else:
        r.raise_for_status()
        ok("compile-async submit")

    r = client.delete(f"{url}/informatics/typst-notes/{note_id}", timeout=30)
    r.raise_for_status()
    ok("delete typst-note")


def articles_smoke(client: httpx.Client, url: str, author_id: int):
    slug = f"smoke-{int(time.time())}"
    payload = {
        "title": "smoke-article",
        "slug": slug,
        "content": "# Smoke\nhello",
        "summary": "smoke",
        "published": False,
        "author_id": author_id,
        "category_id": None,
    }
    r = client.post(f"{url}/articles", json=payload, timeout=30)
    r.raise_for_status()
    a = r.json()
    article_id = a.get("id")
    if not article_id:
        raise RuntimeError(f"article id missing: {a}")
    ok(f"create article id={article_id}")

    r = client.get(f"{url}/articles/{article_id}", timeout=30)
    r.raise_for_status()
    ok("get article")

    r = client.put(f"{url}/articles/{article_id}", json={"title": "smoke-article-2"}, timeout=30)
    r.raise_for_status()
    ok("update article")

    r = client.delete(f"{url}/articles/{article_id}", timeout=30)
    r.raise_for_status()
    ok("delete article")


def agents_smoke(client: httpx.Client, url: str, openrouter_api_url: str, openrouter_api_key: str | None):
    r = client.get(f"{url}/model-discovery/supported-providers", timeout=30)
    r.raise_for_status()
    ok("model-discovery/supported-providers")

    r = client.get(f"{url}/model-discovery/preset-models", timeout=30)
    r.raise_for_status()
    ok("model-discovery/preset-models")

    if not openrouter_api_key:
        print("[SKIP] openrouter agent test (OPENROUTER_API_KEY not set)", flush=True)
        return

    discover_payload = {
        "api_endpoint": openrouter_api_url,
        "api_key": openrouter_api_key,
        "provider": "openrouter",
        "model_filter": {"limit": 5},
    }
    r = client.post(f"{url}/model-discovery/discover", json=discover_payload, timeout=60)
    r.raise_for_status()
    ok("model-discovery/discover(openrouter)")

    models = r.json().get("models") or []
    if not models:
        raise RuntimeError("openrouter discover returned 0 models")
    model_name = models[0].get("id") or models[0].get("name")
    if not model_name:
        raise RuntimeError(f"unexpected model item: {models[0]}")

    agent_payload = {
        "name": "smoke-agent",
        "description": "smoke",
        "provider": "openrouter",
        "model": model_name,
        "api_endpoint": openrouter_api_url,
        "api_key": openrouter_api_key,
        "temperature": 0.2,
        "max_tokens": 256,
        "is_active": True,
    }
    r = client.post(f"{url}/ai-agents", json=agent_payload, timeout=60)
    r.raise_for_status()
    agent = r.json()
    agent_id = agent.get("id") or agent.get("data", {}).get("id")
    if not agent_id:
        raise RuntimeError(f"agent id missing: {agent}")
    ok(f"create ai-agent id={agent_id}")

    test_payload = {"agent_id": agent_id, "message": "Say 'ok' and nothing else."}
    r = client.post(f"{url}/ai-agents/test", json=test_payload, timeout=120)
    r.raise_for_status()
    ok("ai-agents/test")

    r = client.delete(f"{url}/ai-agents/{agent_id}", timeout=60)
    r.raise_for_status()
    ok("delete ai-agent")


def main():
    e = env()
    if not e.admin_password:
        raise SystemExit("missing ADMIN_PASSWORD")

    with httpx.Client(follow_redirects=True) as client:
        wait_health(client, e.base_url)
        token_payload = login(client, e.base_url, e.admin_username, e.admin_password)
        access_token = token_payload.get("access_token")
        if not access_token:
            raise RuntimeError("login response missing access_token")
        client.headers.update({"Authorization": f"Bearer {access_token}"})

        me_payload = me(client, e.base_url)
        user_id = int(me_payload.get("id") or 0)
        if user_id <= 0:
            raise RuntimeError(f"auth/me missing user id: {me_payload}")
        verify_refresh(client, e.base_url)
        typst_note_smoke(client, e.base_url)
        articles_smoke(client, e.base_url, user_id)
        agents_smoke(client, e.base_url, e.openrouter_api_url, e.openrouter_api_key)


if __name__ == "__main__":
    main()
