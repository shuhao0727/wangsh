from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.deps import get_db, require_admin, require_user
from app.utils.errors import safe_error_detail
from app.utils.cache import cache, cache_key_generator
from app.schemas.agents import (
    AgentUsageCreate,
    AgentUsageResponse,
    AgentUsageListResponse,
    AgentUsageStatistics,
    UsageFilterOptions,
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
    cache_key = cache_key_generator(
        "agent_usage_stats",
        keyword=keyword or "",
        student_id=student_id or "",
        student_name=student_name or "",
        class_name=class_name or "",
        grade=grade or "",
        agent_name=agent_name or "",
        start_date=start_date or "",
        end_date=end_date or "",
    )
    try:
        cached = await cache.get(cache_key)
        if cached is not None:
            return cached
    except Exception:
        pass

    try:
        result = await get_agent_usage_statistics(
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
        try:
            await cache.set(cache_key, result, expire_seconds=120)
        except Exception:
            pass
        return result
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
        )
        try:
            await cache.clear_pattern("agent_usage_stats:*")
        except Exception:
            pass
        return usage
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("创建智能体使用记录失败", e),
        )


@router.get("/usage/filter-options", response_model=UsageFilterOptions)
async def read_filter_options(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        class_result = await db.execute(
            text("SELECT DISTINCT class_name FROM sys_users WHERE class_name IS NOT NULL AND class_name != '' ORDER BY class_name")
        )
        class_names = [row[0] for row in class_result if row[0]]

        grade_result = await db.execute(
            text("SELECT DISTINCT study_year FROM sys_users WHERE study_year IS NOT NULL AND study_year != '' ORDER BY study_year")
        )
        grades = [row[0] for row in grade_result if row[0]]

        agent_result = await db.execute(
            text("SELECT DISTINCT name FROM znt_agents WHERE is_active = true AND is_deleted = false ORDER BY name")
        )
        agent_names = [row[0] for row in agent_result if row[0]]

        return UsageFilterOptions(class_names=class_names, grades=grades, agent_names=agent_names)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取筛选选项失败", e),
        )
