import asyncio
import inspect
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.params import Depends
from fastapi.testclient import TestClient
from starlette.requests import Request

import app.core.deps as deps
from app.api.endpoints.it import games as games_api
from app.db.database import get_db


def _assert_depends_on(func, parameter_name, dependency):
    default = inspect.signature(func).parameters[parameter_name].default
    assert isinstance(default, Depends)
    assert default.dependency is dependency


def _authenticated_app():
    app = FastAPI()
    app.include_router(games_api.router)
    app.include_router(games_api.admin_router)

    async def fake_db():
        return object()

    async def fake_user():
        return {"id": 3, "role_code": "student"}

    async def fake_admin():
        return {"id": 1, "role_code": "admin"}

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[deps.get_current_user] = fake_user
    app.dependency_overrides[deps.require_admin] = fake_admin
    return app


def test_download_requires_login_and_admin_routes_require_admin():
    _assert_depends_on(games_api.download_game, "user", deps.get_current_user)
    for func in (
        games_api.admin_list_games,
        games_api.admin_create_game,
        games_api.admin_update_game,
        games_api.admin_delete_game,
        games_api.admin_get_download_logs,
    ):
        _assert_depends_on(func, "admin", deps.require_admin)


def test_page_and_size_query_ranges_return_422(monkeypatch):
    app = FastAPI()
    app.include_router(games_api.router)
    app.include_router(games_api.admin_router)

    async def fake_db():
        return object()

    async def fake_admin():
        return {"id": 1, "role_code": "admin"}

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[deps.require_admin] = fake_admin
    monkeypatch.setattr(
        games_api.game_service,
        "list_games",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("validation must run first")),
    )
    monkeypatch.setattr(
        games_api.game_service,
        "get_download_logs",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("validation must run first")),
    )

    client = TestClient(app)
    assert client.get("/it/games?page=0").status_code == 422
    assert client.get("/it/games?size=101").status_code == 422
    assert client.get("/admin/it/games?page=0").status_code == 422
    assert client.get("/admin/it/games?size=101").status_code == 422
    assert client.get("/admin/it/games/1/logs?page=0").status_code == 422
    assert client.get("/admin/it/games/1/logs?size=201").status_code == 422


@pytest.mark.parametrize("category", ["", "   "])
def test_update_rejects_blank_category_before_calling_the_service(
    monkeypatch,
    category,
):
    app = _authenticated_app()

    async def fail_update(*_args, **_kwargs):
        raise AssertionError("request validation must reject a blank category")

    monkeypatch.setattr(games_api.game_service, "update_game", fail_update)

    response = TestClient(app, raise_server_exceptions=False).put(
        "/admin/it/games/7",
        json={"category": category},
    )

    assert response.status_code == 422


def test_download_survives_source_file_removal_after_it_starts(monkeypatch, tmp_path):
    stored = tmp_path / "7_game.zip"
    stored.write_bytes(b"game-content")
    game = SimpleNamespace(
        id=7,
        is_active=True,
        stored_path=str(stored),
        filename="game.zip",
        file_mime="application/zip",
    )

    async def fake_get_game(_db, _game_id):
        return game

    async def remove_then_record(*_args, **_kwargs):
        stored.unlink()
        return game

    monkeypatch.setattr(games_api.game_service, "get_game", fake_get_game)
    monkeypatch.setattr(
        games_api.game_service,
        "resolve_game_file_path",
        lambda _game: stored,
    )
    monkeypatch.setattr(
        games_api.game_service,
        "record_download",
        remove_then_record,
    )

    response = TestClient(
        _authenticated_app(),
        raise_server_exceptions=False,
    ).get("/it/games/7/download")

    assert response.status_code == 200
    assert response.content == b"game-content"


def test_download_records_the_forwarded_client_ip(monkeypatch, tmp_path):
    stored = tmp_path / "7_game.zip"
    stored.write_bytes(b"game-content")
    game = SimpleNamespace(
        id=7,
        is_active=True,
        stored_path=str(stored),
        filename="game.zip",
        file_mime="application/zip",
    )
    recorded = {}

    async def fake_get_game(_db, _game_id):
        return game

    async def capture_download(*_args, **kwargs):
        recorded.update(kwargs)
        return game

    monkeypatch.setattr(games_api.game_service, "get_game", fake_get_game)
    monkeypatch.setattr(
        games_api.game_service,
        "resolve_game_file_path",
        lambda _game: stored,
    )
    monkeypatch.setattr(
        games_api.game_service,
        "record_download",
        capture_download,
    )

    response = TestClient(_authenticated_app()).get(
        "/it/games/7/download",
        headers={"X-Forwarded-For": "203.0.113.9"},
    )

    assert response.status_code == 200
    assert recorded["ip_address"] == "203.0.113.9"


def test_download_does_not_log_when_file_path_is_missing(monkeypatch):
    game = SimpleNamespace(
        id=7,
        is_active=True,
        stored_path="7_missing.zip",
        filename="missing.zip",
        file_mime="application/zip",
    )

    async def fake_get_game(_db, _game_id):
        return game

    async def fail_record_download(*_args, **_kwargs):
        raise AssertionError("missing files must not create download logs")

    monkeypatch.setattr(games_api.game_service, "get_game", fake_get_game)
    monkeypatch.setattr(games_api.game_service, "resolve_game_file_path", lambda _game: None)
    monkeypatch.setattr(games_api.game_service, "record_download", fail_record_download)
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/it/games/7/download",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            games_api.download_game(
                game_id=7,
                request=request,
                db=object(),
                user={"id": 3, "role_code": "student"},
            )
        )

    assert exc_info.value.status_code == 404
    assert "文件" in exc_info.value.detail
