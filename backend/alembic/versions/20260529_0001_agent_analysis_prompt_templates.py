"""add agent analysis prompt templates

Revision ID: 20260529_0001_agent_analysis_prompt_templates
Revises: 20260522_0719_hot_chain_tables
Create Date: 2026-05-29T00:00:00+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260529_0001_agent_analysis_prompt_templates"
down_revision: Union[str, None] = "20260522_0719_hot_chain_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_analysis_prompt_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("analysis_type", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["sys_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        comment="AgentData 分析提示词模板表",
    )
    op.create_index("ix_agent_analysis_prompt_templates_id", "agent_analysis_prompt_templates", ["id"])
    op.create_index(
        "ix_agent_analysis_prompt_templates_analysis_type",
        "agent_analysis_prompt_templates",
        ["analysis_type"],
    )
    op.create_index(
        "ix_agent_analysis_prompt_templates_type_active",
        "agent_analysis_prompt_templates",
        ["analysis_type", "is_active", "sort_order"],
    )
    prompt_templates = sa.table(
        "agent_analysis_prompt_templates",
        sa.column("analysis_type", sa.String),
        sa.column("name", sa.String),
        sa.column("content", sa.Text),
        sa.column("is_default", sa.Boolean),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        prompt_templates,
        [
            {
                "analysis_type": "hot_questions",
                "name": "课程热点时序分析",
                "content": (
                    "请围绕一节课的完整时间线分析学生热点问题：识别教师提问锚点、学生集中生发的问题、"
                    "热点主题的扩散和收敛，并为每个结论保留真实学生问题证据。重点输出课程热点序列、"
                    "高频关键词、爆发点、未解决问题和教学建议。"
                ),
                "is_default": True,
                "is_active": True,
                "sort_order": 10,
            },
            {
                "analysis_type": "hot_questions",
                "name": "生成性问题与教学改进",
                "content": (
                    "请重点识别学生在任务单之外自然生发的问题方向，区分基础疑问、调试困难、迁移应用、"
                    "挑战性追问，并分析这些问题对后续教学设计的启发。"
                ),
                "is_default": False,
                "is_active": True,
                "sort_order": 20,
            },
            {
                "analysis_type": "student_chains",
                "name": "教师主线驱动的问题链",
                "content": (
                    "请以教师提问为课堂主线，梳理学生围绕每个教师问题产生的澄清、跟进、应用、调试、"
                    "质疑、迁移、延伸和偏离问题。生成 AI 主问题链、学生个人问题链摘要和可绘制的光束图结构。"
                ),
                "is_default": True,
                "is_active": True,
                "sort_order": 10,
            },
            {
                "analysis_type": "student_chains",
                "name": "学生认知递进摘要",
                "content": (
                    "请聚焦学生从最初问题到后续追问的认知递进，标注 Bloom 层级和问题关系，"
                    "提炼全班共同主问题链，同时保留每个学生链路的代表性证据。"
                ),
                "is_default": False,
                "is_active": True,
                "sort_order": 20,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_agent_analysis_prompt_templates_type_active", table_name="agent_analysis_prompt_templates")
    op.drop_index("ix_agent_analysis_prompt_templates_analysis_type", table_name="agent_analysis_prompt_templates")
    op.drop_index("ix_agent_analysis_prompt_templates_id", table_name="agent_analysis_prompt_templates")
    op.drop_table("agent_analysis_prompt_templates")
