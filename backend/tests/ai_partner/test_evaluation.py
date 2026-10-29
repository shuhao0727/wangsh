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


def test_parse_evaluation_strips_reasoning_envelope():
    """Dify 的 DeepSeek 插件把思维链和答案塞进同一个字符串。

    线上真实形态：'<think>…推理…</think>{"dimensions":[…]}'。
    修复前 parse_evaluation 直接 json.loads，必然 JSONDecodeError →
    HTTP 502「AI评分未返回有效结构化结果」。本测试锁住剥离行为。
    """
    answer = model_output()
    for wrapped in (
        f"<think>\n先看预算是否超支，再逐维度打分。\n</think>{answer}",
        f"<THINK>大小写不敏感</THINK>{answer}",
        f"<think>跨行\n推理\n</think>\n\n{answer}\n",
        answer,  # 没有思维链时不能被误伤
    ):
        result = svc.parse_evaluation(wrapped)
        assert sum(d.score for d in result.dimensions) == 80


def test_parse_evaluation_rejects_absent_or_oversized_answer():
    """剥离后为空、或答案本身超长，都必须判为无效输出。"""
    # 只有思维链、没有答案
    with pytest.raises(ValueError):
        svc.parse_evaluation("<think>只有推理</think>")
    # 思维链很长但答案正常：不能因为 raw 长就误判（这正是修复前的缺陷）
    long_reasoning = "分析" * 12000  # 24000 字符，超过旧的 20000 raw 上限
    assert sum(d.score for d in svc.parse_evaluation(f"<think>{long_reasoning}</think>{model_output()}").dimensions) == 80
    # 答案本身超长
    with pytest.raises(ValueError):
        svc.parse_evaluation("x" * 20001)


def test_model_timeout_budget_is_nested_outside_in():
    """三层超时必须严格嵌套，否则内层先超时、外层预算形同虚设。

    实测真实评分耗时分布很宽：24.4s / 27.1s / 28.8s / 29.3s / 33.4s /
    35.5s / 43.3s。旧的 20s httpx + 25s 总预算必然超时；45s 也会让接近
    一半的请求卡在边缘，因此取 75/80。
    """
    assert svc.MODEL_HTTP_TIMEOUT_SECONDS < svc.MODEL_TIMEOUT_SECONDS
    assert svc.MODEL_TIMEOUT_SECONDS < svc.EVALUATION_LOCK_TTL_SECONDS
    # 锁必须长于总预算，否则请求未结束锁就过期 → 同用户并发双跑、双扣配额
    assert svc.EVALUATION_LOCK_TTL_SECONDS > svc.MODEL_TIMEOUT_SECONDS
    # 相对实测最慢 43.3s 需留出余量；总预算要能容纳两次尝试
    assert svc.MODEL_HTTP_TIMEOUT_SECONDS >= 45
    assert svc.MODEL_TIMEOUT_SECONDS >= svc.MODEL_HTTP_TIMEOUT_SECONDS * svc.MODEL_ATTEMPTS


def test_parse_evaluation_tolerates_wrapping_text_and_fences():
    """剥离 think 后仍夹带说明文字或代码围栏时，应截出 JSON 而不是直接 502。

    生产实测出现过模型在 JSON 前后多写一句解释的情况。这类输出对评分
    毫无影响，不该判成「未返回有效结构化结果」。
    """
    answer = model_output()
    for wrapped in (
        f"以下是评分结果：\n{answer}\n希望对学生有帮助。",
        f"```json\n{answer}\n```",
        f"评分如下{answer}（完）",
    ):
        result = svc.parse_evaluation(wrapped)
        assert sum(d.score for d in result.dimensions) == 80


def test_parse_evaluation_still_rejects_truly_broken_json():
    """截取逻辑不能把坏 JSON 也放过——括号内语法错误仍应失败。"""
    with pytest.raises((ValueError, json.JSONDecodeError)):
        svc.parse_evaluation('{"dimensions": [这只不是 JSON], "suggestions": []}')


def test_extract_json_object_handles_braces_inside_strings():
    """字符串里的花括号不能被当成结构括号。"""
    text = 'prefix {"note": "用了 {大括号} 和 \\"转义\\"", "n": 1} suffix'
    assert svc._extract_json_object(text) == '{"note": "用了 {大括号} 和 \\"转义\\"", "n": 1}'


def test_parse_evaluation_normalizes_extra_dimensions():
    """模型偶尔返回 5 个维度（把 suggestions 里一条塞进 dimensions）。

    生产实测样本就是这种情况，schema 的 min_length=4/max_length=4 直接
    ValidationError → 用户看到 502。归一化按 key 白名单精确挑 4 个。
    """
    payload = {
        "dimensions": [
            {"key": "value", "label": "价格性价比", "score": 12, "max": 25, "note": "预算偏重"},
            {"key": "completion", "label": "任务完成度", "score": 14, "max": 25, "note": "链路不全"},
            {"key": "suitability", "label": "选择合理性", "score": 13, "max": 25, "note": "偏重显卡"},
            {"key": "validation", "label": "设计验证与风险", "score": 8, "max": 25, "note": "未细化"},
            {"key": "把验证计划具体化", "label": "多余项", "score": 0, "max": 25, "note": "误塞"},
        ],
        "suggestions": ["补输入输出链路"],
    }
    result = svc.parse_evaluation(json.dumps(payload, ensure_ascii=False))
    assert [d.key for d in result.dimensions] == list(svc.DIMENSIONS)
    assert sum(d.score for d in result.dimensions) == 47
    # label 一律按服务端定义覆盖，不信任模型给的 label
    assert [d.label for d in result.dimensions] == list(svc.DIMENSIONS.values())


def test_parse_evaluation_rejects_missing_dimension_instead_of_padding():
    """缺维度必须失败——补 0 分会让评分失真，宁可拒绝。"""
    payload = {
        "dimensions": [
            {"key": "value", "label": "价格性价比", "score": 12, "max": 25, "note": "x"},
            {"key": "completion", "label": "任务完成度", "score": 14, "max": 25, "note": "x"},
            {"key": "suitability", "label": "选择合理性", "score": 13, "max": 25, "note": "x"},
        ],
        "suggestions": ["x"],
    }
    with pytest.raises(Exception):
        svc.parse_evaluation(json.dumps(payload, ensure_ascii=False))


def test_parse_evaluation_dedupes_repeated_dimension_key():
    """同一 key 出现两次时只取第一条，不能让 4 项全是重复内容。"""
    item = {"key": "value", "label": "价格性价比", "score": 12, "max": 25, "note": "x"}
    payload = {
        "dimensions": [
            item, dict(item),
            {"key": "completion", "label": "任务完成度", "score": 14, "max": 25, "note": "x"},
            {"key": "suitability", "label": "选择合理性", "score": 13, "max": 25, "note": "x"},
            {"key": "validation", "label": "设计验证与风险", "score": 8, "max": 25, "note": "x"},
        ],
        "suggestions": ["x"],
    }
    result = svc.parse_evaluation(json.dumps(payload, ensure_ascii=False))
    assert [d.key for d in result.dimensions] == list(svc.DIMENSIONS)


def test_evaluate_model_retries_once_on_bad_model_output(monkeypatch):
    """模型输出不合格时重试一次；第二次成功则应返回结果。

    这是生产 20% 失败率的主要来源：模型偶发输出语法损坏的 JSON。
    """
    import asyncio as _asyncio

    calls = {"n": 0}
    good = model_output(score=20)

    async def flaky_call(db, request, context):
        calls["n"] += 1
        if calls["n"] == 1:
            return '{"dimensions": [坏 JSON'      # 第一次坏
        return good                                # 第二次好

    monkeypatch.setattr(svc, "call_model", flaky_call)
    result = _asyncio.run(svc._evaluate_model(None, None, {}))
    assert calls["n"] == 2
    assert sum(d.score for d in result.dimensions) == 80


def test_evaluate_model_does_not_retry_on_timeout(monkeypatch):
    """超时不重试——重试只会让用户等两倍时间，且多半还是超时。"""
    import asyncio as _asyncio

    import httpx as _httpx

    calls = {"n": 0}

    async def always_timeout(db, request, context):
        calls["n"] += 1
        raise _httpx.ReadTimeout("boom")

    monkeypatch.setattr(svc, "call_model", always_timeout)
    try:
        _asyncio.run(svc._evaluate_model(None, None, {}))
        raise AssertionError("应当抛 504")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 504
    assert calls["n"] == 1, "超时不该重试"


def test_evaluate_model_gives_up_after_all_attempts(monkeypatch):
    """两次都坏则返回 502，不能无限重试。"""
    import asyncio as _asyncio

    calls = {"n": 0}

    async def always_bad(db, request, context):
        calls["n"] += 1
        return "not json at all"

    monkeypatch.setattr(svc, "call_model", always_bad)
    try:
        _asyncio.run(svc._evaluate_model(None, None, {}))
        raise AssertionError("应当抛 502")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 502
    assert calls["n"] == svc.MODEL_ATTEMPTS


def test_salvage_sections_recovers_real_production_sample():
    """用生产抓到的真实坏样本验证分块抢救。

    fixture 取自 2026-10-29 生产日志中的一次真实失败：模型输出的 JSON
    在末尾写坏（`json.loads` 报 `Expecting ',' delimiter: char 1838`），
    但 dimensions(4 项) 与 suggestions(6 条) 的数据本身完好。

    用真实样本而不是手写复现：损坏形态是模型随机产生的，手写容易构造出
    「其实合法」的输入（我一开始就踩了这个坑）。
    """
    fixture = Path(__file__).with_name("fixtures") / "broken_json_real_sample.txt"
    broken = fixture.read_text(encoding="utf-8")

    # 先确认 fixture 确实是坏的
    with pytest.raises(json.JSONDecodeError):
        json.loads(broken)

    salvaged = svc._salvage_sections(broken)
    assert salvaged is not None
    assert len(salvaged["dimensions"]) == 4
    assert len(salvaged["suggestions"]) == 6

    result = svc.parse_evaluation(broken)
    assert sum(d.score for d in result.dimensions) == 38
    assert [d.key for d in result.dimensions] == list(svc.DIMENSIONS)


def test_salvage_sections_returns_none_when_data_missing():
    """数据本身缺失时不能凭空造——必须返回 None 交给上层报错。"""
    assert svc._salvage_sections('{"dimensions": [坏掉了') is None
    assert svc._salvage_sections('完全没有数组') is None


def test_salvage_does_not_mask_garbage():
    """抢救不能把垃圾输入也放过。"""
    with pytest.raises(Exception):
        svc.parse_evaluation("这根本不是 JSON，只是一段中文说明")


def test_parse_evaluation_drops_unknown_top_level_fields():
    """顶层多出未知字段时，应白名单过滤而不是整次判无效。

    生产实测：模型输出带 `suggestions_note` 字段，而 ModelEvaluation 设了
    extra="forbid"，直接 ValidationError → 502。JSON 本身是合法的，
    这类失败重试也无用（重试多半还是带同样字段）。
    """
    payload = {
        "dimensions": [
            {"key": k, "label": l, "score": 12, "max": 25, "note": "x"}
            for k, l in svc.DIMENSIONS.items()
        ],
        "suggestions": ["建议"],
        "suggestions_note": "placeholder",   # 模型自加的未知字段
    }
    result = svc.parse_evaluation(json.dumps(payload, ensure_ascii=False))
    assert sum(d.score for d in result.dimensions) == 48
    assert len(result.suggestions) == 1


def test_parse_evaluation_drops_unknown_dimension_fields():
    """Dimension 内部多出字段时也应过滤掉，而不是整体失败。"""
    payload = {
        "dimensions": [
            {"key": k, "label": l, "score": 10, "max": 25, "note": "x", "reason": "模型自加"}
            for k, l in svc.DIMENSIONS.items()
        ],
        "suggestions": ["建议"],
    }
    result = svc.parse_evaluation(json.dumps(payload, ensure_ascii=False))
    assert sum(d.score for d in result.dimensions) == 40


def test_whitelist_does_not_accept_missing_suggestions():
    """过滤不能把缺失的 suggestions 也放过——那是真的缺数据。"""
    payload = {
        "dimensions": [
            {"key": k, "label": l, "score": 10, "max": 25, "note": "x"}
            for k, l in svc.DIMENSIONS.items()
        ],
        "some_other_field": "x",
    }
    with pytest.raises(Exception):
        svc.parse_evaluation(json.dumps(payload, ensure_ascii=False))
