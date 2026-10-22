"""Batch configuration and idempotent, serialized student submission."""
import hashlib
import json
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, select

from app.models.it.knn import KnnBatch, KnnRosterEntry, KnnSubmission
from app.schemas.it.knn import student_key
from app.services.it.knn_common import (answer_info, details, find_student, get_batch,
    now, phase, public_info, roster, writing)


async def list_batches(db, user=None):
    query = select(KnnBatch).order_by(KnnBatch.created_at.desc())
    if user is None:
        query = query.where(KnnBatch.state == "scheduled", KnnBatch.ends_at > now())
    elif user.get("role_code") not in {"admin", "super_admin"}:
        query = query.where(KnnBatch.created_by == user.get("id"))
    batches = (await db.scalars(query)).all()
    if user is None:
        return [public_info(b) for b in batches]
    return [await details(db, b, include_rows=False) for b in batches]


def add_entry(db, batch_id, number, position):
    db.add(KnnRosterEntry(batch_id=batch_id, student_no=number,
        student_key=student_key(number), position=position, current_revision=0, refill_allowed=False))


async def create_batch(db, data, user):
    batch = KnnBatch(id=str(uuid4()), title=data.title, starts_at=data.starts_at,
        ends_at=data.ends_at, created_by=user["id"], state="draft")
    try:
        db.add(batch)
        await db.flush()
        for i, number in enumerate(data.student_numbers):
            add_entry(db, batch.id, number, i)
        await db.commit()
        await db.refresh(batch)
    except BaseException:
        await db.rollback()
        raise
    return await details(db, batch)


async def update_batch(db, batch_id, data, user):
    async with writing(db, batch_id, user) as batch:
        entries = await roster(db, batch_id)
        incoming = {student_key(n) for n in data.student_numbers}
        if any(e.current_revision and e.student_key not in incoming for e in entries):
            raise HTTPException(409, "不能从名单移除已提交的学生")
        old = {e.student_key: e for e in entries}
        for e in entries:
            if e.student_key not in incoming:
                await db.delete(e)
        for i, number in enumerate(data.student_numbers):
            entry = old.get(student_key(number))
            if entry is None:
                add_entry(db, batch_id, number, i)
            else:
                entry.student_no, entry.position = number, i
        batch.title, batch.starts_at, batch.ends_at = data.title, data.starts_at, data.ends_at
    return await details(db, batch)


async def change_state(db, batch_id, action, user):
    async with writing(db, batch_id, user) as batch:
        if action == "close":
            batch.state = "closed"
        else:
            if batch.ends_at <= now():
                raise HTTPException(409, "截止时间已过，请先修改时间")
            if action == "start":
                batch.starts_at = now()
            batch.state = "scheduled"
    return await details(db, batch)


async def check_student(db, batch_id, number):
    batch = await get_batch(db, batch_id)
    entry = await find_student(db, batch_id, number)
    return {**public_info(batch), "student_no": entry.student_no,
            "current_revision": entry.current_revision, "refill_allowed": entry.refill_allowed,
            "can_submit": phase(batch) == "open" and (entry.current_revision == 0 or entry.refill_allowed)}


def receipt(entry, answer):
    return {"student_no": entry.student_no, "revision": answer.revision,
            "submitted_at": answer.submitted_at}


async def submit(db, batch_id, data):
    body = {"features": data.features, "label": data.label, "display_consent": data.display_consent,
            "expected_revision": data.expected_revision}
    digest = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    async with writing(db, batch_id) as batch:
        entry = await find_student(db, batch_id, data.student_no)
        previous = (await db.scalars(select(KnnSubmission).where(
            KnnSubmission.roster_id == entry.id, KnnSubmission.request_id == str(data.request_id),
        ))).one_or_none()
        if previous:
            if previous.payload_hash != digest:
                raise HTTPException(409, "提交凭证已使用，请重新核对填写内容")
            result = receipt(entry, previous)
        else:
            if phase(batch) != "open":
                raise HTTPException(409, "当前不在收集时间内，请向老师确认")
            if data.expected_revision != entry.current_revision:
                raise HTTPException(409, "提交状态已变化，请重新核对学号")
            if entry.current_revision and not entry.refill_allowed:
                raise HTTPException(409, "该学号已经提交，如需修改请联系老师允许重填")
            answer = KnnSubmission(roster_id=entry.id, revision=entry.current_revision + 1,
                request_id=str(data.request_id), payload_hash=digest, features=data.features,
                label=data.label, display_consent=data.display_consent)
            db.add(answer)
            entry.current_revision += 1
            entry.refill_allowed = False
            await db.flush()
            result = receipt(entry, answer)
    return result


async def allow_refill(db, batch_id, data, user):
    async with writing(db, batch_id, user) as batch:
        entries = [await find_student(db, batch_id, n) for n in data.student_numbers]
        if any(e.current_revision == 0 for e in entries):
            raise HTTPException(409, "尚未提交的学生可直接填写，无需授权重填")
        for entry in entries:
            entry.refill_allowed = data.allowed
    return await details(db, batch)


async def history(db, batch_id, number, user):
    await get_batch(db, batch_id, user)
    entry = await find_student(db, batch_id, number)
    answers = (await db.scalars(select(KnnSubmission).where(
        KnnSubmission.roster_id == entry.id,
    ).order_by(KnnSubmission.revision.desc()))).all()
    return {"student_no": entry.student_no, "answers": [answer_info(a) for a in answers]}


async def delete_batch(db, batch_id, user):
    async with writing(db, batch_id, user) as batch:
        # 采集中（open）的批次禁止删除，避免学生提交中途失效；
        # 草稿、待开始与已结束的批次允许连同名单、答案一并删除。
        if phase(batch) == "open":
            raise HTTPException(409, "采集中不能删除批次，请先结束收集")
        await db.execute(delete(KnnRosterEntry).where(KnnRosterEntry.batch_id == batch_id))
        await db.delete(batch)
    return {"ok": True}
