"""
AI 智能体分析 SSE 流式保存端点

拆分自 app/api/endpoints/agents/ai_agents/analysis.py（原 1355 行）：
本模块承载三个 SSE 流式分析端点（热点问题 / 学生问题链 / 任务分析），
router 由 analysis.py include 组合，函数经 analysis.py 对外 re-export。
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.core.stream_session import session_checked_stream
from app.utils.errors import safe_error_detail
from app.models.agents import AIAgent, HotQuestionAnalysis, StudentChainAnalysis
from app.models.agents import TaskAnalysis as TaskAnalysisModel
from app.schemas.agents import (
    HotQuestionAnalysisSaveRequest,
    StudentChainAnalysisSaveRequest,
    TaskAnalysisSaveRequest,
)
from app.services.agents import (
    analyze_hot_questions_v2,
    analyze_student_chains_v2,
    stream_task_sheet_analysis,
)
from app.services.agents.hot_agent import deep_analyze_hot_questions
from app.services.agents.chain_agent import deep_analyze_student_chains
from app.services.agents.providers.common import resolve_credentials

from .analysis_helpers import (
    _sse,
    _analysis_window,
    _serialize_teacher_marks,
    _resolve_prompt_text,
    _resolve_analysis_agent_credentials,
    _prepare_hot_deep_analysis_input,
    _prepare_chain_deep_analysis_input,
    _hot_deep_analysis_has_content,
    _chain_deep_analysis_has_content,
)

router = APIRouter()


@router.post("/analysis/hot-questions/stream")
async def save_hot_question_analysis_stream(
    body: HotQuestionAnalysisSaveRequest,
    request: Request,
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
        session_checked_stream(event_generator(), request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/analysis/student-chains/stream")
async def save_student_chain_analysis_stream(
    body: StudentChainAnalysisSaveRequest,
    request: Request,
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
        session_checked_stream(event_generator(), request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/analysis/task-analyses/stream")
async def save_task_analysis_stream(
    body: TaskAnalysisSaveRequest,
    request: Request,
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
        session_checked_stream(event_generator(), request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
