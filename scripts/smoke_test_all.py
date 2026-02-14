
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import sys

BASE_URL = 'http://localhost:6608/api/v1'
ADMIN_USER = 'admin'
ADMIN_PASS = 'dev_admin_password'

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def fail(msg):
    log(msg, "FAIL")
    # Don't exit immediately, try to run other tests
    # sys.exit(1)

def request(method, path, token=None, data=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    if data is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(data).encode('utf-8')
    else:
        body = None
        
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        status = resp.status
        content = resp.read().decode('utf-8')
        try:
            json_content = json.loads(content)
        except:
            json_content = content
        return status, json_content
    except urllib.error.HTTPError as e:
        content = e.read().decode('utf-8')
        try:
            json_content = json.loads(content)
        except:
            json_content = content
        return e.code, json_content
    except Exception as e:
        return 0, str(e)

def test_auth():
    log("Testing Auth...")
    # Login
    body = urllib.parse.urlencode({'username': ADMIN_USER, 'password': ADMIN_PASS}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/auth/login", data=body, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode())
        token = data.get('access_token')
        if token:
            log("Login successful")
            return token
        else:
            fail("Login failed: no token")
            return None
    except Exception as e:
        fail(f"Login failed: {e}")
        return None

def test_system(token):
    log("Testing System...")
    # Health
    s, d = request('GET', '/system/health') # Wait, health is /api/health or /api/v1/system/health?
    # Based on api/__init__.py, health_router is included in api_router without prefix? 
    # But main.py includes api_router.
    # health.py router has no prefix?
    # Actually standard health check is usually root level or /health.
    # Let's check /api/health (which Caddy checks).
    try:
        resp = urllib.request.urlopen('http://localhost:6608/api/health')
        log(f"Global Health: {resp.status}")
    except Exception as e:
        fail(f"Global Health failed: {e}")

    # System Metrics
    s, d = request('GET', '/system/metrics', token)
    if s == 200:
        log("System Metrics OK")
    else:
        fail(f"System Metrics failed: {s} {d}")

def test_users(token):
    log("Testing Users...")
    s, d = request('GET', '/auth/me', token)
    if s == 200:
        log(f"Get Me OK: {d.get('username')}")
    else:
        fail(f"Get Me failed: {s} {d}")

    s, d = request('GET', '/users/', token)
    if s == 200:
        log(f"List Users OK: {d.get('total') if isinstance(d, dict) else len(d)} items")
    else:
        fail(f"List Users failed: {s} {d}")

def test_agents(token):
    log("Testing Agents...")
    # List
    s, d = request('GET', '/ai-agents/', token)
    if s == 200:
        log(f"List Agents OK: {d.get('total')} items")
    else:
        fail(f"List Agents failed: {s} {d}")

    # Create
    ts = int(time.time())
    payload = {
        'name': f'smoke_agent_{ts}',
        'agent_type': 'general',
        'description': 'smoke test',
        'is_active': True
    }
    s, d = request('POST', '/ai-agents/', token, payload)
    if s == 201:
        agent_id = d['id']
        log(f"Create Agent OK: {agent_id}")
    else:
        fail(f"Create Agent failed: {s} {d}")
        return

    # Get
    s, d = request('GET', f'/ai-agents/{agent_id}', token)
    if s == 200:
        log("Get Agent OK")
    else:
        fail(f"Get Agent failed: {s} {d}")

    # Update (No slash) - Should fail 400 if duplicate name, or 200 if OK
    # Let's update description
    s, d = request('PUT', f'/ai-agents/{agent_id}', token, {'description': 'updated'})
    if s == 200 and d.get('description') == 'updated':
        log("Update Agent (no slash) OK")
    else:
        fail(f"Update Agent (no slash) failed: {s} {d}")

    # Update (With slash) - Should likely fail 307
    s, d = request('PUT', f'/ai-agents/{agent_id}/', token, {'description': 'updated2'})
    if s == 307:
        log("Update Agent (slash) -> 307 (Expected behavior for strict slashes)")
    elif s == 200:
        log("Update Agent (slash) OK (Unexpected but fine)")
    else:
        log(f"Update Agent (slash) result: {s}")

    # Update with invalid URL (Testing validator)
    s, d = request('PUT', f'/ai-agents/{agent_id}', token, {'api_endpoint': 'invalid-url'})
    if s == 400 or s == 422:
        log("Update Agent Invalid URL -> Rejected (OK)")
    else:
        fail(f"Update Agent Invalid URL -> Accepted? Status: {s}")

    # Delete
    s, d = request('DELETE', f'/ai-agents/{agent_id}', token)
    if s == 200:
        log("Delete Agent OK")
    else:
        fail(f"Delete Agent failed: {s} {d}")

def test_typst(token):
    log("Testing Typst...")
    # List Notes
    s, d = request('GET', '/informatics/typst-notes/', token)
    if s == 200:
        count = len(d) if isinstance(d, list) else d.get('total', 0)
        log(f"List Typst Notes OK: {count} items")
    else:
        fail(f"List Typst Notes failed: {s} {d}")

    # List Styles
    s, d = request('GET', '/informatics/typst-styles/', token)
    if s == 200:
        log(f"List Typst Styles OK: {len(d)} items")
    else:
        fail(f"List Typst Styles failed: {s} {d}")

def run():
    try:
        token = test_auth()
        if not token:
            return
        
        test_system(token)
        test_users(token)
        test_agents(token)
        test_typst(token)
        
        log("Smoke Test Completed")
    except Exception as e:
        fail(f"Script crash: {e}")

if __name__ == '__main__':
    run()
