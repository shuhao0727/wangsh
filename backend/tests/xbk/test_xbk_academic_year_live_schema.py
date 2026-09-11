"""Opt-in live-schema regression. Use an external network-none PG runner.

Requires --noconftest, dotenv disabled, and an isolated socket audit guard.
Never point this test at a normal database. Synthetic rows only; no HTTP bodies
or identifying roster fields are written to evidence. The full real migration
uses the repository Alembic env; only get_db / authentication are overridden.
"""
import os
import pytest


def test_xbk_academic_year_live_schema():
    if os.environ.get("XBK_MIGRATION_REHEARSAL_ISOLATED") != "network-none-v1":
        pytest.skip("External isolated migration runner required")
    import asyncio
    import hashlib
    import json
    from pathlib import Path
    from sqlalchemy import (CheckConstraint, Integer, MetaData, event, text)
    from sqlalchemy.engine import make_url
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from alembic import command
    from alembic.config import Config
    from fastapi import FastAPI
    import httpx

    url = os.environ["TEST_DATABASE_URL"]
    parsed = make_url(url)
    assert parsed.drivername == "postgresql+asyncpg"
    assert parsed.host == "127.0.0.1" and parsed.port == 5432
    assert parsed.database == "xbk_migration_rehearsal_test"
    assert os.environ.get("DATABASE_URL") == url
    assert os.environ.get("PYTEST_DISABLE_PLUGIN_AUTOLOAD") == "1"
    from app.models import XbkStudent, XbkCourse, XbkSelection
    from app.api.endpoints.xbk import router
    from app.api.endpoints.xbk._common import require_xbk_access
    from app.db.database import get_db

    source = Path(__file__).resolve().parents[2]
    out = Path(os.environ["XBK_REHEARSAL_EVIDENCE"])
    previous = "20260817_0001_query_filter_indexes"
    target = "20260908_0001_xbk_academic_year"
    tables = (XbkStudent.__table__, XbkCourse.__table__, XbkSelection.__table__)
    report = {"normal_db_accessed": False, "data": "synthetic only", "stages": {}}
    def save():
        (out / "observations.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    def engine():
        return create_async_engine(url, hide_parameters=True, connect_args={"server_settings": {
            "statement_timeout": "15000", "lock_timeout": "3000",
            "application_name": "xbk_migration_rehearsal"}})

    async def snapshot():
        e = engine()
        try:
            async with e.connect() as c:
                rows = {t.name: [dict(r) for r in (await c.execute(text(
                    f'SELECT * FROM {t.name} ORDER BY id'))).mappings()] for t in tables}
                catalog = [list(r) for r in (await c.execute(text("""
                    SELECT table_name,data_type,character_maximum_length,is_nullable
                    FROM information_schema.columns WHERE table_schema='public'
                    AND table_name LIKE 'xbk_%' AND column_name='year' ORDER BY table_name
                """))).all()]
                constraints = [list(r) for r in (await c.execute(text("""
                    SELECT cl.relname,co.conname,co.contype::text,pg_get_constraintdef(co.oid)
                    FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.conrelid
                    JOIN pg_namespace ns ON ns.oid=cl.relnamespace
                    WHERE ns.nspname='public' AND cl.relname LIKE 'xbk_%'
                    ORDER BY cl.relname,co.conname
                """))).all()]
                indexes = [list(r) for r in (await c.execute(text("""
                    SELECT tablename,indexname,indexdef FROM pg_indexes
                    WHERE schemaname='public' AND tablename LIKE 'xbk_%' ORDER BY tablename,indexname
                """))).all()]
                links = [list(r) for r in (await c.execute(text("""
                    SELECT x.id,s.id,c.id FROM xbk_selections x
                    JOIN xbk_students s ON (x.year,x.term,x.student_no)=(s.year,s.term,s.student_no)
                    JOIN xbk_courses c ON (x.year,x.term,x.course_code)=(c.year,c.term,c.course_code)
                    ORDER BY x.id
                """))).all()]
                version = (await c.execute(text('SELECT version_num FROM alembic_version'))).scalar_one()
                return dict(rows=rows, catalog=catalog, constraints=constraints,
                            indexes=indexes, links=links, version=version)
        finally:
            await e.dispose()

    def public_snapshot(s):
        return {"version":s["version"], "catalog":s["catalog"],
                "constraints":s["constraints"], "indexes":s["indexes"],
                "counts":{t:len(rows) for t,rows in s["rows"].items()},
                "linked_selections":len(s["links"]),
                "row_digest":hashlib.sha256(json.dumps(s["rows"],sort_keys=True,default=str).encode()).hexdigest()}

    async def seed():
        e = engine()
        try:
            async with e.begin() as c:
                assert (await c.execute(text("SELECT count(*) FROM pg_tables WHERE schemaname='public'"))).scalar_one() == 0
                legacy = MetaData()
                for model_table in tables:
                    t = model_table.to_metadata(legacy)
                    t.c.year.type = Integer()
                    t.c.year.comment = None
                    for check in list(t.constraints):
                        if isinstance(check, CheckConstraint):
                            t.constraints.remove(check)
                await c.run_sync(legacy.create_all)
                await c.execute(text('CREATE TABLE alembic_version (version_num VARCHAR(64) NOT NULL PRIMARY KEY)'))
                await c.execute(text('INSERT INTO alembic_version VALUES (:v)'), {"v":previous})
                students = [dict(year=2026,term="上学期",grade="G1",class_name="SyntheticClass",
                                 student_no=f"S{i:03d}",name="Synthetic") for i in range(1,59)]
                # Reuse two student numbers across terms to detect incorrect cross-term joins.
                students += [dict(year=2026,term="1",grade="G1",class_name="SyntheticClass",
                                  student_no=f"S{i:03d}",name="Synthetic") for i in (1,2)]
                await c.execute(legacy.tables['xbk_students'].insert(), students)
                await c.execute(legacy.tables['xbk_courses'].insert(), [dict(year=2026,term="1",grade="G1",
                    course_code=f"C{i}",course_name=f"SyntheticCourse{i}",quota=30) for i in (1,2)])
                await c.execute(legacy.tables['xbk_selections'].insert(), [dict(year=2026,term="1",grade="G1",
                    student_no=f"S{i:03d}",name="Synthetic",course_code=f"C{i}") for i in (1,2)])
        finally:
            await e.dispose()

    async def queries(stage, green):
        e = engine()
        failures = []
        @event.listens_for(e.sync_engine, "handle_error")
        def collect(ctx):
            exc = ctx.original_exception
            failures.append({"sqlstate":getattr(exc,"sqlstate",None),
                "integer_varchar": "operator does not exist: integer = character varying" in str(exc),
                "sql":ctx.statement})
        session = async_sessionmaker(e, expire_on_commit=False)
        app = FastAPI()
        app.include_router(router, prefix="/api/v1/xbk")
        async def db():
            async with session() as s:
                yield s
        app.dependency_overrides[get_db] = db
        app.dependency_overrides[require_xbk_access] = lambda: {"id":1,"role_code":"admin"}
        checks = []
        report["stages"][stage] = {"http":checks,"errors":failures}
        expected = {
            "上学期": dict(students=58,courses=0,selections=0,unselected_count=0,suspended_count=58),
            "1": dict(students=2,courses=2,selections=2,unselected_count=0,suspended_count=0),
        }
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app,raise_app_exceptions=False),base_url="http://isolated.invalid") as client:
                for term,summary in expected.items():
                    for path in ("data/students","analysis/summary","data/meta","data/course-results"):
                        response = await client.get(f"/api/v1/xbk/{path}",params={"year":"2026-2027","term":term,"size":100})
                        record = {"path":path,"year":"2026-2027","term":term,"status":response.status_code}
                        checks.append(record)
                        assert response.status_code == (200 if green else 500), record
                        if not green:
                            continue
                        value = response.json()
                        if path.endswith("summary"):
                            assert value == summary
                            record["summary"] = value
                        elif path.endswith("meta"):
                            assert value == {"years":["2026-2027"],"terms":[term],"classes":["SyntheticClass"]}
                            record["years"],record["terms"] = value["years"],value["terms"]
                        else:
                            assert value["total"] == summary["students"] == len(value["items"])
                            assert all(r["year"] == "2026-2027" and r["term"] == term for r in value["items"])
                            record["total"] = value["total"]
                            if path.endswith("course-results"):
                                if term == "上学期":
                                    assert all(r["id"]==0 and r["course_code"]=="休学或其他" for r in value["items"])
                                    record["virtual_rows"] = 58
                                else:
                                    assert all(r["id"]>0 and r["course_name"]==f"SyntheticCourse{r['course_code'][1:]}" for r in value["items"])
                                    record["joined_course_rows"] = 2
                if green:
                    r = await client.get('/api/v1/xbk/data/students',params={"year":"2026","term":"上学期","size":100})
                    assert r.status_code == 200 and r.json()["total"] == 58
                    checks.append({"path":"data/students","year":"2026","term":"上学期","status":200,"total":58})
                    r = await client.get('/api/v1/xbk/data/meta',params={"year":"2026-2027"})
                    assert r.status_code == 200 and r.json()["terms"] == ["1","上学期"]
                    checks.append({"path":"data/meta","year":"2026-2027","status":200,"terms":r.json()["terms"]})
            assert len(failures) == (0 if green else 8)
            assert all(x["sqlstate"]=="42883" and x["integer_varchar"] for x in failures)
        finally:
            await e.dispose()
            save()

    config = Config()
    config.set_main_option("script_location", str(source / "alembic"))
    try:
        asyncio.run(seed())
        before = asyncio.run(snapshot())
        assert before["version"] == previous
        assert all(r[1] == "integer" for r in before["catalog"])
        assert {c[2] for c in before["constraints"]} == {"p","u"}
        assert len(before["links"]) == 2
        report["before"] = public_snapshot(before)
        asyncio.run(queries("before_upgrade", False))
        command.upgrade(config, target)
        after = asyncio.run(snapshot())
        report["after_upgrade"] = public_snapshot(after)
        assert after["version"] == target
        assert all(r[1:]==["character varying",9,"NO"] for r in after["catalog"])
        assert len([c for c in after["constraints"] if c[2]=="c"]) == 3
        assert [c for c in after["constraints"] if c[2]!="c"] == before["constraints"]
        assert after["indexes"] == before["indexes"]
        assert after["links"] == before["links"]
        for table, rows in before["rows"].items():
            assert after["rows"][table] == [dict(r, year=f"{r['year']}-{r['year']+1}") for r in rows]
        report["preservation"] = {"all_columns_except_year_identical":True,"term_unchanged":True,
            "primary_unique_constraints_unchanged":True,"index_definitions_unchanged":True,"natural_key_links_unchanged":True}
        asyncio.run(queries("after_upgrade", True))
        command.downgrade(config, previous)
        reverted = asyncio.run(snapshot())
        report["after_downgrade"] = public_snapshot(reverted)
        assert reverted == before
        report["downgrade_exact_snapshot_equal"] = True
        asyncio.run(queries("after_downgrade", False))
        report["result"] = "PASS"
    finally:
        save()
