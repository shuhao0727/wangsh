"""
自主检测系统 第3期 端到端验证脚本
验证三维融合画像全部功能：
  Phase 0: 准备测试数据（创建智能体、第二个学生、模拟讨论数据）
  Phase 1: 管理端画像 CRUD（生成个人/小组/群体画像、列表、详情、删除、批量生成）
  Phase 2: 学生端画像（查看我的画像列表、画像详情、权限校验）
"""
import urllib.request, urllib.parse, json, sys, time, asyncio

BASE = 'http://localhost:8000/api/v1'
results = []

def login(username, password):
    form_data = urllib.parse.urlencode({'username': username, 'password': password}).encode()
    req = urllib.request.Request(f'{BASE}/auth/login', data=form_data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    r = urllib.request.urlopen(req)
    return json.loads(r.read())['access_token']

def api(token, method, path, data=None, timeout=120):
    url = f'{BASE}{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(r.read()), r.status
    except Exception as e:
        body_text = e.read().decode() if hasattr(e, 'read') else ''
        code = e.code if hasattr(e, 'code') else 0
        return {'_error': body_text}, code

def check(name, ok, detail=''):
    status = '\u2705' if ok else '\u274c'
    results.append((name, ok))
    msg = f'{status} {name}'
    if detail: msg += f' ({detail})'
    print(msg)
    return ok

# ─── DB helper ───
async def run_sql(sql, *args):
    import asyncpg
    conn = await asyncpg.connect(
        host='postgres', port=5432, database='wangsh_db',
        user='admin', password='dev_postgres_password'
    )
    try:
        return await conn.fetch(sql, *args)
    finally:
        await conn.close()

async def run_sql_val(sql, *args):
    rows = await run_sql(sql, *args)
    return rows[0][0] if rows else None

async def run_sql_exec(sql, *args):
    import asyncpg
    conn = await asyncpg.connect(
        host='postgres', port=5432, database='wangsh_db',
        user='admin', password='dev_postgres_password'
    )
    try:
        return await conn.execute(sql, *args)
    finally:
        await conn.close()

def sql(query, *args):
    return asyncio.run(run_sql(query, *args))

def sql_val(query, *args):
    return asyncio.run(run_sql_val(query, *args))

def sql_exec(query, *args):
    return asyncio.run(run_sql_exec(query, *args))

# ═══════════════════════════════════════
# PHASE 0: 准备测试数据
# ═══════════════════════════════════════
print('\n\u2550\u2550\u2550 PHASE 0: 准备测试数据 \u2550\u2550\u2550')

admin_token = login('admin', 'wangshuhao0727')
check('管理员登录', bool(admin_token))

# 0.1 创建测试用智能体（debug_stub 模式，无需真实 API）
agent_id = sql_val(
    "SELECT id FROM znt_agents WHERE name='E2E画像测试Agent' AND is_deleted=false"
)
if not agent_id:
    agent_id = sql_val(
        "INSERT INTO znt_agents (name, description, agent_type, is_active, is_deleted) "
        "VALUES ('E2E画像测试Agent', 'e2e测试用', 'openai', true, false) RETURNING id"
    )
check('创建测试智能体', agent_id is not None, f'id={agent_id}')

# 0.2 确保学生张三存在 (id=2)
student1_id = sql_val("SELECT id FROM sys_users WHERE student_id='20240001'")
if not student1_id:
    resp, sc = api(admin_token, 'POST', '/users/', {
        'full_name': '张三', 'student_id': '20240001',
        'class_name': '高一(1)班', 'study_year': '2025',
        'role_code': 'student', 'is_active': True,
    })
    student1_id = resp.get('id')
check('学生张三就绪', student1_id is not None, f'id={student1_id}')

# 0.3 创建第二个学生李四
student2_id = sql_val("SELECT id FROM sys_users WHERE student_id='20240002'")
if not student2_id:
    time.sleep(1)
    resp, sc = api(admin_token, 'POST', '/users/', {
        'full_name': '李四', 'student_id': '20240002',
        'class_name': '高一(1)班', 'study_year': '2025',
        'role_code': 'student', 'is_active': True,
    })
    if sc in (200, 201):
        student2_id = resp.get('id')
    else:
        student2_id = sql_val("SELECT id FROM sys_users WHERE student_id='20240002'")
check('学生李四就绪', student2_id is not None, f'id={student2_id}')

# 0.4 确保有一个 graded 的测评配置和 session
config_id = sql_val(
    "SELECT config_id FROM znt_assessment_sessions WHERE status='graded' AND user_id=$1 LIMIT 1",
    student1_id
)
check('已有graded测评session', config_id is not None, f'config_id={config_id}')

# 0.5 插入模拟小组讨论数据
disc_session_id = sql_val(
    "SELECT id FROM znt_group_discussion_sessions WHERE group_name='E2E画像测试讨论组'"
)
if not disc_session_id:
    disc_session_id = sql_val(
        "INSERT INTO znt_group_discussion_sessions "
        "(session_date, class_name, group_no, group_name, created_by_user_id, message_count) "
        "VALUES (CURRENT_DATE, '高一(1)班', 'e2e1', 'E2E画像测试讨论组', $1, 4) RETURNING id",
        student1_id
    )
    # 添加成员
    sql_exec(
        "INSERT INTO znt_group_discussion_members (session_id, user_id) VALUES ($1, $2) "
        "ON CONFLICT DO NOTHING",
        disc_session_id, student1_id
    )
    sql_exec(
        "INSERT INTO znt_group_discussion_members (session_id, user_id) VALUES ($1, $2) "
        "ON CONFLICT DO NOTHING",
        disc_session_id, student2_id
    )
    # 添加讨论消息
    for name, uid, content in [
        ('张三', student1_id, '我觉得Python的for循环比while循环更常用'),
        ('李四', student2_id, '同意，for循环遍历列表很方便'),
        ('张三', student1_id, '不过while循环在不确定次数时更灵活'),
        ('李四', student2_id, '对，比如读取用户输入直到输入quit'),
    ]:
        sql_exec(
            "INSERT INTO znt_group_discussion_messages "
            "(session_id, user_id, user_display_name, content) VALUES ($1, $2, $3, $4)",
            disc_session_id, uid, name, content
        )
check('模拟讨论数据就绪', disc_session_id is not None, f'session_id={disc_session_id}')

# ═══════════════════════════════════════
# PHASE 1: 管理端画像 CRUD
# ═══════════════════════════════════════
print('\n\u2550\u2550\u2550 PHASE 1: 管理端画像 CRUD \u2550\u2550\u2550')

# 1.1 生成个人画像
profile1_resp, code = api(admin_token, 'POST', '/assessment/admin/profiles/generate', {
    'profile_type': 'individual',
    'target_id': str(student1_id),
    'config_id': config_id,
    'discussion_session_id': disc_session_id,
    'agent_ids': [agent_id],
    'agent_id': agent_id,
}, timeout=120)
profile1_id = profile1_resp.get('id')
check('生成个人画像', code == 200 and profile1_id is not None,
      f'id={profile1_id}, type={profile1_resp.get("profile_type")}')
check('个人画像有内容', bool(profile1_resp.get('result_text')),
      f'len={len(str(profile1_resp.get("result_text","")))}')
check('个人画像数据源正确',
      profile1_resp.get('data_sources') is not None,
      f'sources={profile1_resp.get("data_sources")}')

# 1.2 生成小组画像
profile2_resp, code = api(admin_token, 'POST', '/assessment/admin/profiles/generate', {
    'profile_type': 'group',
    'target_id': str(disc_session_id),
    'config_id': config_id,
    'discussion_session_id': disc_session_id,
    'agent_id': agent_id,
}, timeout=120)
profile2_id = profile2_resp.get('id')
check('生成小组画像', code == 200 and profile2_id is not None,
      f'id={profile2_id}')
check('小组画像有内容', bool(profile2_resp.get('result_text')))

# 1.3 生成群体画像
profile3_resp, code = api(admin_token, 'POST', '/assessment/admin/profiles/generate', {
    'profile_type': 'class',
    'target_id': '高一(1)班',
    'config_id': config_id,
    'agent_id': agent_id,
}, timeout=120)
profile3_id = profile3_resp.get('id')
check('生成群体画像', code == 200 and profile3_id is not None,
      f'id={profile3_id}')
check('群体画像有内容', bool(profile3_resp.get('result_text')))

# 1.4 画像列表
list_resp, code = api(admin_token, 'GET', '/assessment/admin/profiles?limit=50')
check('画像列表', code == 200 and list_resp.get('total', 0) >= 3,
      f'total={list_resp.get("total")}')

# 1.5 按类型筛选
list_ind, code = api(admin_token, 'GET', '/assessment/admin/profiles?profile_type=individual')
check('按类型筛选-个人', code == 200 and list_ind.get('total', 0) >= 1,
      f'total={list_ind.get("total")}')

list_grp, code = api(admin_token, 'GET', '/assessment/admin/profiles?profile_type=group')
check('按类型筛选-小组', code == 200 and list_grp.get('total', 0) >= 1)

# 1.6 画像详情
detail_resp, code = api(admin_token, 'GET', f'/assessment/admin/profiles/{profile1_id}')
check('画像详情', code == 200 and detail_resp.get('id') == profile1_id,
      f'type={detail_resp.get("profile_type")}, target={detail_resp.get("target_id")}')

# 1.7 批量生成
batch_resp, code = api(admin_token, 'POST', '/assessment/admin/profiles/batch-generate', {
    'user_ids': [student1_id, student2_id],
    'config_id': config_id,
    'discussion_session_id': disc_session_id,
    'agent_ids': [agent_id],
    'agent_id': agent_id,
}, timeout=120)
check('批量生成画像', code == 200 and batch_resp.get('count', 0) >= 1,
      f'count={batch_resp.get("count")}')

# 1.8 删除画像（删除群体画像）
del_resp, code = api(admin_token, 'DELETE', f'/assessment/admin/profiles/{profile3_id}')
check('删除画像', code == 200)

# 确认删除后查不到
del_check, code = api(admin_token, 'GET', f'/assessment/admin/profiles/{profile3_id}')
check('删除后404', code == 404)

# ═══════════════════════════════════════
# PHASE 2: 学生端画像
# ═══════════════════════════════════════
print('\n\u2550\u2550\u2550 PHASE 2: 学生端画像 \u2550\u2550\u2550')

time.sleep(2)  # 避免速率限制
student_token = login('张三', '20240001')
check('学生登录', bool(student_token))

# 2.1 学生查看自己的画像列表
my_profiles, code = api(student_token, 'GET', '/assessment/my-profiles')
check('学生-我的画像列表', code == 200 and my_profiles.get('total', 0) >= 1,
      f'total={my_profiles.get("total")}')

# 2.2 学生查看画像详情
if my_profiles.get('items'):
    my_first = my_profiles['items'][0]
    my_detail, code = api(student_token, 'GET', f'/assessment/my-profiles/{my_first["id"]}')
    check('学生-画像详情', code == 200 and my_detail.get('id') == my_first['id'],
          f'id={my_detail.get("id")}')
    check('学生-画像有内容', bool(my_detail.get('result_text')))
else:
    check('学生-画像详情', False, '无画像数据')
    check('学生-画像有内容', False)

# 2.3 学生不能查看别人的画像（用小组画像测试，target_id != student1_id）
forbidden_resp, code = api(student_token, 'GET', f'/assessment/my-profiles/{profile2_id}')
check('学生-无权查看他人画像', code == 403,
      f'code={code}')

# 2.4 学生查看不存在的画像
notfound_resp, code = api(student_token, 'GET', '/assessment/my-profiles/99999')
check('学生-画像不存在404', code == 404)

# ═══════════════════════════════════════
# 总结
# ═══════════════════════════════════════
print(f'\n{"═"*40}')
passed = sum(1 for _, ok in results if ok)
failed = len(results) - passed
print(f'总计: {len(results)} 项, \u2705 {passed} 通过, \u274c {failed} 失败')
if failed:
    print('失败项:')
    for name, ok in results:
        if not ok:
            print(f'  - {name}')
sys.exit(0 if failed == 0 else 1)
