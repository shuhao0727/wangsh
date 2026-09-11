"""Explicit maintenance entry, NOT an HTTP route or an application startup hook.

Run this FILE directly (not `-m`, which imports the router before isolation).
Defaults to dry-run. Requires an explicit target and recorded operational freeze;
never discovers .env, silently uses app defaults, or prints connection secrets.
"""
import argparse
import asyncio
import json
import os
import re
from pathlib import Path
import secrets
import sys


def load_plan(path: Path) -> dict:
    plan = json.loads(path.read_text())
    for key in ("database_url", "redis_url", "operator", "paired_snapshot_id", "freeze_evidence"):
        if not isinstance(plan.get(key), str) or not plan[key].strip():
            raise ValueError(f"Explicit {key} required")
    for key in ("legacy_writers_stopped", "inflight_drained", "account_writes_frozen", "redis_auth_writes_frozen"):
        if plan.get(key) is not True:
            raise ValueError(f"Recorded {key}=true prerequisite required")
    if type(plan.get("unique_per_ip")) is not bool:
        raise ValueError("Explicit current unique_per_ip policy required")
    if not isinstance(plan.get("database_schema"), str) or not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", plan["database_schema"]):
        raise ValueError("Explicit simple database_schema required")
    ids = plan.get("reauthenticate_user_ids", [])
    if not isinstance(ids, list) or any(type(uid) is not int or uid <= 0 for uid in ids):
        raise ValueError("Explicit approval must be a list of positive integer user ids")
    return plan


async def enroll(plan: dict, *, apply: bool) -> dict:
    # Imports occur only AFTER CLI validation and explicit environment isolation.
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.services.auth import bootstrap_durable_auth_authority
    from app.core import session_guard
    import redis.asyncio as redis
    client = redis.from_url(plan["redis_url"], decode_responses=True,
                            socket_connect_timeout=5, socket_timeout=10)
    class ReadOnlySnapshotCache:
        async def get_client(self):
            return client
    previous_cache = session_guard.cache
    session_guard.cache = ReadOnlySnapshotCache()
    engine = create_async_engine(plan["database_url"], connect_args={"server_settings": {
        "statement_timeout": "60000", "lock_timeout": "10000",
        "search_path": plan["database_schema"]}})
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            return await bootstrap_durable_auth_authority(
                db, legacy_writers_stopped=True, dry_run=not apply,
                reauthenticate_user_ids=frozenset(plan.get("reauthenticate_user_ids", [])),
            )
    finally:
        await engine.dispose()
        session_guard.cache = previous_cache
        await client.aclose()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", required=True, type=Path, help="Explicit protected JSON plan; never a dotenv file")
    parser.add_argument("--apply", action="store_true", help="Commit validated enrollment; default is rollback-only")
    parser.add_argument("--confirm-database", required=True, help="Exact target database name (not URL)")
    args = parser.parse_args(argv)
    # No application imports/config/connection on missing/invalid arguments.
    try:
        plan = load_plan(args.plan)
        from sqlalchemy.engine import make_url
        database, redis = make_url(plan["database_url"]), make_url(plan["redis_url"])
        if (database.drivername != "postgresql+asyncpg" or not database.host or not database.database
                or database.database != args.confirm_database or database.query):
            raise ValueError("Explicit PostgreSQL target does not match confirmation")
        if redis.drivername not in ("redis", "rediss") or not redis.host:
            raise ValueError("Explicit Redis target required")
        # Dedicated process only. Avoid inherited application endpoints/secrets.
        keep = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "LANG", "TMPDIR")}
        os.environ.clear(); os.environ.update(keep)
        os.environ.update(DEBUG="true", DATABASE_URL=plan["database_url"], REDIS_URL=plan["redis_url"],
                          SECRET_KEY=secrets.token_urlsafe(48),
                          AUTH_USER_UNIQUE_PER_IP=str(plan["unique_per_ip"]).lower(),
                          PYTHONDONTWRITEBYTECODE="1")
        sys.dont_write_bytecode = True
        from pydantic_settings import DotEnvSettingsSource
        DotEnvSettingsSource._read_env_files = lambda self: {}
        sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
        from loguru import logger
        logger.remove()  # Application connection errors may contain sensitive URLs.
        result = asyncio.run(enroll(plan, apply=args.apply))
        print(json.dumps({"mode": "apply" if args.apply else "dry-run", **result}))
        return 0
    except Exception as exc:
        # Never dump DB/Redis exception text or a traceback (may contain credentials).
        if type(exc).__name__ == "AuthCutoverEvidenceError":
            print(json.dumps({"requires_reauthentication_approval": exc.user_ids}), file=sys.stderr)
        print(f"Cutover refused ({type(exc).__name__}); gate not unconditionally opened. "
              "Inspect approved plan/evidence. If COMMIT acknowledgement was lost, retry this entry.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
