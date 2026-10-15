"""1D chapter canonical-source contract tests."""

import asyncio
import json
import pytest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.database import Base
from app.models.learning.chapter import LearningChapter
from app.models.learning.content import LearningContentItem
from app.services.learning.content_service import list_learning_content, list_learning_content_admin
from app.api.endpoints.learning.chapters import get_chapter, upsert_chapter


@pytest.mark.parametrize("module", ["ml", "ai", "agents"])
def test_public_content_overlays_persisted_chapters_on_raw_book(module):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(
                lambda sync_connection: Base.metadata.create_all(
                    sync_connection,
                    tables=[LearningContentItem.__table__, LearningChapter.__table__],
                )
            )
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            db.add(
                LearningContentItem(
                    module_key=module,
                    section_key="raw",
                    item_key="book",
                    title="Synthetic raw book",
                    content=json.dumps(
                        {
                            "book": {
                                "title": "Synthetic book",
                                "chapters": [
                                    {
                                        "slug": "chapter-a",
                                        "title": "Old title",
                                        "summary": "Old summary",
                                        "markdown": "RAW-OLD",
                                        "goals": ["keep bundled metadata"],
                                    },
                                    {
                                        "slug": "chapter-b",
                                        "title": "Bundled B",
                                        "markdown": "RAW-B",
                                    },
                                ],
                            }
                        },
                        ensure_ascii=False,
                    ),
                    tags="[]",
                    enabled=True,
                    owner_id=None,
                    sort_order=0,
                    source_type="admin",
                )
            )
            db.add(
                LearningChapter(
                    module_key=module,
                    slug="chapter-a",
                    title="Saved title",
                    summary="Saved summary",
                    estimated_minutes=12,
                    difficulty="intermediate",
                    group_name="Saved group",
                    markdown="SYS-NEW",
                    sort_order=0,
                )
            )
            db.add(
                LearningChapter(
                    module_key=module,
                    slug="chapter-c",
                    title="New persisted chapter",
                    summary="New summary",
                    estimated_minutes=8,
                    difficulty="beginner",
                    markdown="SYS-C",
                    sort_order=2,
                )
            )
            await db.commit()

            rows = await list_learning_content(db, module)
            admin_rows = await list_learning_content_admin(db, module)
            assert admin_rows[0]["content"] == rows[0]["content"]

        await engine.dispose()
        book = rows[0]["content"]["book"]
        assert [chapter["slug"] for chapter in book["chapters"]] == [
            "chapter-a",
            "chapter-b",
            "chapter-c",
        ]
        assert book["chapters"][0]["markdown"] == "SYS-NEW"
        assert book["chapters"][0]["title"] == "Saved title"
        assert book["chapters"][0]["estimatedMinutes"] == 12
        assert book["chapters"][0]["group"] == "Saved group"
        assert book["chapters"][0]["goals"] == ["keep bundled metadata"]
        assert book["chapters"][1]["markdown"] == "RAW-B"
        assert book["chapters"][2]["markdown"] == "SYS-C"

    asyncio.run(scenario())


@pytest.mark.parametrize("module", ["ml", "ai", "agents"])
def test_chapter_save_read_back_uses_committed_source_and_preserves_sort(module):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                await connection.run_sync(lambda c: Base.metadata.create_all(
                    c, tables=[LearningContentItem.__table__, LearningChapter.__table__],
                ))
            factory = async_sessionmaker(engine, expire_on_commit=False)
            async with factory() as db:
                db.add(LearningContentItem(
                    module_key=module, section_key="raw", item_key="book", title="Fixture",
                    content=json.dumps({"book": {"chapters": [
                        {"slug": "a", "title": "Raw A", "markdown": "OLD-A"},
                        {"slug": "b", "title": "Raw B", "markdown": "RAW-B"},
                    ]}}), tags="[]", enabled=True, sort_order=0, source_type="admin",
                ))
                await db.commit()
                await upsert_chapter(module, "a", {
                    "title": "Saved A", "markdown": "SAVED-A", "sort_order": 2,
                }, db=db, current_user=None)
            async with factory() as db:
                saved = await get_chapter(module, "a", db=db, current_user=None)
                public = await list_learning_content(db, module)
                assert saved["markdown"] == "SAVED-A"
                assert saved["sort_order"] == 2
                assert [c["slug"] for c in public[0]["content"]["book"]["chapters"]] == ["b", "a"]
                assert public[0]["content"]["book"]["chapters"][1]["markdown"] == "SAVED-A"
        finally:
            await engine.dispose()
    asyncio.run(scenario())


def test_public_content_keeps_non_book_items_and_raw_fallback_unchanged():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(
                lambda sync_connection: Base.metadata.create_all(
                    sync_connection,
                    tables=[LearningContentItem.__table__, LearningChapter.__table__],
                )
            )
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            db.add(
                LearningContentItem(
                    module_key="ml",
                    section_key="resources",
                    item_key="links",
                    title="Resources",
                    content=json.dumps({"items": ["raw"]}),
                    tags="[]",
                    enabled=True,
                    owner_id=None,
                    sort_order=1,
                    source_type="admin",
                )
            )
            db.add(
                LearningChapter(
                    module_key="ml",
                    slug="chapter-a",
                    title="Saved",
                    markdown="SYS-ONLY",
                    sort_order=0,
                )
            )
            await db.commit()
            rows = await list_learning_content(db, "ml")
        await engine.dispose()
        assert rows[0]["content"] == {"items": ["raw"]}

    asyncio.run(scenario())
