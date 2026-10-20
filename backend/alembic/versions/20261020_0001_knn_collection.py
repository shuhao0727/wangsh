"""Add KNN batches, rosters and immutable submission history.

Revision ID: 20261020_0001
Revises: f1a2b3c4d5e6
"""
from alembic import op
import sqlalchemy as sa

revision = "20261020_0001"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("it_knn_batches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("sys_users.id", ondelete="SET NULL")),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("frozen_data", sa.JSON()),
        sa.Column("frozen_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("ends_at > starts_at", name="ck_knn_batch_window"),
        sa.CheckConstraint("state IN ('draft', 'scheduled', 'closed')", name="ck_knn_batch_state"))
    op.create_index("ix_it_knn_batches_created_by", "it_knn_batches", ["created_by"])
    op.create_table("it_knn_roster",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.String(36), sa.ForeignKey("it_knn_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_no", sa.String(24), nullable=False),
        sa.Column("student_key", sa.String(24), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("current_revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("refill_allowed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("batch_id", "student_key", name="uq_knn_roster_student"),
        sa.CheckConstraint("current_revision >= 0", name="ck_knn_roster_revision"))
    op.create_index("ix_it_knn_roster_batch_id", "it_knn_roster", ["batch_id"])
    op.create_table("it_knn_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("roster_id", sa.Integer(), sa.ForeignKey("it_knn_roster.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("label", sa.String(12), nullable=False),
        sa.Column("display_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("roster_id", "revision", name="uq_knn_submission_revision"),
        sa.UniqueConstraint("roster_id", "request_id", name="uq_knn_submission_request"),
        sa.CheckConstraint("revision > 0", name="ck_knn_submission_revision"))
    op.create_index("ix_it_knn_submissions_roster_id", "it_knn_submissions", ["roster_id"])


def downgrade():
    op.drop_table("it_knn_submissions")
    op.drop_table("it_knn_roster")
    op.drop_table("it_knn_batches")
