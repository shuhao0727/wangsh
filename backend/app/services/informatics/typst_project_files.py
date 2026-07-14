"""Filesystem preparation helpers for compiling Typst projects."""

from __future__ import annotations

import posixpath
import re
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

from app.services.informatics.typst_note_state import canonical_compile_assets
from app.utils.typst_asset_validation import normalize_asset_path


_PROJECT_PATH_ERROR = "Typst 项目路径非法"
_MAX_PROJECT_PATH_LENGTH = 400


def _validated_raw_project_path(path: str) -> str:
    if not isinstance(path, str):
        raise ValueError(_PROJECT_PATH_ERROR)
    raw_path = path.strip()
    if not raw_path or "\x00" in raw_path:
        raise ValueError(_PROJECT_PATH_ERROR)
    if len(raw_path) > _MAX_PROJECT_PATH_LENGTH:
        raise ValueError(_PROJECT_PATH_ERROR)
    if raw_path.startswith(("/", "\\")):
        raise ValueError(_PROJECT_PATH_ERROR)
    return raw_path


def _normalize_project_path(path: str) -> str:
    raw_path = _validated_raw_project_path(path)
    windows_path = PureWindowsPath(raw_path)
    if windows_path.is_absolute() or windows_path.drive:
        raise ValueError(_PROJECT_PATH_ERROR)

    normalized_path = raw_path.replace("\\", "/")
    parts = [
        part
        for part in PurePosixPath(normalized_path).parts
        if part not in ("", ".")
    ]
    if not parts or any(part == ".." for part in parts):
        raise ValueError(_PROJECT_PATH_ERROR)
    return "/".join(parts)


def _resolve_project_destination(project_root: Path, relative_path: str) -> Path:
    candidate = project_root.joinpath(*PurePosixPath(relative_path).parts)
    try:
        resolved = candidate.resolve(strict=False)
        resolved.relative_to(project_root)
    except (OSError, RuntimeError, ValueError) as exc:
        raise ValueError(_PROJECT_PATH_ERROR) from exc
    return resolved


def _normalize_source(source: str, entry: str) -> str:
    normalized = source or ""
    entry_dir = posixpath.dirname(entry or "main.typ") or "."
    style_rel = posixpath.relpath("style/my_style.typ", entry_dir)
    style_line = f'#import "{style_rel}":my_style'
    style_import_pattern = r'(#import\s+)(["\'])([^"\']*style/my_style\.typ)(["\'])'
    normalized = re.sub(
        style_import_pattern,
        lambda match: (
            f"{match.group(1)}{match.group(2)}{style_rel}{match.group(4)}"
        ),
        normalized,
    )
    if not re.search(style_import_pattern, normalized):
        normalized = style_line + "\n" + normalized

    def replace_image_ref(match: re.Match) -> str:
        quote = match.group(1)
        reference = match.group(2)
        if "://" in reference:
            return match.group(0)
        if reference.startswith("image/"):
            relative = posixpath.relpath(reference, entry_dir)
            return f"image({quote}{relative}{quote}"
        joined = posixpath.normpath(posixpath.join(entry_dir, reference))
        while joined.startswith("../"):
            joined = joined[3:]
        if joined.startswith("image/"):
            relative = posixpath.relpath(joined, entry_dir)
            return f"image({quote}{relative}{quote}"
        return match.group(0)

    normalized = re.sub(
        r'image\(\s*(["\'])([^"\']+)\1',
        replace_image_ref,
        normalized,
    )
    lines = normalized.splitlines()
    first_h1 = next(
        (index for index, line in enumerate(lines) if re.match(r"^\s*=\s+.+$", line)),
        -1,
    )
    if (
        first_h1 >= 0
        and re.match(r"^\s*=\s*第[\d一二三四五六七八九十百千]+章", lines[first_h1])
        and any(
            re.match(r"^\s*==\s+.+$", line)
            for line in lines[first_h1 + 1 :]
        )
    ):
        lines.pop(first_h1)
        normalized = "\n".join(lines)
    return normalized


def _normalize_project_files(files: dict) -> dict:
    if not isinstance(files, dict) or len(files) == 0:
        return {"main.typ": ""}

    project_files = {}
    for raw_path, source in files.items():
        if not isinstance(raw_path, str) or not raw_path.strip():
            continue
        normalized_path = _normalize_project_path(raw_path)
        if normalized_path in project_files:
            raise ValueError(_PROJECT_PATH_ERROR)
        project_files[normalized_path] = source
    return project_files


def _add_project_style(project_files: dict, style_text: str) -> None:
    if (
        style_text
        and style_text.strip()
        and not str(project_files.get("style/my_style.typ") or "").strip()
    ):
        project_files["style/my_style.typ"] = style_text


def _normalize_entry_source(project_files: dict, entry: str) -> None:
    try:
        if entry in project_files:
            project_files[entry] = _normalize_source(
                project_files.get(entry) or "",
                entry,
            )
    except Exception:
        pass


def _prepare_project_files(
    entry_path: str,
    files: dict,
    style_text: str,
) -> tuple[str, dict]:
    raw_entry = (entry_path or "main.typ").strip() or "main.typ"
    entry = _normalize_project_path(raw_entry)
    project_files = _normalize_project_files(files)
    _add_project_style(project_files, style_text)
    _normalize_entry_source(project_files, entry)
    return entry, project_files


def _write_source_files(project_root: Path, files: dict) -> None:
    for relative_path, source in files.items():
        destination_path = _resolve_project_destination(
            project_root,
            relative_path,
        )
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        with destination_path.open("w", encoding="utf-8") as destination:
            destination.write(source or "")


def _write_assets(project_root: Path, assets: list[Any]) -> None:
    for asset in canonical_compile_assets(assets):
        asset_path = normalize_asset_path(str(asset.path or ""))
        destination_path = _resolve_project_destination(
            project_root,
            asset_path,
        )
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        with destination_path.open("wb") as destination:
            destination.write(bytes(asset.content))


def write_project_files(
    tmpdir: str,
    entry_path: str,
    files: dict,
    assets: list[Any],
    style_text: str,
) -> str:
    project_root = Path(tmpdir).resolve()
    project_root.mkdir(parents=True, exist_ok=True)
    entry, project_files = _prepare_project_files(entry_path, files, style_text)
    _write_source_files(project_root, project_files)
    _write_assets(project_root, assets)
    return entry
