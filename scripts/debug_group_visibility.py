import asyncio
import sys
import os
from datetime import date, datetime

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.database import AsyncSessionLocal
from app.services.agents.group_discussion import list_classes, list_today_groups
from sqlalchemy import select
from app.models.agents.group_discussion import GroupDiscussionSession

async def main():
    target_date = date(2026, 2, 28)
    print(f"Checking data for date: {target_date}")

    async with AsyncSessionLocal() as db:
        # 1. Direct DB Query
        stmt = select(GroupDiscussionSession).where(GroupDiscussionSession.session_date == target_date)
        sessions = (await db.execute(stmt)).scalars().all()
        print(f"Found {len(sessions)} raw sessions in DB:")
        for s in sessions:
            print(f"  - ID: {s.id}, Group: {s.group_no}, Class: {s.class_name}, Created: {s.created_at}, LastMsg: {s.last_message_at}")

        # 2. Check list_classes
        classes = await list_classes(db, date=target_date)
        print(f"\nlist_classes returned: {classes}")

        # 3. Check list_today_groups (with ignore_time_limit=True)
        groups_ignore_limit = await list_today_groups(
            db, 
            date=target_date, 
            class_name=None, 
            ignore_time_limit=True
        )
        print(f"\nlist_today_groups (ignore_time_limit=True) returned {len(groups_ignore_limit)} items")

        # 4. Check list_today_groups (with ignore_time_limit=False) - simulating the bug condition
        groups_with_limit = await list_today_groups(
            db, 
            date=target_date, 
            class_name=None, 
            ignore_time_limit=False
        )
        print(f"list_today_groups (ignore_time_limit=False) returned {len(groups_with_limit)} items")

if __name__ == "__main__":
    asyncio.run(main())
