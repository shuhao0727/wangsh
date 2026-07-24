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


def test_delete_note_soft_deletes_and_removes_derived_resources(monkeypatch, tmp_path):
    class DB:
        def __init__(self):
            self.executed = []
            self.commits = 0
            self.rollbacks = 0

        async def execute(self, statement):
            self.executed.append(str(statement))

        async def commit(self):
            self.commits += 1

        async def rollback(self):
            self.rollbacks += 1

        async def refresh(self, _note):
            pass

    monkeypatch.setattr(typst_notes.settings, "TYPST_PDF_STORAGE_DIR", str(tmp_path))
    pdf_path = tmp_path / "smoke.pdf"
    pdf_path.write_bytes(b"%PDF-smoke")
    note = SimpleNamespace(
        id=17,
        is_deleted=False,
        compiled_hash="hash",
        compiled_pdf_path="smoke.pdf",
        compiled_pdf_size=10,
        compiled_pdf=b"%PDF-smoke",
        compiled_at=object(),
    )
    db = DB()

    asyncio.run(typst_notes.delete_note(db, note))

    assert note.is_deleted is True
    assert note.compiled_hash is None
    assert note.compiled_pdf_path is None
    assert note.compiled_pdf_size is None
    assert note.compiled_pdf is None
    assert note.compiled_at is None
    assert any("DELETE FROM inf_typst_assets" in statement for statement in db.executed)
    assert db.commits == 1
    assert db.rollbacks == 0
    assert not pdf_path.exists()


def test_compile_note_pdf_rejects_deleted_note_before_compilation():
    class Result:
        def scalar_one_or_none(self):
            return None

    class DB:
        async def execute(self, _statement):
            return Result()

    note = SimpleNamespace(id=23)

    try:
        asyncio.run(typst_notes.compile_note_pdf(DB(), note))
    except typst_notes.TypstNoteDeletedError as exc:
        assert "笔记已删除" in str(exc)
    else:
        raise AssertionError("deleted note should not compile")
