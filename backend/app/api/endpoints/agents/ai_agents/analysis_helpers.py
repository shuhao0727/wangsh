"""
AI 智能体分析端点辅助函数（查询辅助 / schema 转换 / SSE 序列化）

拆分自 app/api/endpoints/agents/ai_agents/analysis.py（原 1355 行）：
本模块承载原文件的全部私有辅助函数（_sse、_analysis_window、
_serialize_teacher_marks、_prepare_*_deep_analysis_input、列表项与趋势
转换等），由 analysis.py 与 analysis_streams.py 共用，并经由 analysis.py
对外 re-export 保持原导入路径不变。
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agents import (
    AIAgent,
    AgentAnalysisPromptTemplate,
    HotQuestionAnalysis,
    StudentChainAnalysis,
    TaskAnalysis as TaskAnalysisModel,
)
from app.services.agents import summarize_chain_list_item, summarize_hot_list_item
from app.services.agents.providers.common import resolve_credentials


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
    """转成可直接 JSON 序列化的纯数据。

    原先直接返回含 datetime 的 dict，缓存写入时 json.dumps 失败被静默吞掉，
    缓存永远不生效、每次请求都打数据库；日期也会让响应无法复用。
    """
    return {
        "id": row.id,
        "title": row.title,
        "task_sheet": getattr(row, "task_sheet", None) or "",
        "agent_id": row.agent_id,
        "class_name": row.class_name,
        "start_at": row.start_at.isoformat() if isinstance(row.start_at, datetime) else row.start_at,
        "end_at": row.end_at.isoformat() if isinstance(row.end_at, datetime) else row.end_at,
        "result": row.result or {},
        "created_at": row.created_at.isoformat() if isinstance(row.created_at, datetime) else row.created_at,
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
                AgentAnalysisPromptTemplate.is_active.is_(True),
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
                AIAgent.is_deleted.is_(False),
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


def _compact_student_chain(chain: Dict[str, Any]) -> Dict[str, Any]:
    nodes = chain.get("nodes") if isinstance(chain.get("nodes"), list) else []
    return {
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
                "teacher_anchor_score": node.get("teacher_anchor_score"),
                "teacher_anchor_confidence": node.get("teacher_anchor_confidence"),
                "teacher_anchor_reason": node.get("teacher_anchor_reason") or [],
                "evidence_ids": node.get("evidence_ids") or [],
            }
            for node in nodes
            if node.get("question")
        ],
    }


def _build_chain_meta(
    analysis_result: Dict[str, Any],
    summary: Dict[str, Any],
    filters: Dict[str, Any],
    classes: List[str],
    student_chains: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "analysis_version": analysis_result.get("analysis_version"),
        "analysis_type": analysis_result.get("analysis_type"),
        "time_range": f"{filters.get('start_at') or ''} ~ {filters.get('end_at') or ''}",
        "total_questions": summary.get("question_count"),
        "unique_students": summary.get("unique_students"),
        "teacher_anchor_count": summary.get("teacher_anchor_count"),
        "teacher_anchor_match_count": summary.get("teacher_anchor_match_count"),
        "teacher_anchor_coverage": summary.get("teacher_anchor_coverage"),
        "teacher_anchor_confidence_distribution": summary.get("teacher_anchor_confidence_distribution") or {},
        "chain_count": summary.get("chain_count", len(student_chains)),
        "ai_chain_node_count": summary.get("ai_chain_node_count"),
        "dominant_question_type": summary.get("dominant_question_type"),
        "classes": classes,
        "class_name": filters.get("class_name"),
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

    student_chains = [_compact_student_chain(chain) for chain in raw_chains]

    return {
        "meta": _build_chain_meta(analysis_result, summary, filters, classes, student_chains),
        "task_sheet": analysis_result.get("task_sheet") or "",
        "teacher_questions": _compact_teacher_questions(analysis_result.get("teacher_mainline") or []),
        "student_chains": student_chains,
        "themes": analysis_result.get("themes") or [],
        "ai_main_question_chain": analysis_result.get("ai_main_question_chain") or [],
        "unresolved_questions": (analysis_result.get("unresolved_questions") or [])[:30],
    }


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
