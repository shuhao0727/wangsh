"""Transaction helpers for group discussion session joins."""

from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agents.group_discussion import GroupDiscussionMember, GroupDiscussionSession


async def commit_session_or_get_existing(
    db: AsyncSession,
    session: GroupDiscussionSession,
    *,
    session_date: date,
    class_name: str,
    group_no: str,
) -> GroupDiscussionSession:
    db.add(session)
    try:
        await db.commit()
        await db.refresh(session)
        return session
    except IntegrityError:
        await db.rollback()
        existing = (
            await db.execute(
                select(GroupDiscussionSession).where(
                    GroupDiscussionSession.session_date == session_date,
                    GroupDiscussionSession.class_name == class_name,
                    GroupDiscussionSession.group_no == group_no,
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            raise
        return existing


async def flush_session_or_get_existing(
    db: AsyncSession,
    session: GroupDiscussionSession,
    *,
    session_date: date,
    class_name: str,
    group_no: str,
) -> GroupDiscussionSession:
    """Create a session inside a savepoint without ending the caller transaction."""
    try:
        async with db.begin_nested():
            db.add(session)
            await db.flush()
        return session
    except IntegrityError:
        existing = (
            await db.execute(
                select(GroupDiscussionSession).where(
                    GroupDiscussionSession.session_date == session_date,
                    GroupDiscussionSession.class_name == class_name,
                    GroupDiscussionSession.group_no == group_no,
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            raise
        return existing


async def remove_previous_membership(
    db: AsyncSession,
    *,
    previous_session_id: int | None,
    target_session_id: int,
    user_id: int,
) -> None:
    """Stage removal of the previous membership in the caller's transaction."""
    if previous_session_id is None or previous_session_id == target_session_id:
        return

    previous_session = (
        await db.execute(
            select(GroupDiscussionSession).where(
                GroupDiscussionSession.id == previous_session_id
            )
        )
    ).scalar_one_or_none()
    if previous_session is None:
        return

    await db.execute(
        delete(GroupDiscussionMember).where(
            GroupDiscussionMember.session_id == previous_session_id,
            GroupDiscussionMember.user_id == user_id,
        )
    )
