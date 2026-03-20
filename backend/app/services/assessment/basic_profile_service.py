"""
初级画像服务 - 提交测评后自动生成
"""

import json
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from loguru import logger

from app.models.assessment import (
    AssessmentConfig,
    AssessmentSession,
    AssessmentAnswer,
    AssessmentBasicProfile,
    AssessmentQuestion,
)


async def generate_basic_profile(
    db: AsyncSession,
    session: AssessmentSession,
    config: AssessmentConfig,
) -> Optional[AssessmentBasicProfile]:
    """在 submit_session 后自动调用，生成初级画像"""
    # 检查是否已存在
    existing_result = await db.execute(
        select(AssessmentBasicProfile)
        .where(AssessmentBasicProfile.session_id == session.id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing

    # 加载 answers（如果未加载）
    answers = session.answers
    if not answers:
        ans_result = await db.execute(
            select(AssessmentAnswer)
            .options(selectinload(AssessmentAnswer.question))
            .where(AssessmentAnswer.session_id == session.id)
        )
        answers = list(ans_result.scalars().all())

    # 自适应题只算首次成绩
    from app.services.assessment.session_service import _first_attempt_per_kp
    answers = _first_attempt_per_kp(answers)

    # 聚合知识点得分
    kp_scores: dict[str, dict] = {}
    wrong_points: list[str] = []

    for a in answers:
        q = a.question
        if not q and a.question_id:
            q_r = await db.execute(
                select(AssessmentQuestion)
                .where(AssessmentQuestion.id == a.question_id)
            )
            q = q_r.scalar_one_or_none()

        kp = q.knowledge_point if q else None
        if not kp:
            kp = "其他"

        if kp not in kp_scores:
            kp_scores[kp] = {"earned": 0, "total": 0}
        kp_scores[kp]["earned"] += a.ai_score or 0
        kp_scores[kp]["total"] += a.max_score

        if a.is_correct is False and kp not in wrong_points:
            wrong_points.append(kp)

    # 构建 AI prompt
    student_name = "同学"
    # 避免 lazy load session.user（MissingGreenlet），直接查询
    from app.models import User
    user_result = await db.execute(
        select(User.full_name).where(User.id == session.user_id)
    )
    user_name_row = user_result.scalar_one_or_none()
    if user_name_row:
        student_name = user_name_row

    kp_detail_lines = []
    for kp, d in kp_scores.items():
        kp_detail_lines.append(f"- {kp}: {d['earned']}/{d['total']} 分")
    kp_detail = "\n".join(kp_detail_lines) if kp_detail_lines else "无"

    wrong_text = "、".join(wrong_points) if wrong_points else "无"

    prompt = f"""你是一位专业的教学分析助手。请根据学生的自主检测结果，生成简短的学习画像。

【学生】{student_name}
【测评】{config.title}
【得分】{session.earned_score}/{session.total_score}

【各知识点得分】
{kp_detail}

【错题知识点】
{wrong_text}

请用 Markdown 格式输出，控制在 120 字以内：
1. 先用一句话给出总体结论
2. 掌握较好的知识点（1-2 个）
3. 需要加强的知识点（1-2 个）
4. 一条具体的学习建议

简洁专业，不要使用标题格式，直接输出段落。"""

    ai_summary = None
    if config.agent_id:
        try:
            from app.services.agents.chat_blocking import run_agent_chat_blocking
            ai_summary = await run_agent_chat_blocking(
                db, agent_id=config.agent_id, message=prompt
            )
        except Exception as e:
            logger.error(f"生成初级画像 AI 评语失败: {e}")
            ai_summary = "AI 评语生成失败，请稍后重试。"

    profile = AssessmentBasicProfile(
        session_id=session.id,
        user_id=session.user_id,
        config_id=session.config_id,
        earned_score=session.earned_score or 0,
        total_score=session.total_score,
        knowledge_scores=json.dumps(kp_scores, ensure_ascii=False),
        wrong_points=json.dumps(wrong_points, ensure_ascii=False),
        ai_summary=ai_summary,
    )
    db.add(profile)
    await db.flush()
    return profile


async def get_basic_profile(
    db: AsyncSession, session_id: int
) -> Optional[AssessmentBasicProfile]:
    """按 session_id 查询初级画像"""
    result = await db.execute(
        select(AssessmentBasicProfile)
        .where(AssessmentBasicProfile.session_id == session_id)
    )
    return result.scalar_one_or_none()
