"""Informatics 笔记 CRUD 测试"""
import asyncio
from types import SimpleNamespace

from app.services.informatics import typst_notes


def test_update_note_facade_applies_fields_cache_and_transaction_contract():
    class DB:
        def __init__(self):
            self.commits = 0
            self.refreshed = []

        async def commit(self):
            self.commits += 1

        async def refresh(self, note):
            self.refreshed.append(note)

    compiled_at = object()
    note = SimpleNamespace(
        title="Old",
        summary="",
        category_path="",
        published=False,
        published_at=None,
        style_key="default",
        entry_path="main.typ",
        files={"main.typ": "OLD"},
        toc=[],
        content_typst="OLD",
        compiled_hash="old-hash",
        compiled_pdf_path="old.pdf",
        compiled_pdf_size=7,
        compiled_pdf=b"OLD_PDF",
        compiled_at=compiled_at,
    )
    db = DB()

    result = asyncio.run(
        typst_notes.update_note(
            db,
            note,
            title="New",
            summary="Summary",
            category_path="algorithms",
            published=True,
            files={"main.typ": "NEW"},
            toc=[{"title": "New"}],
        )
    )

    assert result is note
    assert note.title == "New"
    assert note.summary == "Summary"
    assert note.category_path == "algorithms"
    assert note.published is True
    assert note.published_at is not None
    assert note.content_typst == "NEW"
    assert note.toc == [{"title": "New"}]
    assert note.compiled_hash is None
    assert note.compiled_pdf_path is None
    assert note.compiled_pdf_size is None
    assert note.compiled_pdf is None
    assert note.compiled_at is None
    assert db.commits == 1
    assert db.refreshed == [note]
