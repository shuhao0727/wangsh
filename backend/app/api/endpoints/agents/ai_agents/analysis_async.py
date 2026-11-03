"""
AI 智能体深度分析异步端点

提供异步分析任务的创建、查询和管理接口
"""

from typing import Any, Dict, Optional

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.deps import get_db, require_admin
from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis
from sqlalchemy import func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter()


# ── Request/Response Schemas ──


class HotAnalysisAsyncRequest(BaseModel):
    """热点分析异步任务请求"""

    agent_id: int = Field(..., ge=1, description="智能体ID")
    start_at: str = Field(..., description="开始时间(ISO格式)")
    end_at: str = Field(..., description="结束时间(ISO格式)")
    task_sheet: str = Field(..., description="任务单内容")
    class_name: Optional[str] = Field(None, description="班级名称")
    bucket_seconds: int = Field(180, ge=30, le=900, description="时间桶大小(秒)")
    teacher_marks: Optional[list] = Field(None, description="教师标记列表")
    custom_prompt: Optional[str] = Field(None, description="自定义提示词")
    title: str = Field("未命名分析", description="分析标题")


class ChainAnalysisAsyncRequest(BaseModel):
    """问题链分析异步任务请求"""

    agent_id: int = Field(..., ge=1, description="智能体ID")
    start_at: str = Field(..., description="开始时间(ISO格式)")
    end_at: str = Field(..., description="结束时间(ISO格式)")
    class_name: Optional[str] = Field(None, description="班级名称")
    task_sheet: Optional[str] = Field(None, description="任务单内容")
    teacher_marks: Optional[list] = Field(None, description="教师标记列表")
    custom_prompt: Optional[str] = Field(None, description="自定义提示词")
    merge_threshold: float = Field(0.30, ge=0.0, le=1.0, description="相似问题合并阈值")
    title: str = Field("未命名分析", description="分析标题")


class TaskStatusResponse(BaseModel):
    """任务状态响应"""

    task_id: str
    status: str  # pending, progress, completed, failed
    progress: Optional[int] = None  # 0-100
    message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ── API Endpoints ──


@router.post("/analyses/hot-questions/async", response_model=Dict[str, Any])
async def create_hot_analysis_async(
    request: HotAnalysisAsyncRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    创建热点问题分析异步任务

    返回任务ID，客户端可通过 GET /analyses/tasks/{task_id} 查询进度和结果
    """
    from app.tasks.agent_analysis import analyze_hot_questions_task

    # 提交 Celery 任务
    task = analyze_hot_questions_task.delay(
        agent_id=request.agent_id,
        start_at=request.start_at,
        end_at=request.end_at,
        task_sheet=request.task_sheet,
        class_name=request.class_name,
        bucket_seconds=request.bucket_seconds,
        teacher_marks=request.teacher_marks,
        custom_prompt=request.custom_prompt,
        title=request.title,
        created_by=current_user.get("id"),
    )

    return {
        "success": True,
        "task_id": task.id,
        "status": "pending",
        "message": "热点分析任务已提交，请通过 task_id 查询进度",
    }


@router.post("/analyses/student-chains/async", response_model=Dict[str, Any])
async def create_chain_analysis_async(
    request: ChainAnalysisAsyncRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    创建学生问题链分析异步任务

    返回任务ID，客户端可通过 GET /analyses/tasks/{task_id} 查询进度和结果
    """
    from app.tasks.agent_analysis import analyze_student_chains_task

    # 提交 Celery 任务
    task = analyze_student_chains_task.delay(
        agent_id=request.agent_id,
        start_at=request.start_at,
        end_at=request.end_at,
        class_name=request.class_name,
        task_sheet=request.task_sheet,
        teacher_marks=request.teacher_marks,
        custom_prompt=request.custom_prompt,
        merge_threshold=request.merge_threshold,
        title=request.title,
        created_by=current_user.get("id"),
    )

    return {
        "success": True,
        "task_id": task.id,
        "status": "pending",
        "message": "问题链分析任务已提交，请通过 task_id 查询进度",
    }


@router.get("/analyses/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_analysis_task_status(
    task_id: str,
    current_user: Dict[str, Any] = Depends(require_admin),
):
    """
    查询分析任务状态和进度

    状态说明：
    - pending: 任务排队中
    - progress: 执行中（返回 progress 进度百分比）
    - completed: 已完成（返回 result 包含 analysis_id）
    - failed: 失败（返回 error 错误信息）
    """
    task = AsyncResult(task_id)

    # 任务未完成
    if not task.ready():
        state = task.state
        if state == "PROGRESS":
            # 执行中，返回进度信息
            info = task.info or {}
            return TaskStatusResponse(
                task_id=task_id,
                status="progress",
                progress=info.get("progress", 0),
                message=info.get("status", "正在执行..."),
            )
        else:
            # 排队中
            return TaskStatusResponse(
                task_id=task_id,
                status="pending",
                message="任务排队中，等待执行",
            )

    # 任务已完成
    if task.successful():
        result = task.result
        return TaskStatusResponse(
            task_id=task_id,
            status="completed",
            progress=100,
            message="分析完成",
            result=result,
        )

    # 任务失败
    return TaskStatusResponse(
        task_id=task_id,
        status="failed",
        message="任务执行失败",
        error=str(task.info),
    )


@router.delete("/analyses/tasks/{task_id}")
async def cancel_analysis_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(require_admin),
):
    """
    取消正在执行的分析任务

    注意：只能取消尚未开始或正在执行的任务，已完成的任务无法取消
    """
    task = AsyncResult(task_id)

    if task.ready():
        return {
            "success": False,
            "message": "任务已完成，无法取消",
            "status": task.state,
        }

    # 撤销任务
    task.revoke(terminate=True)

    return {
        "success": True,
        "message": "任务已取消",
        "task_id": task_id,
    }


def _task_columns(model):
    """Shared projection for the two analysis tables (same public fields)."""
    return (
        model.id.label("id"),
        model.title.label("title"),
        model.agent_id.label("agent_id"),
        model.class_name.label("class_name"),
        model.created_at.label("created_at"),
    )


def _task_item(row) -> Dict[str, Any]:
    created_at = row["created_at"]
    return {
        "id": row["id"],
        "title": row["title"],
        "agent_id": row["agent_id"],
        "class_name": row["class_name"],
        "created_at": created_at.isoformat() if created_at else None,
        "type": row["type"],
    }


async def _task_total(db: AsyncSession, analysis_type: Optional[str]) -> int:
    if analysis_type == "hot_questions":
        models = (HotQuestionAnalysis,)
    elif analysis_type == "student_chains":
        models = (StudentChainAnalysis,)
    else:
        models = (HotQuestionAnalysis, StudentChainAnalysis)
    total = 0
    for model in models:
        count = await db.scalar(select(func.count()).select_from(model))
        total += int(count or 0)
    return total


@router.get("/analyses/tasks", response_model=Dict[str, Any])
async def list_analysis_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    analysis_type: Optional[str] = Query(None, description="hot_questions 或 student_chains"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    列出最近的分析任务记录。

    `total` 是筛选后的全量条数；混合列表使用同一条 SQL 的
    ORDER BY/OFFSET/LIMIT，避免先各取一半再在内存分页造成重复/漏项。
    """
    if analysis_type == "hot_questions":
        query = select(
            *_task_columns(HotQuestionAnalysis),
            literal("hot_questions").label("type"),
        )
    elif analysis_type == "student_chains":
        query = select(
            *_task_columns(StudentChainAnalysis),
            literal("student_chains").label("type"),
        )
    else:
        hot = select(
            *_task_columns(HotQuestionAnalysis),
            literal("hot_questions").label("type"),
        )
        chains = select(
            *_task_columns(StudentChainAnalysis),
            literal("student_chains").label("type"),
        )
        combined = union_all(hot, chains).subquery()
        query = select(combined)

    if analysis_type in ("hot_questions", "student_chains"):
        rows = (
            await db.execute(
                query.order_by(
                    HotQuestionAnalysis.created_at.desc()
                    if analysis_type == "hot_questions"
                    else StudentChainAnalysis.created_at.desc(),
                    HotQuestionAnalysis.id.desc()
                    if analysis_type == "hot_questions"
                    else StudentChainAnalysis.id.desc(),
                )
                .offset(skip)
                .limit(limit)
            )
        ).mappings().all()
    else:
        rows = (
            await db.execute(
                query.order_by(
                    combined.c.created_at.desc(),
                    combined.c.id.desc(),
                )
                .offset(skip)
                .limit(limit)
            )
        ).mappings().all()

    return {
        "success": True,
        "data": [_task_item(row) for row in rows],
        "total": await _task_total(db, analysis_type),
    }
