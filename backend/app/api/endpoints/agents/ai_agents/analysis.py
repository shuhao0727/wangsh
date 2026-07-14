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
from app.services.agents.hot_agent import deep_analyze_hot_questions
from app.services.agents.chain_agent import deep_analyze_student_chains
from app.services.agents.analysis_compatibility import (
    delete_compatible_sibling as _delete_compatible_siblings,
)
from app.services.agents.providers.common import resolve_credentials

router = APIRouter()


def _sse(event: str, payload: Dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n".encode("utf-8")


def _analysis_window(start_at: Optional[datetime], end_at: Optional[datetime]) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    effective_end = end_at or now
    effective_start = start_at or (effective_end - timedelta(hours=1))
    return effective_start, effective_end


def _serialize_teacher_marks(marks: Optional[List[Any]]) -> List[Dict[str, Any]]:
    """Convert Pydantic teacher marks into JSON-safe payloads for JSON columns/SSE."""
    serialized: List[Dict[str, Any]] = []
    for mark in marks or []:
        if hasattr(mark, "model_dump"):
            item = mark.model_dump(mode="json")
        elif isinstance(mark, dict):
            item = dict(mark)
            value = item.get("time")
            if isinstance(value, datetime):
                item["time"] = value.isoformat()
        else:
            continue
        serialized.append(item)
    return serialized


def _task_analysis_payload(row: Any) -> Dict[str, Any]:
    return {
        "id": row.id,
        "title": row.title,
        "task_sheet": getattr(row, "task_sheet", None) or "",
        "agent_id": row.agent_id,
        "class_name": row.class_name,
        "start_at": row.start_at,
        "end_at": row.end_at,
        "result": row.result or {},
        "created_at": row.created_at,
    }


async def _find_legacy_task_analysis(db: AsyncSession, analysis_id: int) -> Any:
    """Resolve a legacy task-analysis ID without guessing across typed tables."""
    return (
        await db.execute(
            select(TaskAnalysisModel).where(TaskAnalysisModel.id == analysis_id)
        )
    ).scalar_one_or_none()


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


def _agent_public_payload(
    agent: Optional[AIAgent],
    *,
    role: str,
    enabled: bool,
    status_text: str,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": agent.id if agent else None,
        "name": agent.name if agent else None,
        "model_name": agent.model_name if agent else None,
        "agent_type": agent.agent_type if agent else None,
        "role": role,
        "enabled": enabled,
        "status": status_text,
    }
    if reason:
        payload["reason"] = reason
    return payload


async def _resolve_analysis_agent_credentials(
    db: AsyncSession,
    *,
    analysis_agent_id: Optional[int],
    role: str,
) -> Dict[str, Any]:
    if not analysis_agent_id:
        reason = "未选择分析诊断智能体，本次仅生成基础结构化分析"
        return {
            "enabled": False,
            "reason": reason,
            "public": _agent_public_payload(None, role=role, enabled=False, status_text="skipped", reason=reason),
        }

    agent = (
        await db.execute(
            select(AIAgent).where(
                AIAgent.id == analysis_agent_id,
                AIAgent.is_deleted == False,
            )
        )
    ).scalar_one_or_none()
    if not agent:
        reason = "所选分析诊断智能体不存在或已删除"
        return {
            "enabled": False,
            "reason": reason,
            "public": _agent_public_payload(None, role=role, enabled=False, status_text="missing", reason=reason),
        }
    if not agent.is_active:
        reason = "所选分析诊断智能体未启用"
        return {
            "enabled": False,
            "reason": reason,
            "public": _agent_public_payload(agent, role=role, enabled=False, status_text="inactive", reason=reason),
        }

    api_endpoint, api_key = resolve_credentials(agent)
    if not api_endpoint:
        reason = "分析诊断智能体未配置 API Endpoint"
        return {
            "enabled": False,
            "reason": reason,
            "public": _agent_public_payload(agent, role=role, enabled=False, status_text="missing_endpoint", reason=reason),
        }
    if not api_key:
        reason = "分析诊断智能体未配置 API Key"
        return {
            "enabled": False,
            "reason": reason,
            "public": _agent_public_payload(agent, role=role, enabled=False, status_text="missing_api_key", reason=reason),
        }

    return {
        "enabled": True,
        "api_endpoint": api_endpoint,
        "api_key": api_key,
        "agent_type": agent.agent_type,
        "agent_model": agent.model_name or "",
        "public": _agent_public_payload(agent, role=role, enabled=True, status_text="ready"),
    }


def _compact_teacher_questions(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "id": item.get("id"),
            "time": item.get("time"),
            "question": item.get("question"),
            "source": item.get("source"),
            "user_name": item.get("user_name"),
        }
        for item in items[:30]
        if item.get("question")
    ]


def _prepare_hot_deep_analysis_input(analysis_result: Dict[str, Any]) -> Dict[str, Any]:
    summary = analysis_result.get("summary") or {}
    filters = analysis_result.get("filters") or {}
    themes = analysis_result.get("themes") if isinstance(analysis_result.get("themes"), list) else []
    student_events = (
        analysis_result.get("student_question_events")
        if isinstance(analysis_result.get("student_question_events"), list)
        else []
    )
    classes = sorted({str(item.get("class_name")) for item in student_events if item.get("class_name")})

    student_questions = []
    noise_questions = []
    for item in student_events:
        question = str(item.get("content") or "").strip()
        if not question:
            continue
        compact = {
            "student_name": item.get("user_name") or "未知学生",
            "student_id": item.get("student_id"),
            "class_name": item.get("class_name"),
            "time": item.get("created_at"),
            "question": question,
            "question_type": item.get("question_type"),
            "question_type_label": item.get("question_type_label"),
            "bloom_level": item.get("bloom_level"),
            "terms": item.get("terms") or [],
            "theme": item.get("theme"),
            "teacher_anchor_question": item.get("teacher_anchor_question"),
            "evidence_id": item.get("message_id"),
        }
        student_questions.append(compact)
        if item.get("question_type") == "off_track":
            noise_questions.append(compact)

    return {
        "meta": {
            "analysis_version": analysis_result.get("analysis_version"),
            "analysis_type": analysis_result.get("analysis_type"),
            "time_range": f"{filters.get('start_at') or ''} ~ {filters.get('end_at') or ''}",
            "total_questions": summary.get("question_count", len(student_questions)),
            "unique_students": summary.get("unique_students"),
            "teacher_anchor_count": summary.get("teacher_anchor_count"),
            "theme_count": summary.get("theme_count", len(themes)),
            "burst_count": summary.get("burst_count"),
            "classes": classes,
            "class_name": filters.get("class_name"),
            "bucket_seconds": filters.get("bucket_seconds"),
        },
        "task_sheet": analysis_result.get("task_sheet") or "",
        "topic_distribution": {
            str(theme.get("topic") or f"主题{index + 1}"): int(theme.get("count") or 0)
            for index, theme in enumerate(themes)
        },
        "student_questions": student_questions,
        "noise_questions": noise_questions,
        "teacher_questions": _compact_teacher_questions(analysis_result.get("teacher_questions") or []),
        "timeline_buckets": (analysis_result.get("timeline_buckets") or [])[:40],
        "course_hotspot_sequence": (analysis_result.get("course_hotspot_sequence") or [])[:20],
    }


def _prepare_chain_deep_analysis_input(analysis_result: Dict[str, Any]) -> Dict[str, Any]:
    summary = analysis_result.get("student_chain_summary") or {}
    filters = analysis_result.get("filters") or {}
    raw_chains = (
        analysis_result.get("student_question_chains")
        if isinstance(analysis_result.get("student_question_chains"), list)
        else []
    )
    classes = sorted({str(chain.get("class_name")) for chain in raw_chains if chain.get("class_name")})

    student_chains = []
    for chain in raw_chains:
        nodes = chain.get("nodes") if isinstance(chain.get("nodes"), list) else []
        student_chains.append(
            {
                "session_id": chain.get("session_id"),
                "student_name": chain.get("student_name") or "未知学生",
                "student_id": chain.get("student_id"),
                "class_name": chain.get("class_name"),
                "question_count": chain.get("question_count") or len(nodes),
                "summary": chain.get("summary"),
                "questions": [
                    {
                        "node_id": node.get("node_id"),
                        "time": node.get("time"),
                        "question": node.get("question"),
                        "question_type": node.get("question_type"),
                        "question_type_label": node.get("question_type_label"),
                        "bloom_level": node.get("bloom_level"),
                        "teacher_anchor_id": node.get("teacher_anchor_id"),
                        "teacher_anchor_question": node.get("teacher_anchor_question"),
                        "evidence_ids": node.get("evidence_ids") or [],
                    }
                    for node in nodes
                    if node.get("question")
                ],
            }
        )

    return {
        "meta": {
            "analysis_version": analysis_result.get("analysis_version"),
            "analysis_type": analysis_result.get("analysis_type"),
            "time_range": f"{filters.get('start_at') or ''} ~ {filters.get('end_at') or ''}",
            "total_questions": summary.get("question_count"),
            "unique_students": summary.get("unique_students"),
            "teacher_anchor_count": summary.get("teacher_anchor_count"),
            "chain_count": summary.get("chain_count", len(student_chains)),
            "ai_chain_node_count": summary.get("ai_chain_node_count"),
            "dominant_question_type": summary.get("dominant_question_type"),
            "classes": classes,
            "class_name": filters.get("class_name"),
        },
        "task_sheet": analysis_result.get("task_sheet") or "",
        "teacher_questions": _compact_teacher_questions(analysis_result.get("teacher_mainline") or []),
        "student_chains": student_chains,
        "themes": analysis_result.get("themes") or [],
        "ai_main_question_chain": analysis_result.get("ai_main_question_chain") or [],
        "unresolved_questions": (analysis_result.get("unresolved_questions") or [])[:30],
    }


def _hot_deep_analysis_has_content(result: Dict[str, Any]) -> bool:
    return bool(
        result.get("executive_summary")
        or result.get("theme_analysis")
        or result.get("timeline_phases")
        or result.get("teaching_suggestions")
    )


def _chain_deep_analysis_has_content(result: Dict[str, Any]) -> bool:
    return bool(
        result.get("executive_summary")
        or result.get("cognitive_trajectories")
        or result.get("intervention_plan")
        or result.get("teacher_question_evaluations")
    )


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


def _trend_top_themes(result: Dict[str, Any], limit: int = 5) -> List[str]:
    labels: List[str] = []
    for key in ("themes", "uncovered", "covered"):
        items = result.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            label = (
                item.get("topic")
                or item.get("theme")
                or item.get("name")
                or item.get("word")
            )
            if label:
                labels.append(str(label))
    return labels[:limit]


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
                teacher_marks=_serialize_teacher_marks(body.teacher_marks),
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
            yield _sse(
                "step_started",
                {
                    "step_id": "pedagogy_agent",
                    "message": "正在调用热点问题教学诊断智能体",
                    "progress": 88,
                },
            )
            analysis_agent = await _resolve_analysis_agent_credentials(
                db,
                analysis_agent_id=body.analysis_agent_id,
                role="hotspot_pedagogy_diagnosis",
            )
            analysis_result["analysis_agent"] = analysis_agent["public"]
            if analysis_agent.get("enabled"):
                deep_result = await deep_analyze_hot_questions(
                    _prepare_hot_deep_analysis_input(analysis_result),
                    custom_prompt=prompt_text,
                    api_endpoint=analysis_agent["api_endpoint"],
                    api_key=analysis_agent["api_key"],
                    agent_type=analysis_agent["agent_type"],
                    agent_model=analysis_agent["agent_model"],
                )
                has_content = _hot_deep_analysis_has_content(deep_result)
                status_text = "completed" if has_content else "empty"
                reason = None if has_content else "分析诊断智能体未返回可解析的教学诊断 JSON"
                analysis_result["deep_analysis"] = deep_result
                analysis_result["deep_analysis_status"] = {
                    "enabled": True,
                    "status": status_text,
                    "reason": reason,
                }
                analysis_result["analysis_agent"] = {
                    **analysis_agent["public"],
                    "status": status_text,
                    **({"reason": reason} if reason else {}),
                }
                yield _sse(
                    "partial_result",
                    {
                        "step_id": "pedagogy_agent",
                        "message": "热点问题教学诊断已生成" if has_content else "热点问题教学诊断未返回有效内容",
                        "progress": 93,
                        "result": {
                            "executive_summary": deep_result.get("executive_summary"),
                            "theme_analysis_count": len(deep_result.get("theme_analysis") or []),
                            "teaching_suggestions_count": len(deep_result.get("teaching_suggestions") or []),
                            "analysis_agent_status": status_text,
                        },
                    },
                )
            else:
                analysis_result["deep_analysis_status"] = {
                    "enabled": False,
                    "status": "skipped",
                    "reason": analysis_agent.get("reason"),
                }
                yield _sse(
                    "partial_result",
                    {
                        "step_id": "pedagogy_agent",
                        "message": analysis_agent.get("reason") or "未启用热点问题教学诊断智能体",
                        "progress": 90,
                        "result": {"analysis_agent_status": "skipped"},
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
                teacher_marks=_serialize_teacher_marks(body.teacher_marks),
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
                teacher_marks=_serialize_teacher_marks(body.teacher_marks),
                custom_prompt=prompt_text,
                merge_threshold=getattr(body, "merge_threshold", None) or 0.30,
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
            yield _sse(
                "step_started",
                {
                    "step_id": "cognitive_agent",
                    "message": "正在调用光束图认知路径智能体",
                    "progress": 88,
                },
            )
            analysis_agent = await _resolve_analysis_agent_credentials(
                db,
                analysis_agent_id=body.analysis_agent_id,
                role="beam_cognitive_path_diagnosis",
            )
            analysis_result["analysis_agent"] = analysis_agent["public"]
            if analysis_agent.get("enabled"):
                deep_result = await deep_analyze_student_chains(
                    _prepare_chain_deep_analysis_input(analysis_result),
                    custom_prompt=prompt_text,
                    api_endpoint=analysis_agent["api_endpoint"],
                    api_key=analysis_agent["api_key"],
                    agent_type=analysis_agent["agent_type"],
                    agent_model=analysis_agent["agent_model"],
                )
                has_content = _chain_deep_analysis_has_content(deep_result)
                status_text = "completed" if has_content else "empty"
                reason = None if has_content else "分析诊断智能体未返回可解析的认知诊断 JSON"
                analysis_result["deep_analysis"] = deep_result
                analysis_result["deep_analysis_status"] = {
                    "enabled": True,
                    "status": status_text,
                    "reason": reason,
                }
                analysis_result["analysis_agent"] = {
                    **analysis_agent["public"],
                    "status": status_text,
                    **({"reason": reason} if reason else {}),
                }
                yield _sse(
                    "partial_result",
                    {
                        "step_id": "cognitive_agent",
                        "message": "光束图认知路径诊断已生成" if has_content else "光束图认知路径诊断未返回有效内容",
                        "progress": 93,
                        "result": {
                            "executive_summary": deep_result.get("executive_summary"),
                            "trajectory_count": len(deep_result.get("cognitive_trajectories") or []),
                            "teacher_question_evaluation_count": len(deep_result.get("teacher_question_evaluations") or []),
                            "analysis_agent_status": status_text,
                        },
                    },
                )
            else:
                analysis_result["deep_analysis_status"] = {
                    "enabled": False,
                    "status": "skipped",
                    "reason": analysis_agent.get("reason"),
                }
                yield _sse(
                    "partial_result",
                    {
                        "step_id": "cognitive_agent",
                        "message": analysis_agent.get("reason") or "未启用光束图认知路径智能体",
                        "progress": 90,
                        "result": {"analysis_agent_status": "skipped"},
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
                teacher_marks=_serialize_teacher_marks(body.teacher_marks),
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
                    teacher_marks=_serialize_teacher_marks(body.teacher_marks),
                    custom_prompt=body.custom_prompt,
                    result=analysis_result,
                    created_by=current_user.get("id"),
                )
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
            db.add(record)
            db.add(legacy)
            await db.commit()
            await db.refresh(record)
            await db.refresh(legacy)
            yield _sse(
                "saved",
                {
                    "message": "分析完成，已保存结果",
                    "progress": 100,
                    "id": legacy.id,
                    "analysis_record_id": record.id,
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
