import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.informatics.github_sync_source import InformaticsGithubSyncSource
from app.schemas.informatics.typst_note import TypstNotePublicListItem, TypstNotePublicResponse
from app.services.informatics.typst_notes import compile_note_pdf, get_note, list_published_notes

router = APIRouter(prefix="/public/informatics/typst-notes")


@router.get("", response_model=List[TypstNotePublicListItem])
async def public_list_notes(
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    notes = await list_published_notes(db=db, skip=skip, limit=limit, search=search)
    note_ids = [int(n.id) for n in notes if n.id is not None]
    source_path_map: dict[int, str] = {}
    if note_ids:
        src_res = await db.execute(
            select(InformaticsGithubSyncSource.note_id, InformaticsGithubSyncSource.source_path).where(
                InformaticsGithubSyncSource.note_id.in_(note_ids),
                InformaticsGithubSyncSource.is_active.is_(True),
            )
        )
        for row in src_res.all():
            nid = int(row[0])
            if nid not in source_path_map:
                source_path_map[nid] = str(row[1] or "")
    return [
        TypstNotePublicListItem(
            id=n.id,
            title=n.title,
            summary=n.summary or "",
            category_path=n.category_path or "",
            source_path=source_path_map.get(int(n.id), ""),
            updated_at=n.updated_at,
        )
        for n in notes
    ]


@router.get("/{note_id}", response_model=TypstNotePublicResponse)
async def public_get_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
):
    note = await get_note(db=db, note_id=note_id)
    if not note or not note.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="内容不存在")
    return TypstNotePublicResponse(
        id=note.id,
        title=note.title,
        summary=note.summary or "",
        toc=note.toc or [],
        updated_at=note.updated_at,
    )


@router.get("/{note_id}/export.pdf")
async def public_export_pdf(
    note_id: int,
    db: AsyncSession = Depends(get_db),
):
    note = await get_note(db=db, note_id=note_id)
    if not note or not note.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="内容不存在")
    
    # 优先尝试直接从文件缓存读取，避免不必要的编译（和可能的权限问题）
    if getattr(note, "compiled_pdf_path", None):
        try:
            from app.core.config import settings
            from app.utils.typst_pdf_storage import abs_pdf_path
            p = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, note.compiled_pdf_path)
            if os.path.exists(p):
                filename = f"typst-note-{note.id}.pdf"
                from fastapi.responses import FileResponse
                return FileResponse(
                    p,
                    media_type="application/pdf",
                    filename=filename,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                )
        except Exception:
            pass

    try:
        pdf_bytes, _ = await compile_note_pdf(db=db, note=note)
    except Exception as e:
        # 如果是只读文件系统错误，尝试降级处理或给出更友好的提示
        msg = str(e)
        if "Read-only file system" in msg:
             # 可能是因为容器内无写权限，但如果之前有缓存，我们应该已经命中了上面的逻辑
             # 如果走到这里，说明没有缓存，且编译尝试写入失败
             pass
        raise HTTPException(status_code=400, detail=msg)
    filename = f"typst-note-{note.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{note_id}/export.typ")
async def public_export_typ(
    note_id: int,
    db: AsyncSession = Depends(get_db),
):
    note = await get_note(db=db, note_id=note_id)
    if not note or not note.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="内容不存在")
    filename = f"typst-note-{note.id}.typ"
    return Response(
        content=note.content_typst or "",
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
