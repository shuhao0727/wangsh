import asyncio

from sqlalchemy import select

from app.celery_app import celery
from app.db.database import AsyncSessionLocal
from app.models.informatics.typst_note import TypstNote
from app.services.informatics.typst_notes import compile_note_pdf

_loop: asyncio.AbstractEventLoop | None = None


def _run(coro):
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    return _loop.run_until_complete(coro)


async def _compile_note(note_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(TypstNote).where(TypstNote.id == note_id))
        note = res.scalar_one_or_none()
        if not note:
            raise ValueError("笔记不存在")
        pdf_bytes, compiled_hash = await compile_note_pdf(db=db, note=note)
        return {
            "note_id": note_id,
            "compiled_hash": compiled_hash,
            "pdf_bytes": len(pdf_bytes),
        }


@celery.task(name="app.tasks.typst_compile.compile_typst_note")
def compile_typst_note(note_id: int) -> dict:
    return _run(_compile_note(note_id))
