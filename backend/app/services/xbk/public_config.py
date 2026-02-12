from typing import Any, Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FeatureFlag


XBK_PUBLIC_FLAG_KEY = "xbk_public_enabled"


class XbkPublicConfigService:
    @staticmethod
    async def get_enabled(db: AsyncSession) -> bool:
        stmt = select(FeatureFlag).where(FeatureFlag.key == XBK_PUBLIC_FLAG_KEY)
        result = await db.execute(stmt)
        flag = result.scalar_one_or_none()
        if not flag:
            return False
        value: Dict[str, Any] = flag.value or {}
        return bool(value.get("enabled", False))

    @staticmethod
    async def set_enabled(db: AsyncSession, enabled: bool) -> bool:
        stmt = select(FeatureFlag).where(FeatureFlag.key == XBK_PUBLIC_FLAG_KEY)
        result = await db.execute(stmt)
        flag = result.scalar_one_or_none()

        if not flag:
            flag = FeatureFlag(key=XBK_PUBLIC_FLAG_KEY, value={"enabled": enabled})
            db.add(flag)
        else:
            flag.value = {"enabled": enabled}  # type: ignore[assignment]

        await db.commit()
        return enabled

