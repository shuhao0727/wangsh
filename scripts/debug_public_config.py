
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.database import AsyncSessionLocal
from app.services.agents.group_discussion_public_config import GroupDiscussionPublicConfigService
from app.models.core.feature_flag import FeatureFlag
from sqlalchemy import select

async def main():
    print("Checking GroupDiscussionPublicConfigService...")
    async with AsyncSessionLocal() as db:
        # 1. Get current status via Service
        enabled = await GroupDiscussionPublicConfigService.get_enabled(db)
        print(f"Service.get_enabled() returned: {enabled}")

        # 2. Check raw DB value
        stmt = select(FeatureFlag).where(FeatureFlag.key == "group_discussion_frontend_visible")
        result = await db.execute(stmt)
        flag = result.scalar_one_or_none()
        if flag:
            print(f"Raw FeatureFlag: id={flag.id}, key={flag.key}, value={flag.value}")
        else:
            print("Raw FeatureFlag: NOT FOUND")

        # 3. Try to toggle it
        print("\nAttempting to toggle...")
        new_state = not enabled
        await GroupDiscussionPublicConfigService.set_enabled(db, new_state)
        print(f"Called set_enabled({new_state})")

        # 4. Check again
        enabled_after = await GroupDiscussionPublicConfigService.get_enabled(db)
        print(f"Service.get_enabled() returned: {enabled_after}")
        
        stmt = select(FeatureFlag).where(FeatureFlag.key == "group_discussion_frontend_visible")
        result = await db.execute(stmt)
        flag_after = result.scalar_one_or_none()
        if flag_after:
            print(f"Raw FeatureFlag after update: value={flag_after.value}")
        else:
            print("Raw FeatureFlag after update: NOT FOUND")

        if enabled_after == new_state:
            print("\nSUCCESS: Toggle worked.")
        else:
            print("\nFAILURE: Toggle did not persist.")

if __name__ == "__main__":
    asyncio.run(main())
