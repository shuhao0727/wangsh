"""Offline contract/security tests. Provider responses are synthetic, never real AI evidence."""
import asyncio
import json
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

if os.environ.get("AI_PARTNER_ISOLATED_TESTS") != "1":
    pytest.skip("Requires pre-collection isolated bootstrap", allow_module_level=True)

import httpx
from app.core.config import settings
from app.schemas.ai_partner import EvaluationRequest
from app.services import ai_partner_evaluation as svc
from test_leaderboard import harness, identity, submission, PATH, check

EVALUATE = "/api/v1/ai-partner/evaluate"


def payload(rid=None, **changes):
    return {"round_id": rid, "expected_user_id": 1, "ai_name": "学习伙伴", "selected_ids": ["p01-08", "p03-06"], "primary_feature": "organize", "features": [], "budget": 3000, "reason": "按资料整理任务选型", "test_plan": "用样例验证", "risk": "隐私风险", "paper_recorded": False, "tested_core": False, **changes}


def model_output(score=20):
    return json.dumps({"dimensions": [{"key": k, "label": label, "score": score, "max": 25, "note": "目录RTX4060整卡2300元，资料整理投入偏高"} for k, label in svc.DIMENSIONS.items()], "suggestions": ["对比更低成本计算模块"]}, ensure_ascii=False)


async def fake_model(db, request, context):
    assert context["total_price"] == 2300
    return model_output()


def configure(monkeypatch):
    monkeypatch.setattr(settings, "AI_PARTNER_SCORING_AGENT_ID", 1)
    monkeypatch.setattr(svc, "call_model", fake_model)


def test_catalog_copy_and_whole_card_pricing():
    root = Path(__file__).resolve().parents[3]
    assert (root / "frontend/ai-partner/src/catalog.json").read_bytes() == Path(svc.__file__).with_name("ai_partner_catalog.json").read_bytes()
    ctx = svc.catalog_context(EvaluationRequest(**payload()))
    assert ctx["total_price"] == 2300
    assert ctx["uncharged_ids"] == ["p03-06"]
    assert svc.catalog_context(EvaluationRequest(**payload(selected_ids=["p03-06"])))['total_price'] == 2300
    assert "不能据此推断内容优质" in svc.SYSTEM_PROMPT


def test_evaluate_receipt_and_one_time_leaderboard(monkeypatch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, store, rid):
            response = await http.post(EVALUATE, headers=identity(), json=payload())
            assert response.status_code == 200, response.text
            assert response.headers['cache-control'] == 'no-store'
            result = response.json()
            assert set(result) == {"evaluation_id", "round_id", "total", "level", "dimensions", "suggestions"}
            assert result['total'] == 80 and result['round_id'] == rid and result['level'] == '良好'
            key = svc.receipt_key(rid, result['evaluation_id'])
            assert 0 < await store.ttl(key) <= 600
            assert not await store.exists(svc.round_keys(rid)[0])
            post = {"round_id": rid, "expected_user_id": 1, "ai_name": "学习伙伴", "evaluation_id": result['evaluation_id']}
            for patch, headers in [({"expected_user_id": 2}, identity(2)), ({"ai_name": "改名"}, identity())]:
                check(await http.post(PATH, headers=headers, json={**post, **patch}), 409)
                assert await store.exists(key)
            replies = await asyncio.gather(*[http.post(PATH, headers=identity(), json=post) for _ in range(2)])
            assert sorted(r.status_code for r in replies) == [200, 409]
            assert not await store.exists(key)
            board = check(await http.get(PATH, headers=identity()))
            assert board['rows'][0]['score'] == 80
            check(await http.post(PATH, headers=identity(), json={**post, "score": 100}), 422)
    asyncio.run(scenario())


@pytest.mark.parametrize('patch', [
    {"selected_ids": ["missing"]}, {"selected_ids": ["p01-01", "p01-01"]},
    {"selected_ids": ["p01-01", "p01-02"]}, {"selected_ids": []},
    {"selected_ids": ["p03-01", "p03-02"]}, {"budget": -1}, {"budget": 1e9 + 1},
    {"budget": True}, {"score": 100}, {"reason": 'x' * 4001}, {"test_plan": 'x' * 1001},
    {"paper_recorded": 'true'}, {"selected_ids": ["p01-01"], "prices": [0]},
])
def test_invalid_requests_before_model(monkeypatch, patch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, store, rid):
            response = await http.post(EVALUATE, headers=identity(), json=payload(rid, **patch))
            assert response.status_code == 422, response.text
            assert response.headers['cache-control'] == 'no-store'
            assert not await store.exists(svc.round_keys(rid)[0])
    asyncio.run(scenario())


@pytest.mark.parametrize('budget', [0, None, 1e9])
def test_budget_and_text_boundary(monkeypatch, budget):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, _, rid):
            response = await http.post(EVALUATE, headers=identity(), json=payload(rid, budget=budget, reason='x'*4000, test_plan='x'*1000))
            assert response.status_code == 200, response.text
    asyncio.run(scenario())


@pytest.mark.parametrize('role,status', [('guest',403), ('unknown',403), ('student',200), ('teacher',200), ('admin',200), ('super_admin',200)])
def test_evaluation_roles(monkeypatch, role, status):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, _, rid):
            response = await http.post(EVALUATE, headers=identity(role=role), json=payload(rid))
            assert response.status_code == status
            assert response.headers['cache-control'] == 'no-store'
    asyncio.run(scenario())


def test_no_config_identity_round_and_anonymous(monkeypatch):
    async def scenario():
        async with harness(monkeypatch) as (http, _, rid):
            monkeypatch.setattr(settings, 'AI_PARTNER_SCORING_AGENT_ID', None)
            for headers, data, expected in [(identity(), payload(rid),503), (identity(),payload('old'),409), (identity(2),payload(rid),409), ({},payload(rid),401)]:
                response = await http.post(EVALUATE,headers=headers,json=data)
                assert response.status_code == expected
                assert response.headers['cache-control'] == 'no-store'
    asyncio.run(scenario())


@pytest.mark.parametrize('raw', ['debug_stub: fake', '{}', '```json\n{}\n```', model_output(26), model_output(True), model_output('20'), model_output().replace('"completion"','"value"'), model_output().replace('"suggestions":', '"suggestions":[],"suggestions":')])
def test_invalid_model_output_no_receipt(monkeypatch, raw):
    async def bad(*args): return raw
    async def scenario():
        configure(monkeypatch)
        monkeypatch.setattr(svc, 'call_model', bad)
        async with harness(monkeypatch) as (http, store, rid):
            response = await http.post(EVALUATE, headers=identity(), json=payload(rid))
            assert response.status_code == 502
            assert not await store.keys(f'{svc.round_keys(rid)[0]}:evaluation:*')
            assert not await store.exists(f'{svc.round_keys(rid)[0]}:evaluating:1')
    asyncio.run(scenario())


def test_timeout_rate_and_concurrency(monkeypatch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, store, rid):
            started, release = asyncio.Event(), asyncio.Event()
            async def slow(*args):
                started.set()
                await release.wait()
                return model_output()
            monkeypatch.setattr(svc, 'call_model', slow)
            running = asyncio.create_task(http.post(EVALUATE,headers=identity(),json=payload(rid)))
            await started.wait()
            assert (await http.post(EVALUATE,headers=identity(),json=payload(rid))).status_code == 429
            release.set()
            assert (await running).status_code == 200
            async def timeout(*args): raise httpx.ReadTimeout('SECRET-MUST-NOT-LEAK')
            monkeypatch.setattr(svc, 'call_model', timeout)
            for _ in range(4):
                response = await http.post(EVALUATE,headers=identity(),json=payload(rid))
                assert response.status_code == 504 and 'SECRET' not in response.text
            assert (await http.post(EVALUATE,headers=identity(),json=payload(rid))).status_code == 429
            assert not await store.exists(f'{svc.round_keys(rid)[0]}:evaluating:1')
    asyncio.run(scenario())


def test_redis_failure_and_expired_receipt(monkeypatch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, store, rid):
            receipt = await submission(store,rid)
            await store.delete(svc.receipt_key(rid,receipt['evaluation_id']))
            check(await http.post(PATH,headers=identity(),json=receipt),409)
            async def fail(*args): raise RuntimeError('redis-private-secret')
            monkeypatch.setattr(store,'eval',fail)
            response = await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert response.status_code == 503 and 'private' not in response.text
    asyncio.run(scenario())


def test_issue_failure_round_switch_and_deadline(monkeypatch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, store, rid):
            async def switch(*args):
                monkeypatch.setattr(settings,'AI_PARTNER_LEADERBOARD_ROUND_ID', rid+'new')
                return model_output()
            monkeypatch.setattr(svc,'call_model', switch)
            assert (await http.post(EVALUATE,headers=identity(),json=payload(rid))).status_code == 409
            monkeypatch.setattr(settings,'AI_PARTNER_LEADERBOARD_ROUND_ID',rid)
            monkeypatch.setattr(svc,'call_model',fake_model)
            original = store.eval
            async def issue_fail(script,*args):
                if script == svc.ISSUE_LUA: raise RuntimeError('redis issue failure')
                return await original(script,*args)
            monkeypatch.setattr(store,'eval',issue_fail)
            assert (await http.post(EVALUATE,headers=identity(),json=payload(rid))).status_code == 503
            monkeypatch.setattr(store,'eval',original)
            await store.set(svc.round_keys(rid)[0], '1')
            assert (await http.post(EVALUATE,headers=identity(),json=payload(rid))).status_code == 410
            assert not await store.keys(f'{svc.round_keys(rid)[0]}:evaluation:*')
    asyncio.run(scenario())


def agent(**overrides):
    return SimpleNamespace(is_active=True, api_endpoint='https://8.8.8.8/v1', api_key='synthetic-provider-key', api_key_encrypted=None, agent_type='openai', model_name='test-model', **overrides)


@pytest.mark.parametrize('patch,status', [({'is_active':False},503),({'api_endpoint':''},503),({'api_key':''},503),({'model_name':''},503),({'api_endpoint':'http://127.0.0.1/v1'},503),({'api_endpoint':'https://user:password@8.8.8.8/v1'},503)])
def test_real_model_adapter_config_and_ssrf(monkeypatch, patch, status):
    async def scenario():
        configure(monkeypatch)
        monkeypatch.setattr(svc,'call_model',REAL_CALL_MODEL)
        configured = agent()
        for k,v in patch.items(): setattr(configured,k,v)
        async def get(*args,**kwargs): return configured
        monkeypatch.setattr(svc,'get_agent',get)
        async with harness(monkeypatch) as (http, _, rid):
            response = await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert response.status_code == status, response.text
            assert 'synthetic-provider-key' not in response.text
    asyncio.run(scenario())


REAL_CALL_MODEL = svc.call_model


@pytest.mark.parametrize('upstream,expected', [(200,200),(302,502),(429,429),(401,502),(500,502)])
def test_real_adapter_mock_transport(monkeypatch,upstream,expected):
    original_client = httpx.AsyncClient
    async def scenario():
        configure(monkeypatch)
        monkeypatch.setattr(svc,'call_model',REAL_CALL_MODEL)
        async def get(*args,**kwargs): return agent()
        monkeypatch.setattr(svc,'get_agent',get)
        seen=[]
        def respond(request):
            seen.append(request)
            body=json.loads(request.content)
            assert body['model']=='test-model'
            assert body['messages'][0]['role']=='system'
            assert 'paper_recorded仅表示线下记录' in body['messages'][0]['content']
            data=json.loads(body['messages'][1]['content'])
            assert data['server_catalog']['total_price']==2300
            assert 'expected_user_id' not in data['student_evidence']
            return httpx.Response(upstream,json={'choices':[{'message':{'content':model_output()}}]},headers={'Location':'http://127.0.0.1/secret'})
        async with harness(monkeypatch) as (http, _, rid):
            def client(**kwargs):
                assert kwargs['follow_redirects'] is False and kwargs['trust_env'] is False
                return original_client(transport=httpx.MockTransport(respond),**kwargs)
            monkeypatch.setattr(svc.httpx,'AsyncClient',client)
            response=await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert response.status_code==expected,response.text
            assert len(seen)==1
            assert 'synthetic-provider-key' not in response.text
    asyncio.run(scenario())


def test_global_limit_receipt_deadline_and_late_completion(monkeypatch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http, store, rid):
            prefix=svc.round_keys(rid)[0]
            global_key=f'{prefix}:evaluate-rate:global'
            await store.set(global_key,60,ex=60)
            limited=await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert limited.status_code==429 and int(limited.headers['retry-after'])>0
            await store.delete(global_key)
            clock=await store.time()
            deadline=int(clock[0])*1000+int(clock[1])//1000+10000
            await store.set(prefix,deadline)
            good=await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert good.status_code==200,good.text
            receipt=svc.receipt_key(rid,good.json()['evaluation_id'])
            assert 0 < await store.pttl(receipt) <= 10000
            await store.delete(receipt)
            async def end_during_call(*args):
                await store.set(prefix,1)
                return model_output()
            monkeypatch.setattr(svc,'call_model',end_during_call)
            late=await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert late.status_code==410
            assert not await store.keys(f'{prefix}:evaluation:*')
    asyncio.run(scenario())


def test_lost_lock_no_receipt_and_no_other_owner_unlock(monkeypatch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http,store,rid):
            lock=f'{svc.round_keys(rid)[0]}:evaluating:1'
            async def replace_lock(*args):
                await store.set(lock,'other-owner',ex=35)
                return model_output()
            monkeypatch.setattr(svc,'call_model',replace_lock)
            response=await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert response.status_code==409
            assert await store.get(lock)=='other-owner'
            assert not await store.keys(f'{svc.round_keys(rid)[0]}:evaluation:*')
    asyncio.run(scenario())


@pytest.mark.parametrize('kind', ['oversized','invalid_json','timeout','dify','anthropic','encrypted'])
def test_adapter_protocol_and_output_bounds(monkeypatch,kind):
    original_client=httpx.AsyncClient
    async def scenario():
        configure(monkeypatch)
        monkeypatch.setattr(svc,'call_model',REAL_CALL_MODEL)
        configured=agent()
        if kind=='dify': configured.agent_type='dify'; configured.model_name=''
        if kind=='anthropic': configured.api_endpoint='https://8.8.8.8/anthropic'
        if kind=='encrypted':
            from app.services.agents.providers import common
            configured.api_key_encrypted='synthetic-ciphertext'
            monkeypatch.setattr(common,'try_decrypt_api_key',lambda value: 'decrypted-test-key')
        async def get(*args,**kwargs): return configured
        monkeypatch.setattr(svc,'get_agent',get)
        def respond(request):
            if kind=='oversized': return httpx.Response(200,content=b'x'*65537)
            if kind=='invalid_json': return httpx.Response(200,content=b'not-json')
            if kind=='timeout': raise httpx.ReadTimeout('secret')
            body=json.loads(request.content)
            if kind=='dify':
                assert svc.SYSTEM_PROMPT in body['query'] and body['user'].startswith('ai-partner-')
                return httpx.Response(200,json={'answer':model_output()})
            if kind=='anthropic':
                assert body['system']==svc.SYSTEM_PROMPT.strip()
                return httpx.Response(200,json={'content':[{'type':'text','text':model_output()}]})
            if kind=='encrypted': assert request.headers['Authorization']=='Bearer decrypted-test-key'
            return httpx.Response(200,json={'choices':[{'message':{'content':model_output()}}]})
        async with harness(monkeypatch) as (http,store,rid):
            monkeypatch.setattr(svc.httpx,'AsyncClient',lambda **kwargs: original_client(transport=httpx.MockTransport(respond),**kwargs))
            response=await http.post(EVALUATE,headers=identity(),json=payload(rid))
            expected=502 if kind in ('oversized','invalid_json') else 504 if kind=='timeout' else 200
            assert response.status_code==expected,response.text
            if expected!=200: assert not await store.keys(f'{svc.round_keys(rid)[0]}:evaluation:*')
    asyncio.run(scenario())


def test_total_timeout_is_enforced_not_only_http_timeout(monkeypatch):
    async def scenario():
        configure(monkeypatch)
        monkeypatch.setattr(svc,'MODEL_TIMEOUT_SECONDS',0.01)
        async def never_finishes(*args): await asyncio.Event().wait()
        monkeypatch.setattr(svc,'call_model',never_finishes)
        async with harness(monkeypatch) as (http,store,rid):
            response=await http.post(EVALUATE,headers=identity(),json=payload(rid))
            assert response.status_code==504
            assert not await store.exists(f'{svc.round_keys(rid)[0]}:evaluating:1')
    asyncio.run(scenario())


@pytest.mark.parametrize('patch', [{"primary_feature":"nonexistent"},{"features":["nonexistent"]},{"features":["voice","voice"]},{"primary_feature":True}])
def test_task_ids_rejected_before_model(monkeypatch,patch):
    async def scenario():
        configure(monkeypatch)
        async with harness(monkeypatch) as (http,store,rid):
            response=await http.post(EVALUATE,headers=identity(),json=payload(rid,**patch))
            assert response.status_code==422
            assert not await store.keys(f'{svc.round_keys(rid)[0]}:evaluation:*')
    asyncio.run(scenario())


def test_task_ids_match_frontend_and_have_chinese_context():
    import re
    from typing import get_args
    from app.schemas.ai_partner import TaskId
    root=Path(__file__).resolve().parents[3]
    source=(root/'frontend/ai-partner/src/selection.ts').read_text()
    task_block=source[source.index("{ id: 'question'"):source.index("{ id: 'sense'")+200]
    ids=re.findall(r"\{ id: '([^']+)'",task_block)
    assert set(ids)==set(get_args(TaskId))
    for task in get_args(TaskId):
        ctx=svc.catalog_context(EvaluationRequest(**payload(primary_feature=task,features=list(get_args(TaskId)))))
        assert set(ctx['task_definitions'])==set(get_args(TaskId))
        assert any('\u4e00'<=c<='\u9fff' for c in ctx['task_definitions'][task])
