"""Add durable session/revocation authority without invalidating legacy tokens.

Downgrade removes security evidence: stop auth traffic and invalidate/drain all
outstanding credentials first. Do not downgrade a live authentication service.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260910_0001_auth_authority"
down_revision = "20260908_0001_xbk_academic_year"
branch_labels = None
depends_on = None


def upgrade():
    gate = op.create_table(
        "auth_authority",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ready", sa.Boolean(), nullable=False),
    )
    op.bulk_insert(gate, [{"id": 1, "ready": False}])
    op.create_table(
        "auth_session_states",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("sys_users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("nonce", sa.String(128), nullable=False),
        sa.Column("ip", sa.String(64), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("ip_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("auth_session_states")
    op.drop_table("auth_authority")
