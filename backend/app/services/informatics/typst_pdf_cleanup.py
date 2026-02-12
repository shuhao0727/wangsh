import os
import time
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.informatics.typst_note import TypstNote
from app.utils.typst_pdf_storage import abs_pdf_path


async def cleanup_unreferenced_pdfs(db: AsyncSession, retention_days: int, dry_run: bool) -> dict:
    root = os.path.abspath(settings.TYPST_PDF_STORAGE_DIR)
    cutoff = time.time() - max(0, int(retention_days)) * 86400

    res = await db.execute(select(TypstNote.compiled_pdf_path).where(TypstNote.compiled_pdf_path.isnot(None)))
    referenced = {str(x[0]) for x in res.all() if x and x[0]}

    removed = 0
    kept = 0
    scanned = 0
    errors: list[str] = []

    if not os.path.exists(root):
        return {"root": root, "dry_run": dry_run, "retention_days": retention_days, "scanned": 0, "kept": 0, "removed": 0, "errors": []}

    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if not fn.lower().endswith(".pdf"):
                continue
            scanned += 1
            abs_path = os.path.join(dirpath, fn)
            try:
                rel = os.path.relpath(abs_path, root).replace("\\", "/")
                if rel in referenced:
                    kept += 1
                    continue
                st = os.stat(abs_path)
                if st.st_mtime > cutoff:
                    kept += 1
                    continue
                if not dry_run:
                    os.remove(abs_path)
                removed += 1
            except Exception as e:
                errors.append(f"{abs_path}: {e}")

    if not dry_run:
        for dirpath, dirnames, filenames in os.walk(root, topdown=False):
            if dirnames or filenames:
                continue
            try:
                os.rmdir(dirpath)
            except Exception:
                pass

    missing_referenced = 0
    for rel in list(referenced)[:2000]:
        try:
            p = abs_pdf_path(root, rel)
            if not os.path.exists(p):
                missing_referenced += 1
        except Exception:
            continue

    return {
        "root": root,
        "dry_run": dry_run,
        "retention_days": retention_days,
        "scanned": scanned,
        "kept": kept,
        "removed": removed,
        "referenced_count": len(referenced),
        "missing_referenced_sampled": missing_referenced,
        "errors": errors[:50],
    }

