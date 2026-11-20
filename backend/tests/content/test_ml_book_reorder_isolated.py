"""Exercise the ML book routes with real immediate UNIQUE checks in SQLite."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.ml.book import router
from app.core.deps import get_current_user
from app.db import database
from app.models.ml.book import MLBook, MLBookChapter

ADMIN_BOOK = "/admin/ml/book/ml"


@asynccontextmanager
async def book_client(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    monkeypatch.setattr(database, "AsyncSessionLocal", sessions)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "role_code": "admin"}
    try:
        async with engine.begin() as connection:
            await connection.run_sync(database.Base.metadata.create_all, tables=[
                MLBook.__table__, MLBookChapter.__table__,
            ])
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://isolated.invalid"
        ) as client:
            assert (await client.put(ADMIN_BOOK, json={"title": "合成学习书"})).status_code == 200
            for number, slug in enumerate(("first", "second", "third"), start=1):
                created = await client.put(f"{ADMIN_BOOK}/chapters/{slug}", json={
                    "slug": slug, "title": slug, "chapter_number": number, "sort_order": number,
                })
                assert created.status_code == 200, created.text
            yield client
    finally:
        await engine.dispose()


async def current_order(client, path):
    response = await client.get(path)
    assert response.status_code == 200, response.text
    return [
        (chapter["slug"], chapter["chapter_number"], chapter["sort_order"])
        for chapter in response.json()["book"]["chapters"]
    ]


def test_reorder_swaps_two_occupied_numbers_and_persists_the_order(monkeypatch):
    async def scenario():
        async with book_client(monkeypatch) as client:
            response = await client.patch(f"{ADMIN_BOOK}/chapters/reorder", json={"items": [
                {"slug": "second", "chapter_number": 1}, {"slug": "first", "chapter_number": 2},
            ]})
            assert response.status_code == 200, response.text
            expected = [("second", 1, 1), ("first", 2, 2), ("third", 3, 3)]
            assert await current_order(client, ADMIN_BOOK) == expected
            assert await current_order(client, "/ml/book/ml") == expected

    asyncio.run(scenario())


def test_reorder_rejects_a_number_held_by_an_untouched_chapter(monkeypatch):
    async def scenario():
        async with book_client(monkeypatch) as client:
            response = await client.patch(f"{ADMIN_BOOK}/chapters/reorder", json={"items": [
                {"slug": "first", "chapter_number": 4}, {"slug": "second", "chapter_number": 3},
            ]})
            assert response.status_code == 409, response.text
            assert await current_order(client, ADMIN_BOOK) == [
                ("first", 1, 1), ("second", 2, 2), ("third", 3, 3),
            ]

    asyncio.run(scenario())
