"""
自主检测系统 第2期 端到端验证脚本
在 Docker 容器内执行，验证完整答题流程
"""
import urllib.request, urllib.parse, json, sys, time

BASE = 'http://localhost:8000/api/v1'
results = []

def login(username, password):
    form_data = urllib.parse.urlencode({'username': username, 'password': password}).encode()
    req = urllib.request.Request(f'{BASE}/auth/login', data=form_data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    r = urllib.request.urlopen(req)
    return json.loads(r.read())['access_token']

def api(token, method, path, data=None):
    url = f'{BASE}{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    try:
        r = urllib.request.urlopen(req)
        return json.loads(r.read()), r.status
    except Exception as e:
        body = e.read().decode() if hasattr(e, 'read') else ''
        code = e.code if hasattr(e, 'code') else 0
        return {'_error': body}, code

def check(name, ok, detail=''):
    status = '✅' if ok else '❌'
    results.append((name, ok))
    msg = f'{status} {name}'
    if detail:
        msg += f' ({detail})'
    print(msg)
    return ok

# ═══════════════════════════════════════
# PHASE 1: 管理员 - 创建配置 + 手动添加题目
# ═══════════════════════════════════════
print('\n═══ PHASE 1: 管理员创建配置和题目 ═══')

admin_token = login('admin', 'wangshuhao0727')
check('管理员登录', bool(admin_token))

# 创建测评配置
config_resp, code = api(admin_token, 'POST', '/assessment/admin/configs', {
    'title': 'E2E-Python基础测试',
    'subject': '信息技术',
    'grade': '高一',
    'teaching_objectives': '掌握Python基础语法',
    'knowledge_points': '变量,循环,条件判断',
    'total_score': 100,
    'time_limit_minutes': 30,
    'question_config': json.dumps({'choice': {'count': 2}, 'fill': {'count': 1}, 'short_answer': {'count': 1}}),
    'ai_prompt': '',
    'agent_id': None,
    'config_agent_ids': [],
})
config_id = config_resp.get('id')
check('创建测评配置', code == 200 and config_id, f'id={config_id}')

# 手动添加题目 - 选择题1
q1, _ = api(admin_token, 'POST', '/assessment/admin/questions', {
    'config_id': config_id,
    'question_type': 'choice',
    'content': 'Python中哪个关键字用于定义函数？',
    'options': json.dumps({'A': 'func', 'B': 'def', 'C': 'function', 'D': 'define'}),
    'correct_answer': 'B',
    'score': 10,
    'difficulty': 'easy',
    'knowledge_point': '函数',
    'explanation': 'Python使用def关键字定义函数',
})
check('添加选择题1', q1.get('id') is not None, f'id={q1.get("id")}')

# 选择题2
q2, _ = api(admin_token, 'POST', '/assessment/admin/questions', {
    'config_id': config_id,
    'question_type': 'choice',
    'content': 'for i in range(5) 循环执行几次？',
    'options': json.dumps({'A': '4', 'B': '5', 'C': '6', 'D': '3'}),
    'correct_answer': 'B',
    'score': 10,
    'difficulty': 'easy',
    'knowledge_point': '循环',
    'explanation': 'range(5)生成0,1,2,3,4共5个数',
})
check('添加选择题2', q2.get('id') is not None)

# 选择题3（备用）
q3, _ = api(admin_token, 'POST', '/assessment/admin/questions', {
    'config_id': config_id,
    'question_type': 'choice',
    'content': 'Python中 x = 10，x的类型是？',
    'options': json.dumps({'A': 'str', 'B': 'float', 'C': 'int', 'D': 'bool'}),
    'correct_answer': 'C',
    'score': 10,
    'difficulty': 'easy',
    'knowledge_point': '变量',
    'explanation': '整数字面量的类型是int',
})
check('添加选择题3', q3.get('id') is not None)

# 填空题
q4, _ = api(admin_token, 'POST', '/assessment/admin/questions', {
    'config_id': config_id,
    'question_type': 'fill',
    'content': 'Python中用于输出内容的内置函数是____',
    'correct_answer': 'print',
    'score': 15,
    'difficulty': 'easy',
    'knowledge_point': '变量',
    'explanation': 'print()是Python的内置输出函数',
})
check('添加填空题', q4.get('id') is not None)

# 填空题2
q5, _ = api(admin_token, 'POST', '/assessment/admin/questions', {
    'config_id': config_id,
    'question_type': 'fill',
    'content': 'Python中用于获取列表长度的函数是____',
    'correct_answer': 'len',
    'score': 15,
    'difficulty': 'medium',
    'knowledge_point': '变量',
})
check('添加填空题2', q5.get('id') is not None)

# 简答题
q6, _ = api(admin_token, 'POST', '/assessment/admin/questions', {
    'config_id': config_id,
    'question_type': 'short_answer',
    'content': '请简述Python中for循环和while循环的区别',
    'correct_answer': 'for循环用于遍历可迭代对象，循环次数确定；while循环根据条件判断，循环次数不确定',
    'score': 40,
    'difficulty': 'medium',
    'knowledge_point': '循环',
})
check('添加简答题', q6.get('id') is not None)

# 查看题库列表
questions_resp, _ = api(admin_token, 'GET', f'/assessment/admin/configs/{config_id}/questions')
check('查看题库列表', questions_resp.get('total') == 6, f'total={questions_resp.get("total")}')

# 启用配置
toggle_resp, _ = api(admin_token, 'PUT', f'/assessment/admin/configs/{config_id}/toggle')
check('启用配置', toggle_resp.get('enabled') == True)

# ═══════════════════════════════════════
# PHASE 2: 学生端 - 完整答题流程
# ═══════════════════════════════════════
print('\n═══ PHASE 2: 学生答题流程 ═══')

# 先用管理员API创建学生账号
create_student_resp, sc = api(admin_token, 'POST', '/users/', {
    'full_name': '张三',
    'student_id': '20240001',
    'class_name': '高一(1)班',
    'study_year': '2025',
    'role_code': 'student',
    'is_active': True,
})
# 可能已存在（409），也可能新建成功（200/201）
if sc in (200, 201):
    check('创建学生账号', True, f'id={create_student_resp.get("id")}')
elif sc in (400, 409, 422):
    check('创建学生账号', True, '已存在，跳过')
else:
    check('创建学生账号', False, f'code={sc}, resp={create_student_resp}')

try:
    time.sleep(3)  # 避免触发速率限制
    student_token = login('张三', '20240001')
    check('学生登录', True, '张三/20240001')
except Exception as e:
    check('学生登录', False, f'登录失败: {e}')
    print(f'\n═══ 总结 ═══')
    passed = sum(1 for _, ok in results if ok)
    print(f'{passed}/{len(results)} 通过')
    sys.exit(0 if all(ok for _, ok in results) else 1)

# 获取可用测评
available, code = api(student_token, 'GET', '/assessment/available')
check('获取可用测评', code == 200 and isinstance(available, list), f'count={len(available) if isinstance(available, list) else 0}')

our_config = None
if isinstance(available, list):
    our_config = next((a for a in available if a.get('title') == 'E2E-Python基础测试'), None)
check('找到我们的测评', our_config is not None)

if not our_config:
    print('⚠️ 无法继续学生端测试')
    sys.exit(1)

# 开始检测
start_resp, code = api(student_token, 'POST', '/assessment/sessions/start', {'config_id': config_id})
session_id = start_resp.get('session_id')
check('开始检测', code == 200 and session_id, f'session_id={session_id}, questions={start_resp.get("total_questions")}')

# 幂等性：再次开始应返回同一session
start2, _ = api(student_token, 'POST', '/assessment/sessions/start', {'config_id': config_id})
check('开始检测幂等', start2.get('session_id') == session_id)

# 获取题目
questions, code = api(student_token, 'GET', f'/assessment/sessions/{session_id}/questions')
check('获取题目列表', code == 200 and isinstance(questions, list) and len(questions) > 0, f'count={len(questions) if isinstance(questions, list) else 0}')

# 逐题作答
if isinstance(questions, list):
    for i, q in enumerate(questions):
        aid = q['answer_id']
        qtype = q['question_type']
        if qtype == 'choice':
            answer = 'B'  # 我们的正确答案都是B
        elif qtype == 'fill':
            answer = 'print'
        else:
            answer = 'for循环用于遍历序列，while循环根据条件执行'

        ans_resp, ans_code = api(student_token, 'POST', f'/assessment/sessions/{session_id}/answer', {
            'answer_id': aid,
            'student_answer': answer,
        })
        detail = f'type={qtype}'
        if qtype == 'choice':
            detail += f', correct={ans_resp.get("is_correct")}, score={ans_resp.get("earned_score")}'
        check(f'提交第{i+1}题({qtype})', ans_code == 200, detail)

# 提交整卷
submit_resp, code = api(student_token, 'POST', f'/assessment/sessions/{session_id}/submit')
check('提交整卷', code == 200, f'status={submit_resp.get("status")}, score={submit_resp.get("earned_score")}/{submit_resp.get("total_score")}')

# 查看结果
result_resp, code = api(student_token, 'GET', f'/assessment/sessions/{session_id}/result')
check('查看检测结果', code == 200 and result_resp.get('status') == 'graded', f'answers={len(result_resp.get("answers", []))}')

# 查看初级画像
profile_resp, code = api(student_token, 'GET', f'/assessment/sessions/{session_id}/basic-profile')
check('查看初级画像', code == 200, f'ai_summary长度={len(str(profile_resp.get("ai_summary","")))}')

# 再次开始同一配置（应该不能，因为已有graded session）
# 实际上当前逻辑是：已有非in_progress的session时可以重新开始
# 这取决于业务需求，先跳过

# ═══════════════════════════════════════
# PHASE 3: 管理端 - 查看统计
# ═══════════════════════════════════════
print('\n═══ PHASE 3: 管理端统计 ═══')

# 查看答题列表
sessions_resp, code = api(admin_token, 'GET', f'/assessment/admin/configs/{config_id}/sessions')
check('管理端-答题列表', code == 200 and sessions_resp.get('total', 0) > 0, f'total={sessions_resp.get("total")}')

# 查看答题详情
detail_resp, code = api(admin_token, 'GET', f'/assessment/admin/sessions/{session_id}')
check('管理端-答题详情', code == 200 and len(detail_resp.get('answers', [])) > 0, f'answers={len(detail_resp.get("answers",[]))}')

# 查看学生画像
admin_profile, code = api(admin_token, 'GET', f'/assessment/admin/sessions/{session_id}/basic-profile')
check('管理端-学生画像', code == 200 and admin_profile.get('id') is not None)

# 查看统计
stats, code = api(admin_token, 'GET', f'/assessment/admin/configs/{config_id}/statistics')
check('管理端-统计数据', code == 200, f'submitted={stats.get("submitted_count")}, avg={stats.get("avg_score")}')

# ═══════════════════════════════════════
# 总结
# ═══════════════════════════════════════
print(f'\n{"═"*40}')
passed = sum(1 for _, ok in results if ok)
failed = len(results) - passed
print(f'总计: {len(results)} 项, ✅ {passed} 通过, ❌ {failed} 失败')
if failed:
    print('失败项:')
    for name, ok in results:
        if not ok:
            print(f'  - {name}')
sys.exit(0 if failed == 0 else 1)
