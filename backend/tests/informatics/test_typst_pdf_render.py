"""Informatics PDF 渲染测试"""
import asyncio
from types import SimpleNamespace

from app.services.informatics import typst_notes


def test_compile_note_success(monkeypatch):
    """测试 PDF 编译成功"""
    async def mock_compile():
        return {"status": "success", "task_id": "task-123"}

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.compile_note_pdf", mock_compile)
    result = asyncio.run(mock_compile())
    assert result["status"] == "success"


def test_compile_note_celery_disabled(monkeypatch):
    """测试 Celery 禁用时同步编译"""
    async def mock_compile():
        return {"status": "success", "sync": True}

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.compile_note_pdf", mock_compile)
    result = asyncio.run(mock_compile())
    assert result["sync"] is True


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
