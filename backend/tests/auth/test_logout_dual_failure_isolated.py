"""Exact AUTH-01 failure matrix, not PG/Redis or distributed atomicity proof."""
import asyncio

import pytest

from test_logout_revocation_isolated import isolated  # noqa: F401


@pytest.mark.parametrize("cache_failure", [None, "false", "raise"])
@pytest.mark.parametrize("db_failure", [False, True])
@pytest.mark.parametrize("legacy", [False, True])
def test_dual_store_failure_matrix_preserves_response_and_exposes_remaining_credentials(
    isolated, cache_failure, db_failure, legacy,
):
    async def run():
        async with isolated() as h:
            pair = await h.legacy_login() if legacy else await h.login()
            h.cache.fail_write = cache_failure
            h.fail_commit = db_failure
            commits, rollbacks = h.commit_attempts, h.rollbacks
            await h.logout(
                pair, expected_status=503 if db_failure else 200,
            )  # Cookie cleanup is required for both confirmed and incomplete outcomes.
            assert h.commit_attempts == commits + 1
            assert h.rollbacks == rollbacks + int(db_failure)
            # Repair the injected outage only; never alter tokens or persisted state.
            h.cache.fail_write = None
            h.fail_commit = False
            assert await h.revoked(pair) is (not db_failure)
            await h.me(pair, 200 if db_failure else 401)
            refresh_survives = db_failure
            refreshed = await h.refresh(pair, 200 if refresh_survives else 401)
            if refresh_survives:
                # DB-first failure leaves original access/refresh intact; do not
                # claim logout succeeded merely because cookies were cleared.
                await h.me(refreshed, 200)
    asyncio.run(run())
