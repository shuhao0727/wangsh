"""测评抽题辅助：固定题库的批量加载。

单独成模块，避免 session_service 继续膨胀（该文件已接近体积上限）。
"""

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import AssessmentQuestion


def question_count(cfg) -> int:
    """题型配置的抽题数量；兼容 dict 与标量两种写法。"""
    if isinstance(cfg, dict):
        return int(cfg.get("count", 0) or 0)
    return int(cfg or 0)


async def load_fixed_question_pools(
    db: AsyncSession, config_id: int, question_config: dict,
) -> dict[str, list[AssessmentQuestion]]:
    """一次取回该配置下所有需要的固定题，按题型分组。

    原实现每种题型各查一次库，题型越多往返越多。
    """
    wanted = [qtype for qtype, cfg in question_config.items() if question_count(cfg) > 0]
    pools: dict[str, list[AssessmentQuestion]] = {qtype: [] for qtype in wanted}
    if not wanted:
        return pools
    rows = await db.execute(
        select(AssessmentQuestion).where(
            and_(
                AssessmentQuestion.config_id == config_id,
                AssessmentQuestion.question_type.in_(wanted),
                AssessmentQuestion.mode == "fixed",
            )
        )
    )
    for question in rows.scalars().all():
        pools.setdefault(question.question_type, []).append(question)
    return pools


