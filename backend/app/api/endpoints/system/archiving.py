"""数据归档管理接口"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import require_admin
from app.tasks.data_archiving import archive_old_conversations, archive_old_analyses

router = APIRouter()


class ArchiveRequest(BaseModel):
    """归档请求参数"""
    days: int = Field(gt=0, le=3650, description="归档 N 天前的数据")


class ArchiveResponse(BaseModel):
    """归档响应"""
    task_id: str = Field(description="Celery 任务 ID")
    message: str = Field(description="提示信息")


@router.post("/conversations", response_model=ArchiveResponse)
async def trigger_archive_conversations(
    request: ArchiveRequest,
    _admin=Depends(require_admin),
) -> ArchiveResponse:
    """手动触发对话记录归档任务（管理员）

    Args:
        request: 归档参数
        _admin: 管理员依赖注入

    Returns:
        任务 ID 和提示信息
    """
    task = archive_old_conversations.delay(request.days)
    return ArchiveResponse(
        task_id=task.id,
        message=f"已提交对话归档任务，将归档 {request.days} 天前的数据"
    )


@router.post("/analyses", response_model=ArchiveResponse)
async def trigger_archive_analyses(
    request: ArchiveRequest,
    _admin=Depends(require_admin),
) -> ArchiveResponse:
    """手动触发分析记录归档任务（管理员）

    Args:
        request: 归档参数
        _admin: 管理员依赖注入

    Returns:
        任务 ID 和提示信息
    """
    task = archive_old_analyses.delay(request.days)
    return ArchiveResponse(
        task_id=task.id,
        message=f"已提交分析归档任务，将归档 {request.days} 天前的数据"
    )
