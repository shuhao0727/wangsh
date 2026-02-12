from fastapi import APIRouter
from .export import router as export_router
from .conversations import router as conversations_router
from .usage import router as usage_router
from .analysis import router as analysis_router
from .stream import router as stream_router
from .crud import router as crud_router
from .group_discussion import router as group_discussion_router

router = APIRouter()
router.include_router(export_router)
router.include_router(conversations_router)
router.include_router(usage_router)
router.include_router(analysis_router)
router.include_router(stream_router)
router.include_router(crud_router)
router.include_router(group_discussion_router)
