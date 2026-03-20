"""
测评配置服务 - CRUD + toggle
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from loguru import logger

from app.models.assessment import AssessmentConfig, AssessmentConfigAgent, AssessmentQuestion, AssessmentSession
from app.schemas.assessment import AssessmentConfigCreate, AssessmentConfigUpdate


async def create_config(
    db: AsyncSession,
    config_in: AssessmentConfigCreate,
    user_id: int,
) -> AssessmentConfig:
    """创建测评配置"""
    db_config = AssessmentConfig(
        title=config_in.title,
        grade=config_in.grade,
        teaching_objectives=config_in.teaching_objectives,
        knowledge_points=config_in.knowledge_points,
        total_score=config_in.total_score,
        question_config=config_in.question_config,
        ai_prompt=config_in.ai_prompt,
        agent_id=config_in.agent_id,
        time_limit_minutes=config_in.time_limit_minutes,
        available_start=config_in.available_start,
        available_end=config_in.available_end,
        created_by_user_id=user_id,
    )
    db.add(db_config)
    await db.flush()

    # 关联课堂智能体
    if config_in.agent_ids:
        for aid in config_in.agent_ids:
            db.add(AssessmentConfigAgent(config_id=db_config.id, agent_id=aid))

    await db.commit()
    await db.refresh(db_config)
    return db_config


async def get_config(db: AsyncSession, config_id: int) -> Optional[AssessmentConfig]:
    """获取测评配置详情"""
    result = await db.execute(
        select(AssessmentConfig)
        .options(
            selectinload(AssessmentConfig.config_agents),
            selectinload(AssessmentConfig.agent),
            selectinload(AssessmentConfig.creator),
        )
        .where(AssessmentConfig.id == config_id)
    )
    return result.scalar_one_or_none()


async def get_configs(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    grade: Optional[str] = None,
    enabled: Optional[bool] = None,
    search: Optional[str] = None,
) -> tuple[List[AssessmentConfig], int]:
    """获取测评配置列表（分页）"""
    query = select(AssessmentConfig).options(
        selectinload(AssessmentConfig.config_agents),
        selectinload(AssessmentConfig.agent),
        selectinload(AssessmentConfig.creator),
    )
    count_query = select(func.count(AssessmentConfig.id))

    if grade:
        query = query.where(AssessmentConfig.grade == grade)
        count_query = count_query.where(AssessmentConfig.grade == grade)
    if enabled is not None:
        query = query.where(AssessmentConfig.enabled == enabled)
        count_query = count_query.where(AssessmentConfig.enabled == enabled)
    if search:
        query = query.where(AssessmentConfig.title.ilike(f"%{search}%"))
        count_query = count_query.where(AssessmentConfig.title.ilike(f"%{search}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(AssessmentConfig.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def update_config(
    db: AsyncSession,
    config_id: int,
    config_in: AssessmentConfigUpdate,
) -> Optional[AssessmentConfig]:
    """更新测评配置"""
    db_config = await get_config(db, config_id)
    if not db_config:
        return None

    update_data = config_in.dict(exclude_unset=True, exclude={"agent_ids"})
    for key, value in update_data.items():
        setattr(db_config, key, value)

    # 更新关联智能体
    if config_in.agent_ids is not None:
        await db.execute(
            delete(AssessmentConfigAgent).where(AssessmentConfigAgent.config_id == config_id)
        )
        for aid in config_in.agent_ids:
            db.add(AssessmentConfigAgent(config_id=config_id, agent_id=aid))

    await db.commit()
    await db.refresh(db_config)
    return db_config


async def delete_config(db: AsyncSession, config_id: int) -> bool:
    """删除测评配置（级联删除）"""
    db_config = await get_config(db, config_id)
    if not db_config:
        return False

    await db.delete(db_config)
    await db.commit()
    return True


async def toggle_config(db: AsyncSession, config_id: int) -> Optional[AssessmentConfig]:
    """切换测评配置的启用状态"""
    result = await db.execute(
        select(AssessmentConfig).where(AssessmentConfig.id == config_id)
    )
    db_config = result.scalar_one_or_none()
    if not db_config:
        return None

    db_config.enabled = not db_config.enabled
    await db.commit()
    await db.refresh(db_config)
    return db_config


async def get_config_question_count(db: AsyncSession, config_id: int) -> int:
    """获取测评配置的题目数量"""
    result = await db.execute(
        select(func.count(AssessmentQuestion.id)).where(AssessmentQuestion.config_id == config_id)
    )
    return result.scalar() or 0


async def get_config_session_count(db: AsyncSession, config_id: int) -> int:
    """获取测评配置的答题人数"""
    result = await db.execute(
        select(func.count(AssessmentSession.id)).where(AssessmentSession.config_id == config_id)
    )
    return result.scalar() or 0
