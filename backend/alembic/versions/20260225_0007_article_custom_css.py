from alembic import op

# Revision identifiers, used by Alembic.
revision = "20260225_0007"
down_revision = "20260223_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE wz_articles ADD COLUMN IF NOT EXISTS custom_css TEXT;")


def downgrade() -> None:
    op.execute("ALTER TABLE wz_articles DROP COLUMN IF EXISTS custom_css;")

