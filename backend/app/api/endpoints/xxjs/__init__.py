from fastapi import APIRouter
from .dianming import router as dianming_router

router = APIRouter()
router.include_router(dianming_router, prefix="/dianming", tags=["xxjs-dianming"])
