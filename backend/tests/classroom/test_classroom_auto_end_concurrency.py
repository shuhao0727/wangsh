"""课堂活动多进程自动结束的真实 PostgreSQL 回归测试。"""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.database import Base
from app.models import User
from app.models.agents import AIAgent
from app.models.classroom import ClassroomActivity, ClassroomResponse
from app.services import classroom as classroom_svc


def test_concurrent_auto_end_claims_activity_once(monkeypatch):
    async def run():
        schema = f"test_classroom_auto_end_{uuid4().hex}"
        admin_engine = create_async_engine(settings.DATABASE_URL)
        async with admin_engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))

        engine = create_async_engine(
            settings.DATABASE_URL,
            connect_args={
                "server_settings": {
                    "search_path": f"{schema},public",
                }
            },
        )
        Session = async_sessionmaker(engine, expire_on_commit=False)
        events = []

        async def fake_dispatch(_db, deferred_events):
            events.extend(deferred_events)

        monkeypatch.setattr(
            classroom_svc,
            "dispatch_activity_events",
            fake_dispatch,
        )

        async with engine.begin() as connection:
            await connection.run_sync(
                lambda sync_connection: Base.metadata.create_all(
                    sync_connection,
                    tables=[
                        User.__table__,
                        AIAgent.__table__,
                        ClassroomActivity.__table__,
                        ClassroomResponse.__table__,
                    ],
                    checkfirst=False,
                )
            )

        try:
            async with Session() as db:
                owner = User(
                    full_name="Auto End Owner",
                    role_code="teacher",
                    is_active=True,
                    is_deleted=False,
                )
                db.add(owner)
                await db.flush()
                activity = ClassroomActivity(
                    activity_type="vote",
                    title="concurrent-auto-end",
                    class_name="integration-test",
                    options=[{"key": "A", "text": "A"}],
                    correct_answer="A",
                    time_limit=1,
                    status="active",
                    started_at=datetime.now(timezone.utc) - timedelta(seconds=30),
                    analysis_status="not_applicable",
                    created_by=owner.id,
                )
                db.add(activity)
                await db.commit()
                activity_id = activity.id

            async def auto_end_once():
                async with Session() as db:
                    await classroom_svc._auto_end_overdue_activities(db)

            await asyncio.gather(auto_end_once(), auto_end_once())

            async with Session() as db:
                activity = (
                    await db.execute(
                        select(ClassroomActivity).where(
                            ClassroomActivity.id == activity_id
                        )
                    )
                ).scalar_one()

            assert activity.status == "ended"
            assert [
                event
                for event in events
                if event["type"] == "activity_ended"
            ] == [
                {
                    "type": "activity_ended",
                    "activity_id": activity_id,
                    "created_by": owner.id,
                    "class_name": "integration-test",
                }
            ]
        finally:
            await engine.dispose()
            async with admin_engine.begin() as connection:
                await connection.execute(
                    text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
                )
            await admin_engine.dispose()

    asyncio.run(run())
