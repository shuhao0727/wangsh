"""Anonymous collection and staff-owned KNN batch management."""
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_staff
from app.db.database import get_db
from app.schemas.it.knn import BatchAction, BatchCreate, BatchUpdate, Freeze, Refill, StudentCheck, Submit
from app.services.it import knn, knn_exports
from app.services.it.knn_common import details, get_batch, public_info


def no_store(response: Response):
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/it/knn", dependencies=[Depends(no_store)])
admin_router = APIRouter(prefix="/admin/it/knn", dependencies=[Depends(no_store)])


@router.get("/batches")
async def public_batches(db: AsyncSession = Depends(get_db)):
    return await knn.list_batches(db)


@router.get("/batches/{batch_id}")
async def public_batch(batch_id: str, db: AsyncSession = Depends(get_db)):
    return public_info(await get_batch(db, batch_id))


@router.post("/batches/{batch_id}/check")
async def check(batch_id: str, data: StudentCheck, db: AsyncSession = Depends(get_db)):
    return await knn.check_student(db, batch_id, data.student_no)


@router.post("/batches/{batch_id}/submissions", status_code=201)
async def submit(batch_id: str, data: Submit, db: AsyncSession = Depends(get_db)):
    return await knn.submit(db, batch_id, data)


@admin_router.get("/batches")
async def batches(db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn.list_batches(db, user)


@admin_router.post("/batches", status_code=201)
async def create(data: BatchCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn.create_batch(db, data, user)


@admin_router.get("/batches/{batch_id}")
async def detail(batch_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await details(db, await get_batch(db, batch_id, user))


@admin_router.put("/batches/{batch_id}")
async def update(batch_id: str, data: BatchUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn.update_batch(db, batch_id, data, user)


@admin_router.delete("/batches/{batch_id}")
async def delete(batch_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn.delete_batch(db, batch_id, user)


@admin_router.post("/batches/{batch_id}/state")
async def state(batch_id: str, data: BatchAction, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn.change_state(db, batch_id, data.action, user)


@admin_router.post("/batches/{batch_id}/refill")
async def refill(batch_id: str, data: Refill, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn.allow_refill(db, batch_id, data, user)


@admin_router.get("/batches/{batch_id}/history/{student_no}")
async def history(batch_id: str, student_no: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn.history(db, batch_id, student_no, user)


@admin_router.get("/batches/{batch_id}/export.csv")
async def csv_export(batch_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return Response(await knn_exports.export_csv(db, batch_id, user), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="knn-responses.csv"', "Cache-Control": "no-store"})


@admin_router.post("/batches/{batch_id}/freeze")
async def freeze(batch_id: str, data: Freeze, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn_exports.freeze(db, batch_id, data, user)


@admin_router.get("/batches/{batch_id}/frozen")
async def frozen(batch_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    return await knn_exports.frozen(db, batch_id, user)
