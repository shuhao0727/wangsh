"""Pure state helpers for Typst note updates and compile cache keys."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Optional, TypeVar

from app.utils.typst_asset_validation import normalize_asset_path


AssetT = TypeVar("AssetT")


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_bytes_hex(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_compile_assets(assets: list[AssetT]) -> list[AssetT]:
    def sort_key(asset: AssetT) -> tuple[str, int, str]:
        path = normalize_asset_path(str(getattr(asset, "path", "") or ""))
        asset_id = getattr(asset, "id", None)
        stable_id = asset_id if isinstance(asset_id, int) else 2**63 - 1
        digest = sha256_bytes_hex(bytes(getattr(asset, "content")))
        return path, stable_id, digest

    canonical: list[AssetT] = []
    seen_paths: set[str] = set()
    for asset in sorted(assets or [], key=sort_key):
        path = normalize_asset_path(str(getattr(asset, "path", "") or ""))
        if path in seen_paths:
            continue
        seen_paths.add(path)
        canonical.append(asset)
    return canonical


def compile_input_hash(
    *,
    assets: list[Any],
    files: dict,
    entry_path: str,
    style_key: str,
    style_text: str,
) -> str:
    asset_sig = [
        {
            "path": normalize_asset_path(str(asset.path or "")),
            "sha256": sha256_bytes_hex(bytes(asset.content)),
        }
        for asset in canonical_compile_assets(assets)
    ]
    return sha256_hex(
        json.dumps(
            {
                "style_key": style_key,
                "style_text": style_text,
                "entry_path": entry_path,
                "files": files,
                "assets": asset_sig,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


def compile_inputs_changed(
    note: Any,
    *,
    style_key: Optional[str],
    entry_path: Optional[str],
    files: Optional[dict],
    content_typst: Optional[str],
) -> bool:
    return (
        (style_key is not None and style_key != note.style_key)
        or (entry_path is not None and entry_path != note.entry_path)
        or (files is not None and files != note.files)
        or (
            content_typst is not None
            and content_typst != note.content_typst
        )
    )


def apply_note_updates(
    note: Any,
    *,
    title: Optional[str],
    summary: Optional[str],
    category_path: Optional[str],
    published: Optional[bool],
    style_key: Optional[str],
    entry_path: Optional[str],
    files: Optional[dict],
    toc: Optional[list],
    content_typst: Optional[str],
) -> None:
    _apply_descriptive_fields(
        note,
        title=title,
        summary=summary,
        category_path=category_path,
        toc=toc,
    )
    _apply_publication(note, published)
    _apply_compile_fields(
        note,
        style_key=style_key,
        entry_path=entry_path,
        files=files,
        content_typst=content_typst,
    )


def _apply_descriptive_fields(
    note: Any,
    *,
    title: Optional[str],
    summary: Optional[str],
    category_path: Optional[str],
    toc: Optional[list],
) -> None:
    if title is not None:
        note.title = title
    if summary is not None:
        note.summary = summary
    if category_path is not None:
        note.category_path = category_path
    if toc is not None:
        note.toc = toc


def _apply_publication(note: Any, published: Optional[bool]) -> None:
    if published is not None and bool(published) != bool(note.published):
        note.published = bool(published)
        note.published_at = datetime.now() if note.published else None


def _apply_compile_fields(
    note: Any,
    *,
    style_key: Optional[str],
    entry_path: Optional[str],
    files: Optional[dict],
    content_typst: Optional[str],
) -> None:
    if style_key is not None:
        note.style_key = style_key
    if entry_path is not None:
        note.entry_path = entry_path
    if files is not None:
        note.files = files
        if isinstance(files, dict) and "main.typ" in files:
            note.content_typst = files.get("main.typ") or ""
    if content_typst is not None:
        note.content_typst = content_typst


def clear_compile_cache_metadata(note: Any) -> None:
    note.compiled_hash = None
    note.compiled_pdf_path = None
    note.compiled_pdf_size = None
    note.compiled_pdf = None
    note.compiled_at = None
