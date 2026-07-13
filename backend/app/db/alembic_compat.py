"""Compatibility helpers that must run before Alembic updates its version row."""

import sqlalchemy as sa
from sqlalchemy.engine import Connection


def ensure_alembic_version_capacity(connection: Connection) -> None:
    """Allow maintained revision IDs longer than Alembic's legacy default."""
    if connection.dialect.name != "postgresql":
        return

    connection.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF to_regclass('public.alembic_version') IS NOT NULL THEN
                    ALTER TABLE alembic_version
                    ALTER COLUMN version_num TYPE VARCHAR(64);
                END IF;
            END
            $$;
            """
        )
    )
