"""Informatics PDF 渲染测试"""
import asyncio
from datetime import datetime
from types import SimpleNamespace

import pytest

from app.services.informatics import typst_notes

def test_has_cached_pdf_uses_current_hash_without_loading_pdf_bytes():
    class Result:
        def scalars(self):
            return self

        def all(self):
            return []

        def scalar_one_or_none(self):
            return None

    class DB:
        async def execute(self, _query):
            return Result()

    inputs = {
        "assets": [],
        "files": {"main.typ": "CURRENT"},
        "entry_path": "main.typ",
        "style_key": "default",
        "style_text": "",
    }
    note = SimpleNamespace(
        id=7,
        files=inputs["files"],
        content_typst="",
        entry_path=inputs["entry_path"],
        style_key=inputs["style_key"],
        compiled_hash=typst_notes._compile_input_hash(**inputs),
        compiled_pdf_path=None,
        compiled_pdf=b"CURRENT_PDF",
    )

    assert asyncio.run(typst_notes.has_cached_note_pdf(DB(), note)) is True


def test_has_cached_pdf_rejects_stale_hash():
    class Result:
        def scalars(self):
            return self

        def all(self):
            return []

        def scalar_one_or_none(self):
            return None

    class DB:
        async def execute(self, _query):
            return Result()

    note = SimpleNamespace(
        id=7,
        files={"main.typ": "CURRENT"},
        content_typst="",
        entry_path="main.typ",
        style_key="default",
        compiled_hash="stale",
        compiled_pdf_path=None,
        compiled_pdf=b"OLD_PDF",
    )

    assert asyncio.run(typst_notes.has_cached_note_pdf(DB(), note)) is False


def test_cached_pdf_returns_bytes_when_compile_inputs_are_current():
    class Result:
        def scalars(self):
            return self

        def all(self):
            return []

        def scalar_one_or_none(self):
            return None

    class DB:
        async def execute(self, _query):
            return Result()

    inputs = {
        "assets": [],
        "files": {"main.typ": "CURRENT"},
        "entry_path": "main.typ",
        "style_key": "default",
        "style_text": "",
    }
    note = SimpleNamespace(
        id=7,
        files=inputs["files"],
        content_typst="",
        entry_path=inputs["entry_path"],
        style_key=inputs["style_key"],
        compiled_hash=typst_notes._compile_input_hash(**inputs),
        compiled_pdf_path=None,
        compiled_pdf=b"CURRENT_PDF",
    )

    assert asyncio.run(typst_notes.get_cached_note_pdf(DB(), note)) == b"CURRENT_PDF"


def test_update_note_invalidates_metadata_but_defers_old_pdf_cleanup(
    monkeypatch,
    tmp_path,
):
    class DB:
        async def commit(self):
            pass

        async def refresh(self, note):
            pass

    monkeypatch.setattr(typst_notes.settings, "TYPST_PDF_STORAGE_DIR", str(tmp_path))
    old_pdf = tmp_path / "old.pdf"
    old_pdf.write_bytes(b"OLD_PDF")
    note = SimpleNamespace(
        title="Note",
        summary="",
        category_path="",
        published=True,
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
        compiled_at=object(),
    )

    asyncio.run(
        typst_notes.update_note(
            DB(),
            note,
            files={"main.typ": "NEW"},
        )
    )

    assert note.compiled_hash is None
    assert note.compiled_pdf_path is None
    assert note.compiled_pdf is None
    assert old_pdf.read_bytes() == b"OLD_PDF"


def test_update_note_keeps_compiled_pdf_when_compile_inputs_are_unchanged(
    monkeypatch,
    tmp_path,
):
    class DB:
        async def commit(self):
            pass

        async def refresh(self, note):
            pass

    monkeypatch.setattr(typst_notes.settings, "TYPST_PDF_STORAGE_DIR", str(tmp_path))
    cached_pdf = tmp_path / "same-hash.pdf"
    cached_pdf.write_bytes(b"CURRENT_PDF")
    compiled_at = object()
    note = SimpleNamespace(
        title="Note",
        summary="",
        category_path="",
        published=True,
        published_at=None,
        style_key="default",
        entry_path="main.typ",
        files={"main.typ": "CURRENT"},
        toc=[],
        content_typst="CURRENT",
        compiled_hash="same-hash",
        compiled_pdf_path="same-hash.pdf",
        compiled_pdf_size=11,
        compiled_pdf=b"CURRENT_PDF",
        compiled_at=compiled_at,
    )

    asyncio.run(
        typst_notes.update_note(
            DB(),
            note,
            style_key="default",
            entry_path="main.typ",
            files={"main.typ": "CURRENT"},
            content_typst="CURRENT",
        )
    )

    assert note.compiled_hash == "same-hash"
    assert note.compiled_pdf_path == "same-hash.pdf"
    assert note.compiled_pdf == b"CURRENT_PDF"
    assert note.compiled_at is compiled_at
    assert cached_pdf.read_bytes() == b"CURRENT_PDF"


def test_cached_pdf_is_rejected_when_asset_inputs_changed():
    class Result:
        def __init__(self, *, items=None, scalar=None):
            self._items = items or []
            self._scalar = scalar

        def scalars(self):
            return self

        def all(self):
            return self._items

        def scalar_one_or_none(self):
            return self._scalar

    class DB:
        async def execute(self, _query):
            return Result(items=[
                SimpleNamespace(id=1, path="image.png", content=b"NEW_ASSET"),
            ])

    old_inputs = {
        "assets": [
            SimpleNamespace(id=1, path="image.png", content=b"OLD_ASSET"),
        ],
        "files": {"main.typ": '#image("image.png")'},
        "entry_path": "main.typ",
        "style_key": "custom",
        "style_text": "",
    }
    note = SimpleNamespace(
        id=7,
        files=old_inputs["files"],
        content_typst="",
        entry_path=old_inputs["entry_path"],
        style_key=old_inputs["style_key"],
        compiled_hash=typst_notes._compile_input_hash(**old_inputs),
        compiled_pdf_path=None,
        compiled_pdf=b"OLD_PDF",
    )

    assert asyncio.run(typst_notes.get_cached_note_pdf(DB(), note)) is None


def test_cached_pdf_is_rejected_when_style_lookup_fails(monkeypatch):
    class Result:
        def scalars(self):
            return self

        def all(self):
            return []

    class DB:
        def __init__(self):
            self.calls = 0

        async def execute(self, _query):
            self.calls += 1
            if self.calls == 1:
                return Result()
            raise RuntimeError("style database unavailable")

    monkeypatch.setattr(
        typst_notes,
        "read_resource_style",
        lambda key: "BUILTIN_STYLE",
    )
    inputs = {
        "assets": [],
        "files": {"main.typ": "CURRENT"},
        "entry_path": "main.typ",
        "style_key": "custom",
        "style_text": "BUILTIN_STYLE",
    }
    note = SimpleNamespace(
        id=7,
        files=inputs["files"],
        content_typst="",
        entry_path=inputs["entry_path"],
        style_key=inputs["style_key"],
        compiled_hash=typst_notes._compile_input_hash(**inputs),
        compiled_pdf_path=None,
        compiled_pdf=b"OLD_PDF",
    )

    assert asyncio.run(typst_notes.get_cached_note_pdf(DB(), note)) is None


def test_compile_input_hash_is_stable_when_asset_query_order_changes():
    first = SimpleNamespace(id=1, path="images/first.png", content=b"FIRST")
    second = SimpleNamespace(id=2, path="images/second.png", content=b"SECOND")
    inputs = {
        "files": {"main.typ": '#image("images/first.png")'},
        "entry_path": "main.typ",
        "style_key": "default",
        "style_text": "",
    }

    forward_hash = typst_notes._compile_input_hash(
        assets=[first, second],
        **inputs,
    )
    reverse_hash = typst_notes._compile_input_hash(
        assets=[second, first],
        **inputs,
    )

    assert forward_hash == reverse_hash


def test_duplicate_asset_paths_use_the_same_content_for_hash_and_compilation(tmp_path):
    first = SimpleNamespace(id=1, path="image.png", content=b"FIRST")
    duplicate = SimpleNamespace(id=2, path="image.png", content=b"SECOND")
    inputs = {
        "files": {"main.typ": '#image("image.png")'},
        "entry_path": "main.typ",
        "style_key": "default",
        "style_text": "",
    }

    forward_hash = typst_notes._compile_input_hash(
        assets=[first, duplicate],
        **inputs,
    )
    reverse_hash = typst_notes._compile_input_hash(
        assets=[duplicate, first],
        **inputs,
    )
    forward_dir = tmp_path / "forward"
    reverse_dir = tmp_path / "reverse"
    forward_dir.mkdir()
    reverse_dir.mkdir()
    typst_notes._write_project_files(
        tmpdir=str(forward_dir),
        assets=[first, duplicate],
        **{key: inputs[key] for key in ("files", "entry_path", "style_text")},
    )
    typst_notes._write_project_files(
        tmpdir=str(reverse_dir),
        assets=[duplicate, first],
        **{key: inputs[key] for key in ("files", "entry_path", "style_text")},
    )

    assert forward_hash == reverse_hash
    assert (forward_dir / "image.png").read_bytes() == b"FIRST"
    assert (reverse_dir / "image.png").read_bytes() == b"FIRST"


@pytest.mark.parametrize(
    "unsafe_path",
    [
        "../escape.typ",
        "/absolute.typ",
        r"..\escape.typ",
        "nul\x00.typ",
    ],
)
def test_project_writer_rejects_unsafe_entry_paths(tmp_path, unsafe_path):
    with pytest.raises(ValueError, match="Typst 项目路径非法"):
        typst_notes._write_project_files(
            tmpdir=str(tmp_path),
            entry_path=unsafe_path,
            files={"main.typ": "SAFE"},
            assets=[],
            style_text="",
        )


@pytest.mark.parametrize(
    "unsafe_path",
    [
        "../escape.typ",
        "/absolute.typ",
        r"..\escape.typ",
        "nul\x00.typ",
    ],
)
def test_project_writer_rejects_unsafe_file_keys(tmp_path, unsafe_path):
    with pytest.raises(ValueError, match="Typst 项目路径非法"):
        typst_notes._write_project_files(
            tmpdir=str(tmp_path),
            entry_path="main.typ",
            files={unsafe_path: "UNSAFE"},
            assets=[],
            style_text="",
        )


def test_project_writer_rejects_source_symlink_escape(tmp_path):
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    outside = tmp_path / "outside.typ"
    outside.write_text("ORIGINAL", encoding="utf-8")
    (project_dir / "main.typ").symlink_to(outside)

    with pytest.raises(ValueError, match="Typst 项目路径非法"):
        typst_notes._write_project_files(
            tmpdir=str(project_dir),
            entry_path="main.typ",
            files={"main.typ": "UNSAFE"},
            assets=[],
            style_text="",
        )

    assert outside.read_text(encoding="utf-8") == "ORIGINAL"


def test_project_writer_rejects_asset_symlink_escape(tmp_path):
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    outside = tmp_path / "outside.bin"
    outside.write_bytes(b"ORIGINAL")
    (project_dir / "image.bin").symlink_to(outside)
    asset = SimpleNamespace(id=1, path="image.bin", content=b"UNSAFE")

    with pytest.raises(ValueError, match="Typst 项目路径非法"):
        typst_notes._write_project_files(
            tmpdir=str(project_dir),
            entry_path="main.typ",
            files={"main.typ": "SAFE"},
            assets=[asset],
            style_text="",
        )

    assert outside.read_bytes() == b"ORIGINAL"


class _PdfCacheDB:
    def __init__(self):
        self.assets = []
        self.style = SimpleNamespace(content="STYLE")

    async def execute(self, _query):
        return self

    def scalars(self):
        return self

    def all(self):
        return self.assets

    def scalar_one_or_none(self):
        return self.style


def _cached_public_note(db):
    files = {"main.typ": "CURRENT", "other.typ": "OTHER"}
    return SimpleNamespace(
        id=7, title="Public note", summary="", toc=[],
        updated_at=datetime(2026, 10, 15), published=True,
        files=files, content_typst="CURRENT", entry_path="main.typ",
        style_key="custom", compiled_pdf_path=None,
        compiled_pdf=b"%PDF-current",
        compiled_hash=typst_notes._compile_input_hash(
            assets=db.assets, files=files, entry_path="main.typ",
            style_key="custom", style_text=db.style.content,
        ),
    )


@pytest.mark.parametrize("disk_state", ["empty", "directory", "missing", "unreadable"])
def test_pdf_availability_requires_readable_nonempty_file(monkeypatch, tmp_path, disk_state):
    import builtins
    import io

    db = _PdfCacheDB()
    note = _cached_public_note(db)
    note.compiled_pdf = None
    note.compiled_pdf_path = "cached.pdf"
    path = tmp_path / note.compiled_pdf_path
    monkeypatch.setattr(typst_notes.settings, "TYPST_PDF_STORAGE_DIR", str(tmp_path))
    if disk_state == "directory":
        path.mkdir()
    elif disk_state == "empty":
        path.write_bytes(b"")
    elif disk_state == "unreadable":
        path.write_bytes(b"%PDF-current")
        real_open = builtins.open

        def guarded_open(file, *args, **kwargs):
            if str(file) == str(path):
                raise PermissionError("synthetic unreadable PDF")
            return real_open(file, *args, **kwargs)

        monkeypatch.setattr(builtins, "open", guarded_open)
        monkeypatch.setattr(io, "open", guarded_open)

    assert asyncio.run(typst_notes.has_cached_note_pdf(db, note)) is False
    assert asyncio.run(typst_notes.get_cached_note_pdf(db, note)) is None


def test_empty_disk_pdf_falls_back_to_current_database_pdf(monkeypatch, tmp_path):
    db = _PdfCacheDB()
    note = _cached_public_note(db)
    note.compiled_pdf_path = "empty.pdf"
    (tmp_path / note.compiled_pdf_path).write_bytes(b"")
    monkeypatch.setattr(typst_notes.settings, "TYPST_PDF_STORAGE_DIR", str(tmp_path))

    assert asyncio.run(typst_notes.has_cached_note_pdf(db, note)) is True
    assert asyncio.run(typst_notes.get_cached_note_pdf(db, note)) == note.compiled_pdf


def test_disk_pdf_availability_does_not_read_full_pdf(monkeypatch, tmp_path):
    from pathlib import Path

    db = _PdfCacheDB()
    note = _cached_public_note(db)
    note.compiled_pdf = None
    note.compiled_pdf_path = "cached.pdf"
    (tmp_path / note.compiled_pdf_path).write_bytes(b"%PDF-current")
    monkeypatch.setattr(typst_notes.settings, "TYPST_PDF_STORAGE_DIR", str(tmp_path))

    def unexpected_read(*_args, **_kwargs):
        raise AssertionError("availability must not load full PDF bytes")

    monkeypatch.setattr(Path, "read_bytes", unexpected_read)
    assert asyncio.run(typst_notes.has_cached_note_pdf(db, note)) is True


@pytest.mark.parametrize("state", ["current", "files", "entry", "style", "asset", "unpublished", "missing"])
def test_public_pdf_http_contract(monkeypatch, state):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.endpoints.informatics import public_typst_notes as public_api

    db = _PdfCacheDB()
    note = _cached_public_note(db)
    if state == "files":
        note.files["main.typ"] = "CHANGED"
    elif state == "entry":
        note.entry_path = "other.typ"
    elif state == "style":
        db.style.content = "CHANGED STYLE"
    elif state == "asset":
        db.assets = [SimpleNamespace(id=1, path="image.png", content=b"NEW")]
    elif state == "unpublished":
        note.published = False

    async def fake_get_note(**_kwargs):
        return None if state == "missing" else note

    async def fake_db():
        return db

    def unexpected_compile(*_args, **_kwargs):
        raise AssertionError("anonymous requests must not compile")

    monkeypatch.setattr(public_api, "get_note", fake_get_note)
    monkeypatch.setattr(typst_notes, "compile_note_pdf", unexpected_compile)
    monkeypatch.setattr(typst_notes, "_compile_typst_project_to_pdf_bytes", unexpected_compile)
    app = FastAPI()
    app.include_router(public_api.router)
    app.dependency_overrides[public_api.get_db] = fake_db
    prefix = "/public/informatics/typst-notes/7"
    with TestClient(app) as client:
        detail = client.get(prefix)
        pdf = client.get(prefix + "/export.pdf")
        source = client.get(prefix + "/export.typ")

    if state in ("unpublished", "missing"):
        assert [detail.status_code, pdf.status_code, source.status_code] == [404, 404, 404]
        return
    assert detail.status_code == source.status_code == 200
    assert "no-store" in detail.headers["cache-control"]
    assert detail.json()["pdf_available"] is (state == "current")
    assert pdf.status_code == (200 if state == "current" else 404)
    if state == "current":
        assert pdf.content == note.compiled_pdf
        assert pdf.headers["content-type"] == "application/pdf"
        assert "no-store" in pdf.headers["cache-control"]
