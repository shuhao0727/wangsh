from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin, require_user
from app.utils.errors import safe_error_detail
from app.schemas.agents import (
    AgentUsageCreate,
    AgentUsageResponse,
    AgentUsageListResponse,
    AgentUsageStatistics,
)
from app.services.agents import (
    create_agent_usage,
    get_agent_usage_list,
    get_agent_usage_statistics,
)

router = APIRouter()


@router.get("/usage", response_model=AgentUsageListResponse)
async def read_agent_usage(
    db: AsyncSession = Depends(get_db),
    keyword: Optional[str] = Query(None, description="关键词搜索问题或回答"),
    student_id: Optional[str] = Query(None, description="学号"),
    student_name: Optional[str] = Query(None, description="学生姓名"),
    class_name: Optional[str] = Query(None, description="班级"),
    grade: Optional[str] = Query(None, description="学年"),
    agent_name: Optional[str] = Query(None, description="智能体名称"),
    start_date: Optional[str] = Query(None, description="开始时间"),
    end_date: Optional[str] = Query(None, description="结束时间"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=200, description="每页数量"),
    _: dict = Depends(require_admin),
):
    try:
        return await get_agent_usage_list(
            db,
            keyword=keyword,
            student_id=student_id,
            student_name=student_name,
            class_name=class_name,
            grade=grade,
            agent_name=agent_name,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取智能体使用数据失败", e),
        )


@router.get("/usage/statistics", response_model=AgentUsageStatistics)
async def read_agent_usage_statistics(
    db: AsyncSession = Depends(get_db),
    keyword: Optional[str] = Query(None, description="关键词搜索问题或回答"),
    student_id: Optional[str] = Query(None, description="学号"),
    student_name: Optional[str] = Query(None, description="学生姓名"),
    class_name: Optional[str] = Query(None, description="班级"),
    grade: Optional[str] = Query(None, description="学年"),
    agent_name: Optional[str] = Query(None, description="智能体名称"),
    start_date: Optional[str] = Query(None, description="开始时间"),
    end_date: Optional[str] = Query(None, description="结束时间"),
    _: dict = Depends(require_admin),
):
    try:
        return await get_agent_usage_statistics(
            db,
            keyword=keyword,
            student_id=student_id,
            student_name=student_name,
            class_name=class_name,
            grade=grade,
            agent_name=agent_name,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取智能体使用统计失败", e),
        )


@router.post("/usage", response_model=AgentUsageResponse, status_code=status.HTTP_201_CREATED)
async def create_usage_record(
    usage_in: AgentUsageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_user),
):
    try:
        from sqlalchemy import select
        from app.models import AIAgent

        agent_result = await db.execute(select(AIAgent).where(AIAgent.id == usage_in.agent_id))
        agent = agent_result.scalar_one_or_none()
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"智能体ID {usage_in.agent_id} 不存在",
            )

        resolved_user_id = current_user.get("id")
        if resolved_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="当前用户无效，请重新登录",
            )

        usage = await create_agent_usage(
            db,
            agent_id=usage_in.agent_id,
            user_id=resolved_user_id,
            question=usage_in.question,
            answer=usage_in.answer,
            session_id=usage_in.session_id,
            response_time_ms=usage_in.response_time_ms,
            used_at=usage_in.used_at,
        )
        return usage
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("创建智能体使用记录失败", e),
        )
