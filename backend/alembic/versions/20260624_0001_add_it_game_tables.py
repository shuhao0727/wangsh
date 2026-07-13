"""add it_games and it_game_download_logs tables

新增「IT 游戏资源库」功能所需的两张表：
- it_games: 游戏资源元数据（名称、分类、文件信息、下载计数等）
- it_game_download_logs: 每次下载的审计记录（用户、IP、UA、时间）

这两张表的模型定义见 app/models/it/game.py（GameResource / GameDownloadLog），
此前仅靠开发环境 Base.metadata.create_all 建表，缺少正式 Alembic 迁移，
导致生产环境 alembic upgrade head 后表不存在、游戏库接口全部报错。

Revises: 20260614_0001_add_fullname_index
Create Date: 2026-06-24T00:01:00+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260624_0001_add_it_game_tables"
down_revision: Union[str, None] = "20260614_0001_add_fullname_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) 游戏资源表（父表，先建）
    op.create_table(
        "it_games",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, comment="游戏名称"),
        sa.Column("description", sa.Text(), nullable=True, comment="游戏简介"),
        sa.Column(
            "category",
            sa.String(length=100),
            nullable=False,
            comment="分类：如益智、动作、模拟、工具",
        ),
        sa.Column("filename", sa.String(length=300), nullable=False, comment="原始文件名"),
        sa.Column("stored_path", sa.String(length=500), nullable=False, comment="服务器存储路径"),
        # 注意：补 server_default，使裸 SQL INSERT（不经 ORM）也能正确写入默认值，
        # 而不会因 NOT NULL 约束报错。模型层用的是 Python default=，仅在 ORM 生效。
        sa.Column(
            "file_size",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="文件大小（字节）",
        ),
        sa.Column(
            "file_mime",
            sa.String(length=100),
            nullable=False,
            server_default="application/octet-stream",
            comment="MIME 类型",
        ),
        sa.Column("file_sha256", sa.String(length=64), nullable=True, comment="SHA256 校验值"),
        sa.Column("icon_url", sa.String(length=500), nullable=True, comment="封面/图标 URL"),
        sa.Column(
            "download_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="下载次数（冗余计数）",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            comment="是否上架",
        ),
        sa.Column(
            "uploaded_by",
            sa.Integer(),
            nullable=True,
            comment="上传者",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="更新时间",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["sys_users.id"],
            ondelete="SET NULL",
            name="fk_it_games_uploaded_by_sys_users",
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="游戏资源库表",
    )
    op.create_index("ix_it_games_category", "it_games", ["category"])
    op.create_index("ix_it_games_uploaded_by", "it_games", ["uploaded_by"])

    # 2) 下载记录表（子表，后建，FK 引用 it_games.id）
    op.create_table(
        "it_game_download_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False, comment="游戏ID"),
        sa.Column("user_id", sa.Integer(), nullable=True, comment="下载用户"),
        sa.Column("ip_address", sa.String(length=45), nullable=False, comment="客户端IP"),
        sa.Column("user_agent", sa.String(length=500), nullable=True, comment="浏览器UA"),
        sa.Column(
            "downloaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="下载时间",
        ),
        sa.ForeignKeyConstraint(
            ["game_id"],
            ["it_games.id"],
            ondelete="CASCADE",
            name="fk_it_game_download_logs_game_id_it_games",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["sys_users.id"],
            ondelete="SET NULL",
            name="fk_it_game_download_logs_user_id_sys_users",
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="游戏下载记录表",
    )
    op.create_index("ix_it_game_download_logs_game_id", "it_game_download_logs", ["game_id"])
    op.create_index("ix_it_game_download_logs_user_id", "it_game_download_logs", ["user_id"])


def downgrade() -> None:
    # 逆序删除：先删子表，再删父表（FK 依赖关系）
    op.drop_index("ix_it_game_download_logs_user_id", table_name="it_game_download_logs")
    op.drop_index("ix_it_game_download_logs_game_id", table_name="it_game_download_logs")
    op.drop_table("it_game_download_logs")

    op.drop_index("ix_it_games_uploaded_by", table_name="it_games")
    op.drop_index("ix_it_games_category", table_name="it_games")
    op.drop_table("it_games")
