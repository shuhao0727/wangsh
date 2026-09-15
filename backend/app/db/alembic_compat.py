"""Compatibility helpers that must run before Alembic updates its version row."""

import sqlalchemy as sa
from sqlalchemy.engine import Connection

_VERSION_TABLE = "alembic_version"


def _current_version_table_schema(connection: Connection) -> str:
    """Resolve the schema PostgreSQL uses for an unqualified version table."""
    schema = connection.execute(
        sa.text("SELECT current_schema()")
    ).scalar_one_or_none()
    if not schema:
        raise RuntimeError(
            "PostgreSQL search_path does not contain an existing schema; "
            "cannot create or update alembic_version"
        )
    return str(schema)


def effective_schema(connection: Connection) -> str:
    """Return the schema that PostgreSQL resolves first for this connection."""
    if connection.dialect.name != "postgresql":
        raise RuntimeError("effective_schema is only supported for PostgreSQL")
    return _current_version_table_schema(connection)


def ensure_alembic_version_capacity(connection: Connection) -> None:
    """Ensure Alembic's version table exists in the connection's effective schema.

    Always bind the version table to ``current_schema()`` rather than reusing a
    visible fallback table in ``public``. This prevents a custom-schema
    migration from accidentally reading or writing ``public.alembic_version``
    when the connection has ``search_path=<custom>, public``.
    """
    if connection.dialect.name != "postgresql":
        return

    target_schema = effective_schema(connection)
    preparer = connection.dialect.identifier_preparer
    qualified_table = (
        f"{preparer.quote_schema(target_schema)}.{preparer.quote(_VERSION_TABLE)}"
    )
    table_exists = bool(
        connection.execute(
            sa.text(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_catalog.pg_class AS c
                    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                    WHERE n.nspname = :schema
                      AND c.relname = :table_name
                      AND c.relkind IN ('r', 'p')
                )
                """
            ),
            {"schema": target_schema, "table_name": _VERSION_TABLE},
        ).scalar_one()
    )
    if table_exists:
        connection.execute(
            sa.text(
                f"ALTER TABLE {qualified_table} "
                "ALTER COLUMN version_num TYPE VARCHAR(64)"
            )
        )
        return

    connection.execute(
        sa.text(
            f"CREATE TABLE {qualified_table} ("
            "version_num VARCHAR(64) NOT NULL, "
            "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)"
            ")"
        )
    )
