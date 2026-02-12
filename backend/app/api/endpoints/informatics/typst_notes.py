import os
import asyncio
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, require_admin
from app.utils.rate_limit import rate_limiter
from app.tasks.typst_compile import compile_typst_note
from app.utils.typst_pdf_storage import abs_pdf_path
from app.utils.typst_asset_validation import validate_asset_upload
from app.celery_app import celery
from app.schemas.informatics.typst_note import TypstNoteCreate, TypstNoteListItem, TypstNoteResponse, TypstNoteUpdate
from app.schemas.informatics.typst_asset import TypstAssetListItem
from app.services.informatics.typst_notes import (
    compile_note_pdf,
    create_note,
    delete_note,
    delete_asset,
    get_asset,
    get_note,
    list_assets,
    list_notes,
    upsert_asset,
    update_note,
)

router = APIRouter(prefix="/informatics/typst-notes")


def _to_list_item(n) -> TypstNoteListItem:
    return TypstNoteListItem(
        id=n.id,
        title=n.title,
        summary=n.summary or "",
        category_path=n.category_path or "",
        published=bool(n.published),
        updated_at=n.updated_at,
        compiled_at=n.compiled_at,
    )


def _to_response(n) -> TypstNoteResponse:
    return TypstNoteResponse(
        id=n.id,
        title=n.title,
        summary=n.summary or "",
        category_path=n.category_path or "",
        published=bool(n.published),
        published_at=n.published_at,
        style_key=n.style_key or "my_style",
        entry_path=n.entry_path or "main.typ",
        files=n.files or {},
        toc=n.toc or [],
        content_typst=n.content_typst,
        created_by_id=n.created_by_id,
        compiled_hash=n.compiled_hash,
        compiled_at=n.compiled_at,
        created_at=n.created_at,
        updated_at=n.updated_at,
    )


@router.get("", response_model=List[TypstNoteListItem])
async def api_list_notes(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    notes = await list_notes(db=db, skip=skip, limit=limit, search=search)
    return [_to_list_item(n) for n in notes]


@router.post("", response_model=TypstNoteResponse)
async def api_create_note(
    payload: TypstNoteCreate,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(require_admin),
):
    note = await create_note(
        db=db,
        title=payload.title.strip(),
        content_typst=payload.content_typst or "",
        created_by_id=user.get("id"),
    )
    note = await update_note(
        db=db,
        note=note,
        summary=payload.summary,
        category_path=payload.category_path,
        published=payload.published,
        style_key=payload.style_key,
        entry_path=payload.entry_path,
        files=payload.files,
        toc=payload.toc,
        content_typst=payload.content_typst,
    )
    return _to_response(note)


@router.get("/{note_id}", response_model=TypstNoteResponse)
async def api_get_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    return _to_response(note)


@router.put("/{note_id}", response_model=TypstNoteResponse)
async def api_update_note(
    note_id: int,
    payload: TypstNoteUpdate,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    note = await update_note(
        db=db,
        note=note,
        title=payload.title,
        summary=payload.summary,
        category_path=payload.category_path,
        published=payload.published,
        style_key=payload.style_key,
        entry_path=payload.entry_path,
        files=payload.files,
        toc=payload.toc,
        content_typst=payload.content_typst,
    )
    return _to_response(note)


@router.get("/{note_id}/assets", response_model=list[TypstAssetListItem])
async def api_list_assets(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    assets = await list_assets(db=db, note_id=note_id)
    return [
        TypstAssetListItem(
            id=a.id,
            path=a.path,
            mime=a.mime,
            sha256=getattr(a, "sha256", None),
            size_bytes=getattr(a, "size_bytes", None),
            uploaded_by_id=getattr(a, "uploaded_by_id", None),
            created_at=a.created_at,
        )
        for a in assets
    ]


@router.post("/{note_id}/assets", response_model=TypstAssetListItem)
async def api_upload_asset(
    note_id: int,
    path: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    await rate_limiter.check(
        f"typst_asset_upload:{current_user.get('id')}:{note_id}",
        float(settings.TYPST_ASSET_UPLOAD_RATE_LIMIT_SECONDS),
    )
    content = await file.read()
    try:
        allowed = {x.strip().lower().lstrip(".") for x in str(settings.TYPST_ASSET_ALLOWED_EXTS or "").split(",") if x.strip()}
        rel_path, mime = validate_asset_upload(
            path=path,
            filename=file.filename or path,
            content_type=file.content_type,
            content=content,
            max_bytes=int(settings.TYPST_ASSET_MAX_BYTES),
            allowed_exts=allowed,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    a = await upsert_asset(
        db=db,
        note_id=note_id,
        path=rel_path,
        mime=mime,
        content=content,
        uploaded_by_id=int(current_user.get("id")) if current_user.get("id") is not None else None,
    )
    return TypstAssetListItem(
        id=a.id,
        path=a.path,
        mime=a.mime,
        sha256=getattr(a, "sha256", None),
        size_bytes=getattr(a, "size_bytes", None),
        uploaded_by_id=getattr(a, "uploaded_by_id", None),
        created_at=a.created_at,
    )


@router.delete("/{note_id}/assets/{asset_id}", response_model=Dict[str, bool])
async def api_delete_asset(
    note_id: int,
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    await delete_asset(db=db, note_id=note_id, asset_id=asset_id)
    return {"success": True}


@router.get("/{note_id}/assets/{asset_id}")
async def api_download_asset(
    note_id: int,
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    asset = await get_asset(db=db, note_id=note_id, asset_id=asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资源不存在")
    filename = os.path.basename(asset.path or f"asset-{asset.id}")
    return Response(
        content=bytes(asset.content),
        media_type=asset.mime or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{note_id}", response_model=Dict[str, bool])
async def api_delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    await delete_note(db=db, note=note)
    return {"success": True}


@router.get("/{note_id}/export.typ")
async def api_export_typ(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    filename = f"typst-note-{note.id}.typ"
    return Response(
        content=note.content_typst or "",
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{note_id}/compile")
async def api_compile_pdf(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    await rate_limiter.check(
        f"typst_compile:{current_user.get('id')}:{note_id}",
        float(settings.TYPST_COMPILE_RATE_LIMIT_SECONDS),
    )
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    try:
        if settings.TYPST_COMPILE_USE_CELERY:
            async_result = compile_typst_note.delay(note_id)
            try:
                await asyncio.to_thread(async_result.get, timeout=180)
            except Exception:
                await asyncio.to_thread(async_result.forget)
                pdf_bytes, _ = await compile_note_pdf(db=db, note=note)
            else:
                await db.refresh(note)
                if getattr(note, "compiled_pdf_path", None):
                    try:
                        p = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, note.compiled_pdf_path)
                        if os.path.exists(p):
                            filename = f"typst-note-{note.id}.pdf"
                            return FileResponse(
                                p,
                                media_type="application/pdf",
                                filename=filename,
                                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                            )
                    except Exception:
                        pass
                if not note.compiled_pdf:
                    raise HTTPException(status_code=500, detail="编译任务已完成，但未生成PDF")
                pdf_bytes = bytes(note.compiled_pdf)
        else:
            pdf_bytes, _ = await compile_note_pdf(db=db, note=note)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    filename = f"typst-note-{note.id}.pdf"
    if getattr(note, "compiled_pdf_path", None):
        try:
            p = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, note.compiled_pdf_path)
            if os.path.exists(p):
                return FileResponse(
                    p,
                    media_type="application/pdf",
                    filename=filename,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                )
        except Exception:
            pass
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{note_id}/compile-async")
async def api_compile_pdf_async(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    await rate_limiter.check(
        f"typst_compile_async:{current_user.get('id')}:{note_id}",
        float(settings.TYPST_COMPILE_RATE_LIMIT_SECONDS),
    )
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    if not settings.TYPST_COMPILE_USE_CELERY:
        raise HTTPException(status_code=400, detail="未启用异步编译")
    async_result = compile_typst_note.delay(note_id)
    return {"job_id": async_result.id, "note_id": note_id}


@router.get("/compile-jobs/{job_id}")
async def api_compile_job_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    r = celery.AsyncResult(job_id)
    state = str(getattr(r, "state", "PENDING") or "PENDING")
    info = getattr(r, "info", None)
    payload: Dict[str, Any] = {"job_id": job_id, "state": state}
    if state == "SUCCESS":
        try:
            result = r.get(timeout=0.1)
            payload["result"] = result if isinstance(result, dict) else None
            note_id = int((result or {}).get("note_id") or 0) if isinstance(result, dict) else 0
            if note_id:
                note = await get_note(db=db, note_id=note_id)
                payload["note_id"] = note_id
                payload["pdf_ready"] = bool(getattr(note, "compiled_pdf_path", None) or getattr(note, "compiled_pdf", None))
        except Exception:
            payload["result"] = None
    elif state == "FAILURE":
        payload["error"] = str(info) if info is not None else "编译失败"
    return payload


@router.post("/compile-jobs/{job_id}/cancel")
async def api_compile_job_cancel(
    job_id: str,
    _: Dict[str, Any] = Depends(require_admin),
):
    try:
        celery.control.revoke(job_id, terminate=True)
    except Exception:
        pass
    return {"success": True, "job_id": job_id}


@router.get("/{note_id}/export.pdf")
async def api_export_pdf(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    note = await get_note(db=db, note_id=note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在")
    filename = f"typst-note-{note.id}.pdf"
    if getattr(note, "compiled_pdf_path", None):
        try:
            p = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, note.compiled_pdf_path)
            if os.path.exists(p):
                return FileResponse(
                    p,
                    media_type="application/pdf",
                    filename=filename,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                )
        except Exception:
            pass
    if not note.compiled_pdf:
        raise HTTPException(status_code=404, detail="暂无已编译的PDF，请先点击导出/编译")
    return Response(
        content=bytes(note.compiled_pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
