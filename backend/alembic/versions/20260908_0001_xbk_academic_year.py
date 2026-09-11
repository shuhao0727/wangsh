"""store XBK academic years as canonical ranges

XBK previously stored ``year`` as an integer. The application contract now uses
``YYYY-YYYY`` (for example ``2026-2027``) while still accepting a four-digit
start year at API/import boundaries.

Existing integer values are upgraded with ``2026 -> 2026-2027``. Indexes and
unique constraints are retained because PostgreSQL rewrites the indexed column
in place. Downgrade keeps only the first four digits and is therefore lossy by
design.

Revision ID: 20260908_0001_xbk_academic_year
Revises: 20260817_0001_query_filter_indexes
Create Date: 2026-09-08T00:00:00+08:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260908_0001_xbk_academic_year"
down_revision: Union[str, None] = "20260817_0001_query_filter_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_TABLES = ("xbk_students", "xbk_courses", "xbk_selections")


def _constraint_name(table_name: str) -> str:
    return f"ck_{table_name}_academic_year"


def upgrade() -> None:
    for table_name in _TABLES:
        op.alter_column(
            table_name,
            "year",
            existing_type=sa.Integer(),
            type_=sa.String(length=9),
            existing_nullable=False,
            comment="学年（如 2026-2027）",
            postgresql_using=(
                "CASE "
                "WHEN year BETWEEN 2000 AND 2099 "
                "THEN year::text || '-' || (year + 1)::text "
                "ELSE year::text END"
            ),
        )
        op.create_check_constraint(
            _constraint_name(table_name),
            table_name,
            "length(year) = 9 AND substr(year, 5, 1) = '-' "
            "AND CAST(substr(year, 1, 4) AS INTEGER) BETWEEN 2000 AND 2099 "
            "AND CAST(substr(year, 6, 4) AS INTEGER) = "
            "CAST(substr(year, 1, 4) AS INTEGER) + 1",
        )


def downgrade() -> None:
    # Lossy boundary: ``2026-2027`` is restored to the former integer ``2026``.
    for table_name in reversed(_TABLES):
        op.drop_constraint(_constraint_name(table_name), table_name, type_="check")
        op.alter_column(
            table_name,
            "year",
            existing_type=sa.String(length=9),
            type_=sa.Integer(),
            existing_nullable=False,
            comment=None,
            postgresql_using="CAST(substr(year, 1, 4) AS INTEGER)",
        )
