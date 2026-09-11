"""R5 real auth/JWT/ORM regression, opt-in isolated SQLite or dedicated PG/Redis.

Collection requires a reviewed bootstrap that disables dotenv/conftest first.
R5_AUTH_DATABASE_URL must be a dedicated loopback PostgreSQL test database;
never fall back to application settings. PG tests use a unique schema per case.
"""
import os
import pytest

if os.environ.get("R5_AUTH_ISOLATED") != "1":
    pytest.skip("requires isolated R5 bootstrap", allow_module_level=True)

import asyncio
import copy
import importlib.util
import json
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.endpoints.auth import auth as api
from app.core import session_guard as guard
from app.core.config import settings
from app.core.session_family import lock_auth_mutation, refresh_family
from app.db import database
from app.db.database import Base, get_db
from app.models import AuthSessionState, AuthAuthority, RefreshToken, User
from app.services import auth as service
from test_logout_revocation_isolated import LogoutHarness, MemoryCache


class Cache:
    """Real Redis TCP adapter, or the identical isolated JSON contract in memory."""
    def __init__(self, client=None):
        self.client = client
        self.prefix = f"r5:{secrets.token_hex(8)}:"
        self.data = {}
        self.deadlines = {}
        self.fail_read = False
        self.fail_write = None
        self.writes = 0

    async def get_client(self):
        cache = self
        class Raw:
            def pipeline(self, transaction=True):
                class Pipeline:
                    def __init__(self): self.commands = []
                    async def __aenter__(self): return self
                    async def __aexit__(self, *args): pass
                    def get(self, key): self.commands.append(("get", key)); return self
                    def pttl(self, key): self.commands.append(("pttl", key)); return self
                    async def execute(self):
                        if cache.fail_read: raise RuntimeError("synthetic read failure")
                        if cache.client:
                            async with cache.client.pipeline(transaction=True) as p:
                                for op, key in self.commands: getattr(p, op)(cache.prefix + key)
                                return await p.execute()
                        now = datetime.now(timezone.utc)
                        return [cache.data.get(k) if op == "get" else (
                            max(0, int((cache.deadlines[k]-now).total_seconds()*1000))
                            if k in cache.deadlines else -2) for op, k in self.commands]
                return Pipeline()
            async def get(self, key):
                if cache.fail_read:
                    raise RuntimeError("synthetic read failure")
                return await cache.client.get(cache.prefix + key) if cache.client else cache.data.get(key)
        return Raw()

    async def get(self, key):
        try:
            raw = await (await self.get_client()).get(key)
            return json.loads(raw) if raw else None
        except Exception:
            return None

    async def set(self, key, value, expire_seconds=None):
        self.writes += 1
        if self.fail_write == "before":
            return False
        raw = json.dumps(value)
        expire_seconds = guard._session_ttl() if expire_seconds is None else expire_seconds
        self.deadlines[key] = datetime.now(timezone.utc) + timedelta(seconds=expire_seconds)
        if self.client:
            await self.client.set(self.prefix + key, raw, ex=expire_seconds)
        else:
            self.data[key] = raw
        if self.fail_write == "after":
            raise RuntimeError("synthetic lost Redis acknowledgement AFTER applied SET")
        return True

    async def delete(self, key):
        if self.client:
            await self.client.delete(self.prefix + key)
        else:
            self.data.pop(key, None)

    async def cleanup(self):
        if self.client:
            keys = [key async for key in self.client.scan_iter(match=self.prefix + "*")]
            if keys:
                await self.client.delete(*keys)
            await self.client.aclose()


class Harness(LogoutHarness):
    fail_commit_after = False
    pg = False
    async def request(self, method, path, *, token=None, cookies=None, ip="192.0.2.10", **kwargs):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        async with AsyncClient(transport=ASGITransport(app=self.app, client=(ip,12345),
                               raise_app_exceptions=False), base_url="http://isolated.invalid",
                               cookies=cookies, headers=headers) as client:
            return await client.request(method, "/api/v1/auth" + path, **kwargs)

    async def state(self, uid):
        async with self.db_factory() as db:
            state = await db.get(AuthSessionState, uid)
            return None if state is None else {"active": state.active, "nonce": state.nonce, "ip": state.ip}

    async def old_legacy(self, user="a", *, cache=True):
        """Enrolled legacy token, no ws1 family; no new-JWT downgrade."""
        uid = 1 if user == "a" else 2
        nonce = secrets.token_urlsafe(16)
        async with self.db_factory() as db:
            rt = await service.create_refresh_token(db, uid)
            db.add(AuthSessionState(user_id=uid, nonce=nonce, ip="192.0.2.10", active=True,
                                    ip_expires_at=datetime.now(timezone.utc)+timedelta(seconds=guard._session_ttl())))
            await db.commit()
        access = service.create_access_token({"sub": f"synthetic-{user}", "sn": nonce})
        if cache:
            await self.cache.set(guard._key_user(uid), {"nonce":nonce,"ip":"192.0.2.10"})
            await self.cache.set(guard._key_ip("192.0.2.10"), {"nonce":nonce,"user_id":uid})
        return {"access_token":access,"refresh_token":rt}


@pytest.fixture
def isolated_authority(monkeypatch):
    @asynccontextmanager
    async def context():
        h = Harness()
        url = os.environ.get("R5_AUTH_DATABASE_URL")
        schema = "r5_auth_" + secrets.token_hex(8)
        h.schema = schema
        client = None
        if url:
            parsed = make_url(url)
            assert parsed.drivername == "postgresql+asyncpg"
            assert parsed.host == "127.0.0.1" and parsed.port == 18870 and parsed.database == "r5_auth_test"
            import redis.asyncio as redis
            client = redis.Redis(host="127.0.0.1",port=18871,db=0,socket_timeout=2)
            h.pg = True
            admin = create_async_engine(url)
            async with admin.begin() as conn:
                await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
            engine = create_async_engine(url, connect_args={"server_settings":{
                "search_path":schema,"statement_timeout":"8000","lock_timeout":"6000"}})
        else:
            engine = create_async_engine("sqlite+aiosqlite:///:memory:")
            admin = None
        h.cache = Cache(client)
        class FaultSession(AsyncSession):
            async def commit(self):
                h.commit_attempts += 1
                if h.fail_commit:
                    raise RuntimeError("synthetic failure before COMMIT")
                await super().commit()
                if h.fail_commit_after:
                    raise RuntimeError("synthetic lost COMMIT acknowledgement")
        h.db_factory = async_sessionmaker(engine,class_=FaultSession,expire_on_commit=False,autoflush=False)
        monkeypatch.setattr(database,"AsyncSessionLocal",h.db_factory)
        monkeypatch.setattr(guard,"cache",h.cache)
        monkeypatch.setattr(settings,"AUTH_USER_UNIQUE_PER_IP",True)
        monkeypatch.setattr(settings,"AUTH_TRUST_X_FORWARDED_FOR",False)
        monkeypatch.setattr(settings,"AUTH_ENFORCE_SAME_IP_PER_REQUEST",False)
        monkeypatch.setattr(settings,"COOKIE_SECURE",False)
        async def rate_check(*args,**kwargs): pass
        monkeypatch.setattr(api.rate_limiter,"check",rate_check)
        try:
            async with engine.begin() as conn:
                await conn.run_sync(lambda c: Base.metadata.create_all(c,tables=[User.__table__,RefreshToken.__table__]))
                # Execute the actual incremental migration against existing core tables.
                def migrate(c):
                    from alembic.migration import MigrationContext
                    from alembic.operations import Operations
                    p = Path(__file__).resolve().parents[2]/"alembic/versions/20260910_0001_auth_authority.py"
                    spec=importlib.util.spec_from_file_location("r5_migration",p)
                    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
                    module.op=Operations(MigrationContext.configure(c));module.upgrade()
                await conn.run_sync(migrate)
            async with h.db_factory() as db:
                await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
                db.add_all([User(id=i,username=f"synthetic-{n}",full_name=f"Synthetic {n}",student_id=f"ID-{n}",
                    role_code="student",is_active=True,is_deleted=False) for i,n in [(1,"a"),(2,"b")]])
                await db.commit()
            h.app=FastAPI();h.app.include_router(api.router,prefix="/api/v1/auth")
            async def dep():
                async with h.db_factory() as db: yield db
            h.app.dependency_overrides[get_db]=dep
            yield h
        finally:
            await h.cache.cleanup()
            await engine.dispose()
            if admin:
                async with admin.begin() as conn:
                    await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
                await admin.dispose()
    return context


@pytest.mark.parametrize("legacy",[False,True])
@pytest.mark.parametrize("cache_loss",[False,True])
def test_replaced_credential_never_recovers(isolated_authority,legacy,cache_loss):
    async def run():
        async with isolated_authority() as h:
            a=await h.old_legacy() if legacy else await h.login()
            b=await h.login("b")
            assert await h.revoked(a)
            if cache_loss: await h.cache.delete(guard._key_user(1))
            await h.refresh(a,401);await h.me(a,401);await h.me(b,200)
            assert (await h.state(1))["active"] is False
    asyncio.run(run())


@pytest.mark.parametrize("legacy",[False,True])
def test_legal_cache_loss_recovery(isolated_authority,legacy):
    async def run():
        async with isolated_authority() as h:
            a=await h.old_legacy() if legacy else await h.login()
            await h.cache.delete(guard._key_user(1))
            recovered=await h.refresh(a,200)
            await h.me(recovered,200)
            assert (await h.state(1))["active"]
            await h.refresh(a,401)  # one-use semantics unchanged
            if not legacy: await h.me(a,200)
    asyncio.run(run())


@pytest.mark.parametrize("legacy",[False,True])
@pytest.mark.parametrize("failure",["before","after"])
def test_logout_durable_even_with_redis_write_failure(isolated_authority,legacy,failure):
    async def run():
        async with isolated_authority() as h:
            a=await h.old_legacy() if legacy else await h.login()
            h.cache.fail_write=failure
            await h.logout(a)
            h.cache.fail_write=None
            await h.me(a,401);await h.refresh(a,401)
            assert await h.revoked(a)
    asyncio.run(run())


@pytest.mark.parametrize("phase",["before","after"])
@pytest.mark.parametrize("legacy",[False,True])
def test_login_publish_failure_retry_retains_eviction(isolated_authority,phase,legacy):
    async def run():
        async with isolated_authority() as h:
            a=await h.old_legacy() if legacy else await h.login()
            h.cache.fail_write=phase
            failed=await h.request("POST","/login",data={"username":"Synthetic b","password":"ID-b"})
            assert failed.status_code==500 and "set-cookie" not in failed.headers
            assert await h.revoked(a)
            h.cache.fail_write=None
            b=await h.login("b")
            await h.cache.delete(guard._key_user(1))
            await h.refresh(a,401);await h.me(a,401);await h.me(b,200)
    asyncio.run(run())


def test_login_commit_failure_has_no_cache_publication(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a=await h.login();before=h.cache.writes
            h.fail_commit=True
            r=await h.request("POST","/login",data={"username":"Synthetic b","password":"ID-b"})
            assert r.status_code==500 and h.cache.writes==before
            h.fail_commit=False
            assert not await h.revoked(a)
            await h.me(a,200)
            await h.login("b");await h.refresh(a,401)
    asyncio.run(run())


@pytest.mark.parametrize("operation",["login","refresh","logout"])
def test_unknown_commit_keeps_durable_result_and_safe_retry(isolated_authority,operation):
    async def run():
        async with isolated_authority() as h:
            a=await h.login();before=h.cache.writes
            h.fail_commit_after=True
            if operation=="login":
                r=await h.request("POST","/login",data={"username":"Synthetic b","password":"ID-b"})
            elif operation=="refresh":
                r=await h.request("POST","/refresh",json={"refresh_token":a["refresh_token"]})
            else:
                r=await h.logout(a,expected_status=503)
            assert r.status_code in (500,503) and h.cache.writes==before
            h.fail_commit_after=False
            assert await h.revoked(a)
            await h.refresh(a,401)
            b=await h.login("b");await h.me(b,200)
            await h.me(a,401)
    asyncio.run(run())


def test_logout_commit_failure_503_without_claiming_revocation(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a=await h.old_legacy();h.fail_commit=True
            await h.logout(a,expected_status=503)
            h.fail_commit=False
            assert not await h.revoked(a)
            await h.me(a,200) # honest failure, not successful revocation
            await h.logout(a);await h.me(a,401)
    asyncio.run(run())


@pytest.mark.parametrize("phase",["before","after"])
def test_refresh_publish_failure_old_credential_retry_is_rejected(isolated_authority,phase):
    async def run():
        async with isolated_authority() as h:
            a=await h.login();await h.cache.delete(guard._key_user(1))
            h.cache.fail_write=phase
            r=await h.request("POST","/refresh",json={"refresh_token":a["refresh_token"]})
            assert r.status_code==500
            h.cache.fail_write=None
            assert await h.revoked(a)
            await h.refresh(a,401)
            fresh=await h.login();await h.me(fresh,200)
    asyncio.run(run())


def test_stale_redis_binding_does_not_evict_moved_durable_owner(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a=await h.login()
            moved=await h.request("POST","/login",ip="192.0.2.20",data={"username":"Synthetic a","password":"ID-a"})
            assert moved.status_code==200
            await h.login("b")
            await h.me(moved.json(),200)
            assert (await h.state(1))["ip"]=="192.0.2.20"
    asyncio.run(run())


def test_legacy_missing_cache_does_not_adopt_another_users_identity(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a=await h.old_legacy(cache=False)
            recovered=await h.refresh(a,200)
            r=await h.request("GET","/me",token=recovered["access_token"])
            assert r.status_code==200 and r.json()["id"]==1
            assert await h.state(2) is None
    asyncio.run(run())


def test_publish_window_rechecks_committed_credential(isolated_authority,monkeypatch):
    async def run():
        async with isolated_authority() as h:
            original=api._publish_committed_login
            triggered=False
            async def competing(db,uid,rt,request):
                nonlocal triggered
                if uid==1 and not triggered:
                    triggered=True
                    await h.login("b")
                return await original(db,uid,rt,request)
            monkeypatch.setattr(api,"_publish_committed_login",competing)
            r=await h.request("POST","/login",data={"username":"Synthetic a","password":"ID-a"})
            assert r.status_code==409
            assert (await h.state(1))["active"] is False
            assert (await h.state(2))["active"] is True
    asyncio.run(run())


def test_real_pg_concurrent_empty_ip_and_single_use(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            if not h.pg: pytest.skip("requires real PostgreSQL locks")
            responses=await asyncio.gather(*[h.request("POST","/login",data={"username":f"Synthetic {u}","password":f"ID-{u}"}) for u in ("a","b")])
            assert all(r.status_code in (200,409) for r in responses)
            states=[await h.state(i) for i in (1,2)]
            assert sum(bool(s and s["active"]) for s in states)==1
            active=1 if states[0]["active"] else 2
            pair=responses[active-1].json();assert responses[active-1].status_code==200
            await h.me(pair,200)
            refreshes=await asyncio.gather(*[h.request("POST","/refresh",json={"refresh_token":pair["refresh_token"]}) for _ in range(2)])
            assert sorted(r.status_code for r in refreshes)==[200,401]
    asyncio.run(run())


def test_real_pg_lock_release_after_cancel(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            if not h.pg: pytest.skip("requires real PostgreSQL locks")
            acquired=asyncio.Event()
            async def holder():
                async with h.db_factory() as db:
                    await lock_auth_mutation(db);acquired.set()
                    await asyncio.Event().wait()
            task=asyncio.create_task(holder());await acquired.wait()
            task.cancel()
            with pytest.raises(asyncio.CancelledError): await task
            a=await asyncio.wait_for(h.login(),3)
            await h.me(a,200)
    asyncio.run(run())


def test_refresh_does_not_renew_existing_session_cache_ttl(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a=await h.login();writes=h.cache.writes
            if h.pg:
                key=h.cache.prefix+guard._key_user(1)
                await h.cache.client.expire(key,100)
            refreshed=await h.refresh(a,200)
            assert h.cache.writes==writes
            if h.pg: assert 0 < await h.cache.client.ttl(key) <= 100
            await h.me(refreshed,200)
    asyncio.run(run())


def test_real_pg_deferred_commit_failure_rolls_back_eviction(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            if not h.pg: pytest.skip("requires real PostgreSQL deferred constraint")
            a=await h.login();writes=h.cache.writes
            async with h.db_factory() as db:
                await db.execute(text("""CREATE FUNCTION r5_fail_commit() RETURNS trigger LANGUAGE plpgsql AS $$
                    BEGIN IF NEW.user_id=2 THEN RAISE EXCEPTION 'synthetic deferred auth failure'; END IF;
                    RETURN NEW; END $$"""))
                await db.execute(text("""CREATE CONSTRAINT TRIGGER r5_commit_failure
                    AFTER INSERT OR UPDATE ON auth_session_states DEFERRABLE INITIALLY DEFERRED
                    FOR EACH ROW EXECUTE FUNCTION r5_fail_commit()"""))
                await db.commit()
            r=await h.request("POST","/login",data={"username":"Synthetic b","password":"ID-b"})
            assert r.status_code==500 and h.cache.writes==writes
            assert not await h.revoked(a)
            await h.me(a,200)
            async with h.db_factory() as db:
                await db.execute(text("DROP TRIGGER r5_commit_failure ON auth_session_states"));await db.commit()
            b=await h.login("b");await h.me(b,200);await h.refresh(a,401)
    asyncio.run(run())


def test_real_redis_timeout_keeps_durable_eviction(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            if not h.pg: pytest.skip("requires real Redis TCP")
            import redis.asyncio as redis
            a=await h.login()
            original=h.cache.client
            timed=redis.Redis(host="127.0.0.1",port=18871,socket_timeout=0.05,
                              retry_on_timeout=False, retry=__import__('redis').asyncio.retry.Retry(
                                  __import__('redis').backoff.NoBackoff(),0))
            h.cache.client=timed
            try:
                # Redis accepts commands but holds writes beyond the client timeout.
                await original.execute_command("CLIENT","PAUSE",250,"WRITE")
                r=await h.request("POST","/login",data={"username":"Synthetic b","password":"ID-b"})
                assert r.status_code==500
            finally:
                await timed.aclose();h.cache.client=original
                await asyncio.sleep(0.3)
            assert await h.revoked(a)
            b=await h.login("b")
            await h.cache.delete(guard._key_user(1))
            await h.refresh(a,401);await h.me(a,401);await h.me(b,200)
    asyncio.run(run())


def test_logout_database_read_failure_is_503(isolated_authority,monkeypatch):
    async def run():
        async with isolated_authority() as h:
            a=await h.login()
            original=api.resolve_legacy_subject
            async def fail(*args,**kwargs): raise RuntimeError("synthetic database unavailable")
            monkeypatch.setattr(api,"resolve_legacy_subject",fail)
            await h.logout(a,expected_status=503)
            monkeypatch.setattr(api,"resolve_legacy_subject",original)
            assert not await h.revoked(a)
            await h.logout(a);await h.me(a,401)
    asyncio.run(run())


async def _prepare_unenrolled_legacy(h, *, cached=True):
    """Reset only this unique synthetic schema to the post-migration CLOSED gate."""
    from sqlalchemy import delete, update
    async with h.db_factory() as db:
        await db.execute(delete(AuthSessionState))
        await db.execute(update(AuthAuthority).values(ready=False))
        await db.commit()
    pair = await h.old_legacy(cache=cached)
    async with h.db_factory() as db:
        await db.execute(delete(AuthSessionState))
        await db.commit()
    return pair


def test_enrollment_missing_ip_binding_preserves_legacy_then_replacement_revokes(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a = await _prepare_unenrolled_legacy(h)
            await h.cache.delete(guard._key_ip("192.0.2.10"))
            blocked = await h.request("POST", "/login", data={"username":"Synthetic b", "password":"ID-b"})
            assert blocked.status_code == 503
            async with h.db_factory() as db:
                result = await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
            assert result["preserved"] == 1
            await h.me(a, 200)
            b = await h.login("b")
            await h.me(a, 401)
            await h.cache.delete(guard._key_user(1))
            await h.refresh(a, 401)
            await h.me(b, 200)
    asyncio.run(run())


def test_enrollment_unknown_evidence_aborts_without_implicit_revocation(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a = await _prepare_unenrolled_legacy(h, cached=False)
            async with h.db_factory() as db:
                with pytest.raises(ValueError, match="Stop and drain"):
                    await service.bootstrap_durable_auth_authority(db)
                with pytest.raises(ValueError, match="Unproven legacy"):
                    await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
                assert not await db.scalar(select(AuthAuthority.ready))
                assert await db.scalar(select(AuthSessionState.user_id).limit(1)) is None
            assert not await h.revoked(a)
            async with h.db_factory() as db:
                await service.bootstrap_durable_auth_authority(
                    db, legacy_writers_stopped=True, reauthenticate_user_ids=frozenset({1}))
            assert await h.revoked(a)
            await h.refresh(a, 401)
            await h.me(await h.login(), 200)
    asyncio.run(run())


def test_enrollment_commit_failure_is_closed_and_retryable(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a = await _prepare_unenrolled_legacy(h)
            h.fail_commit = True
            async with h.db_factory() as db:
                with pytest.raises(RuntimeError, match="before COMMIT"):
                    await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
            h.fail_commit = False
            assert not await h.revoked(a)
            async with h.db_factory() as db:
                assert not await db.scalar(select(AuthAuthority.ready))
                assert await db.scalar(select(AuthSessionState.user_id).limit(1)) is None
                await db.rollback()
                await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
            await h.me(a, 200)
            await h.cache.delete(guard._key_user(1))
            await h.refresh(a, 200)
    asyncio.run(run())


def test_ready_gate_never_authorizes_unenrolled_legacy(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            from sqlalchemy import delete
            a = await h.old_legacy()
            async with h.db_factory() as db:
                await db.execute(delete(AuthSessionState).where(AuthSessionState.user_id == 1))
                await db.commit()
            b = await h.login("b")
            await h.me(a, 401)
            await h.refresh(a, 401)
            await h.me(b, 200)
    asyncio.run(run())


def test_migration_version_roundtrip_closed_gate(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            async with h.db_factory() as db:
                conn = await db.connection()
                def exercise(c):
                    from alembic.migration import MigrationContext
                    from alembic.operations import Operations
                    from alembic.config import Config
                    from alembic.script import ScriptDirectory
                    p = Path(__file__).resolve().parents[2]/"alembic/versions/20260910_0001_auth_authority.py"
                    spec = importlib.util.spec_from_file_location("r5_roundtrip", p)
                    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
                    cfg = Config(); cfg.set_main_option("script_location", str(p.parents[1]))
                    scripts = ScriptDirectory.from_config(cfg)
                    assert scripts.get_revision(module.revision).down_revision == module.down_revision
                    ctx = MigrationContext.configure(c)
                    module.op = Operations(ctx)
                    # This schema has only synthetic tables; no normal migration env.py.
                    ctx.stamp(scripts, module.revision)
                    assert ctx.get_current_revision() == module.revision
                    module.downgrade()
                    ctx.stamp(scripts, module.down_revision)
                    assert ctx.get_current_revision() == module.down_revision
                    module.upgrade()
                    ctx.stamp(scripts, module.revision)
                    assert ctx.get_current_revision() == module.revision
                    assert c.execute(text("SELECT ready FROM auth_authority WHERE id=1")).scalar() in (False, 0)
                await conn.run_sync(exercise)
                await db.commit()
    asyncio.run(run())


@pytest.mark.parametrize("bad_owner", [True, 1.0, "1", None])
def test_cutover_noncanonical_binding_owner_aborts(isolated_authority, bad_owner):
    asyncio.run(_assert_bad_binding_aborts(isolated_authority, {"user_id": bad_owner}))


@pytest.mark.parametrize("bad_nonce", [None, "", "invalid", 123, "MISSING", "A"*22])
def test_cutover_noncanonical_binding_nonce_aborts(isolated_authority, bad_nonce):
    asyncio.run(_assert_bad_binding_aborts(isolated_authority, {"user_id": 1, "nonce": bad_nonce}))


async def _assert_bad_binding_aborts(isolated_authority, override):
    from sqlalchemy import delete, update
    async with isolated_authority() as h:
        a, b = await h.old_legacy("a"), await h.old_legacy("b")
        state = await h.state(1)
        binding = {"user_id": 1, "nonce": state["nonce"], **override}
        if override.get("nonce") == "MISSING":
            binding.pop("nonce")
        await h.cache.set(guard._key_ip("192.0.2.10"), binding)
        async with h.db_factory() as db:
            await db.execute(delete(AuthSessionState))
            await db.execute(update(AuthAuthority).values(ready=False)); await db.commit()
            with pytest.raises(service.AuthCutoverEvidenceError) as err:
                await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
            assert err.value.user_ids == [1, 2]
            assert not await db.scalar(select(AuthAuthority.ready))
            assert await db.scalar(select(AuthSessionState.user_id).limit(1)) is None
        assert not await h.revoked(a) and not await h.revoked(b)


def test_enrollment_dryrun_read_failure_and_ack_retry(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a = await _prepare_unenrolled_legacy(h)
            h.cache.fail_read = True
            async with h.db_factory() as db:
                with pytest.raises(RuntimeError):
                    await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
            h.cache.fail_read = False
            async with h.db_factory() as db:
                result = await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True, dry_run=True)
                assert result["preserved"] == 1
                assert not await db.scalar(select(AuthAuthority.ready))
                assert await db.scalar(select(AuthSessionState.user_id).limit(1)) is None
            assert not await h.revoked(a)
            h.fail_commit_after = True
            async with h.db_factory() as db:
                with pytest.raises(RuntimeError, match="lost COMMIT"):
                    await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
            h.fail_commit_after = False
            async with h.db_factory() as db:
                result = await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
                assert result["already_ready"] == 1
            await h.me(a, 200)
    asyncio.run(run())


def test_enrollment_existing_evidence_and_foreign_transaction_rejected(isolated_authority):
    async def run():
        from sqlalchemy import update
        async with isolated_authority() as h:
            a = await h.login()
            async with h.db_factory() as db:
                await db.execute(update(AuthAuthority).values(ready=False)); await db.commit()
                with pytest.raises(RuntimeError, match="existing evidence"):
                    await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
                await db.execute(select(AuthAuthority))
                with pytest.raises(ValueError, match="fresh dedicated"):
                    await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
                await db.rollback()
            assert not await h.revoked(a)
    asyncio.run(run())


def test_expired_ip_lease_does_not_evict_or_get_republished(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a = await h.login()
            async with h.db_factory() as db:
                state = await db.get(AuthSessionState, 1)
                state.ip_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
                await db.commit()
            await h.cache.delete(guard._key_ip("192.0.2.10"))
            b = await h.login("b")
            assert not await h.revoked(a)
            await h.cache.delete(guard._key_user(1))
            a2 = await h.refresh(a, 200)
            assert (await h.cache.get(guard._key_ip("192.0.2.10")))["user_id"] == 2
            await h.me(a2, 200); await h.me(b, 200)
    asyncio.run(run())


def test_enrollment_retains_remaining_ip_lease(isolated_authority):
    async def run():
        async with isolated_authority() as h:
            a = await _prepare_unenrolled_legacy(h)
            value = await h.cache.get(guard._key_user(1))
            await h.cache.set(guard._key_user(1), value, expire_seconds=30)
            await h.cache.delete(guard._key_ip("192.0.2.10"))
            async with h.db_factory() as db:
                await service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
                state = await db.get(AuthSessionState, 1)
                expiry = state.ip_expires_at.replace(tzinfo=timezone.utc)
                assert 0 < (expiry - datetime.now(timezone.utc)).total_seconds() <= 30
            await h.cache.delete(guard._key_user(1))
            await h.refresh(a, 200)
            async with h.db_factory() as db:
                state = await db.get(AuthSessionState, 1)
                assert state.ip_expires_at.replace(tzinfo=timezone.utc) == expiry
    asyncio.run(run())


def test_read_overlapping_replacement_has_explicit_admission_boundary(isolated_authority, monkeypatch):
    async def run():
        from app.core import session_family
        async with isolated_authority() as h:
            a = await h.old_legacy()
            entered, release = asyncio.Event(), asyncio.Event()
            original = session_family.durable_access_is_active
            async def paused(db, uid, payload):
                result = await original(db, uid, payload)
                if uid == 1 and result:
                    entered.set(); await release.wait()
                return result
            monkeypatch.setattr(session_family, "durable_access_is_active", paused)
            pending = asyncio.create_task(h.me(a, 200))
            await asyncio.wait_for(entered.wait(), 3)
            b = await h.login("b")
            release.set(); await pending
            # In-flight read passed its durable admission before replacement.
            # Subsequent admissions MUST reject; no claim of cancelling HTTP.
            monkeypatch.setattr(session_family, "durable_access_is_active", original)
            await h.me(a, 401); await h.refresh(a, 401); await h.me(b, 200)
    asyncio.run(run())


def test_cutover_explicit_maintenance_entry_pg(isolated_authority):
    async def run():
        from sqlalchemy import update
        from app.api.endpoints.auth import cutover
        async with isolated_authority() as h:
            if not h.pg:
                pytest.skip("explicit CLI enrollment requires dedicated PostgreSQL")
            async with h.db_factory() as db:
                await db.execute(update(AuthAuthority).values(ready=False)); await db.commit()
            plan = {"database_url": os.environ["R5_AUTH_DATABASE_URL"],
                    "redis_url": "redis://127.0.0.1:18871/15", "database_schema": h.schema}
            result = await cutover.enroll(plan, apply=False)
            assert result["preserved"] == 0
            async with h.db_factory() as db:
                assert not await db.scalar(select(AuthAuthority.ready))
                assert await db.scalar(select(AuthSessionState.user_id).limit(1)) is None
            await cutover.enroll(plan, apply=True)
            async with h.db_factory() as db:
                assert await db.scalar(select(AuthAuthority.ready))
                assert len((await db.execute(select(AuthSessionState))).scalars().all()) == 2
            assert (await cutover.enroll(plan, apply=True))["already_ready"] == 1
    asyncio.run(run())


def test_cutover_plan_validation_and_default_dryrun(tmp_path, monkeypatch):
    from app.api.endpoints.auth import cutover
    plan = {"database_url": "postgresql+asyncpg://synthetic:synthetic@127.0.0.1:18870/r5_auth_test",
            "redis_url": "redis://127.0.0.1:18871/15", "database_schema": "r5_synthetic_only",
            "operator": "synthetic-review", "paired_snapshot_id": "synthetic-pair",
            "freeze_evidence": "synthetic-stopped-and-drained",
            "unique_per_ip": True, "reauthenticate_user_ids": [],
            "legacy_writers_stopped": True, "inflight_drained": True,
            "account_writes_frozen": True, "redis_auth_writes_frozen": True}
    file = tmp_path / "plan.json"
    file.write_text(json.dumps(plan))
    assert cutover.load_plan(file) == plan
    for field in ("legacy_writers_stopped", "inflight_drained", "account_writes_frozen", "redis_auth_writes_frozen"):
        file.write_text(json.dumps({**plan, field: False}))
        with pytest.raises(ValueError): cutover.load_plan(file)
    for ids in ([True], [1.0], ["1"], [-1]):
        file.write_text(json.dumps({**plan, "reauthenticate_user_ids": ids}))
        with pytest.raises(ValueError): cutover.load_plan(file)
    file.write_text(json.dumps(plan))
    # Wrong target refuses before any database/cache/application setup.
    assert cutover.main(["--plan", str(file), "--confirm-database", "wrong"]) == 1
