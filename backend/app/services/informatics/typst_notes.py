import asyncio
import os
import shutil
import subprocess
import tempfile
import time
from datetime import datetime
from typing import List, Optional, Tuple
from pathlib import Path

from sqlalchemy import select, func, cast, Integer, case, literal
from sqlalchemy.ext.asyncio import AsyncSession

from loguru import logger
from app.core.config import settings
from app.utils.cache import cache
from app.utils.typst_pdf_storage import abs_pdf_path, pdf_rel_path, write_pdf_bytes
from app.utils.typst_asset_validation import normalize_asset_path
from app.models.informatics.typst_note import TypstNote
from app.models.informatics.typst_asset import TypstAsset
from app.services.informatics.typst_note_state import (
    apply_note_updates as _apply_note_updates,
    canonical_compile_assets,
    clear_compile_cache_metadata as _clear_compile_cache_metadata,
    compile_input_hash as _compile_input_hash,
    compile_inputs_changed as _compile_inputs_changed,
    sha256_bytes_hex as _sha256_bytes_hex,
)
from app.services.informatics.typst_project_files import (
    write_project_files as _write_project_files,
)
from app.services.informatics.typst_styles import read_resource_style
from app.models.informatics.typst_style import TypstStyle

_compile_locks: dict[int, asyncio.Lock] = {}
_compile_semaphore = asyncio.Semaphore(max(1, int(getattr(settings, "TYPST_COMPILE_MAX_CONCURRENCY", 2))))

# 单次 typst 编译超时秒数：防止恶意/超大 .typ 文件无限阻塞编译并发槽（仅 2 并发）
TYPST_COMPILE_TIMEOUT_SECONDS = max(1, int(getattr(settings, "TYPST_COMPILE_TIMEOUT_SECONDS", 120)))


async def _load_note_compile_inputs(
    db: AsyncSession,
    note: TypstNote,
) -> tuple[List[TypstAsset], dict, str, str, str]:
    assets: List[TypstAsset] = []
    if note.id:
        res = await db.execute(select(TypstAsset).where(TypstAsset.note_id == note.id))
        assets = list(res.scalars().all())

    files = (
        dict(note.files)
        if isinstance(note.files, dict)
        else {"main.typ": note.content_typst or ""}
    )
    entry_path = note.entry_path or "main.typ"
    style_key = note.style_key or "my_style"
    style_text = ""
    has_project_style = bool(str(files.get("style/my_style.typ") or "").strip())
    if not has_project_style:
        res = await db.execute(select(TypstStyle).where(TypstStyle.key == style_key))
        style = res.scalar_one_or_none()
        style_text = (style.content if style else "") or ""
        if not style_text.strip():
            style_text = read_resource_style(key=style_key)

    return canonical_compile_assets(assets), files, entry_path, style_key, style_text


async def compute_note_compile_hash(db: AsyncSession, note: TypstNote) -> str:
    assets, files, entry_path, style_key, style_text = (
        await _load_note_compile_inputs(db, note)
    )
    return _compile_input_hash(
        assets=assets,
        files=files,
        entry_path=entry_path,
        style_key=style_key,
        style_text=style_text,
    )


def _title_natural_order():
    """按标题中的数字前缀自然排序，如 1.1, 1.2, ..., 1.10, 2.1"""
    # 提取主序号（标题开头的第一个数字）
    major = cast(
        func.coalesce(
            func.nullif(func.substring(TypstNote.title, r'^(\d+)'), ''),
            '999999'
        ),
        Integer,
    )
    # 提取子序号（主序号后面 . 跟的数字）
    minor = cast(
        func.coalesce(
            func.nullif(func.substring(TypstNote.title, r'^\d+\.(\d+)'), ''),
            '0'
        ),
        Integer,
    )
    return [major, minor, TypstNote.title]


async def list_notes(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> List[TypstNote]:
    stmt = select(TypstNote).where(TypstNote.is_deleted.is_(False))
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(TypstNote.title.ilike(like))
    stmt = stmt.order_by(*_title_natural_order()).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def list_published_notes(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> List[TypstNote]:
    stmt = select(TypstNote).where(
        TypstNote.is_deleted.is_(False),
        TypstNote.published.is_(True),
    )
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(TypstNote.title.ilike(like))
    stmt = stmt.order_by(*_title_natural_order()).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_note(db: AsyncSession, note_id: int) -> Optional[TypstNote]:
    stmt = select(TypstNote).where(TypstNote.id == note_id, TypstNote.is_deleted.is_(False))
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def create_note(db: AsyncSession, title: str, content_typst: str, created_by_id: Optional[int]) -> TypstNote:
    files = {"main.typ": content_typst or ""} if content_typst is not None else {"main.typ": ""}
    note = TypstNote(
        title=title,
        category_path="",
        content_typst=content_typst,
        entry_path="main.typ",
        files=files,
        toc=[],
        created_by_id=created_by_id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def update_note(
    db: AsyncSession,
    note: TypstNote,
    title: Optional[str] = None,
    summary: Optional[str] = None,
    category_path: Optional[str] = None,
    published: Optional[bool] = None,
    style_key: Optional[str] = None,
    entry_path: Optional[str] = None,
    files: Optional[dict] = None,
    toc: Optional[list] = None,
    content_typst: Optional[str] = None,
) -> TypstNote:
    compile_inputs_changed = _compile_inputs_changed(
        note,
        style_key=style_key,
        entry_path=entry_path,
        files=files,
        content_typst=content_typst,
    )
    _apply_note_updates(
        note,
        title=title,
        summary=summary,
        category_path=category_path,
        published=published,
        style_key=style_key,
        entry_path=entry_path,
        files=files,
        toc=toc,
        content_typst=content_typst,
    )
    if compile_inputs_changed:
        _clear_compile_cache_metadata(note)

    await db.commit()
    await db.refresh(note)
    return note


async def invalidate_note_pdf_cache(db: AsyncSession, note: TypstNote, *, remove_file: bool = True) -> None:
    """Clear compiled PDF metadata so the next compile cannot reuse stale output."""
    old_rel = getattr(note, "compiled_pdf_path", None)
    if remove_file and old_rel:
        try:
            old_abs = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, old_rel)
            if os.path.exists(old_abs):
                await asyncio.to_thread(os.remove, old_abs)
        except Exception:
            pass

    note.compiled_hash = None
    note.compiled_pdf_path = None
    note.compiled_pdf_size = None
    note.compiled_pdf = None
    note.compiled_at = None
    await db.commit()
    await db.refresh(note)


async def delete_note(db: AsyncSession, note: TypstNote) -> None:
    note.is_deleted = True
    await db.commit()


def _compile_typst_to_pdf_bytes(content_typst: str) -> bytes:
    if not shutil.which("typst"):
        raise RuntimeError("服务器未安装 typst 编译器")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "main.typ")
        output_path = os.path.join(tmpdir, "main.pdf")
        with open(input_path, "w", encoding="utf-8") as f:
            f.write(content_typst or "")

        cmd = ["typst", "compile", input_path, output_path, "--root", tmpdir]
        # 加 timeout 防止恶意/超大 typst 文件无限阻塞；超时抛 RuntimeError 由调用方转 HTTP 504
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=TYPST_COMPILE_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Typst 编译超时（{TYPST_COMPILE_TIMEOUT_SECONDS}s）")
        if proc.returncode != 0:
            msg = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(msg or "typst 编译失败")
        with open(output_path, "rb") as f:
            return f.read()


def _compile_typst_project_to_pdf_bytes(entry_path: str, files: dict, assets: List[TypstAsset], style_text: str) -> bytes:
    if not shutil.which("typst"):
        raise RuntimeError("服务器未安装 typst 编译器")

    with tempfile.TemporaryDirectory() as tmpdir:
        ep = _write_project_files(tmpdir=tmpdir, entry_path=entry_path, files=files, assets=assets, style_text=style_text)
        input_path = os.path.join(tmpdir, ep)
        if not os.path.exists(input_path):
            raise RuntimeError(f"入口文件不存在: {ep}")
        output_path = os.path.join(tmpdir, "main.pdf")

        cmd = ["typst", "compile", input_path, output_path, "--root", tmpdir]
        # 加 timeout 防止恶意/超大 typst 文件无限阻塞；超时抛 RuntimeError 由调用方转 HTTP 504
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=TYPST_COMPILE_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Typst 编译超时（{TYPST_COMPILE_TIMEOUT_SECONDS}s）")
        if proc.returncode != 0:
            msg = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(msg or "typst 编译失败")
        with open(output_path, "rb") as f:
            return f.read()


async def compile_note_pdf(db: AsyncSession, note: TypstNote) -> Tuple[bytes, str]:
    lock = _compile_locks.setdefault(note.id or 0, asyncio.Lock())
    started = time.perf_counter()
    try:
        await cache.increment("typst:compile:total")
    except Exception:
        pass
    async with lock:
        assets, files, entry_path, style_key, style_text = (
            await _load_note_compile_inputs(db, note)
        )
        h = _compile_input_hash(
            assets=assets,
            files=files,
            entry_path=entry_path,
            style_key=style_key,
            style_text=style_text,
        )
        if note.compiled_hash == h:
            # 优先读取磁盘缓存文件
            if note.compiled_pdf_path:
                try:
                    p = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, note.compiled_pdf_path)
                    if os.path.exists(p):
                        pdf_bytes = await asyncio.to_thread(lambda: Path(p).read_bytes())
                        dur_ms = int((time.perf_counter() - started) * 1000)
                        logger.info(
                            "typst.compile ok cache_hit=true note_id={} dur_ms={} pdf_bytes={}",
                            note.id,
                            dur_ms,
                            len(pdf_bytes),
                        )
                        try:
                            await cache.increment("typst:compile:hit")
                        except Exception:
                            pass
                        try:
                            client = await cache.get_client()
                            await client.lpush("typst:compile:dur_ms", dur_ms)
                            await client.ltrim("typst:compile:dur_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
                            await client.lpush("typst:compile:cache_hit", 1)
                            await client.ltrim("typst:compile:cache_hit", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
                        except Exception:
                            pass
                        return pdf_bytes, h
                except Exception:
                    pass
            # 再读取数据库中的二进制PDF，并补写文件缓存
            if note.compiled_pdf:
                try:
                    pdf_bytes = bytes(note.compiled_pdf)
                    if not note.compiled_pdf_path:
                        rel = pdf_rel_path(note.id or 0, h)
                        await asyncio.to_thread(write_pdf_bytes, settings.TYPST_PDF_STORAGE_DIR, rel, pdf_bytes)
                        note.compiled_pdf_path = rel
                        note.compiled_pdf_size = len(pdf_bytes)
                        if not settings.TYPST_STORE_PDF_IN_DB:
                            note.compiled_pdf = None
                        await db.commit()
                        await db.refresh(note)
                    dur_ms = int((time.perf_counter() - started) * 1000)
                    logger.info("typst.compile ok cache_hit=true note_id={} dur_ms={} pdf_bytes={}", note.id, dur_ms, len(pdf_bytes))
                    try:
                        await cache.increment("typst:compile:hit")
                    except Exception:
                        pass
                    try:
                        client = await cache.get_client()
                        await client.lpush("typst:compile:dur_ms", dur_ms)
                        await client.ltrim("typst:compile:dur_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
                        await client.lpush("typst:compile:cache_hit", 1)
                        await client.ltrim("typst:compile:cache_hit", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
                    except Exception:
                        pass
                    return pdf_bytes, h
                except Exception:
                    pass
        try:
            await cache.increment("typst:compile:miss")
        except Exception:
            pass

        if settings.TYPST_COMPILE_USE_CELERY:
            # 如果启用了Celery，则不应在本地执行同步编译，除非作为降级方案
            # 但此函数(compile_note_pdf)现在主要作为Celery任务的实现或同步回退
            # 如果是API直接调用且配置了Celery，API层应该已经派发了任务
            # 这里我们继续执行本地编译（可能是Worker在执行，也可能是API层的同步回退）
            pass

        sem_wait_started = time.perf_counter()
        async with _compile_semaphore:
            waited_ms = int((time.perf_counter() - sem_wait_started) * 1000)
            try:
                pdf_bytes = await asyncio.to_thread(_compile_typst_project_to_pdf_bytes, entry_path, files, assets, style_text)
            except Exception as e:
                dur_ms = int((time.perf_counter() - started) * 1000)
                logger.warning("typst.compile fail note_id={} dur_ms={} waited_ms={} err={}", note.id, dur_ms, waited_ms, str(e))
                try:
                    await cache.increment("typst:compile:fail")
                except Exception:
                    pass
                raise

        rel = pdf_rel_path(note.id or 0, h)
        old_rel = note.compiled_pdf_path
        await asyncio.to_thread(write_pdf_bytes, settings.TYPST_PDF_STORAGE_DIR, rel, pdf_bytes)

        if old_rel and old_rel != rel:
            try:
                old_abs = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, old_rel)
                if os.path.exists(old_abs):
                    os.remove(old_abs)
            except Exception:
                pass

        note.compiled_hash = h
        note.compiled_pdf_path = rel
        note.compiled_pdf_size = len(pdf_bytes)
        note.compiled_pdf = pdf_bytes if settings.TYPST_STORE_PDF_IN_DB else None
        note.compiled_at = datetime.now()
        await db.commit()
        await db.refresh(note)
        dur_ms = int((time.perf_counter() - started) * 1000)
        logger.info("typst.compile ok cache_hit=false note_id={} dur_ms={} waited_ms={} pdf_bytes={}", note.id, dur_ms, waited_ms, len(pdf_bytes))
        try:
            await cache.increment("typst:compile:miss")
            client = await cache.get_client()
            await client.lpush("typst:compile:dur_ms", dur_ms)
            await client.ltrim("typst:compile:dur_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
            await client.lpush("typst:compile:waited_ms", waited_ms)
            await client.ltrim("typst:compile:waited_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
            await client.lpush("typst:compile:cache_hit", 0)
            await client.ltrim("typst:compile:cache_hit", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        except Exception:
            pass
        if not pdf_bytes:
            pdf_bytes = b""
        return pdf_bytes, h


async def get_cached_note_pdf(db: AsyncSession, note: TypstNote) -> Optional[bytes]:
    """仅读取已编译的 PDF 缓存（磁盘文件 > 数据库二进制），不触发任何编译。

    供公开/匿名端点使用：避免无认证用户访问未缓存笔记引发服务器编译（DoS 风险）。
    返回 None 表示当前无可用缓存，调用方应返回 404。
    """
    try:
        current_hash = await compute_note_compile_hash(db, note)
    except Exception:
        logger.warning(
            "typst.cache validation_failed note_id={}",
            getattr(note, "id", None),
        )
        return None
    if not note.compiled_hash or note.compiled_hash != current_hash:
        return None

    # 1) 优先读取磁盘缓存文件
    if note.compiled_pdf_path:
        try:
            p = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, note.compiled_pdf_path)
            if os.path.exists(p):
                return await asyncio.to_thread(lambda: Path(p).read_bytes())
        except Exception:
            pass

    # 2) 回退读取数据库中的二进制 PDF（注意：公开端点不回写文件缓存，避免副作用）
    if note.compiled_pdf:
        try:
            return bytes(note.compiled_pdf)
        except Exception:
            pass

    return None


async def list_assets(db: AsyncSession, note_id: int) -> List[TypstAsset]:
    res = await db.execute(select(TypstAsset).where(TypstAsset.note_id == note_id).order_by(TypstAsset.created_at.desc()))
    return list(res.scalars().all())


async def upsert_asset(db: AsyncSession, note_id: int, path: str, mime: str, content: bytes, uploaded_by_id: int | None = None) -> TypstAsset:
    safe_path = normalize_asset_path(path)
    sha256 = _sha256_bytes_hex(content or b"")
    size_bytes = int(len(content or b""))
    res = await db.execute(
        select(TypstAsset)
        .where(TypstAsset.note_id == note_id, TypstAsset.path == safe_path)
        .order_by(TypstAsset.id.asc())
    )
    existing_assets = list(res.scalars().all())
    if existing_assets:
        existing = existing_assets[0]
        for duplicate in existing_assets[1:]:
            await db.delete(duplicate)
        if len(existing_assets) > 1:
            logger.warning(
                "typst.asset duplicate rows repaired note_id={} path={} kept_id={} removed={}",
                note_id,
                safe_path,
                existing.id,
                len(existing_assets) - 1,
            )
        existing.mime = mime
        existing.content = content
        existing.sha256 = sha256
        existing.size_bytes = size_bytes
        existing.uploaded_by_id = uploaded_by_id
        await db.commit()
        await db.refresh(existing)
        return existing
    asset = TypstAsset(
        note_id=note_id,
        path=safe_path,
        mime=mime,
        content=content,
        sha256=sha256,
        size_bytes=size_bytes,
        uploaded_by_id=uploaded_by_id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def delete_asset(db: AsyncSession, note_id: int, asset_id: int) -> None:
    res = await db.execute(select(TypstAsset).where(TypstAsset.id == asset_id, TypstAsset.note_id == note_id))
    asset = res.scalar_one_or_none()
    if not asset:
        return
    await db.delete(asset)
    await db.commit()


async def get_asset(db: AsyncSession, note_id: int, asset_id: int) -> Optional[TypstAsset]:
    res = await db.execute(select(TypstAsset).where(TypstAsset.id == asset_id, TypstAsset.note_id == note_id))
    return res.scalar_one_or_none()
