"""Pure Alembic revision-graph and database-state validation helpers.

The application and bootstrap entry points both need the same answer to one
question: is the revision recorded in the effective schema a known, single
revision on the current migration line?  This module deliberately contains no
SQLAlchemy engine access and never imports or executes migration modules.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


DEFAULT_VERSIONS_DIR = Path(__file__).resolve().parents[2] / "alembic" / "versions"
VIEW_CONTRACT_REVISION = "f1a2b3c4d5e6"


@dataclass(frozen=True)
class RevisionGraph:
    """The statically parsed Alembic graph."""

    revisions: Mapping[str, Path]
    parents: Mapping[str, frozenset[str]]
    heads: frozenset[str]

    def is_ancestor(self, ancestor: str, revision: str) -> bool:
        """Return whether ``ancestor`` is equal to or precedes ``revision``."""
        if ancestor == revision:
            return True
        pending = list(self.parents.get(revision, ()))
        visited: set[str] = set()
        while pending:
            candidate = pending.pop()
            if candidate in visited:
                continue
            if candidate == ancestor:
                return True
            visited.add(candidate)
            pending.extend(self.parents.get(candidate, ()))
        return False

    def descendants_of(self, ancestor: str) -> frozenset[str]:
        """Return all known revisions equal to or after ``ancestor``."""
        return frozenset(
            revision
            for revision in self.revisions
            if self.is_ancestor(ancestor, revision)
        )


@dataclass(frozen=True)
class RevisionStateResult:
    """A diagnostic result suitable for startup and CLI error messages."""

    ok: bool
    reason: str
    message: str
    revision: str | None = None


def quote_identifier(identifier: str) -> str:
    """Quote a PostgreSQL identifier without allowing SQL syntax injection."""
    return '"' + identifier.replace('"', '""') + '"'


def qualified_identifier(schema: str, name: str) -> str:
    """Return a schema-qualified PostgreSQL identifier."""
    return f"{quote_identifier(schema)}.{quote_identifier(name)}"


def _revision_assignment_targets(node: ast.stmt) -> list[ast.expr]:
    """Find top-level assignment targets without executing migration code."""
    if isinstance(node, ast.Assign):
        return node.targets
    if isinstance(node, ast.AnnAssign):
        return [node.target]
    return []


def _validate_revision_literal(path: Path, name: str, value: object) -> None:
    """Keep revision identifier and parent-list validation independent of AST IO."""
    if name == "revision":
        if not isinstance(value, str) or not value:
            raise RuntimeError(f"{path.name}: revision must be a non-empty string")
        return
    if value is None:
        return
    if isinstance(value, (tuple, list)):
        if not all(isinstance(item, str) and item for item in value):
            raise RuntimeError(
                f"{path.name}: down_revision sequence must contain only non-empty strings"
            )
    elif not isinstance(value, str) or not value:
        raise RuntimeError(
            f"{path.name}: down_revision must be None, a non-empty string, "
            "or a sequence of non-empty strings"
        )


def _load_revision_namespace(path: Path) -> dict[str, object]:
    namespace: dict[str, object] = {}
    for node in ast.parse(path.read_text(encoding="utf-8"), filename=str(path)).body:
        for target in _revision_assignment_targets(node):
            if not isinstance(target, ast.Name) or target.id not in {
                "revision",
                "down_revision",
            }:
                continue
            try:
                value = ast.literal_eval(node.value)
            except (TypeError, ValueError) as exc:
                raise RuntimeError(f"{path.name}: non-literal {target.id}") from exc
            _validate_revision_literal(path, target.id, value)
            namespace[target.id] = value
    return namespace


def load_revision_graph(versions_dir: Path = DEFAULT_VERSIONS_DIR) -> RevisionGraph:
    """Parse the current migration graph without importing migration code."""
    revisions: dict[str, Path] = {}
    parents: dict[str, frozenset[str]] = {}
    referenced: set[str] = set()

    for path in sorted(versions_dir.glob("*.py")):
        namespace = _load_revision_namespace(path)
        revision = namespace.get("revision")
        if not isinstance(revision, str):
            continue
        if revision in revisions:
            raise RuntimeError(f"duplicate Alembic revision: {revision}")

        down_revision = namespace.get("down_revision")
        if isinstance(down_revision, str):
            parent_values = {down_revision}
        elif isinstance(down_revision, (tuple, list)):
            parent_values = set(down_revision)
        else:
            parent_values = set()
        parent_values.discard("None")
        revisions[revision] = path
        parents[revision] = frozenset(parent_values)
        referenced.update(parent_values)

    missing = referenced - set(revisions)
    if missing:
        raise RuntimeError(f"missing Alembic parent revision(s): {sorted(missing)}")

    visiting: set[str] = set()
    visited: set[str] = set()

    def validate(revision: str) -> None:
        if revision in visiting:
            raise RuntimeError(f"cycle in Alembic graph at {revision}")
        if revision in visited:
            return
        visiting.add(revision)
        for parent in parents[revision]:
            validate(parent)
        visiting.remove(revision)
        visited.add(revision)

    for revision in revisions:
        validate(revision)

    heads = frozenset(set(revisions) - referenced)
    return RevisionGraph(revisions=revisions, parents=parents, heads=heads)


def validate_revision_state(
    current_revisions: list[object] | tuple[object, ...],
    graph: RevisionGraph,
    *,
    contract_revision: str = VIEW_CONTRACT_REVISION,
) -> RevisionStateResult:
    """Validate an exact ``alembic_version`` row set against the graph.

    A database is accepted only when it has exactly one known revision and the
    view-contract migration is an ancestor of both that revision and the sole
    current head.  This accepts future descendants of the contract migration,
    while rejecting old, branched, or unknown/future revisions immediately.
    """
    if not current_revisions:
        return RevisionStateResult(
            ok=False,
            reason="empty_version_table",
            message="alembic_version is empty; refusing to infer or stamp a revision",
        )

    if len(current_revisions) != 1:
        revisions = ", ".join(repr(str(value)) for value in current_revisions)
        return RevisionStateResult(
            ok=False,
            reason="multiple_version_rows",
            message=(
                "alembic_version must contain exactly one revision row; "
                f"found {len(current_revisions)}: [{revisions}]"
            ),
        )

    value = current_revisions[0]
    if not isinstance(value, str) or not value:
        return RevisionStateResult(
            ok=False,
            reason="invalid_version_value",
            message=f"alembic_version contains an invalid revision value: {value!r}",
        )
    revision = value

    if revision not in graph.revisions:
        return RevisionStateResult(
            ok=False,
            reason="unknown_revision",
            message=(
                f"unknown Alembic revision {revision!r}; refusing to start against "
                "a revision not present in the current migration graph"
            ),
            revision=revision,
        )

    if contract_revision not in graph.revisions:
        return RevisionStateResult(
            ok=False,
            reason="contract_revision_missing",
            message=(
                f"view-contract revision {contract_revision!r} is not present in "
                "the current migration graph"
            ),
            revision=revision,
        )

    if len(graph.heads) != 1:
        return RevisionStateResult(
            ok=False,
            reason="multiple_graph_heads",
            message=(
                "expected exactly one Alembic head in the current migration graph; "
                f"found: {sorted(graph.heads)}"
            ),
            revision=revision,
        )

    head = next(iter(graph.heads))
    if not graph.is_ancestor(contract_revision, head):
        return RevisionStateResult(
            ok=False,
            reason="contract_not_ancestor_of_head",
            message=(
                f"view-contract revision {contract_revision!r} is not an ancestor "
                f"of current Alembic head {head!r}"
            ),
            revision=revision,
        )

    if not graph.is_ancestor(contract_revision, revision):
        return RevisionStateResult(
            ok=False,
            reason="revision_before_contract",
            message=(
                f"database revision {revision!r} is older than required view-contract "
                f"revision {contract_revision!r}"
            ),
            revision=revision,
        )

    if not graph.is_ancestor(revision, head):
        return RevisionStateResult(
            ok=False,
            reason="revision_not_on_current_head_line",
            message=(
                f"database revision {revision!r} is not an ancestor of current "
                f"Alembic head {head!r}"
            ),
            revision=revision,
        )

    return RevisionStateResult(
        ok=True,
        reason="ok",
        message=f"database is at valid Alembic revision {revision!r}",
        revision=revision,
    )
