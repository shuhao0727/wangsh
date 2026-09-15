"""legacy baseline tables (18 tables) as the Alembic migration root

Revision ID: 20260210_0000_legacy_baseline_tables
Revises:
Create Date: 2026-02-10

动机
----
治理 §六.1/§六.2 要求表结构必须走 Alembic，且空库必须可完整 `alembic upgrade head`。
历史上这 18 张表只由 `backend/scripts/bootstrap_db.py` 的 `LEGACY_BASELINE_TABLES`
清单 + `Base.metadata.create_all` 创建，迁移链从不建它们，导致裸空库 upgrade 到
`20260213_0005_ai_agent_api_key_encryption` 时因 znt_agents 不存在而失败。

本迁移把这些表固化为正式根迁移（down_revision=None），DDL 与当前模型
`backend/app/models/**` 完全一致（含索引、唯一约束、外键、表注释）。

幂等守卫
--------
- 每张表创建前用 inspector 检查是否已存在（存在则跳过），保证 bootstrap 先
  create_all 再 upgrade head 的路径下全部跳过。
- 每个索引创建前检查 pg_indexes 中是否已存在同名索引；bootstrap 会按
  `_migration_managed_indexes()` 规则丢弃 create_all 建出的、迁移链负责的索引，
  因此索引必须按“缺失即建”而不是“表新建才建”来守卫。

刻意排除（由后续迁移链拥有，避免重复/冲突）
--------------------------------------------
- znt_group_discussion_members.muted_until：`20260323_0006` 用无守卫的
  op.add_column 添加（bootstrap 的 MIGRATION_ORIGIN_COLUMNS 也刻意把该列
  交给迁移链）。
- wz_articles.style_key 指向 wz_markdown_styles 的外键：wz_markdown_styles
  在 `20260225_0009` 才创建，本迁移只建列与 ix_wz_articles_style_key 索引，
  外键由 0009 补建（fk_wz_articles_style_key）。
- ix_sys_users_full_name：`20260614_0001` 用无守卫的 op.create_index 添加。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector


revision: str = "20260210_0000_legacy_baseline_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    inspector = Inspector.from_engine(op.get_bind())
    return table_name in set(inspector.get_table_names())


def _index_exists(index_name: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = :idx"),
        {"idx": index_name},
    ).first()
    return row is not None


def _create_table(table_name: str, *columns, **kw) -> None:
    if _table_exists(table_name):
        return
    op.create_table(table_name, *columns, **kw)


def _create_index(index_name: str, table_name: str, columns, unique: bool = False) -> None:
    if _index_exists(index_name):
        return
    op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    # ---- 无外键依赖的表 ----
    _create_table(
        "sys_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(length=50), nullable=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("student_id", sa.String(length=50), nullable=True),
        sa.Column("class_name", sa.String(length=50), nullable=True),
        sa.Column("study_year", sa.String(length=10), nullable=True),
        sa.Column(
            "role_code",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'student'"),
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _create_index("ix_sys_users_class_name", "sys_users", ["class_name"])
    _create_index("ix_sys_users_username", "sys_users", ["username"], unique=True)
    _create_index("ix_sys_users_student_id", "sys_users", ["student_id"], unique=True)
    _create_index("ix_sys_users_id", "sys_users", ["id"])

    _create_table(
        "sys_feature_flags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _create_index("ix_sys_feature_flags_key", "sys_feature_flags", ["key"], unique=True)
    _create_index("ix_sys_feature_flags_id", "sys_feature_flags", ["id"])

    _create_table(
        "znt_agents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("agent_type", sa.String(length=20), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("api_endpoint", sa.String(length=500), nullable=True),
        sa.Column("api_key", sa.String(length=200), nullable=True),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("api_key_last4", sa.String(length=8), nullable=True),
        sa.Column("has_api_key", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        comment="AI智能体配置表",
    )
    _create_index("ix_znt_agents_id", "znt_agents", ["id"])
    _create_index("ix_znt_agents_agent_type", "znt_agents", ["agent_type"])

    _create_table(
        "wz_categories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _create_index("ix_wz_categories_id", "wz_categories", ["id"])
    _create_index("ix_wz_categories_slug", "wz_categories", ["slug"], unique=True)

    _create_table(
        "xxjs_dianming",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("year", sa.String(length=32), nullable=False),
        sa.Column("class_name", sa.String(length=64), nullable=False),
        sa.Column("student_name", sa.String(length=64), nullable=False),
        sa.Column("student_no", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("year", "class_name", "student_name", name="uq_xxjs_dianming_student"),
        comment="信息技术-点名系统(学生名单)",
    )
    _create_index("ix_xxjs_dianming_student_no", "xxjs_dianming", ["student_no"])
    _create_index("ix_xxjs_dianming_id", "xxjs_dianming", ["id"])
    _create_index("ix_xxjs_dianming_class_name", "xxjs_dianming", ["class_name"])
    _create_index("ix_xxjs_dianming_year", "xxjs_dianming", ["year"])

    _create_table(
        "xbk_courses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("term", sa.String(length=20), nullable=False),
        sa.Column("grade", sa.String(length=20), nullable=True),
        sa.Column("course_code", sa.String(length=50), nullable=False),
        sa.Column("course_name", sa.String(length=200), nullable=False),
        sa.Column("teacher", sa.String(length=100), nullable=True),
        sa.Column("quota", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint(
            "year", "term", "course_code", name="uq_xbk_courses_year_term_course_code"
        ),
    )
    _create_index("ix_xbk_courses_term", "xbk_courses", ["term"])
    _create_index("ix_xbk_courses_grade", "xbk_courses", ["grade"])
    _create_index("ix_xbk_courses_year", "xbk_courses", ["year"])
    _create_index("ix_xbk_courses_id", "xbk_courses", ["id"])
    _create_index("ix_xbk_courses_course_code", "xbk_courses", ["course_code"])

    _create_table(
        "xbk_students",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("term", sa.String(length=20), nullable=False),
        sa.Column("grade", sa.String(length=20), nullable=True),
        sa.Column("class_name", sa.String(length=50), nullable=False),
        sa.Column("student_no", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("gender", sa.String(length=10), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint(
            "year", "term", "student_no", name="uq_xbk_students_year_term_student_no"
        ),
    )
    _create_index("ix_xbk_students_class_name", "xbk_students", ["class_name"])
    _create_index("ix_xbk_students_term", "xbk_students", ["term"])
    _create_index("ix_xbk_students_grade", "xbk_students", ["grade"])
    _create_index("ix_xbk_students_year", "xbk_students", ["year"])
    _create_index("ix_xbk_students_student_no", "xbk_students", ["student_no"])
    _create_index("ix_xbk_students_id", "xbk_students", ["id"])

    _create_table(
        "xbk_selections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("term", sa.String(length=20), nullable=False),
        sa.Column("grade", sa.String(length=20), nullable=True),
        sa.Column("student_no", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=True),
        sa.Column("course_code", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint(
            "year",
            "term",
            "student_no",
            "course_code",
            name="uq_xbk_selections_year_term_student_no_course_code",
        ),
    )
    _create_index("ix_xbk_selections_term", "xbk_selections", ["term"])
    _create_index("ix_xbk_selections_grade", "xbk_selections", ["grade"])
    _create_index("ix_xbk_selections_year", "xbk_selections", ["year"])
    _create_index("ix_xbk_selections_course_code", "xbk_selections", ["course_code"])
    _create_index("ix_xbk_selections_id", "xbk_selections", ["id"])
    _create_index("ix_xbk_selections_student_no", "xbk_selections", ["student_no"])

    # ---- 依赖 sys_users / znt_agents 的表 ----
    _create_table(
        "sys_refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(length=500), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("is_revoked", sa.Boolean(), server_default=sa.text("false")),
    )
    _create_index("ix_sys_refresh_tokens_id", "sys_refresh_tokens", ["id"])
    _create_index("ix_sys_refresh_tokens_user_id", "sys_refresh_tokens", ["user_id"])

    _create_table(
        "znt_conversations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("user_name", sa.String(length=100), nullable=True),
        sa.Column(
            "agent_id",
            sa.Integer(),
            sa.ForeignKey("znt_agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("agent_name", sa.String(length=200), nullable=True),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("message_type", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        comment="对话记录表",
    )
    _create_index("ix_znt_conversations_id", "znt_conversations", ["id"])
    _create_index("ix_znt_conversations_session_id", "znt_conversations", ["session_id"])
    _create_index("ix_znt_conversations_user_id", "znt_conversations", ["user_id"])
    _create_index("ix_znt_conversations_agent_id", "znt_conversations", ["agent_id"])

    _create_table(
        "znt_optimize_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("original_content", sa.Text(), nullable=True),
        sa.Column("optimized_content", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("rollback_id", sa.String(length=36), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        comment="代码/流程图优化记录表",
    )
    _create_index("ix_znt_optimize_logs_project_id", "znt_optimize_logs", ["project_id"])
    _create_index("ix_znt_optimize_logs_rollback_id", "znt_optimize_logs", ["rollback_id"], unique=True)
    _create_index("ix_znt_optimize_logs_user_id", "znt_optimize_logs", ["user_id"])
    _create_index("ix_znt_optimize_logs_id", "znt_optimize_logs", ["id"])
    _create_index("ix_znt_optimize_logs_type", "znt_optimize_logs", ["type"])

    _create_table(
        "znt_group_discussion_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_date", sa.Date(), nullable=False),
        sa.Column("class_name", sa.String(length=64), nullable=False),
        sa.Column("group_no", sa.String(length=16), nullable=False),
        sa.Column("group_name", sa.String(length=64), nullable=True),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.UniqueConstraint(
            "session_date",
            "class_name",
            "group_no",
            name="uq_znt_group_discussion_sessions_date_class_group",
        ),
        comment="小组讨论会话（按日期+班级+组号分组）",
    )
    _create_index("ix_znt_group_discussion_sessions_id", "znt_group_discussion_sessions", ["id"])
    _create_index(
        "ix_znt_group_discussion_sessions_group_name",
        "znt_group_discussion_sessions",
        ["group_name"],
    )
    _create_index(
        "ix_znt_group_discussion_sessions_class_name",
        "znt_group_discussion_sessions",
        ["class_name"],
    )
    _create_index(
        "ix_znt_group_discussion_sessions_group_no",
        "znt_group_discussion_sessions",
        ["group_no"],
    )
    _create_index(
        "ix_znt_group_discussion_sessions_session_date",
        "znt_group_discussion_sessions",
        ["session_date"],
    )
    _create_index(
        "ix_znt_group_discussion_sessions_last_message_at",
        "znt_group_discussion_sessions",
        ["last_message_at"],
    )
    _create_index(
        "ix_znt_group_discussion_sessions_created_by_user_id",
        "znt_group_discussion_sessions",
        ["created_by_user_id"],
    )

    # muted_until 列刻意不在此建：由 20260323_0006 无守卫 op.add_column 添加
    _create_table(
        "znt_group_discussion_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("znt_group_discussion_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("session_id", "user_id", name="uq_group_session_user"),
        comment="小组讨论成员表",
    )
    _create_index(
        "ix_znt_group_discussion_members_session_id",
        "znt_group_discussion_members",
        ["session_id"],
    )
    _create_index("ix_znt_group_discussion_members_user_id", "znt_group_discussion_members", ["user_id"])
    _create_index("ix_znt_group_discussion_members_id", "znt_group_discussion_members", ["id"])

    _create_table(
        "znt_group_discussion_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("znt_group_discussion_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_display_name", sa.String(length=100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        comment="小组讨论消息表",
    )
    _create_index(
        "ix_znt_group_discussion_messages_user_id",
        "znt_group_discussion_messages",
        ["user_id"],
    )
    _create_index(
        "ix_znt_group_discussion_messages_session_id",
        "znt_group_discussion_messages",
        ["session_id"],
    )
    _create_index("ix_znt_group_discussion_messages_id", "znt_group_discussion_messages", ["id"])
    _create_index(
        "ix_znt_group_discussion_messages_created_at",
        "znt_group_discussion_messages",
        ["created_at"],
    )

    _create_table(
        "znt_group_discussion_analyses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("znt_group_discussion_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "agent_id",
            sa.Integer(),
            sa.ForeignKey("znt_agents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_admin_user_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("analysis_type", sa.String(length=32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("result_text", sa.Text(), nullable=False),
        sa.Column("compare_session_ids", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        comment="小组讨论分析结果（管理员发起，可使用智能体API）",
    )
    _create_index(
        "ix_znt_group_discussion_analyses_id",
        "znt_group_discussion_analyses",
        ["id"],
    )
    _create_index(
        "ix_znt_group_discussion_analyses_agent_id",
        "znt_group_discussion_analyses",
        ["agent_id"],
    )
    _create_index(
        "ix_znt_group_discussion_analyses_session_id",
        "znt_group_discussion_analyses",
        ["session_id"],
    )
    _create_index(
        "ix_znt_group_discussion_analyses_created_at",
        "znt_group_discussion_analyses",
        ["created_at"],
    )
    _create_index(
        "ix_znt_group_discussion_analyses_created_by_admin_user_id",
        "znt_group_discussion_analyses",
        ["created_by_admin_user_id"],
    )

    _create_table(
        "inf_typst_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("category_path", sa.String(length=200), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("style_key", sa.String(length=100), nullable=False),
        sa.Column("entry_path", sa.String(length=200), nullable=False),
        sa.Column("files", postgresql.JSONB(), nullable=False),
        sa.Column("toc", postgresql.JSONB(), nullable=False),
        sa.Column("content_typst", sa.Text(), nullable=False),
        sa.Column(
            "created_by_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("compiled_hash", sa.String(length=64), nullable=True),
        sa.Column("compiled_pdf", sa.LargeBinary(), nullable=True),
        sa.Column("compiled_pdf_path", sa.String(length=500), nullable=True),
        sa.Column("compiled_pdf_size", sa.Integer(), nullable=True),
        sa.Column("compiled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _create_index("ix_inf_typst_notes_created_by_id", "inf_typst_notes", ["created_by_id"])
    _create_index("ix_inf_typst_notes_id", "inf_typst_notes", ["id"])
    _create_index("ix_inf_typst_notes_published", "inf_typst_notes", ["published"])
    _create_index("ix_inf_typst_notes_is_deleted", "inf_typst_notes", ["is_deleted"])

    _create_table(
        "inf_typst_assets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("inf_typst_notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("path", sa.String(length=400), nullable=False),
        sa.Column("mime", sa.String(length=100), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column(
            "uploaded_by_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _create_index("ix_inf_typst_assets_uploaded_by_id", "inf_typst_assets", ["uploaded_by_id"])
    _create_index("ix_inf_typst_assets_id", "inf_typst_assets", ["id"])
    _create_index("ix_inf_typst_assets_note_id", "inf_typst_assets", ["note_id"])

    # style_key 外键不在此建（wz_markdown_styles 由 20260225_0009 创建），
    # 0009 会补建 fk_wz_articles_style_key
    _create_table(
        "wz_articles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("custom_css", sa.Text(), nullable=True),
        sa.Column("style_key", sa.String(length=100), nullable=True),
        sa.Column(
            "author_id",
            sa.Integer(),
            sa.ForeignKey("sys_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("wz_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("published", sa.Boolean(), server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    _create_index("ix_wz_articles_slug", "wz_articles", ["slug"], unique=True)
    _create_index("ix_wz_articles_category_id", "wz_articles", ["category_id"])
    _create_index("ix_wz_articles_id", "wz_articles", ["id"])
    _create_index("ix_wz_articles_published", "wz_articles", ["published"])
    _create_index("ix_wz_articles_author_id", "wz_articles", ["author_id"])
    _create_index("ix_wz_articles_style_key", "wz_articles", ["style_key"])


def downgrade() -> None:
    # 反向（子表先于父表）删除，带存在性守卫
    for table_name in (
        "wz_articles",
        "inf_typst_assets",
        "inf_typst_notes",
        "znt_group_discussion_analyses",
        "znt_group_discussion_messages",
        "znt_group_discussion_members",
        "znt_group_discussion_sessions",
        "znt_optimize_logs",
        "znt_conversations",
        "sys_refresh_tokens",
        "xbk_selections",
        "xbk_students",
        "xbk_courses",
        "xxjs_dianming",
        "wz_categories",
        "znt_agents",
        "sys_feature_flags",
        "sys_users",
    ):
        if _table_exists(table_name):
            op.drop_table(table_name)
