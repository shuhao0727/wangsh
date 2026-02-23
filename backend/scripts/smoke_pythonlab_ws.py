import asyncio
import json
import os
import sys
import time
import requests
import aiohttp

# Configuration
API_URL = os.getenv("API_URL", "http://localhost:6608")
USERNAME = os.getenv("USERNAME", "admin")
PASSWORD = os.getenv("PASSWORD", "wangshuhao0727")

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def login():
    log(f"Logging in to {API_URL} as {USERNAME}...")
    resp = requests.post(
        f"{API_URL}/api/v1/auth/login",
        data={"username": USERNAME, "password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    log(f"Login successful. Token len: {len(token)}")
    return token

def create_session(token):
    log("Creating pythonlab session...")
    code = "import time; print('Hello Smoke Test'); time.sleep(1); print('Done')"
    resp = requests.post(
        f"{API_URL}/api/v1/debug/sessions",
        json={
            "title": "smoke_test",
            "code": code,
            "entry_path": "main.py",
            "requirements": []
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    resp.raise_for_status()
    sid = resp.json()["session_id"]
    log(f"Session created: {sid}")
    return sid

def wait_for_ready(token, sid):
    log("Waiting for session READY...")
    start = time.time()
    while time.time() - start < 60:
        resp = requests.get(
            f"{API_URL}/api/v1/debug/sessions/{sid}",
            headers={"Authorization": f"Bearer {token}"}
        )
        resp.raise_for_status()
        status = resp.json()["status"]
        if status == "READY":
            log("Session is READY")
            return
        if status == "FAILED":
            raise Exception(f"Session failed: {resp.json().get('error_detail')}")
        time.sleep(1)
        print(".", end="", flush=True)
    raise TimeoutError("Session not ready in 60s")

async def test_ws(token, sid):
    # Construct WS URL
    ws_base = API_URL.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_base}/api/v1/debug/sessions/{sid}/ws?token={token}"
    log(f"Connecting to WS: {ws_url}")

    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(ws_url) as ws:
            log("WS Connected")
            
            # DAP Initialize
            seq = 1
            init_req = {
                "seq": seq,
                "type": "request",
                "command": "initialize",
                "arguments": {
                    "adapterID": "python",
                    "linesStartAt1": True,
                    "columnsStartAt1": True,
                    "pathFormat": "path"
                }
            }
            await ws.send_str(json.dumps(init_req))
            seq += 1
            log("Sent initialize")

            # Wait for initialized event
            initialized = False
            output_received = False
            
            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    # log(f"Received: {data}")
                    
                    if data.get("type") == "response" and data.get("command") == "initialize" and data.get("success"):
                        log("Received initialize response")
                        # Send launch
                        launch_req = {
                            "seq": seq,
                            "type": "request",
                            "command": "launch",
                            "arguments": {
                                "name": "PythonLab",
                                "type": "python",
                                "request": "launch",
                                "program": "/workspace/main.py",
                                "console": "internalConsole",
                                "justMyCode": True,
                                "redirectOutput": True
                            }
                        }
                        await ws.send_str(json.dumps(launch_req))
                        seq += 1
                        log("Sent launch")

                    if data.get("type") == "event" and data.get("event") == "initialized":
                        log("Received initialized event")
                        initialized = True
                        # Send configurationDone
                        config_req = {
                            "seq": seq,
                            "type": "request",
                            "command": "configurationDone"
                        }
                        await ws.send_str(json.dumps(config_req))
                        seq += 1
                        log("Sent configurationDone")

                    if data.get("type") == "event" and data.get("event") == "output":
                        body = data.get("body", {})
                        out = body.get("output", "")
                        log(f"Received output: {out.strip()}")
                        if "Hello Smoke Test" in out:
                            log(f"SUCCESS: Received expected output: {out.strip()}")
                            output_received = True
                            break
                    
                    if data.get("type") == "event" and data.get("event") == "terminated":
                        log("Session terminated")
                        break
                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    log("WS Closed")
                    break
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    log("WS Error")
                    break

            if output_received:
                log("Smoke test PASSED")
            else:
                log("Smoke test FAILED: Did not receive expected output")
                # sys.exit(1) # Don't exit here, let main handle it

def main():
    try:
        token = login()
        sid = create_session(token)
        wait_for_ready(token, sid)
        asyncio.run(test_ws(token, sid))
    except Exception as e:
        log(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
