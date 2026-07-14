"""Compatibility helpers for legacy and typed AI analysis records."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis
from app.models.agents import TaskAnalysis as TaskAnalysisModel


_BUSINESS_FIELDS = (
    "title",
    "agent_id",
    "class_name",
    "start_at",
    "end_at",
    "created_by",
)
_SNAPSHOT_FIELDS = ("created_at", "task_sheet", "result")


def _normalized_snapshot(row: Any, missing: object) -> tuple[Any, Any, Any] | None:
    snapshot = tuple(getattr(row, field, missing) for field in _SNAPSHOT_FIELDS)
    if missing in snapshot or snapshot[0] is None:
        return None
    return snapshot[0], snapshot[1] or None, snapshot[2]


def _compatible_targets(row: Any) -> tuple[type, ...]:
    if isinstance(row, (HotQuestionAnalysis, StudentChainAnalysis)):
        return (TaskAnalysisModel,)
    return ()


async def delete_compatible_sibling(db: AsyncSession, kept_row: Any) -> int:
    """Delete one uniquely identifiable legacy sibling of a typed row.

    Ambiguous or incomplete snapshots are left untouched to avoid deleting a
    different analysis run. Legacy rows are never used to authorize deletion
    from a typed table because the three tables have independent integer IDs.
    """
    targets = _compatible_targets(kept_row)
    if not targets:
        return 0

    missing = object()
    kept_snapshot = _normalized_snapshot(kept_row, missing)
    if kept_snapshot is None:
        return 0

    matches = []
    for target in targets:
        rows = (
            await db.execute(
                select(target).where(
                    *(
                        getattr(target, field) == getattr(kept_row, field)
                        for field in _BUSINESS_FIELDS
                    )
                )
            )
        ).scalars().all()
        matches.extend(
            row
            for row in rows
            if _normalized_snapshot(row, missing) == kept_snapshot
        )

    if len(matches) != 1:
        return 0
    await db.delete(matches[0])
    return 1
