"""Teacher-only CSV export and immutable anonymized classroom snapshots."""
import csv
import io

from fastapi import HTTPException

from app.schemas.it.knn import student_key
from app.services.it.knn_common import details, get_batch, now, writing

DIMENSIONS = ["球类对抗", "力量", "耐力", "技巧", "团队配合", "日常活动"]


def csv_cell(value):
    text = str(value)
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else text


async def export_csv(db, batch_id, user):
    batch = await get_batch(db, batch_id, user)
    data = await details(db, batch)
    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(["学号", "状态", "版本", "允许重填", *[f"{d}{s}" for d in DIMENSIONS for s in ["天数", "喜欢程度"]],
                     "运动意向", "同意匿名展示", "提交时间"])
    for row in data["rows"]:
        answer = row["answer"]
        writer.writerow([csv_cell(row["student_no"]), "已提交" if answer else "未提交", row["current_revision"],
            "是" if row["refill_allowed"] else "否", *(answer["features"] if answer else [""] * 12),
            answer["label"] if answer else "", "是" if answer and answer["display_consent"] else "否",
            answer["submitted_at"].isoformat() if answer else ""])
    return "\ufeff" + stream.getvalue()


async def freeze(db, batch_id, data, user):
    async with writing(db, batch_id, user) as batch:
        if batch.frozen_data is not None:
            raise HTTPException(409, "本批数据已冻结，请直接下载，冻结结果不会被后续答案覆盖")
        rows = (await details(db, batch))["rows"]
        valid = [r for r in rows if r["answer"]]
        if len(valid) < 4:
            raise HTTPException(409, "至少收集 4 份有效答案后才能冻结课堂数据")
        candidates = [r for r in valid if r["answer"]["display_consent"]]
        if data.a_student_no:
            try:
                key = student_key(data.a_student_no)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
            candidates = [r for r in candidates if student_key(r["student_no"]) == key]
        if not candidates:
            raise HTTPException(409, "请选择已同意匿名课堂展示的学生 A")
        chosen = candidates[0]
        students = [{"id": f"S{i:02d}", "label": r["answer"]["label"], "features": r["answer"]["features"]}
                    for i, r in enumerate(valid, 1)]
        a_id = students[valid.index(chosen)]["id"]
        batch.frozen_data = {"version": 1, "aId": a_id, "students": students}
        batch.frozen_at = now()
    return batch.frozen_data


async def frozen(db, batch_id, user):
    batch = await get_batch(db, batch_id, user)
    if batch.frozen_data is None:
        raise HTTPException(404, "尚未冻结课堂数据")
    return batch.frozen_data
