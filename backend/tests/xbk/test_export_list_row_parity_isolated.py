"""List/export parity against synthetic rows, never the configured application DB.

Defaults to SQLite. The external audit runner may explicitly opt in to a dedicated
loopback PostgreSQL database named xbk_export_test. HTTP is ASGI, not TCP;
authorization is injected because this suite checks export row semantics, not auth.
"""
import asyncio
import io
import json
import os
import re
import uuid
from collections import Counter
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from openpyxl import load_workbook
from sqlalchemy import event, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.xbk import import_export, selections
from app.api.endpoints.xbk._common import require_xbk_access
from app.core.deps import require_admin
from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent

YEAR = '2037-2038'
TERM = '上学期'
FILTERS = [
    {}, {'class_name': '1班'}, {'grade': '高二'}, {'grade': '高一', 'class_name': '1班'},
    {'search_text': '无选'}, {'search_text': '1班'}, {'search_text': '当前'},
    {'search_text': 'SNAPSHOT'}, {'search_text': 'CATALOG'}, {'search_text': '教师专词'},
    {'search_text': '001'}, {'search_text': '   '}, {'search_text': '无匹配词'},
    {'grade': '过期'}, {'term': '下学期'}, {'year': '2036-2037'},
    {'grade': '高一', 'class_name': '1班', 'search_text': '当前'},
]


def seed_rows():
    def student(no, name, **changes):
        values = dict(year=YEAR, term=TERM, grade='高一', class_name='1班',
                      student_no=no, name=name, is_deleted=False)
        values.update(changes)
        return XbkStudent(**values)
    def choice(no, code, **changes):
        values = dict(year=YEAR, term=TERM, grade='过期', student_no=no,
                      name='SNAPSHOT-'+no, course_code=code, is_deleted=False)
        values.update(changes)
        return XbkSelection(**values)
    def course(code, **changes):
        values = dict(year=YEAR, term=TERM, grade='高一', course_code=code,
                      course_name='CATALOG-'+code, teacher='教师专词', location='教室',
                      quota=3, is_deleted=False)
        values.update(changes)
        return XbkCourse(**values)
    return [
        student('001', '无选甲'), student('002', '空选乙'), student('003', '未选丙'),
        student('004', '当前丁'), student('005', '删除选课戊'),
        student('006', '当前己', grade='高二', class_name='2班'),
        student('007', '空年级庚', grade=None), student('008', '空串年级辛', grade=''),
        student('009', '已删名册', is_deleted=True),
        student('010', '孤立课程壬'), student('011', '软删课程癸'),
        student('001', '跨期同号', term='下学期'),
        student('001', '跨年同号', year='2036-2037'),
        choice('002', ''), choice('003', '未选'), choice('004', 'C1'), choice('004', 'C2'),
        choice('005', 'C1', is_deleted=True), choice('006', 'C1'),
        choice('007', 'C1'), choice('008', 'C1'), choice('009', 'C1'),
        choice('ORPHAN', 'C1'), choice('010', 'MISSING'), choice('011', 'DELETED'),
        choice('001', 'C2', year='2036-2037'),
        choice('DELETED-ORPHAN', 'C1', is_deleted=True),
        course('C1'), course('C2'), course('DELETED', is_deleted=True),
        course('C2', year='2036-2037'),
    ]


async def exercise(scope, filters, evidence_name, *, extra_rows=()):
    url = os.environ.get('XBK_EXPORT_TEST_DATABASE_URL', 'sqlite+aiosqlite:///:memory:')
    parsed = make_url(url)
    if parsed.get_backend_name() != 'sqlite':
        assert parsed.drivername == 'postgresql+asyncpg'
        assert parsed.host == '127.0.0.1' and parsed.database == 'xbk_export_test'
        assert parsed.username == 'xbk_export_app' and os.environ.get('XBK_EXPORT_ISOLATED') == '1'
    engine = create_async_engine(url)
    if parsed.get_backend_name() == 'sqlite':
        @event.listens_for(engine.sync_engine, 'connect')
        def sqlite_regexp(connection, _):
            connection.create_function('regexp_replace', 4, lambda s, p, r, flags: re.sub(p, r, s))
    schema = 'parity_' + uuid.uuid4().hex
    tables = [model.__table__ for model in (XbkStudent, XbkCourse, XbkSelection)]
    try:
        async with engine.begin() as connection:
            if parsed.get_backend_name() != 'sqlite':
                await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
                await connection.execute(text(f'SET search_path TO "{schema}"'))
            await connection.run_sync(lambda conn: XbkStudent.metadata.create_all(conn, tables=tables))
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            db.add_all([*seed_rows(), *extra_rows])
            await db.commit()
        async def get_test_db():
            async with factory() as db:
                yield db
        app = FastAPI()
        app.include_router(selections.router, prefix='/xbk')
        app.include_router(import_export.router, prefix='/xbk')
        app.dependency_overrides[get_db] = get_test_db
        app.dependency_overrides[require_admin] = lambda: {'id': 1, 'role_code': 'admin'}
        app.dependency_overrides[require_xbk_access] = lambda: {'id': 1, 'role_code': 'admin'}
        params = dict(year=YEAR, term=TERM)
        params.update(filters)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://isolated-asgi') as client:
            route = 'selections' if scope == 'selections' else 'course-results'
            # Exercise real pagination but export deliberately has no page parameter.
            items = []
            page = 1
            while True:
                response = await client.get('/xbk/'+route, params={**params, 'page': page, 'size': 3})
                assert response.status_code == 200, response.text
                body = response.json()
                items.extend(body['items'])
                if len(items) >= body['total']:
                    break
                page += 1
            response = await client.get('/xbk/export', params={**params, 'scope': scope})
            assert response.status_code == 200, response.text
        workbook = load_workbook(io.BytesIO(response.content))
        for worksheet in workbook:
            for row in worksheet:
                for cell in row:
                    if isinstance(cell.value, str):
                        assert cell.data_type == 's'
                        assert cell.number_format == '@'
                    assert cell.data_type not in {'f', 'e'}
        sheets = {}
        for ws in workbook:
            values = list(ws.values)
            sheets[ws.title] = [dict(zip(values[0], row)) for row in values[1:]] if values else []
        result = dict(scope=scope, filters=params, list_items=items, sheets=sheets,
                      layer='HTTPX ASGITransport; injected admin; real SQL; not TCP', dialect=parsed.get_backend_name())
        evidence = os.environ.get('XBK_EXPORT_EVIDENCE_DIR')
        if evidence:
            out = Path(evidence)
            out.mkdir(parents=True, exist_ok=True)
            (out/(evidence_name+'.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2))
            (out/(evidence_name+'.xlsx')).write_bytes(response.content)
        return result
    finally:
        if parsed.get_backend_name() != 'sqlite':
            async with engine.begin() as connection:
                await connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        await engine.dispose()


def row_key(row, exported=False):
    columns = ('学年', '学期', '学号', '课程代码') if exported else ('year', 'term', 'student_no', 'course_code')
    return tuple(row.get(column) for column in columns)


@pytest.mark.parametrize('scope', ['selections', 'course_results'])
@pytest.mark.parametrize('filters', FILTERS, ids=[f'filter-{i:02}' for i in range(len(FILTERS))])
def test_export_rows_match_paginated_list(scope, filters):
    index = FILTERS.index(filters)
    result = asyncio.run(exercise(scope, filters, f'{scope}-{index:02}'))
    actual = result['sheets']['data']
    expected = result['list_items']
    assert Counter(row_key(r, True) for r in actual) == Counter(row_key(r) for r in expected)
    if scope == 'course_results':
        for export_row, list_row in zip(actual, expected):
            mapping = {'年级': 'grade', '姓名': 'student_name', '班级': 'class_name',
                       '课程名称': 'course_name', '负责人': 'teacher', '地点': 'location'}
            assert {k: export_row[k] for k in mapping} == {k: list_row[v] for k, v in mapping.items()}


@pytest.mark.parametrize('scope', ['selections', 'course_results'])
def test_diagnostics_remain_exportable_but_not_list_rows(scope):
    result = asyncio.run(exercise(scope, {}, scope+'-diagnostics'))
    diagnostics = result['sheets'].get('diagnostics', [])
    assert {r['学号'] for r in diagnostics} == {'009', 'ORPHAN'}
    assert all(r['年级'] == '过期' and r['姓名'].startswith('SNAPSHOT-') for r in diagnostics)
    assert not {'009', 'ORPHAN'} & {r['学号'] for r in result['sheets']['data']}
    class_filtered = asyncio.run(exercise(scope, {'class_name': '1班'}, scope+'-diagnostics-class'))
    assert not class_filtered['sheets'].get('diagnostics', [])
    old_grade = asyncio.run(exercise(scope, {'grade': '过期'}, scope+'-diagnostics-grade'))
    assert {r['学号'] for r in old_grade['sheets']['diagnostics']} == {'009', 'ORPHAN'}


@pytest.mark.parametrize('scope', ['selections', 'course_results'])
def test_live_grade_and_preserved_selection_name_contract(scope):
    result = asyncio.run(exercise(scope, {}, scope+'-live-fields'))
    rows = {row['学号']: row for row in result['sheets']['data']}
    assert rows['004']['年级'] == '高一'
    assert rows['006']['年级'] == '高二'
    assert rows['007']['年级'] is None and rows['008']['年级'] is None
    assert rows['004']['姓名'] == ('SNAPSHOT-004' if scope == 'selections' else '当前丁')
    assert rows['001']['姓名'] == '无选甲'
    assert rows['005']['课程代码'] == '休学或其他'
    assert rows['002']['课程代码'] == rows['003']['课程代码'] == '未选'
    # Course orphans are still real selection rows; do not erase these diagnostics.
    assert rows['010']['课程代码'] == 'MISSING'
    assert rows['011']['课程代码'] == 'DELETED'
    if scope == 'course_results':
        assert rows['010']['课程名称'] == rows['011']['课程名称'] == '未选'


@pytest.mark.parametrize('scope', ['selections', 'course_results'])
@pytest.mark.parametrize('search', ['SNAPSHOT-ORPHAN', 'C1', 'CATALOG', '教师专词'])
def test_orphan_diagnostics_keep_legacy_search(scope, search):
    result = asyncio.run(exercise(scope, {'search_text': search}, scope+'-old-search-'+search))
    supported_search = search == 'C1' or (
        scope == 'course_results' and search in {'CATALOG', '教师专词'}
    )
    if not supported_search:
        assert result['sheets']['data'] == []  # These are not live roster search terms.
    else:
        assert result['sheets']['data']  # Search contract supports these fields.
    expected = {'ORPHAN'} if search == 'SNAPSHOT-ORPHAN' else {'009', 'ORPHAN'}
    if scope == 'selections' and search in {'CATALOG', '教师专词'}:
        expected = set()
    assert {row['学号'] for row in result['sheets']['diagnostics']} == expected


@pytest.mark.parametrize('scope', ['selections', 'course_results'])
def test_real_sql_numeric_order_and_workbook_text_safety(scope):
    extra = [XbkStudent(year=YEAR, term=TERM, grade='高一', class_name='3班',
                       student_no=no, name='=1+1', is_deleted=False)
             for no in ('2A', '10A', 'A')]
    extra.append(XbkSelection(year=YEAR, term=TERM, grade='高一', student_no='ORPHAN-TEXT',
                              name='=1+1', course_code='+1+1', is_deleted=False))
    result = asyncio.run(exercise(scope, {}, scope+'-real-text', extra_rows=extra))
    actual = result['sheets']['data']
    assert [row_key(row, True) for row in actual] == [row_key(row) for row in result['list_items']]
    expected_order = ['10A', '2A', 'A'] if scope == 'selections' else ['2A', '10A', 'A']
    text_rows = [row for row in actual if row['学号'] in {'2A', '10A', 'A'}]
    assert [row['学号'] for row in text_rows] == expected_order
    assert all(row['姓名'] == '=1+1' for row in text_rows)
    diagnostic = next(row for row in result['sheets']['diagnostics'] if row['学号'] == 'ORPHAN-TEXT')
    assert diagnostic['姓名'] == '=1+1' and diagnostic['课程代码'] == '+1+1'
