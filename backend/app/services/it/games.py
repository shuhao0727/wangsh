"""游戏资源库 — 业务逻辑层

- 文件存储管理（本地文件系统）
- CRUD 操作
- 下载日志记录
"""

import logging
import os
import re
import struct
import tempfile
import uuid
import zipfile
from pathlib import Path, PurePosixPath
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.it.game import GameDownloadLog, GameResource
from app.services.it.game_uploads import (
    portable_stored_name as _portable_stored_name,
    rollback_failed_upload as _rollback_failed_upload,
    stream_upload_to_file as _stream_upload_to_file,
    validated_game_extension as _validated_game_extension,
)


logger = logging.getLogger(__name__)

GAMES_UPLOAD_DIR = Path(settings.UPLOAD_FOLDER) / "games"
UPLOAD_CHUNK_SIZE = 1024 * 1024
MAX_GAME_FILENAME_BYTES = 220

# 游戏安装包允许的扩展名白名单（教学场景常见游戏包格式）
ALLOWED_GAME_EXTENSIONS = {
    ".zip",
    ".rar",
    ".7z",
    ".exe",
    ".msi",
    ".dmg",
    ".pkg",
    ".apk",
    ".iso",
}

# 这些格式无法仅凭少量 magic bytes 证明完整语义，因此明确收紧支持范围。
_FORMAT_VALIDATION_POLICIES = {
    ".msi": "MSI 与其他 OLE/CFB 文件共享容器签名，仅校验 CFB 容器头",
    ".iso": "仅接受主卷描述符包含 CD001 的 ISO9660 镜像",
    ".dmg": "仅支持带 koly 尾部的 UDIF 磁盘映像",
    ".pkg": "仅支持 xar 格式的 macOS flat package，不接受目录型 bundle",
}


def _is_valid_zip(path: Path, *, require_android_manifest: bool = False) -> bool:
    try:
        with path.open("rb") as source:
            prefix = source.read(4)
        if prefix not in {b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"}:
            return False
        if not zipfile.is_zipfile(path):
            return False
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
        return not require_android_manifest or "AndroidManifest.xml" in names
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile):
        return False


def _is_valid_pe(path: Path) -> bool:
    try:
        file_size = path.stat().st_size
        if file_size < 64:
            return False
        with path.open("rb") as source:
            if source.read(2) != b"MZ":
                return False
            source.seek(0x3C)
            offset_bytes = source.read(4)
            if len(offset_bytes) != 4:
                return False
            pe_offset = struct.unpack("<I", offset_bytes)[0]
            if pe_offset < 0x40 or pe_offset > file_size - 4:
                return False
            source.seek(pe_offset)
            return source.read(4) == b"PE\0\0"
    except OSError:
        return False


def _check_file_signature(ext: str, path: Path) -> bool:
    """Validate a completed temp file without loading it into memory."""
    try:
        if ext == ".zip":
            return _is_valid_zip(path)
        if ext == ".apk":
            return _is_valid_zip(path, require_android_manifest=True)
        if ext == ".exe":
            return _is_valid_pe(path)

        with path.open("rb") as source:
            if ext == ".msi":
                return source.read(8) == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
            if ext == ".7z":
                return source.read(6) == b"7z\xbc\xaf'\x1c"
            if ext == ".rar":
                prefix = source.read(8)
                return prefix.startswith(b"Rar!\x1a\x07\x00") or prefix == b"Rar!\x1a\x07\x01\x00"
            if ext == ".iso":
                source.seek(0x8001)
                return source.read(5) == b"CD001"
            if ext == ".dmg":
                if path.stat().st_size < 512:
                    return False
                source.seek(-512, os.SEEK_END)
                return source.read(4) == b"koly"
            if ext == ".pkg":
                return source.read(4) == b"xar!"
    except OSError:
        return False
    return False


def _signature_error(ext: str) -> ValueError:
    policy = _FORMAT_VALIDATION_POLICIES.get(ext)
    suffix = f"；校验策略：{policy}" if policy else ""
    return ValueError(f"文件内容与 {ext} 格式签名不匹配，疑似伪装或损坏文件{suffix}")


def resolve_game_file_path(game: GameResource) -> Optional[Path]:
    """从 stored_path 提取 basename，重建并校验下载路径，防止目录穿越。

    安全策略：
    1. 只取 stored_path 的文件名部分（basename），丢弃任何目录前缀
    2. 与 GAMES_UPLOAD_DIR 拼接后 resolve
    3. 用 is_relative_to 校验结果仍在 GAMES_UPLOAD_DIR 内
    4. 校验文件真实存在于磁盘

    返回绝对路径或 None（任一校验失败）。
    """
    if not game or not game.stored_path:
        return None
    normalized = str(game.stored_path).replace("\\", "/")
    base_name = PurePosixPath(normalized).name
    if not base_name or base_name in (".", ".."):
        return None
    if not game.id or not base_name.startswith(f"{game.id}_"):
        return None
    upload_dir = GAMES_UPLOAD_DIR.resolve()
    candidate = upload_dir / base_name
    try:
        if candidate.is_symlink():
            return None
        resolved = candidate.resolve()
    except (OSError, ValueError):
        return None
    # 防穿越：解析后必须仍在 games 上传目录内
    try:
        resolved.relative_to(upload_dir)
    except ValueError:
        return None
    if resolved.name != base_name or not resolved.is_file():
        return None
    return resolved


def _slugify(title: str) -> str:
    """将标题转为安全的文件 slug"""
    s = title.lower().strip()
    s = re.sub(r"[^\w一-鿿]+", "_", s)
    return s.strip("_") or "game"


def _truncate_utf8(value: str, max_bytes: int) -> str:
    if max_bytes <= 0:
        return ""
    encoded = value.encode("utf-8")
    if len(encoded) <= max_bytes:
        return value
    return encoded[:max_bytes].decode("utf-8", errors="ignore").rstrip("_")


def _ensure_upload_dir() -> Path:
    GAMES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return GAMES_UPLOAD_DIR.resolve()


# ── CRUD ──────────────────────────────────────────────


async def list_games(
    db: AsyncSession,
    *,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    active_only: bool = True,
) -> tuple[list[GameResource], int]:
    """列出游戏资源（公开，支持分类筛选和关键词搜索）"""
    q = select(GameResource)
    count_q = select(func.count(GameResource.id))

    if active_only:
        q = q.where(GameResource.is_active == True)
        count_q = count_q.where(GameResource.is_active == True)
    if category:
        q = q.where(GameResource.category == category)
        count_q = count_q.where(GameResource.category == category)
    if search:
        like = f"%{search}%"
        q = q.where(
            (GameResource.title.ilike(like)) | (GameResource.description.ilike(like))
        )
        count_q = count_q.where(
            (GameResource.title.ilike(like)) | (GameResource.description.ilike(like))
        )

    q = q.order_by(desc(GameResource.created_at)).offset((page - 1) * size).limit(size)
    total = (await db.execute(count_q)).scalar() or 0
    items = (await db.execute(q)).scalars().all()
    return list(items), total


async def get_game(db: AsyncSession, game_id: int) -> Optional[GameResource]:
    return await db.get(GameResource, game_id)


async def get_categories(db: AsyncSession) -> list[str]:
    """获取所有分类（去重排序）"""
    q = (
        select(GameResource.category)
        .where(GameResource.is_active == True)
        .distinct()
        .order_by(GameResource.category)
    )
    rows = (await db.execute(q)).scalars().all()
    return list(rows)


async def create_game(
    db: AsyncSession,
    *,
    title: str,
    description: Optional[str],
    category: str,
    file: UploadFile,
    uploaded_by: int,
) -> GameResource:
    """管理员上传新游戏

    安全校验（参照 app/utils/typst_asset_validation.py 模式）：
    1. 扩展名白名单 ALLOWED_GAME_EXTENSIONS
    2. settings.IT_GAME_MAX_UPLOAD_BYTES（分块累计，超限即中止）
    3. 完整临时文件的格式签名与必要结构校验
    校验失败抛 ValueError，由 endpoint 转换为 HTTPException(400)。
    """
    raw_name = file.filename or ""
    ext = _validated_game_extension(raw_name, ALLOWED_GAME_EXTENSIONS)

    upload_dir = _ensure_upload_dir()
    game = GameResource(
        title=title,
        description=description,
        category=category,
        filename=raw_name or "unknown",
        stored_path="",  # 稍后填充
        file_size=0,
        file_mime=file.content_type or "application/octet-stream",
        uploaded_by=uploaded_by,
    )
    temp_path: Optional[Path] = None
    dest_path: Optional[Path] = None
    renamed = False

    try:
        db.add(game)
        await db.flush()
        if game.id is None:
            raise RuntimeError("数据库未生成游戏资源 ID")

        stored_name, slug = _portable_stored_name(
            game_id=game.id,
            title=title,
            extension=ext,
            max_filename_bytes=MAX_GAME_FILENAME_BYTES,
            slugify=_slugify,
            truncate_utf8=_truncate_utf8,
        )
        dest_path = upload_dir / stored_name
        fd, temp_name = tempfile.mkstemp(
            prefix=f".{game.id}_{slug}_",
            suffix=".upload",
            dir=upload_dir,
        )
        temp_path = Path(temp_name)

        total, sha256 = await _stream_upload_to_file(
            file,
            fd,
            max_size=int(settings.IT_GAME_MAX_UPLOAD_BYTES),
            chunk_size=UPLOAD_CHUNK_SIZE,
        )
        if not _check_file_signature(ext, temp_path):
            raise _signature_error(ext)

        os.replace(temp_path, dest_path)
        renamed = True
        temp_path = None

        game.stored_path = str(dest_path)
        game.file_size = total
        game.file_sha256 = sha256
        await db.commit()
        return game
    except BaseException:
        await _rollback_failed_upload(
            db,
            temp_path=temp_path,
            dest_path=dest_path,
            renamed=renamed,
        )
        raise


async def update_game(
    db: AsyncSession,
    game_id: int,
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
    icon_url: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Optional[GameResource]:
    """管理员编辑游戏信息"""
    game = await db.get(GameResource, game_id)
    if not game:
        return None
    if title is not None:
        game.title = title
    if description is not None:
        game.description = description
    if category is not None:
        game.category = category
    if icon_url is not None:
        game.icon_url = icon_url
    if is_active is not None:
        game.is_active = is_active
    try:
        await db.commit()
        await db.refresh(game)
    except BaseException:
        await db.rollback()
        raise
    return game


async def delete_game(db: AsyncSession, game_id: int) -> bool:
    """Delete metadata and file, restoring the file if DB commit fails."""
    game = await db.get(GameResource, game_id)
    if not game:
        return False

    file_path = resolve_game_file_path(game)
    quarantine_path: Optional[Path] = None
    if file_path is not None:
        quarantine_path = file_path.with_name(
            f".deleting-{uuid.uuid4().hex}"
        )
        try:
            os.replace(file_path, quarantine_path)
        except BaseException:
            await db.rollback()
            raise

    try:
        await db.delete(game)
        await db.commit()
    except BaseException:
        try:
            await db.rollback()
        finally:
            if quarantine_path is not None and quarantine_path.exists():
                os.replace(quarantine_path, file_path)
        raise

    if quarantine_path is not None:
        try:
            quarantine_path.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            logger.exception("游戏记录已删除，但隔离文件清理失败: %s", quarantine_path)
    return True


# ── 下载 & 日志 ────────────────────────────────────────


async def record_download(
    db: AsyncSession,
    *,
    game_id: int,
    user_id: int,
    ip_address: str,
    user_agent: Optional[str] = None,
) -> Optional[GameResource]:
    """记录下载并递增计数，返回游戏对象供 StreamingResponse 使用"""
    result = await db.execute(
        select(GameResource)
        .where(
            GameResource.id == game_id,
            GameResource.is_active.is_(True),
        )
        .with_for_update()
    )
    game = result.scalar_one_or_none()
    if not game:
        return None

    log = GameDownloadLog(
        game_id=game_id,
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent else None,
    )
    db.add(log)
    previous_count = game.download_count or 0
    game.download_count = previous_count + 1
    try:
        await db.commit()
    except BaseException:
        game.download_count = previous_count
        await db.rollback()
        raise
    return game


async def get_download_logs(
    db: AsyncSession,
    game_id: int,
    page: int = 1,
    size: int = 50,
) -> tuple[list[dict], int]:
    """管理员查看某个游戏的下载记录"""
    q = (
        select(GameDownloadLog)
        .where(GameDownloadLog.game_id == game_id)
        .order_by(desc(GameDownloadLog.downloaded_at))
        .offset((page - 1) * size)
        .limit(size)
    )
    count_q = (
        select(func.count(GameDownloadLog.id))
        .where(GameDownloadLog.game_id == game_id)
    )
    total = (await db.execute(count_q)).scalar() or 0
    logs = (await db.execute(q)).scalars().all()

    items = []
    for log in logs:
        item = {
            "id": log.id,
            "game_id": log.game_id,
            "user_id": log.user_id,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "downloaded_at": log.downloaded_at,
        }
        items.append(item)
    return items, total
