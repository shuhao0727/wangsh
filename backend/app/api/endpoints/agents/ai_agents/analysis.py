import json
from typing import Optional, List, Dict, Any

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.utils.errors import safe_error_detail
from app.models.agents import AIAgent
from app.schemas.agents import (
    HotQuestionBucket,
    StudentChainSession,
    TaskAnalysisRequest,
    TaskAnalysisResponse,
    TaskAnalysisSaveRequest,
    TaskAnalysisRecord,
    TeacherQuestionMark,
    HotQuestionAnalysisSaveRequest,
    HotQuestionAnalysisRecord,
    HotQuestionAnalysisListItem,
    StudentChainAnalysisSaveRequest,
    StudentChainAnalysisRecord,
    StudentChainAnalysisListItem,
)
from app.models.agents import TaskAnalysis as TaskAnalysisModel
from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis
from app.services.agents import (
    analyze_hot_questions,
    analyze_student_chains,
    analyze_task_sheet,
    stream_task_sheet_analysis,
)
from app.services.agents.providers.common import resolve_credentials

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
    now = datetime.now(timezone.utc)
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


@router.post("/analysis/task-analysis", response_model=TaskAnalysisResponse)
async def task_analysis(
    body: TaskAnalysisRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    effective_end = body.end_at or now
    effective_start = body.start_at or (effective_end - timedelta(hours=1))

    # Resolve credentials for the selected agent
    result = await db.execute(
        select(AIAgent).where(
            AIAgent.id == body.agent_id,
            AIAgent.is_deleted == False,
        )
    )
    agent = result.scalar_one_or_none()
    api_endpoint = ""
    api_key = ""
    agent_type = ""
    agent_model = ""
    if agent:
        api_endpoint, api_key = resolve_credentials(agent)
        agent_type = agent.agent_type
        agent_model = agent.model_name or ""

    return await analyze_task_sheet(
        db,
        agent_id=body.agent_id,
        task_sheet=body.task_sheet,
        start_at=effective_start,
        end_at=effective_end,
        class_name=body.class_name,
        api_endpoint=api_endpoint,
        api_key=api_key,
        agent_type=agent_type,
        agent_model=agent_model,
    )


# ── 任务分析记录的 CRUD ──

@router.get("/analysis/task-analyses")
async def list_task_analyses(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(TaskAnalysisModel).order_by(TaskAnalysisModel.created_at.desc()).offset(skip).limit(limit)
    )).scalars().all()
    return [{"id": r.id, "title": r.title, "agent_id": r.agent_id, "class_name": r.class_name,
             "created_at": r.created_at.isoformat(),
             "uncovered_count": len((r.result or {}).get("uncovered", []))} for r in rows]

def _sse(event: str, payload: Dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


@router.post("/analysis/task-analyses/stream")
async def save_task_analysis_stream(
    body: TaskAnalysisSaveRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def event_generator():
        try:
            now = datetime.now(timezone.utc)
            effective_end = body.end_at or now
            effective_start = body.start_at or (effective_end - timedelta(hours=1))

            # 分析用智能体（用于调用 LLM）：优先使用 analysis_agent_id，否则用 agent_id
            llm_agent_id = body.analysis_agent_id or body.agent_id
            result_data = await db.execute(
                select(AIAgent).where(AIAgent.id == llm_agent_id, AIAgent.is_deleted == False)
            )
            agent = result_data.scalar_one_or_none()
            api_endpoint, api_key, agent_type, agent_model = "", "", "", ""
            if agent:
                api_endpoint, api_key = resolve_credentials(agent)
                agent_type = agent.agent_type
                agent_model = agent.model_name or ""

            analysis_result: Dict[str, Any] = {"word_cloud": [], "covered": [], "uncovered": []}
            async for item in stream_task_sheet_analysis(
                db,
                agent_id=body.agent_id,
                task_sheet=body.task_sheet,
                start_at=effective_start,
                end_at=effective_end,
                class_name=body.class_name,
                api_endpoint=api_endpoint,
                api_key=api_key,
                agent_type=agent_type,
                agent_model=agent_model,
                bucket_seconds=body.bucket_seconds,
                teacher_marks=[m.model_dump() for m in body.teacher_marks] if body.teacher_marks else [],
                custom_prompt=body.custom_prompt,
            ):
                event = str(item.pop("event", "progress"))
                if event == "analysis_finished":
                    analysis_result = item.get("result") or analysis_result
                    item["message"] = "分析完成，正在保存结果"
                    item["progress"] = 96
                    yield _sse(event, item)
                    break
                yield _sse(event, item)

            # 根据请求特征判断类型并存入对应表
            is_hot = bool(body.task_sheet) and body.bucket_seconds > 0
            if is_hot:
                record = HotQuestionAnalysis(
                    title=body.title,
                    task_sheet=body.task_sheet,
                    agent_id=body.agent_id,
                    analysis_agent_id=body.analysis_agent_id,
                    class_name=body.class_name,
                    start_at=effective_start,
                    end_at=effective_end,
                    bucket_seconds=body.bucket_seconds,
                    teacher_marks=[m.model_dump() for m in body.teacher_marks] if body.teacher_marks else [],
                    custom_prompt=body.custom_prompt,
                    result=analysis_result,
                    created_by=current_user.get("id"),
                )
                db.add(record)
                await db.commit()
                await db.refresh(record)
            else:
                record = StudentChainAnalysis(
                    title=body.title,
                    task_sheet=body.task_sheet or None,
                    agent_id=body.agent_id,
                    analysis_agent_id=body.analysis_agent_id,
                    class_name=body.class_name,
                    start_at=effective_start,
                    end_at=effective_end,
                    result=analysis_result,
                    created_by=current_user.get("id"),
                )
                db.add(record)
                await db.commit()
                await db.refresh(record)

            # 兼容写入旧表
            legacy = TaskAnalysisModel(
                title=body.title,
                task_sheet=body.task_sheet,
                agent_id=body.agent_id,
                class_name=body.class_name,
                start_at=effective_start,
                end_at=effective_end,
                result=analysis_result,
                created_by=current_user.get("id"),
            )
            db.add(legacy)
            await db.commit()
            await db.refresh(legacy)
            yield _sse(
                "saved",
                {
                    "message": "分析完成，已保存结果",
                    "progress": 100,
                    "id": record.id,
                    "result": analysis_result,
                },
            )
        except Exception as exc:
            yield _sse("error", {"message": safe_error_detail("任务分析失败", exc), "progress": 100})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/analysis/task-analyses/{analysis_id}", response_model=TaskAnalysisRecord)
async def get_task_analysis(
    analysis_id: int,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(TaskAnalysisModel).where(TaskAnalysisModel.id == analysis_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    return row


@router.post("/analysis/task-analyses", response_model=TaskAnalysisRecord)
async def save_task_analysis(
    body: TaskAnalysisSaveRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.agents import TaskAnalysis as TaskAnalysisModel

    # Run analysis
    now = datetime.now(timezone.utc)
    effective_end = body.end_at or now
    effective_start = body.start_at or (effective_end - timedelta(hours=1))
    result_data = await db.execute(
        select(AIAgent).where(AIAgent.id == body.agent_id, AIAgent.is_deleted == False)
    )
    agent = result_data.scalar_one_or_none()
    api_endpoint, api_key, agent_type, agent_model = "", "", "", ""
    if agent:
        api_endpoint, api_key = resolve_credentials(agent)
        agent_type = agent.agent_type
        agent_model = agent.model_name or ""

    analysis_result = await analyze_task_sheet(
        db, agent_id=body.agent_id, task_sheet=body.task_sheet,
        start_at=effective_start, end_at=effective_end,
        class_name=body.class_name,
        api_endpoint=api_endpoint, api_key=api_key, agent_type=agent_type,
        agent_model=agent_model,
    )

    record = TaskAnalysisModel(
        title=body.title, task_sheet=body.task_sheet,
        agent_id=body.agent_id, class_name=body.class_name,
        start_at=effective_start, end_at=effective_end,
        result=analysis_result,
        created_by=current_user.get("id"),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/analysis/task-analyses/{analysis_id}")
async def delete_task_analysis(
    analysis_id: int,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(TaskAnalysisModel).where(TaskAnalysisModel.id == analysis_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


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
    now = datetime.now(timezone.utc)
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


# ── 热点问题分析 CRUD ──

@router.get("/analysis/hot-questions",
    response_model=List[HotQuestionAnalysisListItem])
async def list_hot_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    result = await db.execute(
        select(HotQuestionAnalysis).order_by(HotQuestionAnalysis.created_at.desc())
    )
    return [{"id": r.id, "title": r.title, "agent_id": r.agent_id, "class_name": r.class_name, "created_at": r.created_at} for r in result.scalars().all()]


@router.get("/analysis/hot-questions/{analysis_id}",
    response_model=HotQuestionAnalysisRecord)
async def get_hot_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    r = (await db.execute(select(HotQuestionAnalysis).where(HotQuestionAnalysis.id == analysis_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    return r


@router.delete("/analysis/hot-questions/{analysis_id}")
async def delete_hot_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    r = (await db.execute(select(HotQuestionAnalysis).where(HotQuestionAnalysis.id == analysis_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    await db.delete(r)
    await db.commit()
    return {"message": "已删除"}


# ── 学生问题链分析 CRUD ──

@router.get("/analysis/student-chains",
    response_model=List[StudentChainAnalysisListItem])
async def list_chain_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    result = await db.execute(
        select(StudentChainAnalysis).order_by(StudentChainAnalysis.created_at.desc())
    )
    return [{"id": r.id, "title": r.title, "agent_id": r.agent_id, "class_name": r.class_name, "created_at": r.created_at} for r in result.scalars().all()]


@router.get("/analysis/student-chains/{analysis_id}",
    response_model=StudentChainAnalysisRecord)
async def get_chain_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    r = (await db.execute(select(StudentChainAnalysis).where(StudentChainAnalysis.id == analysis_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    return r


@router.delete("/analysis/student-chains/{analysis_id}")
async def delete_chain_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    r = (await db.execute(select(StudentChainAnalysis).where(StudentChainAnalysis.id == analysis_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    await db.delete(r)
    await db.commit()
    return {"message": "已删除"}
