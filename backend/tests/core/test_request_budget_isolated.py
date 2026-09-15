"""Small synthetic ASGI checks for OP-01; no DB, Redis, dotenv or network."""

import asyncio

from fastapi import FastAPI, File, Form, UploadFile
from httpx import ASGITransport, AsyncClient

from app.core.request_budget import (
    FALLBACK_FORM_BUDGET,
    GAME_UPLOAD_BUDGET,
    LOGIN_FORM_BUDGET,
    STANDARD_IMPORT_BUDGET,
    TYPST_ASSET_BUDGET,
    RequestBudget,
    RequestBudgetMiddleware,
    RouteBudget,
    select_request_budget,
)


def _app(*, route_budgets=None, header_bytes=32 * 1024):
    app = FastAPI()
    parsed = {"calls": 0}

    @app.post("/api/v1/auth/login")
    async def login(username: str = Form(...), password: str = Form(...)):
        parsed["calls"] += 1
        return {"username": username, "password_length": len(password)}

    @app.post("/api/v1/admin/it/games")
    async def game(title: str = Form(...), file: UploadFile = File(...)):
        parsed["calls"] += 1
        return {"title": title, "size": len(await file.read())}

    kwargs = {"max_header_bytes": header_bytes}
    if route_budgets is not None:
        kwargs["route_budgets"] = route_budgets
    app.add_middleware(RequestBudgetMiddleware, **kwargs)
    return app, parsed


def test_route_selection_preserves_500_mib_game_contract():
    login_scope = {
        "type": "http", "method": "POST", "path": "/api/v1/auth/login",
        "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
    }
    game_scope = {
        "type": "http", "method": "POST", "path": "/api/v1/admin/it/games",
        "headers": [(b"content-type", b"multipart/form-data; boundary=x")],
    }
    assert select_request_budget(login_scope) == LOGIN_FORM_BUDGET
    assert select_request_budget(game_scope) == GAME_UPLOAD_BUDGET
    assert GAME_UPLOAD_BUDGET.max_body_bytes > 500 * 1024 * 1024


def test_all_current_form_routes_have_explicit_or_safe_fallback_budgets():
    def scope(path, content_type="multipart/form-data; boundary=x"):
        return {
            "type": "http", "method": "POST", "path": path,
            "headers": [(b"content-type", content_type.encode("ascii"))],
        }

    assert select_request_budget(scope("/api/v1/users/import")) == STANDARD_IMPORT_BUDGET
    assert select_request_budget(scope("/api/v1/xbk/import")) == STANDARD_IMPORT_BUDGET
    assert select_request_budget(scope("/api/v1/xbk/import/preview")) == STANDARD_IMPORT_BUDGET
    assert select_request_budget(
        scope("/api/v1/informatics/typst-notes/17/assets")
    ) == TYPST_ASSET_BUDGET
    assert select_request_budget(scope("/api/v1/future/form")) == FALLBACK_FORM_BUDGET
    assert select_request_budget(scope("/api/v1/json", "application/json")) is None


def test_content_length_is_rejected_before_form_parser_runs():
    async def run():
        app, parsed = _app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://isolated.invalid") as client:
            response = await client.post(
                "/api/v1/auth/login",
                headers={
                    "content-type": "application/x-www-form-urlencoded",
                    "content-length": str(LOGIN_FORM_BUDGET.max_body_bytes + 1),
                },
                content=b"username=a&password=b",
            )
        assert response.status_code == 413
        assert parsed["calls"] == 0
    asyncio.run(run())


def test_chunked_body_is_counted_before_form_parser_completes():
    tiny = RequestBudget("tiny-login", 24, 1.0)
    routes = (RouteBudget(tiny, frozenset({"POST"}), exact_path="/api/v1/auth/login"),)

    async def chunks():
        yield b"username=synthetic"
        yield b"&password=too-long-for-budget"

    async def run():
        app, parsed = _app(route_budgets=routes)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://isolated.invalid") as client:
            response = await client.post(
                "/api/v1/auth/login",
                headers={"content-type": "application/x-www-form-urlencoded"},
                content=chunks(),
            )
        assert response.status_code == 413
        assert parsed["calls"] == 0
    asyncio.run(run())


def test_valid_urlencoded_and_multipart_forms_still_parse():
    async def run():
        app, parsed = _app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://isolated.invalid") as client:
            login = await client.post(
                "/api/v1/auth/login",
                data={"username": "student+测试", "password": "p;a&ss=word"},
            )
            game = await client.post(
                "/api/v1/admin/it/games",
                data={"title": "small synthetic"},
                files={"file": ("game.zip", b"PK\x03\x04synthetic", "application/zip")},
            )
        assert login.status_code == 200, login.text
        assert login.json() == {"username": "student+测试", "password_length": 11}
        assert game.status_code == 200, game.text
        assert game.json()["size"] == len(b"PK\x03\x04synthetic")
        assert parsed["calls"] == 2
    asyncio.run(run())


def test_header_budget_rejects_before_endpoint():
    async def run():
        app, parsed = _app(header_bytes=64)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://isolated.invalid") as client:
            response = await client.post(
                "/api/v1/auth/login",
                data={"username": "a", "password": "b"},
                headers={"x-large-synthetic": "x" * 80},
            )
        assert response.status_code == 431
        assert parsed["calls"] == 0
    asyncio.run(run())


def test_receive_idle_timeout_only_bounds_network_wait():
    tiny = RequestBudget("idle", 1024, 0.01)
    routes = (RouteBudget(tiny, frozenset({"POST"}), exact_path="/api/v1/auth/login"),)

    async def delayed():
        await asyncio.sleep(0.05)
        yield b"username=a&password=b"

    async def run():
        app, parsed = _app(route_budgets=routes)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://isolated.invalid") as client:
            response = await client.post(
                "/api/v1/auth/login",
                headers={"content-type": "application/x-www-form-urlencoded"},
                content=delayed(),
            )
        assert response.status_code == 408
        assert parsed["calls"] == 0
    asyncio.run(run())
