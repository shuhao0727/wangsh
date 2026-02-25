from typing import Optional, List, Dict, Any

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.schemas.agents import HotQuestionBucket, StudentChainSession
from app.services.agents import analyze_hot_questions, analyze_student_chains

router = APIRouter()


@router.get("/analysis/hot-questions", response_model=List[HotQuestionBucket])
async def hot_questions(
    agent_id: int = Query(..., ge=1, description="智能体ID"),
    start_at: Optional[datetime] = Query(None, description="开始时间(ISO)"),
    end_at: Optional[datetime] = Query(None, description="结束时间(ISO)"),
    bucket_seconds: int = Query(60, ge=30, le=900, description="时间桶(秒)，如60/180"),
    top_n: int = Query(10, ge=1, le=50, description="每个时间桶返回TopN问题"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    effective_end = end_at or now
    effective_start = start_at or (effective_end - timedelta(hours=1))
    return await analyze_hot_questions(
        db,
        agent_id=agent_id,
        start_at=effective_start,
        end_at=effective_end,
        bucket_seconds=bucket_seconds,
        top_n=top_n,
    )


@router.get("/analysis/student-chains", response_model=List[StudentChainSession])
async def student_chains(
    agent_id: int = Query(..., ge=1, description="智能体ID"),
    user_id: Optional[int] = Query(None, ge=1, description="用户ID"),
    student_id: Optional[str] = Query(None, description="学号"),
    class_name: Optional[str] = Query(None, description="班级名称"),
    start_at: Optional[datetime] = Query(None, description="开始时间(ISO)"),
    end_at: Optional[datetime] = Query(None, description="结束时间(ISO)"),
    limit_sessions: int = Query(5, ge=1, le=20, description="最多返回会话数"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    effective_end = end_at or now
    effective_start = start_at or (effective_end - timedelta(hours=1))
    return await analyze_student_chains(
        db,
        agent_id=agent_id,
        user_id=user_id,
        student_id=student_id,
        class_name=class_name,
        start_at=effective_start,
        end_at=effective_end,
        limit_sessions=limit_sessions,
    )
