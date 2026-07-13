"""repair assessment columns missing from the Alembic history

Revision ID: 20260711_0001_add_assessment_availability
Revises: 20260628_0001_add_classroom_activity_class_desc
Create Date: 2026-07-11T00:01:00+00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260711_0001_add_assessment_availability"
down_revision: Union[str, None] = "20260628_0001_add_classroom_activity_class_desc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_configs "
            "ADD COLUMN IF NOT EXISTS available_start TIMESTAMP WITH TIME ZONE"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_configs "
            "ADD COLUMN IF NOT EXISTS available_end TIMESTAMP WITH TIME ZONE"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_questions "
            "ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'fixed'"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_questions "
            "ADD COLUMN IF NOT EXISTS adaptive_config TEXT"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_answers "
            "ADD COLUMN IF NOT EXISTS knowledge_point VARCHAR(200)"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_answers "
            "ADD COLUMN IF NOT EXISTS attempt_seq INTEGER NOT NULL DEFAULT 1"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_answers "
            "ADD COLUMN IF NOT EXISTS is_adaptive BOOLEAN NOT NULL DEFAULT false"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_configs "
            "ALTER COLUMN available_start TYPE TIMESTAMP WITH TIME ZONE "
            "USING available_start::TIMESTAMP WITH TIME ZONE, "
            "ALTER COLUMN available_end TYPE TIMESTAMP WITH TIME ZONE "
            "USING available_end::TIMESTAMP WITH TIME ZONE"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_questions "
            "ALTER COLUMN mode DROP DEFAULT, "
            "ALTER COLUMN mode TYPE VARCHAR(20) USING mode::VARCHAR(20), "
            "ALTER COLUMN adaptive_config TYPE TEXT USING adaptive_config::TEXT"
        )
    )
    op.execute(
        sa.text(
            "UPDATE znt_assessment_questions SET mode = 'fixed' WHERE mode IS NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_questions "
            "ALTER COLUMN mode SET DEFAULT 'fixed', "
            "ALTER COLUMN mode SET NOT NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_answers "
            "ALTER COLUMN knowledge_point TYPE VARCHAR(200) "
            "USING knowledge_point::VARCHAR(200), "
            "ALTER COLUMN attempt_seq DROP DEFAULT, "
            "ALTER COLUMN attempt_seq TYPE INTEGER USING attempt_seq::INTEGER, "
            "ALTER COLUMN is_adaptive DROP DEFAULT, "
            "ALTER COLUMN is_adaptive TYPE BOOLEAN USING is_adaptive::BOOLEAN"
        )
    )
    op.execute(
        sa.text(
            "UPDATE znt_assessment_answers SET attempt_seq = 1 WHERE attempt_seq IS NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_answers "
            "ALTER COLUMN attempt_seq SET DEFAULT 1, "
            "ALTER COLUMN attempt_seq SET NOT NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE znt_assessment_answers SET is_adaptive = false WHERE is_adaptive IS NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE znt_assessment_answers "
            "ALTER COLUMN is_adaptive SET DEFAULT false, "
            "ALTER COLUMN is_adaptive SET NOT NULL"
        )
    )


def downgrade() -> None:
    # This repair migration cannot know whether each column predates it.
    # Keep data and constraints intact instead of dropping potentially owned data.
    pass
