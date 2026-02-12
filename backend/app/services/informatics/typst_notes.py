import hashlib
import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import time
from datetime import datetime
from typing import List, Optional, Tuple
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from loguru import logger
from app.core.config import settings
from app.utils.cache import cache
from app.utils.typst_pdf_storage import abs_pdf_path, pdf_rel_path, write_pdf_bytes
from app.utils.typst_asset_validation import normalize_asset_path
from app.models.informatics.typst_note import TypstNote
from app.models.informatics.typst_asset import TypstAsset
from app.services.informatics.typst_styles import read_resource_style
from app.models.informatics.typst_style import TypstStyle

_compile_locks: dict[int, asyncio.Lock] = {}
_compile_semaphore = asyncio.Semaphore(max(1, int(getattr(settings, "TYPST_COMPILE_MAX_CONCURRENCY", 2))))


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _sha256_bytes_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


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
    stmt = stmt.order_by(TypstNote.updated_at.desc()).offset(skip).limit(limit)
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
    stmt = stmt.order_by(TypstNote.updated_at.desc()).offset(skip).limit(limit)
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
    if title is not None:
        note.title = title
    if summary is not None:
        note.summary = summary
    if category_path is not None:
        note.category_path = category_path
    if published is not None and bool(published) != bool(note.published):
        note.published = bool(published)
        note.published_at = datetime.now() if note.published else None
    if style_key is not None:
        note.style_key = style_key
    if entry_path is not None:
        note.entry_path = entry_path
    if files is not None:
        note.files = files
        if isinstance(files, dict) and "main.typ" in files:
            note.content_typst = files.get("main.typ") or ""
    if toc is not None:
        note.toc = toc
    if content_typst is not None:
        note.content_typst = content_typst

    await db.commit()
    await db.refresh(note)
    return note




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
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            msg = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(msg or "typst 编译失败")
        with open(output_path, "rb") as f:
            return f.read()


def _write_project_files(tmpdir: str, entry_path: str, files: dict, assets: List[TypstAsset], style_text: str) -> str:
    ep = (entry_path or "main.typ").lstrip("/").strip()
    if not ep:
        ep = "main.typ"

    if not isinstance(files, dict) or len(files) == 0:
        files = {"main.typ": ""}

    if style_text and style_text.strip():
        files["style/my_style.typ"] = style_text

    try:
        if ep in files:
            s = files.get(ep) or ""
            if 'import "style/my_style.typ"' not in s and "import 'style/my_style.typ'" not in s:
                files[ep] = '#import "style/my_style.typ":my_style\n' + s
    except Exception:
        pass

    for rel_path, source in files.items():
        if not isinstance(rel_path, str):
            continue
        p = rel_path.lstrip("/").strip()
        if not p:
            continue
        abs_path = os.path.join(tmpdir, p)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(source or "")

    for a in assets or []:
        p = (a.path or "").lstrip("/").strip()
        if not p:
            continue
        abs_path = os.path.join(tmpdir, p)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "wb") as f:
            f.write(bytes(a.content))

    return ep


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
        proc = subprocess.run(cmd, capture_output=True, text=True)
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
        assets = []
        if note.id:
            res = await db.execute(select(TypstAsset).where(TypstAsset.note_id == note.id))
            assets = list(res.scalars().all())

        files = note.files if isinstance(note.files, dict) else {"main.typ": note.content_typst or ""}
        entry_path = note.entry_path or "main.typ"
        style_key = note.style_key or "my_style"
        style_text = ""
        try:
            res = await db.execute(select(TypstStyle).where(TypstStyle.key == style_key))
            s = res.scalar_one_or_none()
            style_text = (s.content if s else "") or ""
        except Exception:
            style_text = ""
        if not style_text.strip():
            style_text = read_resource_style(key=style_key)

        asset_sig = [{"path": a.path, "sha256": _sha256_bytes_hex(bytes(a.content))} for a in assets]
        h = _sha256_hex(
            json.dumps(
                {"style_key": style_key, "style_text": style_text, "entry_path": entry_path, "files": files, "assets": asset_sig},
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        if note.compiled_hash == h:
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
            if note.compiled_pdf:
                if not note.compiled_pdf_path:
                    try:
                        rel = pdf_rel_path(note.id or 0, h)
                        pdf_bytes = bytes(note.compiled_pdf)
                        await asyncio.to_thread(write_pdf_bytes, settings.TYPST_PDF_STORAGE_DIR, rel, pdf_bytes)
                        note.compiled_pdf_path = rel
                        note.compiled_pdf_size = len(pdf_bytes)
                        if not settings.TYPST_STORE_PDF_IN_DB:
                            note.compiled_pdf = None
                        await db.commit()
                        await db.refresh(note)
                    except Exception:
                        pdf_bytes = bytes(note.compiled_pdf)
                else:
                    pdf_bytes = bytes(note.compiled_pdf)
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
        try:
            await cache.increment("typst:compile:miss")
        except Exception:
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
        await asyncio.to_thread(write_pdf_bytes, settings.TYPST_PDF_STORAGE_DIR, rel, pdf_bytes)

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
            client = await cache.get_client()
            await client.lpush("typst:compile:dur_ms", dur_ms)
            await client.ltrim("typst:compile:dur_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
            await client.lpush("typst:compile:waited_ms", waited_ms)
            await client.ltrim("typst:compile:waited_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
            await client.lpush("typst:compile:cache_hit", 0)
            await client.ltrim("typst:compile:cache_hit", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        except Exception:
            pass
        return pdf_bytes, h


async def list_assets(db: AsyncSession, note_id: int) -> List[TypstAsset]:
    res = await db.execute(select(TypstAsset).where(TypstAsset.note_id == note_id).order_by(TypstAsset.created_at.desc()))
    return list(res.scalars().all())


async def upsert_asset(db: AsyncSession, note_id: int, path: str, mime: str, content: bytes, uploaded_by_id: int | None = None) -> TypstAsset:
    safe_path = normalize_asset_path(path)
    sha256 = _sha256_bytes_hex(content or b"")
    size_bytes = int(len(content or b""))
    res = await db.execute(select(TypstAsset).where(TypstAsset.note_id == note_id, TypstAsset.path == safe_path))
    existing = res.scalar_one_or_none()
    if existing:
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
