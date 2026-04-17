import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.services.auth import create_refresh_token, revoke_all_user_refresh_tokens, verify_refresh_token


def test_revoke_all_user_refresh_tokens_revokes_existing_tokens():
    async def run():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, expire_on_commit=False)
        async with Session() as db:
            token = await create_refresh_token(db, 3)
            before = await verify_refresh_token(db, token)
            assert before is not None

            ok = await revoke_all_user_refresh_tokens(db, 3)
            assert ok is True

            after = await verify_refresh_token(db, token)
            assert after is None
        await engine.dispose()

    asyncio.run(run())
