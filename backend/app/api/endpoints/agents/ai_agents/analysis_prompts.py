"""
AI 智能体分析提示词模板 CRUD 端点

拆分自 app/api/endpoints/agents/ai_agents/analysis.py（原 1355 行）：
本模块承载提示词模板的列表 / 创建 / 更新 / 删除端点，
router 由 analysis.py include 组合，函数经 analysis.py 对外 re-export。
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.models.agents import AgentAnalysisPromptTemplate
from app.schemas.agents import (
    AgentAnalysisPromptTemplateCreate,
    AgentAnalysisPromptTemplateRecord,
    AgentAnalysisPromptTemplateUpdate,
)

router = APIRouter()


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
