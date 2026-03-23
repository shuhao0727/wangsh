from fastapi import APIRouter
from .admin import router as admin_router
from .student import router as student_router
from .plan import router as plan_router

router = APIRouter()
router.include_router(admin_router, prefix="/admin", tags=["classroom-admin"])
router.include_router(student_router, tags=["classroom-student"])
router.include_router(plan_router, prefix="/plans", tags=["classroom-plan"])
