"""restore indexes skipped by legacy baseline migrations

Revision ID: 20260711_0002_restore_legacy_baseline_indexes
Revises: 20260711_0001_add_assessment_availability
Create Date: 2026-07-11T15:45:00+00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260711_0002_restore_legacy_baseline_indexes"
down_revision: Union[str, None] = "20260711_0001_add_assessment_availability"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_STATEMENTS = (
    'CREATE INDEX IF NOT EXISTS "ix_xbk_courses_grade" ON "xbk_courses" ("grade")',
    'CREATE INDEX IF NOT EXISTS "ix_xbk_selections_grade" ON "xbk_selections" ("grade")',
    'CREATE INDEX IF NOT EXISTS "ix_xbk_students_grade" ON "xbk_students" ("grade")',
    'CREATE INDEX IF NOT EXISTS "idx_wz_markdown_styles_sort" ON "wz_markdown_styles" ("sort_order")',
    'CREATE INDEX IF NOT EXISTS "ix_wz_articles_style_key" ON "wz_articles" ("style_key")',
)


def upgrade() -> None:
    for statement in INDEX_STATEMENTS:
        op.execute(sa.text(statement))


def downgrade() -> None:
    # These indexes belong to the intended schema at the previous revision.
    # Removing them would recreate the legacy baseline defect.
    pass
