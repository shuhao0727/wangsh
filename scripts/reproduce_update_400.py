
import json, os, time, urllib.request, urllib.parse, urllib.error

base=os.environ.get('BASE_URL','http://localhost:8000/api/v1').rstrip('/')

def get_token():
    user=os.environ.get('ADMIN_USER','admin')
    candidates=[
        os.environ.get('ADMIN_PASS','').strip(),
        os.environ.get('SUPER_ADMIN_PASSWORD','').strip(),
        'dev_admin_password',
        'wangshuhao0727',
        'change_me',
    ]
    for pwd in [x for x in candidates if x]:
        body=urllib.parse.urlencode({'username':user,'password':pwd}).encode('utf-8')
        req=urllib.request.Request(base+'/auth/login', data=body, headers={'Content-Type':'application/x-www-form-urlencoded'})
        try:
            return json.loads(urllib.request.urlopen(req).read().decode())['access_token']
        except urllib.error.HTTPError as e:
            if e.code == 401:
                continue
            raise
    raise RuntimeError('Login failed: no valid password candidate')

def create_agent(token):
    payload={
      'name': f'test_update_{int(time.time())}_{int(time.perf_counter()*1000)}',
      'agent_type': 'general',
      'description': 'for update test',
      'api_endpoint': None,
      'api_key': None,
      'is_active': True,
    }
    req=urllib.request.Request(
      base+'/ai-agents/', # Use trailing slash as fixed before
      data=json.dumps(payload).encode('utf-8'),
      headers={'Content-Type':'application/json','Authorization': f'Bearer {token}'},
      method='POST'
    )
    return json.loads(urllib.request.urlopen(req).read().decode())

def update_agent(token, agent_id, use_slash, payload):
    url = f"{base}/ai-agents/{agent_id}" + ("/" if use_slash else "")
    print(f"Testing Update: {url}")
    req=urllib.request.Request(
      url,
      data=json.dumps(payload).encode('utf-8'),
      headers={'Content-Type':'application/json','Authorization': f'Bearer {token}'},
      method='PUT'
    )
    try:
        resp=urllib.request.urlopen(req)
        print(f"Success: {resp.status}")
        return True
    except urllib.error.HTTPError as e:
        print(f"Failed: {e.code}")
        try:
            print(e.read().decode())
        except:
            print("(no body)")
        return False

try:
    token = get_token()
    agent = create_agent(token)
    agent_id = agent['id']
    print(f"Created agent {agent_id}")

    # Test 1: Update without slash (should work if backend is /{id})
    update_agent(token, agent_id, False, {'description': 'updated no slash'})

    # Test 2: Update with slash (might fail if backend is /{id})
    update_agent(token, agent_id, True, {'description': 'updated with slash'})

    # Test 3: Update with invalid data (e.g. duplicate name)
    # Create another agent to conflict with
    agent2 = create_agent(token)
    print(f"Created agent2 {agent2['id']} with name {agent2['name']}")
    update_agent(token, agent_id, False, {'name': agent2['name']}) # Should fail 400
except Exception as e:
    print(f"Script Error: {e}")
