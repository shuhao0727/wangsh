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
