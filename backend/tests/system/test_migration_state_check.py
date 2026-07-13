from pathlib import Path
from textwrap import dedent

from scripts.check_migration_state import (
    evaluate_migration_state,
    load_revision_graph,
    pending_revisions_from_current,
)


def _write_revision(path: Path, revision: str, down_revision: str | tuple[str, ...] | None, body: str = "pass") -> None:
    down = repr(down_revision)
    path.write_text(
        dedent(
            f"""
            revision = {revision!r}
            down_revision = {down}

            def upgrade():
                {body}
            """
        ),
        encoding="utf-8",
    )


def test_detects_existing_table_for_pending_migration(tmp_path):
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions / "001_base.py", "001_base", None)
    _write_revision(
        versions / "002_task.py",
        "002_task",
        "001_base",
        "op.create_table('task_analyses')",
    )

    result = evaluate_migration_state(
        current_revisions=["001_base"],
        existing_tables={"task_analyses"},
        existing_indexes=set(),
        existing_columns=set(),
        versions_dir=versions,
    )

    assert not result.ok
    assert any("task_analyses" in message for message in result.messages)
    assert any("schema drift detected" in message for message in result.messages)


def test_detects_op_f_index_for_pending_migration(tmp_path):
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions / "001_base.py", "001_base", None)
    _write_revision(
        versions / "002_index.py",
        "002_index",
        "001_base",
        "op.create_index(op.f('ix_task_analyses_id'), 'task_analyses', ['id'])",
    )

    result = evaluate_migration_state(
        current_revisions=["001_base"],
        existing_tables={"task_analyses"},
        existing_indexes={"ix_task_analyses_id"},
        existing_columns=set(),
        versions_dir=versions,
    )

    assert not result.ok
    assert any("ix_task_analyses_id" in message for message in result.messages)


def test_non_empty_database_without_alembic_version_is_blocked(tmp_path):
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions / "001_base.py", "001_base", None)

    result = evaluate_migration_state(
        current_revisions=[],
        existing_tables={"sys_users"},
        existing_indexes=set(),
        existing_columns=set(),
        versions_dir=versions,
    )

    assert not result.ok
    assert any("alembic_version is missing or empty" in message for message in result.messages)


def test_empty_database_without_alembic_version_can_initialize(tmp_path):
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions / "001_base.py", "001_base", None)

    result = evaluate_migration_state(
        current_revisions=[],
        existing_tables=set(),
        existing_indexes=set(),
        existing_columns=set(),
        versions_dir=versions,
    )

    assert result.ok


def test_empty_database_requires_exactly_one_alembic_head(tmp_path):
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions / "001_left.py", "001_left", None)
    _write_revision(versions / "002_right.py", "002_right", None)

    result = evaluate_migration_state(
        current_revisions=[],
        existing_tables=set(),
        existing_indexes=set(),
        existing_columns=set(),
        versions_dir=versions,
    )

    assert not result.ok
    assert any("expected exactly one Alembic head" in message for message in result.messages)


def test_pending_revisions_are_ordered_from_current_to_head(tmp_path):
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions / "001_base.py", "001_base", None)
    _write_revision(versions / "002_mid.py", "002_mid", "001_base")
    _write_revision(versions / "003_head.py", "003_head", "002_mid")

    revisions, down_revisions, heads = load_revision_graph(versions)

    assert pending_revisions_from_current(["001_base"], revisions, down_revisions, heads) == [
        "002_mid",
        "003_head",
    ]


def test_pending_revisions_include_unapplied_merge_branch(tmp_path):
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions / "001_base.py", "001_base", None)
    _write_revision(versions / "002_left.py", "002_left", "001_base")
    _write_revision(versions / "003_right.py", "003_right", "001_base")
    _write_revision(
        versions / "004_merge.py",
        "004_merge",
        ("002_left", "003_right"),
    )

    revisions, down_revisions, heads = load_revision_graph(versions)

    assert pending_revisions_from_current(["002_left"], revisions, down_revisions, heads) == [
        "003_right",
        "004_merge",
    ]


def test_assessment_availability_columns_are_managed_by_alembic():
    versions_dir = Path(__file__).resolve().parents[2] / "alembic" / "versions"
    migration = versions_dir / "20260711_0001_add_assessment_availability.py"
    content = migration.read_text(encoding="utf-8")

    assert "ADD COLUMN IF NOT EXISTS available_start TIMESTAMP WITH TIME ZONE" in content
    assert "ADD COLUMN IF NOT EXISTS available_end TIMESTAMP WITH TIME ZONE" in content
    assert "ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'fixed'" in content
    assert "ADD COLUMN IF NOT EXISTS adaptive_config TEXT" in content
    assert "ADD COLUMN IF NOT EXISTS knowledge_point VARCHAR(200)" in content
    assert "ADD COLUMN IF NOT EXISTS attempt_seq INTEGER NOT NULL DEFAULT 1" in content
    assert "ADD COLUMN IF NOT EXISTS is_adaptive BOOLEAN NOT NULL DEFAULT false" in content
    assert "ALTER COLUMN available_start TYPE TIMESTAMP WITH TIME ZONE" in content
    assert "ALTER COLUMN available_end TYPE TIMESTAMP WITH TIME ZONE" in content
    assert "ALTER COLUMN mode TYPE VARCHAR(20)" in content
    assert "ALTER COLUMN adaptive_config TYPE TEXT" in content
    assert "ALTER COLUMN knowledge_point TYPE VARCHAR(200)" in content
    assert "ALTER COLUMN attempt_seq TYPE INTEGER" in content
    assert "ALTER COLUMN is_adaptive TYPE BOOLEAN" in content
    assert "ALTER COLUMN attempt_seq SET DEFAULT 1" in content
    assert "ALTER COLUMN attempt_seq SET NOT NULL" in content
    assert "ALTER COLUMN is_adaptive SET DEFAULT false" in content
    assert "ALTER COLUMN is_adaptive SET NOT NULL" in content
    assert "DROP COLUMN" not in content


def test_alembic_online_migrations_expand_legacy_version_table_capacity():
    backend_root = Path(__file__).resolve().parents[2]
    env_content = (backend_root / "alembic" / "env.py").read_text(encoding="utf-8")
    compat_content = (
        backend_root / "app" / "db" / "alembic_compat.py"
    ).read_text(encoding="utf-8")

    assert "async with connectable.begin() as connection" in env_content
    assert "await connection.run_sync(ensure_alembic_version_capacity)" in env_content
    assert "ALTER COLUMN version_num TYPE VARCHAR(64)" in compat_content


def test_legacy_baseline_index_repair_migration_covers_conditional_indexes():
    versions_dir = Path(__file__).resolve().parents[2] / "alembic" / "versions"
    migration = versions_dir / "20260711_0002_restore_legacy_baseline_indexes.py"
    content = migration.read_text(encoding="utf-8")

    assert (
        'down_revision: Union[str, None] = '
        '"20260711_0001_add_assessment_availability"'
    ) in content
    expected_indexes = {
        "ix_xbk_courses_grade": ("xbk_courses", "grade"),
        "ix_xbk_selections_grade": ("xbk_selections", "grade"),
        "ix_xbk_students_grade": ("xbk_students", "grade"),
        "idx_wz_markdown_styles_sort": ("wz_markdown_styles", "sort_order"),
        "ix_wz_articles_style_key": ("wz_articles", "style_key"),
    }
    for index_name, (table_name, column_name) in expected_indexes.items():
        assert (
            f'CREATE INDEX IF NOT EXISTS "{index_name}" '
            f'ON "{table_name}" ("{column_name}")'
        ) in content
    assert "for statement in INDEX_STATEMENTS:" in content
    assert "op.execute(sa.text(statement))" in content
    assert "DROP INDEX" not in content
