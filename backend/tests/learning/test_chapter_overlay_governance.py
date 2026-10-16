"""Offline compatibility and hook tests for the chapter overlay extraction."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.services.learning import chapter_overlay, content_service


FROZEN_SHA256 = "78cbd5665de2a39b918a53e40f1dbb07df0edbe02c27b202ba61b228730abd82"


@pytest.fixture(scope="module")
def frozen_service():
    source_path = os.environ.get("LEARNING_OVERLAY_ORACLE")
    if not source_path:
        pytest.skip("Frozen-byte oracle requires the reviewed offline learning runner")
    source = Path(source_path)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == FROZEN_SHA256
    spec = importlib.util.spec_from_file_location("learning_content_service_frozen", source)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _chapter(slug: Any, sort_order: int, *, updated_at: datetime | None = None, title: str = "Saved"):
    return SimpleNamespace(
        slug=slug,
        title=title,
        summary=f"summary-{slug}",
        estimated_minutes=sort_order + 10,
        difficulty="advanced",
        group_name="governance",
        markdown=f"markdown-{slug}",
        sort_order=sort_order,
        updated_at=updated_at,
    )


def _cases():
    timestamp = datetime(2026, 10, 13, 1, 2, 3, tzinfo=timezone.utc)
    return [
        (None, [], "none"),
        ({"book": {"chapters": [{"slug": "a"}]}}, [], "no-persisted-chapters"),
        ({"book": {"chapters": [{"slug": "a"}]}}, None, "none-persisted-chapters"),
        (None, [_chapter("a", 0)], "none-content-with-chapters"),
        ("book", [_chapter("a", 0)], "string-content"),
        ([], [_chapter("a", 0)], "non-dict-content"),
        ({"meta": {"keep": True}}, [_chapter("a", 0)], "no-book"),
        ({"book": None}, [_chapter("a", 0)], "none-book"),
        ({"book": []}, [_chapter("a", 0)], "list-book"),
        ({"book": {}}, [_chapter("a", 0)], "missing-bundled-chapters"),
        ({"book": {"chapters": None}}, [_chapter("a", 0)], "none-bundled-chapters"),
        ({"book": {"chapters": {"a": {"slug": "a"}}}}, [_chapter("a", 0)], "dict-bundled-chapters"),
        ({"book": {"chapters": ({"slug": "a"},)}}, [_chapter("a", 0)], "tuple-bundled-chapters"),
        (
            {"book": {"chapters": [None, False, 1, [], "bad", {},
                                    {"slug": None}, {"slug": False}, {"slug": 0},
                                    {"slug": ""}, {"slug": []},
                                    {"slug": "a", "extra": {"same": True}}]}},
            [_chapter("new", 0)], "mixed-bundled-types-and-false-slugs",
        ),
        (
            {"book": {"chapters": [{"slug": 7, "extra": []}, {"slug": "7", "last": True},
                                    {"slug": True}, {"slug": "unmatched", "sort_order": -100}]}},
            [_chapter("7", 0), _chapter(None, 1), _chapter(7, 0)],
            "mixed-slug-types-and-string-coercion",
        ),
        (
            {"book": {"chapters": [{"slug": "a", "extra": {"same": True},
                                    "_canonical_order": 500, "_canonical_index": 99}]}},
            [_chapter("a", -1, updated_at=datetime(2026, 10, 13, 1, 2, 3, 456789))],
            "negative-sort-naive-timestamp-and-internal-key-collision",
        ),
        (
            {
                "meta": {"same": True},
                "book": {
                    "title": "Book",
                    "extra": {"identity": "keep"},
                    "chapters": [
                        "bad",
                        {"title": "missing slug"},
                        {"slug": "a", "title": "Bundled A", "extra": ["same"]},
                        {"slug": "a", "title": "Bundled duplicate"},
                        {"slug": "b", "title": "Bundled B"},
                    ],
                },
            },
            [
                _chapter("b", 0, updated_at=timestamp, title="Persisted B"),
                _chapter("a", 0, title="Persisted A first"),
                _chapter("a", 0, title="Persisted A last"),
                _chapter("c", 0, title="Persisted C first"),
                _chapter("c", 0, title="Persisted C duplicate"),
            ],
            "duplicate-slugs-zero-sort-timestamp-extra",
        ),
    ]


@pytest.mark.parametrize("alias", ["book", "content"])
def test_canonical_cleanup_precedes_copy_for_original_hook_alias(alias, frozen_service, monkeypatch):
    results = []
    for service in (frozen_service, content_service):
        source = {"meta": "keep", "book": {"title": "Book", "chapters": []}}
        returned = source["book"] if alias == "book" else source
        with monkeypatch.context() as patch:
            patch.setattr(service, "_chapter_overlay", lambda _row: returned)
            merged = service._merge_book_chapters(source, [_chapter("a", 0)])
        copied = merged["book"] if alias == "book" else merged
        assert merged["book"]["chapters"][0] is returned
        assert "_canonical_order" not in returned and "_canonical_index" not in returned
        results.append(sorted(key for key in copied if key.startswith("_canonical")))
    assert results == [[], []]


def test_sort_comparison_mutation_precedes_copy(frozen_service):
    for service in (frozen_service, content_service):
        source = {"book": {"chapters": []}}

        class SortValue(int):
            def __lt__(self, other):
                source["during_sort"] = True
                source["book"]["during_sort"] = True
                return int(self) < int(other)

        merged = service._merge_book_chapters(source, [
            _chapter("a", SortValue(2)), _chapter("b", SortValue(1)),
        ])
        assert source["during_sort"] is True
        assert merged.get("during_sort") is True
        assert merged["book"].get("during_sort") is True
        assert [item["slug"] for item in merged["book"]["chapters"]] == ["b", "a"]


@pytest.mark.parametrize("content,chapters,label", _cases(), ids=lambda value: value if isinstance(value, str) else None)
def test_extracted_overlay_matches_frozen_source(content, chapters, label, frozen_service):
    frozen_content = deepcopy(content)
    extracted_content = deepcopy(content)
    unchanged = deepcopy(extracted_content)
    chapter_values = deepcopy([vars(chapter) for chapter in chapters or []])

    frozen = frozen_service._merge_book_chapters(frozen_content, chapters)
    extracted = content_service._merge_book_chapters(extracted_content, chapters)

    assert extracted == frozen, label
    assert extracted_content == frozen_content == unchanged
    assert [vars(chapter) for chapter in chapters or []] == chapter_values
    assert (extracted is extracted_content) == (frozen is frozen_content)
    if not chapters or not isinstance(content, dict) or not isinstance(content.get("book"), dict):
        assert extracted is extracted_content
    else:
        assert extracted is not extracted_content
        assert extracted["book"] is not extracted_content["book"]
        assert extracted["book"]["chapters"] is not extracted_content["book"].get("chapters")
        for key, value in extracted_content.items():
            if key != "book":
                assert extracted[key] is value
        for key, value in extracted_content["book"].items():
            if key != "chapters":
                assert extracted["book"][key] is value


def test_overlay_preserves_duplicate_and_tie_order_and_timestamp_values():
    timestamp = datetime(2026, 10, 13, 1, 2, 3, tzinfo=timezone.utc)
    content = {
        "book": {
            "chapters": [
                {"slug": "first", "bundled": True},
                {"slug": "second", "bundled": True},
            ]
        }
    }
    chapters = [
        _chapter("second", 0, updated_at=timestamp),
        _chapter("first", 0),
        _chapter("new", 0),
    ]
    result = content_service._merge_book_chapters(content, chapters)

    assert [item["slug"] for item in result["book"]["chapters"]] == ["first", "second", "new"]
    assert result["book"]["chapters"][1]["updated_at"] == timestamp.isoformat()
    assert result["book"]["chapters"][0]["bundled"] is True
    assert content["book"]["chapters"][0] == {"slug": "first", "bundled": True}


def test_merge_facade_reads_overlay_hook_at_call_time(monkeypatch):
    observed = {}

    def fake_overlay(chapter):
        observed["chapter"] = chapter
        return {"slug": chapter.slug, "sort_order": 0, "hook": True}

    def fake_merge(content, chapters, overlay):
        observed["content"] = content
        observed["chapters"] = chapters
        observed["overlay_result"] = overlay(chapters[0])
        return "hook-result"

    monkeypatch.setattr(content_service, "_chapter_overlay", fake_overlay)
    monkeypatch.setattr(chapter_overlay, "merge_book_chapters", fake_merge)
    source = {"book": {"chapters": []}}
    chapter = _chapter("hook", 0)

    assert content_service._merge_book_chapters(source, [chapter]) == "hook-result"
    assert observed == {
        "content": source,
        "chapters": [chapter],
        "overlay_result": {"slug": "hook", "sort_order": 0, "hook": True},
        "chapter": chapter,
    }


def test_existing_content_payload_facade_reads_merge_at_call_time(monkeypatch):
    item = SimpleNamespace(
        id=1,
        module_key="ml",
        section_key="raw",
        item_key="book",
        title="Book",
        summary=None,
        content='{"book": {"chapters": []}}',
        tags="[]",
        difficulty=None,
        sort_order=0,
        enabled=True,
        source_type="admin",
        created_at=None,
        updated_at=None,
    )
    monkeypatch.setattr(content_service, "_merge_book_chapters", lambda content, chapters: "facade-hook")

    assert content_service._content_payload(item, [_chapter("a", 0)])["content"] == "facade-hook"


def test_duplicate_slug_rules_and_shared_nested_metadata():
    nested = {"goals": ["keep"]}
    first = {"slug": "a", "extra": {"discard": True}}
    last = {"slug": "a", "extra": nested, "sort_order": -9}
    source = {"book": {"chapters": [first, {"slug": "b"}, last]}}
    chapters = [_chapter("a", 0, title="first matched"),
                _chapter("a", 0, title="last matched"),
                _chapter("new", 0, title="first new"),
                _chapter("new", -5, title="last new")]
    result = content_service._merge_book_chapters(source, chapters)
    items = result["book"]["chapters"]
    assert [item["slug"] for item in items] == ["a", "new", "b"]
    assert items[0]["title"] == "last matched"
    assert items[1]["title"] == "first new"
    assert items[0] is not last
    assert items[0]["extra"] is nested
    assert source["book"]["chapters"][0] is first
    assert source["book"]["chapters"][2] is last
    assert last["sort_order"] == -9
    assert all("_canonical_order" not in item and "_canonical_index" not in item for item in items)


@pytest.mark.parametrize("markdown", [None, "", False, 0, "Markdown"])
@pytest.mark.parametrize("updated_at", [None, datetime(2026, 10, 13),
                                      datetime(2026, 10, 13, tzinfo=timezone.utc)])
def test_overlay_none_and_timestamp_projection_matches_original(markdown, updated_at, frozen_service):
    row = _chapter("a", 0, updated_at=updated_at)
    row.markdown = markdown
    row.summary = row.estimated_minutes = row.difficulty = row.group_name = None
    actual = content_service._chapter_overlay(row)
    assert actual == frozen_service._chapter_overlay(row)
    assert actual["markdown"] == (markdown or "")
    assert actual["updated_at"] == (updated_at.isoformat() if updated_at else None)
    assert actual["estimatedMinutes"] is actual["summary"] is actual["difficulty"] is actual["group"] is None
    assert actual["sort_order"] == 0


def test_overlay_hook_replacement_is_visible_during_one_merge(monkeypatch):
    calls = []

    def later(row):
        calls.append(("later", row.slug))
        return {"slug": row.slug, "hook": "later"}

    def first(row):
        calls.append(("first", row.slug))
        monkeypatch.setattr(content_service, "_chapter_overlay", later)
        return {"slug": row.slug, "hook": "first"}

    monkeypatch.setattr(content_service, "_chapter_overlay", first)
    content = {"book": {"chapters": [{"slug": "match"}]}}
    result = content_service._merge_book_chapters(content, [_chapter("match", 0), _chapter("new", 0)])
    assert calls == [("first", "match"), ("later", "new")]
    assert [item["hook"] for item in result["book"]["chapters"]] == ["first", "later"]


def test_hook_result_for_new_chapter_retains_its_object_identity(monkeypatch):
    overlay = {"slug": "new", "extra": []}
    monkeypatch.setattr(content_service, "_chapter_overlay", lambda row: overlay)
    source = {"book": {"chapters": []}}
    result = content_service._merge_book_chapters(source, [_chapter("new", 0)])
    assert result["book"]["chapters"][0] is overlay
    assert overlay == {"slug": "new", "extra": []}
    assert source == {"book": {"chapters": []}}


@pytest.mark.parametrize("defect", ["mixed-sort", "none-sort", "unhashable-slug", "missing-title", "bad-timestamp"])
def test_invalid_inputs_keep_original_exception_contract(defect, frozen_service):
    def make_inputs():
        rows = [_chapter("a", 0), _chapter("b", 1)]
        if defect == "mixed-sort":
            rows[1].sort_order = "1"
        elif defect == "none-sort":
            rows[1].sort_order = None
        elif defect == "unhashable-slug":
            rows[1].slug = []
        elif defect == "missing-title":
            del rows[1].title
        else:
            rows[1].updated_at = "not a datetime"
        return {"book": {"chapters": [{"slug": "a"}]}}, rows

    with pytest.raises((TypeError, AttributeError)) as original:
        frozen_service._merge_book_chapters(*make_inputs())
    with pytest.raises(type(original.value)) as actual:
        content_service._merge_book_chapters(*make_inputs())
    assert str(actual.value) == str(original.value)


def test_overlay_error_propagates_unchanged(monkeypatch):
    failure = RuntimeError("overlay failed")

    def fail(row):
        raise failure

    monkeypatch.setattr(content_service, "_chapter_overlay", fail)
    with pytest.raises(RuntimeError) as actual:
        content_service._merge_book_chapters({"book": {}}, [_chapter("new", 0)])
    assert actual.value is failure


@pytest.mark.parametrize("facade", ["list_learning_content", "list_learning_content_admin"])
@pytest.mark.parametrize("with_content", [False, True])
def test_list_facades_keep_query_and_projection_order(facade, with_content, frozen_service):
    import json

    item = SimpleNamespace(
        id=1, module_key="ml", section_key="raw", item_key="book", title="Book",
        summary=None, content=json.dumps({"book": {"chapters": [{"slug": "a"}]}}),
        tags='["test"]', difficulty=None, sort_order=0, enabled=True,
        source_type="admin", created_at=None, updated_at=None,
    )
    rows = [item] if with_content else []
    chapters = [_chapter("a", 0)]

    class RecordingDB:
        def __init__(self):
            self.queries = []

        async def execute(self, statement):
            compiled = statement.compile()
            self.queries.append((str(compiled), dict(compiled.params)))
            values = rows if len(self.queries) == 1 else chapters
            return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: values))

    actual_db, original_db = RecordingDB(), RecordingDB()
    original = asyncio.run(getattr(frozen_service, facade)(original_db, "ml"))
    actual = asyncio.run(getattr(content_service, facade)(actual_db, "ml"))
    assert actual == original
    assert actual_db.queries == original_db.queries
    assert len(actual_db.queries) == 2
    assert "sys_learning_content_items" in actual_db.queries[0][0]
    assert "ORDER BY sys_learning_chapters.sort_order, sys_learning_chapters.id" in actual_db.queries[1][0]
