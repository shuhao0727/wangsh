import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.db.database import engine
from app.models import Base


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(main())
