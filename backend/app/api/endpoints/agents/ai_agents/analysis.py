import json
import asyncio
from typing import Optional, List, Dict, Any

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.utils.errors import safe_error_detail
from app.models.agents import AIAgent, HotQuestionAnalysis, StudentChainAnalysis, AgentAnalysisPromptTemplate
from app.models.agents import TaskAnalysis as TaskAnalysisModel
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
    AgentAnalysisPromptTemplateCreate,
    AgentAnalysisPromptTemplateUpdate,
    AgentAnalysisPromptTemplateRecord,
)
from app.services.agents import (
    analyze_hot_questions,
    analyze_student_chains,
    analyze_task_sheet,
    stream_task_sheet_analysis,
    analyze_hot_questions_v2,
    analyze_student_chains_v2,
    summarize_hot_list_item,
    summarize_chain_list_item,
)
from app.services.agents.providers.common import resolve_credentials

router = APIRouter()


def _sse(event: str, payload: Dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


def _analysis_window(start_at: Optional[datetime], end_at: Optional[datetime]) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    effective_end = end_at or now
    effective_start = start_at or (effective_end - timedelta(hours=1))
    return effective_start, effective_end


async def _resolve_prompt_text(
    db: AsyncSession,
    *,
    prompt_template_id: Optional[int],
    custom_prompt: Optional[str],
) -> Optional[str]:
    if custom_prompt and custom_prompt.strip():
        return custom_prompt.strip()
    if not prompt_template_id:
        return None
    template = (
        await db.execute(
            select(AgentAnalysisPromptTemplate).where(
                AgentAnalysisPromptTemplate.id == prompt_template_id,
                AgentAnalysisPromptTemplate.is_active == True,
            )
        )
    ).scalar_one_or_none()
    return template.content if template else None


def _hot_list_item(row: HotQuestionAnalysis) -> Dict[str, Any]:
    stats = summarize_hot_list_item(row.result or {})
    return {
        "id": row.id,
        "title": row.title,
        "agent_id": row.agent_id,
        "class_name": row.class_name,
        "created_at": row.created_at,
        **stats,
        "uncovered_count": stats["theme_count"],
    }


def _chain_list_item(row: StudentChainAnalysis) -> Dict[str, Any]:
    stats = summarize_chain_list_item(row.result or {})
    return {
        "id": row.id,
        "title": row.title,
        "agent_id": row.agent_id,
        "class_name": row.class_name,
        "created_at": row.created_at,
        **stats,
        "theme_count": stats["ai_chain_node_count"],
        "uncovered_count": stats["chain_count"],
    }


@router.get("/analysis/hot-questions/live", response_model=List[HotQuestionBucket])
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


@router.get(
    "/analysis/prompt-templates",
    response_model=List[AgentAnalysisPromptTemplateRecord],
)
async def list_prompt_templates(
    analysis_type: Optional[str] = Query(None, pattern="^(hot_questions|student_chains)$"),
    include_inactive: bool = Query(False),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AgentAnalysisPromptTemplate)
    if analysis_type:
        stmt = stmt.where(AgentAnalysisPromptTemplate.analysis_type == analysis_type)
    if not include_inactive:
        stmt = stmt.where(AgentAnalysisPromptTemplate.is_active == True)
    rows = (
        await db.execute(
            stmt.order_by(
                AgentAnalysisPromptTemplate.analysis_type.asc(),
                AgentAnalysisPromptTemplate.sort_order.asc(),
                AgentAnalysisPromptTemplate.id.asc(),
            )
        )
    ).scalars().all()
    return rows


@router.post(
    "/analysis/prompt-templates",
    response_model=AgentAnalysisPromptTemplateRecord,
)
async def create_prompt_template(
    body: AgentAnalysisPromptTemplateCreate,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.is_default:
        existing = (
            await db.execute(
                select(AgentAnalysisPromptTemplate).where(
                    AgentAnalysisPromptTemplate.analysis_type == body.analysis_type,
                    AgentAnalysisPromptTemplate.is_default == True,
                )
            )
        ).scalars().all()
        for template in existing:
            template.is_default = False
    template = AgentAnalysisPromptTemplate(
        analysis_type=body.analysis_type,
        name=body.name,
        content=body.content,
        is_default=body.is_default,
        is_active=body.is_active,
        sort_order=body.sort_order,
        created_by=current_user.get("id"),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put(
    "/analysis/prompt-templates/{template_id}",
    response_model=AgentAnalysisPromptTemplateRecord,
)
async def update_prompt_template(
    template_id: int,
    body: AgentAnalysisPromptTemplateUpdate,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    template = (
        await db.execute(
            select(AgentAnalysisPromptTemplate).where(AgentAnalysisPromptTemplate.id == template_id)
        )
    ).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板不存在")
    if body.name is not None:
        template.name = body.name
    if body.content is not None:
        template.content = body.content
    if body.is_active is not None:
        template.is_active = body.is_active
    if body.sort_order is not None:
        template.sort_order = body.sort_order
    if body.is_default is not None:
        template.is_default = body.is_default
        if body.is_default:
            existing = (
                await db.execute(
                    select(AgentAnalysisPromptTemplate).where(
                        AgentAnalysisPromptTemplate.analysis_type == template.analysis_type,
                        AgentAnalysisPromptTemplate.id != template_id,
                        AgentAnalysisPromptTemplate.is_default == True,
                    )
                )
            ).scalars().all()
            for item in existing:
                item.is_default = False
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/analysis/prompt-templates/{template_id}")
async def delete_prompt_template(
    template_id: int,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    template = (
        await db.execute(
            select(AgentAnalysisPromptTemplate).where(AgentAnalysisPromptTemplate.id == template_id)
        )
    ).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板不存在")
    await db.delete(template)
    await db.commit()
    return {"message": "已删除"}


@router.post("/analysis/hot-questions/stream")
async def save_hot_question_analysis_stream(
    body: HotQuestionAnalysisSaveRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def event_generator():
        try:
            effective_start, effective_end = _analysis_window(body.start_at, body.end_at)
            yield _sse("analysis_started", {"message": "开始热点问题深度分析", "progress": 0})
            prompt_text = await _resolve_prompt_text(
                db,
                prompt_template_id=body.prompt_template_id,
                custom_prompt=body.custom_prompt,
            )
            yield _sse("step_started", {"step_id": "events", "message": "正在提取课堂对话事件", "progress": 15})
            analysis_result = await analyze_hot_questions_v2(
                db,
                agent_id=body.agent_id,
                start_at=effective_start,
                end_at=effective_end,
                class_name=body.class_name,
                task_sheet=body.task_sheet,
                bucket_seconds=body.bucket_seconds,
                teacher_marks=[m.model_dump() for m in body.teacher_marks] if body.teacher_marks else [],
                custom_prompt=prompt_text,
            )
            yield _sse(
                "partial_result",
                {
                    "step_id": "analysis",
                    "message": "热点主题、时序和课程序列已生成",
                    "progress": 82,
                    "result": {
                        "theme_count": analysis_result.get("theme_count", 0),
                        "question_count": (analysis_result.get("summary") or {}).get("question_count", 0),
                        "teacher_anchor_count": (analysis_result.get("summary") or {}).get("teacher_anchor_count", 0),
                    },
                },
            )
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
                custom_prompt=prompt_text,
                result=analysis_result,
                created_by=current_user.get("id"),
            )
            db.add(record)
            await db.commit()
            await db.refresh(record)
            yield _sse(
                "saved",
                {
                    "message": "热点问题分析完成，已保存结果",
                    "progress": 100,
                    "id": record.id,
                    "analysis_type": "hot_questions",
                    "view": "timeline",
                    "result": analysis_result,
                },
            )
        except asyncio.CancelledError:
            import logging; logging.getLogger(__name__).info("SSE client disconnected, hot analysis cancelled")
        except Exception as exc:
            yield _sse("error", {"message": safe_error_detail("热点问题分析失败", exc), "progress": 100})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/analysis/student-chains/stream")
async def save_student_chain_analysis_stream(
    body: StudentChainAnalysisSaveRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def event_generator():
        try:
            effective_start, effective_end = _analysis_window(body.start_at, body.end_at)
            yield _sse("analysis_started", {"message": "开始学生问题链深度分析", "progress": 0})
            prompt_text = await _resolve_prompt_text(
                db,
                prompt_template_id=body.prompt_template_id,
                custom_prompt=body.custom_prompt,
            )
            yield _sse("step_started", {"step_id": "chains", "message": "正在构建教师主线与学生问题链", "progress": 18})
            analysis_result = await analyze_student_chains_v2(
                db,
                agent_id=body.agent_id,
                start_at=effective_start,
                end_at=effective_end,
                class_name=body.class_name,
                task_sheet=body.task_sheet,
                teacher_marks=[m.model_dump() for m in body.teacher_marks] if body.teacher_marks else [],
                custom_prompt=prompt_text,
            )
            summary = analysis_result.get("student_chain_summary") or {}
            yield _sse(
                "partial_result",
                {
                    "step_id": "beam",
                    "message": "教师主线、AI 主问题链和光束图结构已生成",
                    "progress": 84,
                    "result": {
                        "chain_count": summary.get("chain_count", 0),
                        "teacher_anchor_count": summary.get("teacher_anchor_count", 0),
                        "ai_chain_node_count": summary.get("ai_chain_node_count", 0),
                    },
                },
            )
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
            yield _sse(
                "saved",
                {
                    "message": "学生问题链分析完成，已保存结果",
                    "progress": 100,
                    "id": record.id,
                    "analysis_type": "student_chains",
                    "view": "beam",
                    "result": analysis_result,
                },
            )
        except asyncio.CancelledError:
            import logging; logging.getLogger(__name__).info("SSE client disconnected, chain analysis cancelled")
        except Exception as exc:
            yield _sse("error", {"message": safe_error_detail("学生问题链分析失败", exc), "progress": 100})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
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
        except asyncio.CancelledError:
            import logging; logging.getLogger(__name__).info("SSE client disconnected, analysis cancelled")
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

    is_hot = bool(body.task_sheet) and body.bucket_seconds > 0
    if is_hot:
        record = HotQuestionAnalysis(
            title=body.title, task_sheet=body.task_sheet,
            agent_id=body.agent_id, analysis_agent_id=body.analysis_agent_id,
            class_name=body.class_name, start_at=effective_start, end_at=effective_end,
            bucket_seconds=body.bucket_seconds,
            teacher_marks=[m.model_dump() for m in body.teacher_marks] if body.teacher_marks else [],
            custom_prompt=body.custom_prompt,
            result=analysis_result, created_by=current_user.get("id"),
        )
    else:
        record = StudentChainAnalysis(
            title=body.title, task_sheet=body.task_sheet or None,
            agent_id=body.agent_id, analysis_agent_id=body.analysis_agent_id,
            class_name=body.class_name, start_at=effective_start, end_at=effective_end,
            result=analysis_result, created_by=current_user.get("id"),
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


@router.get("/analysis/student-chains/live", response_model=List[StudentChainSession])
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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    result = await db.execute(
        select(HotQuestionAnalysis).order_by(HotQuestionAnalysis.created_at.desc())
        .offset(skip).limit(limit)
    )
    return [_hot_list_item(r) for r in result.scalars().all()]


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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    result = await db.execute(
        select(StudentChainAnalysis).order_by(StudentChainAnalysis.created_at.desc())
        .offset(skip).limit(limit)
    )
    return [_chain_list_item(r) for r in result.scalars().all()]


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
