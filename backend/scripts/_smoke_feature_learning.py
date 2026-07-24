import sys
import uuid

import httpx


def _ok(msg: str) -> None:
    print(f"[OK] {msg}", flush=True)


def _warn(msg: str) -> None:
    print(f"[WARN] {msg}", flush=True)


def _cleanup_delete(client: httpx.Client, url: str, label: str) -> str | None:
    try:
        response = client.delete(url, timeout=30)
        response.raise_for_status()
        _ok(f"cleanup {label}")
        return None
    except Exception as exc:
        return f"{label}: {type(exc).__name__}: {exc}"


def _finish_cleanup(errors: list[str], *, primary_failed: bool) -> None:
    if not errors:
        return
    for error in errors:
        _warn(f"cleanup failed: {error}")
    if not primary_failed:
        raise RuntimeError("smoke cleanup failed: " + "; ".join(errors))


def learning_content_smoke(client: httpx.Client, url: str) -> None:
    response = client.get(f"{url}/learning/content/ml/admin", timeout=30)
    response.raise_for_status()
    items = [
        item
        for item in response.json()
        if item.get("section_key") != "mindmap"
    ]
    if not items:
        _warn("learning content restore smoke skipped: no stable content item")
        return

    original = items[0]
    section_key = str(original["section_key"])
    item_key = str(original["item_key"])
    endpoint = f"{url}/learning/content/ml/{section_key}/{item_key}"
    payload = {
        "section_key": section_key,
        "item_key": item_key,
        "title": original["title"],
        "summary": original.get("summary"),
        "content": original.get("content") or {},
        "tags": original.get("tags") or [],
        "difficulty": original.get("difficulty"),
        "sort_order": int(original.get("sort_order") or 0),
        "enabled": bool(original.get("enabled")),
        "source_type": original.get("source_type") or "admin",
    }
    primary_failed = False
    try:
        response = client.put(endpoint, json=payload, timeout=30)
        response.raise_for_status()
        _ok("learning content idempotent update")

        response = client.patch(
            f"{endpoint}/enabled",
            json={"enabled": not payload["enabled"]},
            timeout=30,
        )
        response.raise_for_status()
        _ok("learning content toggle")
    except Exception:
        primary_failed = True
        raise
    finally:
        try:
            response = client.put(endpoint, json=payload, timeout=30)
            response.raise_for_status()
            _ok("learning content restored")
        except Exception as exc:
            if primary_failed:
                _warn(
                    "learning content restore failed: "
                    f"{type(exc).__name__}: {exc}"
                )
            else:
                raise


def learning_chapter_smoke(client: httpx.Client, url: str) -> None:
    slug = f"smoke-{uuid.uuid4().hex[:10]}"
    endpoint = f"{url}/learning/chapters/ml/{slug}"
    created = False
    try:
        response = client.put(
            endpoint,
            json={
                "title": "Smoke learning chapter",
                "summary": "temporary smoke chapter",
                "estimated_minutes": 5,
                "difficulty": "beginner",
                "group_name": "smoke",
                "markdown": "# Smoke",
                "sort_order": 9999,
            },
            timeout=30,
        )
        response.raise_for_status()
        created = True
        _ok("learning chapter create")

        response = client.get(endpoint, timeout=30)
        response.raise_for_status()
        _ok("learning chapter get")
    finally:
        primary_failed = sys.exc_info()[0] is not None
        errors = []
        if created:
            error = _cleanup_delete(client, endpoint, "learning chapter")
            if error:
                errors.append(error)
        _finish_cleanup(errors, primary_failed=primary_failed)


def learning_progress_smoke(client: httpx.Client, url: str) -> None:
    endpoint = f"{url}/learning/progress/agents"
    existing_payload: dict | None = None
    response = client.get(endpoint, timeout=30)
    if response.status_code == 200:
        existing_payload = response.json().get("data") or {}
    elif response.status_code != 404:
        response.raise_for_status()

    primary_failed = False
    try:
        response = client.put(
            endpoint,
            json={
                "current_stage": "smoke-put",
                "completed_stages": ["smoke-1"],
                "notes": "temporary smoke progress",
                "completedItems": {"smoke": True},
            },
            timeout=30,
        )
        response.raise_for_status()
        _ok("learning progress put")

        response = client.post(
            endpoint,
            json={
                "current_stage": "smoke-post",
                "completed_stages": ["smoke-1", "smoke-2"],
                "notes": "temporary smoke progress updated",
            },
            timeout=30,
        )
        response.raise_for_status()
        _ok("learning progress post")

        response = client.get(f"{url}/learning/progress", timeout=30)
        response.raise_for_status()
        _ok("learning progress list")
    except Exception:
        primary_failed = True
        raise
    finally:
        try:
            if existing_payload is None:
                response = client.delete(endpoint, timeout=30)
                if response.status_code not in {200, 404}:
                    response.raise_for_status()
                _ok("learning progress cleanup")
            else:
                response = client.put(
                    endpoint,
                    json=existing_payload,
                    timeout=30,
                )
                response.raise_for_status()
                _ok("learning progress restored")
        except Exception as exc:
            if primary_failed:
                _warn(
                    "learning progress cleanup failed: "
                    f"{type(exc).__name__}: {exc}"
                )
            else:
                raise


def mindmap_smoke(client: httpx.Client, url: str) -> None:
    mindmap_id: int | None = None
    try:
        response = client.post(
            f"{url}/learning/mindmaps",
            json={
                "title": f"smoke-mindmap-{uuid.uuid4().hex[:8]}",
                "module_key": "ml",
                "content": {"root": {"text": "Smoke"}},
            },
            timeout=30,
        )
        response.raise_for_status()
        mindmap_id = int(response.json().get("id") or 0)
        if mindmap_id <= 0:
            raise RuntimeError(f"mindmap id missing: {response.text}")
        _ok(f"mindmap create id={mindmap_id}")

        response = client.put(
            f"{url}/learning/mindmaps/{mindmap_id}",
            json={
                "title": "smoke-mindmap-updated",
                "content": {"root": {"text": "Updated"}},
            },
            timeout=30,
        )
        response.raise_for_status()
        _ok("mindmap update")

        response = client.get(f"{url}/learning/mindmaps/my", timeout=30)
        response.raise_for_status()
        _ok("mindmap my list")

        for label in ("publish", "unpublish"):
            response = client.patch(
                f"{url}/learning/mindmaps/{mindmap_id}/publish",
                timeout=30,
            )
            response.raise_for_status()
            _ok(f"mindmap {label}")
    finally:
        primary_failed = sys.exc_info()[0] is not None
        errors = []
        if mindmap_id is not None:
            error = _cleanup_delete(
                client,
                f"{url}/learning/mindmaps/{mindmap_id}",
                "mindmap",
            )
            if error:
                errors.append(error)
        _finish_cleanup(errors, primary_failed=primary_failed)


def ml_book_smoke(client: httpx.Client, url: str) -> None:
    book_endpoint = f"{url}/admin/ml/book/ml"
    response = client.get(book_endpoint, timeout=30)
    response.raise_for_status()
    book = response.json().get("book")
    if not book:
        _warn("ml-book smoke skipped: no existing ml book to preserve")
        return

    response = client.put(
        book_endpoint,
        json={
            "title": book["title"],
            "subtitle": book.get("subtitle"),
            "description": book.get("description"),
            "audience": book.get("audience"),
            "outcomes": book.get("outcomes") or [],
            "enabled": bool(book.get("enabled")),
        },
        timeout=30,
    )
    response.raise_for_status()
    _ok("ml-book metadata idempotent update")

    slug = f"smoke-{uuid.uuid4().hex[:10]}"
    chapter_endpoint = f"{book_endpoint}/chapters/{slug}"
    created = False
    try:
        response = client.put(
            chapter_endpoint,
            json={
                "slug": slug,
                "chapter_number": 999,
                "title": "Smoke ML chapter",
                "summary": "temporary smoke chapter",
                "difficulty": "beginner",
                "estimated_minutes": 5,
                "markdown": "# Smoke",
                "goals": ["verify"],
                "checklist": [],
                "experiments": [],
                "glossary": [],
                "references": [],
                "prerequisites": [],
                "keywords": ["smoke"],
                "quiz": [],
                "sort_order": 999,
                "enabled": True,
            },
            timeout=30,
        )
        response.raise_for_status()
        created = True
        _ok("ml-book chapter create")

        response = client.get(chapter_endpoint, timeout=30)
        response.raise_for_status()
        _ok("ml-book chapter get")

        response = client.patch(
            chapter_endpoint + "/toggle",
            json={"enabled": False},
            timeout=30,
        )
        response.raise_for_status()
        _ok("ml-book chapter toggle")

        response = client.patch(
            book_endpoint + "/chapters/reorder",
            json={"items": [{"slug": slug, "chapter_number": 999}]},
            timeout=30,
        )
        response.raise_for_status()
        _ok("ml-book chapter reorder")

        response = client.get(f"{url}/ml/book/ml", timeout=30)
        response.raise_for_status()
        _ok("ml-book public get")
    finally:
        primary_failed = sys.exc_info()[0] is not None
        errors = []
        if created:
            error = _cleanup_delete(
                client,
                chapter_endpoint,
                "ml-book chapter",
            )
            if error:
                errors.append(error)
        _finish_cleanup(errors, primary_failed=primary_failed)
