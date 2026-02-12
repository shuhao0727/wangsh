from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.informatics.typst_note import TypstNotePublicListItem, TypstNotePublicResponse
from app.services.informatics.typst_notes import compile_note_pdf, get_note, list_published_notes

router = APIRouter(prefix="/public/informatics/typst-notes")


@router.get("", response_model=List[TypstNotePublicListItem])
async def public_list_notes(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    notes = await list_published_notes(db=db, skip=skip, limit=limit, search=search)
    return [
        TypstNotePublicListItem(
            id=n.id,
            title=n.title,
            summary=n.summary or "",
            category_path=n.category_path or "",
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
    try:
        pdf_bytes, _ = await compile_note_pdf(db=db, note=note)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
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
