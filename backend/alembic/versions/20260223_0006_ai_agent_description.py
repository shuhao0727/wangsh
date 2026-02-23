from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = "20260223_0006"
down_revision = "20260213_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    为 znt_agents 添加 description 文本列（可空），用于前端展示与编辑。
    兼容旧库：IF NOT EXISTS 防止重复执行报错。
    """
    op.execute("ALTER TABLE znt_agents ADD COLUMN IF NOT EXISTS description TEXT;")


def downgrade() -> None:
    """
    回滚移除 description 列（兼容 IF EXISTS）
    """
    op.execute("ALTER TABLE znt_agents DROP COLUMN IF EXISTS description;")
