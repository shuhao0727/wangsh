"""OPS-04: real parser/evaluator contracts; no app config or business DB."""
from dataclasses import replace
from pathlib import Path

import pytest

from scripts import check_migration_state as preflight

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"
MIGRATION = VERSIONS / "20260430_migrate_dev_schema.py"
INDEX = "ix_znt_group_discussion_sessions_group_name"
TABLE = "znt_group_discussion_sessions"
DEFINITION = f"CREATE INDEX {INDEX} ON public.{TABLE} USING btree (group_name)"


def catalog(**changes):
    return replace(preflight.IndexDefinition(
        schema="public", table=TABLE, definition=DEFINITION,
        valid=True, ready=True, live=True, kind="i",
    ), **changes)


def evaluate(*, indexes=None, definitions=None, current=None, versions=VERSIONS, tables=None):
    return preflight.evaluate_migration_state(
        current_revisions=["20260428_agent_idx"] if current is None else current,
        existing_tables={TABLE} if tables is None else tables,
        existing_indexes={INDEX} if indexes is None else indexes,
        existing_columns={(TABLE, "group_name")},
        existing_index_definitions=definitions,
        versions_dir=versions,
    )


def test_actual_intermediate_revision_accepts_only_equivalent_guarded_index():
    ops = preflight.parse_migration_ops(MIGRATION, "20260430_migrate_dev_schema")
    assert INDEX in ops.create_indexes
    assert ops.guarded_indexes[INDEX] == DEFINITION
    assert evaluate(definitions={INDEX: (catalog(),)}).ok


def test_actual_guard_without_catalog_evidence_stays_blocked():
    result = evaluate()
    assert not result.ok
    assert INDEX in " ".join(result.messages)


def test_actual_guard_with_absent_index_is_safe_to_create():
    assert evaluate(indexes=set(), definitions={}).ok


@pytest.mark.parametrize("changes", [
    {"table": "other_table"}, {"schema": "shadow"},
    {"valid": False}, {"ready": False}, {"live": False}, {"kind": "I"},
    {"definition": DEFINITION.replace("(group_name)", "(session_date)")},
    {"definition": DEFINITION.replace("CREATE INDEX", "CREATE UNIQUE INDEX")},
    {"definition": DEFINITION.replace("btree", "hash")},
    {"definition": DEFINITION.replace("(group_name)", "(group_name DESC)")},
    {"definition": DEFINITION.replace("(group_name)", "(group_name, session_date)")},
    {"definition": DEFINITION + " WHERE group_name IS NOT NULL"},
    {"definition": DEFINITION + " INCLUDE (session_date)"},
    {"definition": DEFINITION.replace("(group_name)", "(lower((group_name)::text))")},
    {"definition": DEFINITION.replace("(group_name)", '(group_name COLLATE "C")')},
    {"definition": DEFINITION.replace("(group_name)", "(group_name varchar_pattern_ops)")},
    {"definition": DEFINITION + " WITH (fillfactor='70')"},
    {"definition": DEFINITION + " TABLESPACE other_space"},
])
def test_same_name_different_structure_or_unusable_index_is_blocked(changes):
    result = evaluate(definitions={INDEX: (catalog(**changes),)})
    assert not result.ok
    assert INDEX in " ".join(result.messages)


@pytest.mark.parametrize("public_exists", [True, False])
def test_unqualified_historical_guard_cannot_trust_cross_schema_names(public_exists):
    foreign = catalog(schema="shadow")
    definitions = {INDEX: (catalog(), foreign) if public_exists else (foreign,)}
    assert not evaluate(indexes={INDEX} if public_exists else set(), definitions=definitions).ok


def test_empty_head_and_missing_revision_controls():
    assert evaluate(current=[], tables=set(), indexes=set(), definitions={}).ok
    assert not evaluate(current=[], definitions={}).ok
    assert not evaluate(current=["missing_revision"], definitions={}).ok
    _, _, heads = preflight.load_revision_graph(VERSIONS)
    assert evaluate(current=list(heads), definitions={}).ok


def graph(tmp_path, body, extra=""):
    (tmp_path / "base.py").write_text("revision = 'base'\ndown_revision = None\n")
    path = tmp_path / "next.py"
    path.write_text("revision = 'next'\ndown_revision = 'base'\n" + extra +
                    "\ndef upgrade():\n" + body + "\n")
    return path


@pytest.mark.parametrize("guard", [
    f"not _index_exists('{INDEX}')", "dynamic_guard()", "not inspector.has_index(name)",
])
@pytest.mark.parametrize("exists", [True, False])
def test_unreviewed_dynamic_guard_fails_closed_even_without_collision(tmp_path, guard, exists):
    graph(tmp_path, f"    if {guard}:\n        op.create_index('{INDEX}', '{TABLE}', ['group_name'])")
    result = evaluate(current=["base"], versions=tmp_path,
                      indexes={INDEX} if exists else set(), definitions={INDEX: (catalog(),)} if exists else {})
    assert not result.ok
    assert "unreviewed" in " ".join(result.messages).lower()


@pytest.mark.parametrize("mutation", [
    lambda s: s.replace("return row is not None", "return row is None"),
    lambda s: s.replace('if not _index_exists("ix_', 'if _index_exists("ix_'),
    lambda s: s.replace('["group_name"],', '["session_date"],'),
    lambda s: s.replace('def upgrade():', 'def upgrade():\n    _index_exists = lambda _: True'),
    lambda s: s + '\n_index_exists = lambda _: True\n',
])
def test_reviewed_filename_or_helper_name_does_not_authorize_changed_code(tmp_path, mutation):
    path = tmp_path / MIGRATION.name
    path.write_text(mutation(MIGRATION.read_text()))
    ops = preflight.parse_migration_ops(path, "20260430_migrate_dev_schema")
    assert not ops.guarded_indexes
    assert ops.review_errors


def test_unguarded_equivalent_index_still_conflicts(tmp_path):
    graph(tmp_path, f"    op.create_index(op.f('{INDEX}'), '{TABLE}', ['group_name'])")
    assert not evaluate(current=["base"], versions=tmp_path,
                        definitions={INDEX: (catalog(),)}).ok


def test_downgrade_only_index_not_a_pending_upgrade_operation(tmp_path):
    path = graph(tmp_path, "    pass")
    with path.open("a") as f:
        f.write(f"\ndef downgrade():\n    op.create_index('{INDEX}', '{TABLE}', ['group_name'])\n")
    assert INDEX not in preflight.parse_migration_ops(path, "next").create_indexes
    assert evaluate(current=["base"], versions=tmp_path, definitions={}).ok


@pytest.mark.parametrize("operation", ["op.create_table('existing')", "op.add_column('existing', sa.Column('col', sa.Text()))"])
def test_real_table_and_column_conflicts_remain_blocked(tmp_path, operation):
    graph(tmp_path, "    " + operation)
    result = preflight.evaluate_migration_state(
        current_revisions=["base"], existing_tables={"existing"},
        existing_indexes=set(), existing_columns={("existing", "col")}, versions_dir=tmp_path,
    )
    assert not result.ok


def test_missing_parent_revision_fails_closed(tmp_path):
    graph(tmp_path, "    pass")
    (tmp_path / "base.py").unlink()
    assert not evaluate(current=["next"], versions=tmp_path, definitions={}).ok


def test_revision_graph_does_not_execute_migration_modules(tmp_path):
    graph(tmp_path, "    pass", "raise AssertionError('preflight must not execute migrations')\n")
    revisions, _, heads = preflight.load_revision_graph(tmp_path)
    assert set(revisions) == {"base", "next"}
    assert heads == {"next"}


def test_hidden_helper_index_guard_fails_closed(tmp_path):
    path = graph(tmp_path, "    helper()", f"def helper():\n    if dynamic_guard():\n        op.create_index('{INDEX}', '{TABLE}', ['group_name'])\n")
    assert preflight.parse_migration_ops(path, "next").review_errors
    assert not evaluate(current=["base"], versions=tmp_path, indexes=set(), definitions={}).ok


def test_guard_fingerprint_is_stable_across_empty_ast_field_versions():
    import ast
    tree = ast.parse(MIGRATION.read_text())
    expected = preflight._guard_ast_digest(tree)
    for node in ast.walk(tree):
        for name, value in list(ast.iter_fields(node)):
            if value is None or value == []:
                delattr(node, name)
    assert preflight._guard_ast_digest(tree) == expected


def test_comment_only_change_keeps_reviewed_contract(tmp_path):
    path = tmp_path / "renamed.py"
    path.write_text("# added comment\n\n" + MIGRATION.read_text())
    assert preflight.parse_migration_ops(path, "ignored").guarded_indexes[INDEX] == DEFINITION


@pytest.mark.parametrize("body", [
    "    op.create_index(index_name, 't', ['c'])",
    "    op.create_index('i', 't', ['c'], if_not_exists=True)",
    "    op.create_index('i', 't', ['c'], **options)",
])
def test_dynamic_index_name_and_unreviewed_builtin_guard_block(tmp_path, body):
    graph(tmp_path, body)
    assert not evaluate(current=["base"], versions=tmp_path, indexes=set(), definitions={}).ok


def test_catalog_loader_preserves_structure_flags_and_all_schemas():
    import asyncio
    statements = []

    class Rows(list):
        def scalar_one_or_none(self):
            return self[0][0] if self else None

    class Connection:
        async def execute(self, statement):
            sql = str(statement)
            statements.append(sql)
            if "to_regclass" in sql:
                return Rows([("alembic_version",)])
            if "SELECT version_num" in sql:
                return Rows([("20260428_agent_idx",)])
            if "FROM pg_tables" in sql:
                return Rows([(TABLE,)])
            if "pg_catalog.pg_index AS i" in sql:
                return Rows([
                    (INDEX, "public", TABLE, DEFINITION, True, True, True, "i"),
                    (INDEX, "shadow", TABLE, DEFINITION, False, False, False, "I"),
                ])
            if "information_schema.columns" in sql:
                return Rows([(TABLE, "group_name")])
            raise AssertionError(f"unexpected SQL: {sql}")

    current, tables, indexes, columns, definitions = asyncio.run(preflight._load_database_state(Connection()))
    assert current == ["20260428_agent_idx"]
    assert tables == {TABLE} and indexes == {INDEX} and columns == {(TABLE, "group_name")}
    assert definitions[INDEX] == (catalog(), catalog(schema="shadow", valid=False, ready=False, live=False, kind="I"))
    assert not evaluate(definitions=definitions).ok
    query = next(sql for sql in statements if "pg_catalog.pg_index AS i" in sql)
    assert "pg_catalog.pg_get_indexdef" in query
    assert "WHERE" not in query.upper()  # Unqualified historical guard sees all schemas.
    assert all(sql.strip().upper().startswith("SELECT") for sql in statements)


def test_catalog_query_casts_postgres_internal_char_for_asyncpg():
    """asyncpg returns pg_class.relkind's internal char as bytes without a cast."""
    import asyncio

    class Rows(list):
        def scalar_one_or_none(self):
            return None

    class Connection:
        async def execute(self, statement):
            sql = str(statement)
            if 'pg_catalog.pg_index AS i' in sql:
                assert 'CAST(idx.relkind AS text)' in sql
            return Rows()

    asyncio.run(preflight._load_database_state(Connection()))


def test_earlier_actual_revisions_do_not_gain_unreviewed_guard_exemptions():
    result = evaluate(current=['20260210_0000_legacy_baseline_tables'], indexes=set(), definitions={})
    assert not result.ok
    assert 'unreviewed' in ' '.join(result.messages)


@pytest.mark.parametrize('definition, expected_exit', [(DEFINITION, 0), (DEFINITION + ' WHERE group_name IS NOT NULL', 1)])
def test_async_entrypoint_passes_real_loader_evidence_to_real_evaluator(monkeypatch, capsys, definition, expected_exit):
    import asyncio
    import sys
    import types

    statements = []

    class Rows(list):
        def scalar_one_or_none(self):
            return self[0][0] if self else None

    class Context:
        def __init__(self, value):
            self.value = value

        async def __aenter__(self):
            return self.value

        async def __aexit__(self, *_):
            return False

    class Connection:
        def begin(self):
            return Context(self)

        async def execute(self, statement):
            sql = str(statement)
            statements.append(sql)
            if sql.startswith('SET TRANSACTION'):
                return Rows()
            if 'to_regclass' in sql:
                return Rows([('alembic_version',)])
            if 'SELECT version_num' in sql:
                return Rows([('20260428_agent_idx',)])
            if 'FROM pg_tables' in sql:
                return Rows([(TABLE,)])
            if 'pg_catalog.pg_index AS i' in sql:
                return Rows([(INDEX, 'public', TABLE, definition, True, True, True, 'i')])
            if 'information_schema.columns' in sql:
                return Rows([(TABLE, 'group_name')])
            raise AssertionError(sql)

    database = types.ModuleType('app.db.database')
    async def dispose():
        pass

    database.engine = types.SimpleNamespace(connect=lambda: Context(Connection()), dispose=dispose)
    monkeypatch.setitem(sys.modules, 'app.db.database', database)
    assert asyncio.run(preflight.async_main()) == expected_exit
    assert statements[0] == 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'
    assert all(sql.strip().startswith('SELECT') for sql in statements[1:])
    captured = capsys.readouterr()
    assert ('[OK]' if expected_exit == 0 else '[FAIL]') in (captured.out + captured.err)
