"""Shared KNN ownership, locking and read projections."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select

from app.models.it.knn import KnnBatch, KnnRosterEntry, KnnSubmission
from app.schemas.it.knn import student_key


def now():
    return datetime.now(timezone.utc)


def phase(batch):
    if batch.state in {"draft", "closed"}:
        return batch.state
    clock = now()
    if clock < batch.starts_at:
        return "scheduled"
    return "open" if clock < batch.ends_at else "ended"


def authorize(batch, user):
    if user.get("role_code") not in {"admin", "super_admin"} and batch.created_by != user.get("id"):
        raise HTTPException(403, "只能管理自己创建的采集批次")


async def get_batch(db, batch_id, user=None, lock=False):
    query = select(KnnBatch).where(KnnBatch.id == batch_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    batch = (await db.execute(query)).scalar_one_or_none()
    if batch is None:
        raise HTTPException(404, "采集批次不存在")
    if user is not None:
        authorize(batch, user)
    return batch


@asynccontextmanager
async def writing(db, batch_id, user=None):
    try:
        batch = await get_batch(db, batch_id, user, lock=True)
        yield batch
        await db.commit()
    except BaseException:
        await db.rollback()
        raise


async def roster(db, batch_id):
    return list((await db.scalars(select(KnnRosterEntry).where(
        KnnRosterEntry.batch_id == batch_id,
    ).order_by(KnnRosterEntry.position))).all())


async def find_student(db, batch_id, number):
    try:
        key = student_key(number)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    entry = (await db.scalars(select(KnnRosterEntry).where(
        KnnRosterEntry.batch_id == batch_id, KnnRosterEntry.student_key == key,
    ))).one_or_none()
    if entry is None:
        raise HTTPException(404, "学号不在本次名单中，请向老师确认")
    return entry


def public_info(batch):
    return {"id": batch.id, "title": batch.title, "starts_at": batch.starts_at,
            "ends_at": batch.ends_at, "phase": phase(batch)}


def answer_info(answer):
    return {"revision": answer.revision, "features": answer.features,
            "label": answer.label, "display_consent": answer.display_consent,
            "submitted_at": answer.submitted_at}


async def details(db, batch, include_rows=True):
    entries = await roster(db, batch.id)
    submitted = sum(e.current_revision > 0 for e in entries)
    result = {**public_info(batch), "state": batch.state, "created_at": batch.created_at,
              "expected": len(entries), "submitted": submitted, "missing": len(entries) - submitted,
              "pending_refill": sum(e.refill_allowed for e in entries), "frozen_at": batch.frozen_at}
    if include_rows:
        answers = (await db.scalars(select(KnnSubmission).join(KnnRosterEntry).where(
            KnnRosterEntry.batch_id == batch.id,
            KnnSubmission.revision == KnnRosterEntry.current_revision,
        ))).all()
        current = {a.roster_id: a for a in answers}
        result["rows"] = [{"student_no": e.student_no, "current_revision": e.current_revision,
                           "refill_allowed": e.refill_allowed,
                           "answer": answer_info(current[e.id]) if e.id in current else None} for e in entries]
    return result
