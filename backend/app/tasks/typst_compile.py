from sqlalchemy import select

from app.celery_app import celery
from app.db.database import AsyncSessionLocal
from app.models.informatics.typst_note import TypstNote
from app.tasks._async_runner import run as run_async
from app.services.informatics.typst_notes import (
    TypstNoteDeletedError,
    compile_note_pdf,
)


async def _compile_note(note_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(TypstNote).where(
                TypstNote.id == note_id,
                TypstNote.is_deleted.is_(False),
            )
        )
        note = res.scalar_one_or_none()
        if not note:
            return {"note_id": note_id, "skipped": "deleted_or_missing"}
        try:
            pdf_bytes, compiled_hash = await compile_note_pdf(db=db, note=note)
        except TypstNoteDeletedError:
            return {"note_id": note_id, "skipped": "deleted_during_compile"}
        return {
            "note_id": note_id,
            "compiled_hash": compiled_hash,
            "pdf_bytes": len(pdf_bytes),
        }


@celery.task(
    name="app.tasks.typst_compile.compile_typst_note",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
)
def compile_typst_note(note_id: int) -> dict:
    return run_async(_compile_note(note_id))
