"""assessment tables - 自主检测系统 7 张新表

Revision ID: 20260318_0001
Revises: 20260311_0001
Create Date: 2026-03-18 22:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260318_0001"
down_revision = "20260311_0001"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    conn = op.get_bind()
    return sa.inspect(conn).has_table(name)


def upgrade() -> None:
    # 1. 测评配置表
    if not _has_table("znt_assessment_configs"):
        op.create_table(
            "znt_assessment_configs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("subject", sa.String(100), nullable=True),
            sa.Column("grade", sa.String(20), nullable=True),
            sa.Column("teaching_objectives", sa.Text(), nullable=True),
            sa.Column("knowledge_points", sa.Text(), nullable=True),
            sa.Column("total_score", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("question_config", sa.Text(), nullable=True),
            sa.Column("ai_prompt", sa.Text(), nullable=True),
            sa.Column("agent_id", sa.Integer(), sa.ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True),
            sa.Column("time_limit_minutes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            comment="测评配置表",
        )
        op.create_index("ix_znt_assessment_configs_id", "znt_assessment_configs", ["id"])

    # 2. 题库表
    if not _has_table("znt_assessment_questions"):
        op.create_table(
            "znt_assessment_questions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("config_id", sa.Integer(), sa.ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("question_type", sa.String(20), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("options", sa.Text(), nullable=True),
            sa.Column("correct_answer", sa.Text(), nullable=False),
            sa.Column("score", sa.Integer(), nullable=False),
            sa.Column("difficulty", sa.String(10), nullable=False, server_default="medium"),
            sa.Column("knowledge_point", sa.String(200), nullable=True),
            sa.Column("explanation", sa.Text(), nullable=True),
            sa.Column("source", sa.String(20), nullable=False, server_default="ai_generated"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            comment="测评题库表",
        )
        op.create_index("ix_znt_assessment_questions_id", "znt_assessment_questions", ["id"])
        op.create_index("ix_znt_assessment_questions_config_id", "znt_assessment_questions", ["config_id"])

    # 3. 测评会话表
    if not _has_table("znt_assessment_sessions"):
        op.create_table(
            "znt_assessment_sessions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("config_id", sa.Integer(), sa.ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("total_score", sa.Integer(), nullable=False),
            sa.Column("earned_score", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            comment="测评会话表",
        )
        op.create_index("ix_znt_assessment_sessions_id", "znt_assessment_sessions", ["id"])
        op.create_index("ix_znt_assessment_sessions_config_id", "znt_assessment_sessions", ["config_id"])
        op.create_index("ix_znt_assessment_sessions_user_id", "znt_assessment_sessions", ["user_id"])

    # 4. 答题记录表
    if not _has_table("znt_assessment_answers"):
        op.create_table(
            "znt_assessment_answers",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("session_id", sa.Integer(), sa.ForeignKey("znt_assessment_sessions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("question_id", sa.Integer(), sa.ForeignKey("znt_assessment_questions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("question_snapshot", sa.Text(), nullable=True),
            sa.Column("question_type", sa.String(20), nullable=False),
            sa.Column("student_answer", sa.Text(), nullable=True),
            sa.Column("is_correct", sa.Boolean(), nullable=True),
            sa.Column("ai_score", sa.Integer(), nullable=True),
            sa.Column("ai_feedback", sa.Text(), nullable=True),
            sa.Column("max_score", sa.Integer(), nullable=False),
            sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
            comment="答题记录表",
        )
        op.create_index("ix_znt_assessment_answers_id", "znt_assessment_answers", ["id"])
        op.create_index("ix_znt_assessment_answers_session_id", "znt_assessment_answers", ["session_id"])

    # 5. 初级画像表
    if not _has_table("znt_assessment_basic_profiles"):
        op.create_table(
            "znt_assessment_basic_profiles",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("session_id", sa.Integer(), sa.ForeignKey("znt_assessment_sessions.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("config_id", sa.Integer(), sa.ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("earned_score", sa.Integer(), nullable=False),
            sa.Column("total_score", sa.Integer(), nullable=False),
            sa.Column("knowledge_scores", sa.Text(), nullable=True),
            sa.Column("wrong_points", sa.Text(), nullable=True),
            sa.Column("ai_summary", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("session_id", name="uq_znt_assessment_basic_profiles_session"),
            comment="初级画像表（测评后自动生成）",
        )
        op.create_index("ix_znt_assessment_basic_profiles_id", "znt_assessment_basic_profiles", ["id"])
        op.create_index("ix_znt_assessment_basic_profiles_user_id", "znt_assessment_basic_profiles", ["user_id"])
        op.create_index("ix_znt_assessment_basic_profiles_config_id", "znt_assessment_basic_profiles", ["config_id"])

    # 6. 高级画像表
    if not _has_table("znt_student_profiles"):
        op.create_table(
            "znt_student_profiles",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("profile_type", sa.String(20), nullable=False),
            sa.Column("target_id", sa.String(100), nullable=False),
            sa.Column("config_id", sa.Integer(), sa.ForeignKey("znt_assessment_configs.id", ondelete="SET NULL"), nullable=True),
            sa.Column("discussion_session_id", sa.Integer(), sa.ForeignKey("znt_group_discussion_sessions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("agent_ids", sa.Text(), nullable=True),
            sa.Column("agent_id", sa.Integer(), sa.ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True),
            sa.Column("data_sources", sa.Text(), nullable=True),
            sa.Column("result_text", sa.Text(), nullable=True),
            sa.Column("scores", sa.Text(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            comment="高级画像表（三维融合分析）",
        )
        op.create_index("ix_znt_student_profiles_id", "znt_student_profiles", ["id"])
        op.create_index("ix_znt_student_profiles_type", "znt_student_profiles", ["profile_type"])
        op.create_index("ix_znt_student_profiles_target", "znt_student_profiles", ["target_id"])

    # 7. 测评-智能体关联表
    if not _has_table("znt_assessment_config_agents"):
        op.create_table(
            "znt_assessment_config_agents",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("config_id", sa.Integer(), sa.ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("agent_id", sa.Integer(), sa.ForeignKey("znt_agents.id", ondelete="CASCADE"), nullable=False),
            sa.UniqueConstraint("config_id", "agent_id", name="uq_znt_assessment_config_agent"),
            comment="测评-智能体关联表",
        )
        op.create_index("ix_znt_assessment_config_agents_id", "znt_assessment_config_agents", ["id"])
        op.create_index("ix_znt_assessment_config_agents_config_id", "znt_assessment_config_agents", ["config_id"])
        op.create_index("ix_znt_assessment_config_agents_agent_id", "znt_assessment_config_agents", ["agent_id"])


def downgrade() -> None:
    op.drop_table("znt_assessment_config_agents")
    op.drop_table("znt_student_profiles")
    op.drop_table("znt_assessment_basic_profiles")
    op.drop_table("znt_assessment_answers")
    op.drop_table("znt_assessment_sessions")
    op.drop_table("znt_assessment_questions")
    op.drop_table("znt_assessment_configs")
