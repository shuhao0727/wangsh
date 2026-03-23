"""add muted_until to group_discussion_members

Revision ID: 20260323_0006
Revises: 20260320_0005
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = "20260323_0006"
down_revision = "20260320_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "znt_group_discussion_members",
        sa.Column("muted_until", sa.DateTime(timezone=True), nullable=True, comment="禁言截止时间"),
    )


def downgrade() -> None:
    op.drop_column("znt_group_discussion_members", "muted_until")
