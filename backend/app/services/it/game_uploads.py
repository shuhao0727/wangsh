"""Focused helpers for game upload validation and filesystem staging."""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Callable, Optional

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession


logger = logging.getLogger("app.services.it.games")


def validated_game_extension(
    raw_name: str,
    allowed_extensions: set[str],
) -> str:
    extension = Path(raw_name or "unknown").suffix.lower()
    if not extension:
        raise ValueError("文件缺少扩展名，无法识别游戏包类型")
    if extension not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise ValueError(f"不支持的文件类型：{extension}，仅允许 {allowed}")
    return extension


def portable_stored_name(
    *,
    game_id: int,
    title: str,
    extension: str,
    max_filename_bytes: int,
    slugify: Callable[[str], str],
    truncate_utf8: Callable[[str, int], str],
) -> tuple[str, str]:
    fixed_name_bytes = len(f"{game_id}_{extension}".encode("utf-8"))
    slug = truncate_utf8(
        slugify(title),
        max(1, max_filename_bytes - fixed_name_bytes),
    ) or "game"
    return f"{game_id}_{slug}{extension}", slug


async def stream_upload_to_file(
    file: UploadFile,
    file_descriptor: int,
    *,
    max_size: int,
    chunk_size: int,
) -> tuple[int, str]:
    total = 0
    sha256 = hashlib.sha256()
    with os.fdopen(file_descriptor, "wb") as destination:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > max_size:
                raise ValueError(
                    f"文件过大（已超过 {max_size} 字节上限），请压缩或拆分后上传"
                )
            destination.write(chunk)
            destination.flush()
            sha256.update(chunk)
        destination.flush()
        os.fsync(destination.fileno())

    if total == 0:
        raise ValueError("上传文件内容为空")
    return total, sha256.hexdigest()


def safe_unlink(path: Optional[Path]) -> None:
    if path is None:
        return
    try:
        path.unlink()
    except FileNotFoundError:
        pass
    except OSError:
        logger.exception("临时游戏文件清理失败: %s", path)


async def rollback_failed_upload(
    db: AsyncSession,
    *,
    temp_path: Optional[Path],
    dest_path: Optional[Path],
    renamed: bool,
) -> None:
    try:
        await db.rollback()
    finally:
        safe_unlink(temp_path)
        if renamed:
            safe_unlink(dest_path)
