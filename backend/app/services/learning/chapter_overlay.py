"""Pure chapter merging; querying and public row projection stay in the service."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Dict, List

if TYPE_CHECKING:
    from app.models.learning.chapter import LearningChapter

ChapterOverlay = Callable[["LearningChapter"], Dict[str, Any]]


def _merge_bundled_chapters(
    bundled_chapters: Any,
    chapters: List[LearningChapter],
    overlay: ChapterOverlay,
) -> Dict[str, Dict[str, Any]]:
    """Retain bundled extras, using the last persisted row for matching slugs."""
    if not isinstance(bundled_chapters, list):
        bundled_chapters = []
    persisted_by_slug = {chapter.slug: chapter for chapter in chapters}
    merged_by_slug: Dict[str, Dict[str, Any]] = {}
    for index, bundled in enumerate(bundled_chapters):
        if not isinstance(bundled, dict) or not bundled.get("slug"):
            continue
        slug = str(bundled["slug"])
        persisted = persisted_by_slug.get(slug)
        merged = dict(bundled)
        if persisted is not None:
            merged.update(overlay(persisted))
        merged["_canonical_order"] = persisted.sort_order if persisted is not None else index
        merged["_canonical_index"] = index
        merged_by_slug[slug] = merged
    return merged_by_slug


def _append_persisted_chapters(
    merged_by_slug: Dict[str, Dict[str, Any]],
    chapters: List[LearningChapter],
    overlay: ChapterOverlay,
) -> None:
    """Append missing slugs in input order, keeping the first new duplicate."""
    for persisted in chapters:
        if persisted.slug in merged_by_slug:
            continue
        merged = overlay(persisted)
        merged["_canonical_order"] = persisted.sort_order
        merged["_canonical_index"] = len(merged_by_slug)
        merged_by_slug[persisted.slug] = merged


def _ordered_chapters(merged_by_slug: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort on the existing canonical pair and remove the temporary keys."""
    merged_chapters = sorted(
        merged_by_slug.values(),
        key=lambda item: (item["_canonical_order"], item["_canonical_index"]),
    )
    for chapter in merged_chapters:
        chapter.pop("_canonical_order", None)
        chapter.pop("_canonical_index", None)
    return merged_chapters


def merge_book_chapters(
    content: Any,
    chapters: List[LearningChapter],
    overlay: ChapterOverlay,
) -> Any:
    """Shallow-copy a valid book; return the original object on bypass paths."""
    if not chapters or not isinstance(content, dict):
        return content
    book = content.get("book")
    if not isinstance(book, dict):
        return content
    merged_by_slug = _merge_bundled_chapters(book.get("chapters"), chapters, overlay)
    _append_persisted_chapters(merged_by_slug, chapters, overlay)
    merged_chapters = _ordered_chapters(merged_by_slug)
    return {**content, "book": {**book, "chapters": merged_chapters}}
