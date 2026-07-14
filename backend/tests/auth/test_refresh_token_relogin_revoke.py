import asyncio
from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.models import User
from app.services.auth import create_refresh_token, revoke_all_user_refresh_tokens, verify_refresh_token


def test_revoke_all_user_refresh_tokens_revokes_existing_tokens():
    async def run():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, expire_on_commit=False)
        suffix = str(datetime.now(timezone.utc).timestamp()).replace(".", "")
        username = f"revoke-all-{suffix}"

        try:
            async with Session() as db:
                user = User(
                    username=username,
                    full_name="Refresh Revoke Test",
                    role_code="teacher",
                    is_active=True,
                    is_deleted=False,
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
                user_id = user.id

                token = await create_refresh_token(db, user_id)
                before = await verify_refresh_token(db, token)
                assert before is not None

                ok = await revoke_all_user_refresh_tokens(db, user_id)
                assert ok is True

                after = await verify_refresh_token(db, token)
                assert after is None
        finally:
            async with Session() as db:
                await db.execute(delete(User).where(User.username == username))
                await db.commit()
            await engine.dispose()

    asyncio.run(run())
