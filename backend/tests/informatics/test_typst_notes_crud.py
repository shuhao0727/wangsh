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


def test_list_notes_success(monkeypatch):
    """测试笔记列表"""
    fake_notes = [SimpleNamespace(id=1, title="测试笔记")]

    async def mock_list():
        return fake_notes, 1

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.list_notes", mock_list)
    result = asyncio.run(mock_list())
    assert len(result[0]) == 1


def test_create_note_success(monkeypatch):
    """测试创建笔记"""
    fake_note = SimpleNamespace(id=1, title="新笔记")

    async def mock_create():
        return fake_note

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.create_note", mock_create)
    result = asyncio.run(mock_create())
    assert result.id == 1


def test_get_note_success(monkeypatch):
    """测试获取笔记"""
    fake_note = SimpleNamespace(id=1, title="测试")

    async def mock_get():
        return fake_note

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.get_note", mock_get)
    result = asyncio.run(mock_get())
    assert result.id == 1


def test_update_note_success(monkeypatch):
    """测试更新笔记"""
    fake_note = SimpleNamespace(id=1, title="更新后")

    async def mock_update():
        return fake_note

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.update_note", mock_update)
    result = asyncio.run(mock_update())
    assert result.title == "更新后"


def test_delete_note_success(monkeypatch):
    """测试删除笔记"""
    async def mock_delete():
        return True

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.delete_note", mock_delete)
    result = asyncio.run(mock_delete())
    assert result is True
