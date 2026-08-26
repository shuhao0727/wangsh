"""
AI 智能体分析端点（任务分析 / 热点问题 / 学生问题链 / 趋势）

拆分自原单文件 analysis.py（1355 行 → 本文件 <501 行）：
- analysis_helpers.py：查询辅助与 schema 转换纯函数
- analysis_streams.py：SSE 流式分析保存端点
- analysis_prompts.py：提示词模板 CRUD
本文件保留 router 组合与对外 re-export，外部导入路径（analysis.router、
analysis.get_task_analysis、analysis._delete_compatible_siblings 等）不变。
"""

from typing import Optional, List, Dict, Any

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.models.agents import AIAgent, HotQuestionAnalysis, StudentChainAnalysis
from app.models.agents import TaskAnalysis as TaskAnalysisModel
from app.schemas.agents import (
    HotQuestionBucket,
    StudentChainSession,
    TaskAnalysisRequest,
    TaskAnalysisResponse,
    TaskAnalysisSaveRequest,
    TaskAnalysisRecord,
    HotQuestionAnalysisListItem,
    HotQuestionAnalysisRecord,
    StudentChainAnalysisListItem,
    StudentChainAnalysisRecord,
)
from app.services.agents import (
    analyze_hot_questions,
    analyze_student_chains,
    analyze_task_sheet,
    summarize_hot_list_item,
    summarize_chain_list_item,
)
from app.services.agents.analysis_compatibility import (
    delete_compatible_sibling as _delete_compatible_siblings,
)

from .analysis_helpers import (
    _sse,
    _analysis_window,
    _serialize_teacher_marks,
    _task_analysis_payload,
    _find_legacy_task_analysis,
    _resolve_prompt_text,
    _agent_public_payload,
    _resolve_analysis_agent_credentials,
    _compact_teacher_questions,
    _prepare_hot_deep_analysis_input,
    _prepare_chain_deep_analysis_input,
    _hot_deep_analysis_has_content,
    _chain_deep_analysis_has_content,
    _hot_list_item,
    _chain_list_item,
    _trend_top_themes,
)
from .analysis_streams import (
    router as streams_router,
    save_hot_question_analysis_stream,
    save_student_chain_analysis_stream,
    save_task_analysis_stream,
)
from .analysis_prompts import (
    router as prompts_router,
    list_prompt_templates,
    create_prompt_template,
    update_prompt_template,
    delete_prompt_template,
)

router = APIRouter()
router.include_router(streams_router)
router.include_router(prompts_router)


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
        bucket_seconds=body.bucket_seconds,
        teacher_marks=_serialize_teacher_marks(body.teacher_marks),
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


@router.get("/analysis/task-analyses/{analysis_id}", response_model=TaskAnalysisRecord)
async def get_task_analysis(
    analysis_id: int,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await _find_legacy_task_analysis(db, analysis_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    return _task_analysis_payload(row)


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

    analysis_result = await analyze_task_sheet(
        db, agent_id=body.agent_id, task_sheet=body.task_sheet,
        start_at=effective_start, end_at=effective_end,
        class_name=body.class_name,
        api_endpoint=api_endpoint, api_key=api_key, agent_type=agent_type,
        agent_model=agent_model,
        bucket_seconds=body.bucket_seconds,
        teacher_marks=_serialize_teacher_marks(body.teacher_marks),
        custom_prompt=body.custom_prompt,
    )

    is_hot = bool(body.task_sheet) and body.bucket_seconds > 0
    if is_hot:
        record = HotQuestionAnalysis(
            title=body.title, task_sheet=body.task_sheet,
            agent_id=body.agent_id, analysis_agent_id=body.analysis_agent_id,
            class_name=body.class_name, start_at=effective_start, end_at=effective_end,
            bucket_seconds=body.bucket_seconds,
            teacher_marks=_serialize_teacher_marks(body.teacher_marks),
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
    db.add(record)
    db.add(legacy)
    await db.commit()
    await db.refresh(record)
    await db.refresh(legacy)
    return legacy


@router.delete("/analysis/task-analyses/{analysis_id}")
async def delete_task_analysis(
    analysis_id: int,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await _find_legacy_task_analysis(db, analysis_id)
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


@router.get("/analysis/trends")
async def get_analysis_trends(
    agent_id: int = Query(..., ge=1, description="数据来源智能体ID"),
    analysis_type: str = Query(..., description="hot_questions 或 student_chains"),
    limit: int = Query(10, ge=2, le=50, description="返回最近分析次数"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    if analysis_type not in {"hot_questions", "student_chains"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="analysis_type 仅支持 hot_questions 或 student_chains",
        )

    model = HotQuestionAnalysis if analysis_type == "hot_questions" else StudentChainAnalysis
    result = await db.execute(
        select(model)
        .where(model.agent_id == agent_id)
        .order_by(model.created_at.desc())
        .limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    items: List[Dict[str, Any]] = []
    for row in rows:
        data = row.result or {}
        if analysis_type == "hot_questions":
            stats = summarize_hot_list_item(data)
            items.append({
                "id": row.id,
                "title": row.title,
                "created_at": row.created_at,
                "theme_count": stats.get("theme_count", 0),
                "question_count": stats.get("question_count", 0),
                "burst_count": stats.get("burst_count", 0),
                "unique_students": int(
                    (data.get("summary") or {}).get("unique_students") or 0
                ),
                "teacher_anchor_count": stats.get("teacher_anchor_count", 0),
                "top_themes": _trend_top_themes(data),
                "teaching_suggestions_count": len(data.get("teaching_suggestions") or []),
            })
        else:
            stats = summarize_chain_list_item(data)
            items.append({
                "id": row.id,
                "title": row.title,
                "created_at": row.created_at,
                "chain_count": stats.get("chain_count", 0),
                "question_count": stats.get("question_count", 0),
                "unique_students": int(
                    (data.get("student_chain_summary") or {}).get("unique_students") or 0
                ),
                "teacher_anchor_count": stats.get("teacher_anchor_count", 0),
                "ai_chain_node_count": stats.get("ai_chain_node_count", 0),
                "top_themes": _trend_top_themes(data),
            })
    return {"data": items}


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
    await _delete_compatible_siblings(db, r)
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
    await _delete_compatible_siblings(db, r)
    await db.commit()
    return {"message": "已删除"}


@router.get("/trends")
async def get_trends_summary(
    agent_id: int = Query(..., description="数据来源智能体 ID"),
    analysis_type: str = Query("hot_questions", description="分析类型: hot_questions | student_chains"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    """返回指定智能体最近 N 次分析的摘要趋势数据"""
    model = StudentChainAnalysis if analysis_type == "student_chains" else HotQuestionAnalysis

    rows = (await db.execute(
        select(model)
        .where(model.agent_id == agent_id, model.result.isnot(None))
        .order_by(model.created_at.desc())
        .limit(limit)
    )).scalars().all()

    trends = []
    for r in rows:
        result = r.result or {}
        if isinstance(result, dict) and "result" in result:
            result = result["result"]

        item: Dict[str, Any] = {
            "id": r.id,
            "title": r.title,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        if analysis_type == "hot_questions":
            themes = result.get("themes") or []
            item.update({
                "theme_count": max(len(themes), len(result.get("covered") or []), len(result.get("uncovered") or [])),
                "question_count": sum((t.get("count", 0) for t in themes), 0) or None,
                "burst_count": len(result.get("burst_points") or []),
                "unique_students": sum((t.get("unique_students", 0) for t in themes), 0) or None,
                "top_themes": [t.get("topic", "") for t in (themes or [])[:3]],
                "teaching_suggestions_count": len(result.get("teaching_suggestions") or []),
                "course_sequence_count": len(result.get("course_hotspot_sequence") or []),
            })
        else:
            summary = result.get("student_chain_summary") or {}
            chains = result.get("student_question_chains") or []
            item.update({
                "chain_count": summary.get("chain_count") or len(chains),
                "question_count": summary.get("question_count"),
                "unique_students": summary.get("unique_students"),
                "teacher_anchor_count": summary.get("teacher_anchor_count"),
                "dominant_question_type": summary.get("dominant_question_type"),
            })
        trends.append(item)

    return {"success": True, "data": list(reversed(trends))}
