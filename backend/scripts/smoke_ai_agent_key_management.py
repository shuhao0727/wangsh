import os
import time

import httpx


def main() -> int:
    base_url = os.environ.get("BASE_URL", "http://localhost:6608/api/v1").rstrip("/")
    username = os.environ.get("ADMIN_USERNAME", "admin")
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not password:
        raise SystemExit("missing ADMIN_PASSWORD")

    test_key = f"keytest_value_{int(time.time())}_12345678abcd"

    with httpx.Client(follow_redirects=True, timeout=30) as client:
        r = client.post(
            f"{base_url}/auth/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        r.raise_for_status()
        token = r.json().get("access_token")
        if not token:
            raise RuntimeError("missing access_token")
        client.headers.update({"Authorization": f"Bearer {token}"})

        payload = {
            "name": f"keytest-openrouter-{int(time.time())}",
            "agent_type": "general",
            "description": "keytest",
            "model_name": "qwen/qwen3-next-80b-a3b-instruct:free",
            "api_endpoint": "https://openrouter.ai/api/v1",
            "api_key": test_key,
            "is_active": True,
        }
        r = client.post(f"{base_url}/ai-agents/", json=payload)
        r.raise_for_status()
        agent = r.json()
        agent_id = agent.get("id")
        if not agent_id:
            raise RuntimeError("missing agent id")
        assert agent.get("api_key") is None
        assert agent.get("has_api_key") is True
        assert agent.get("api_key_last4") == test_key[-4:]

        r = client.get(f"{base_url}/ai-agents/{agent_id}")
        r.raise_for_status()
        agent2 = r.json()
        assert agent2.get("api_key") is None
        assert agent2.get("has_api_key") is True
        assert agent2.get("api_key_last4") == test_key[-4:]

        r = client.post(
            f"{base_url}/ai-agents/{agent_id}/reveal-api-key",
            json={"admin_password": password},
        )
        r.raise_for_status()
        revealed = r.json().get("api_key") or ""
        assert revealed == test_key

        r = client.put(f"{base_url}/ai-agents/{agent_id}", json={"description": "updated"})
        r.raise_for_status()
        agent3 = r.json()
        assert agent3.get("has_api_key") is True
        assert agent3.get("api_key_last4") == test_key[-4:]

        r = client.put(f"{base_url}/ai-agents/{agent_id}", json={"clear_api_key": True})
        r.raise_for_status()
        agent4 = r.json()
        assert agent4.get("has_api_key") is False

        r = client.delete(f"{base_url}/ai-agents/{agent_id}")
        r.raise_for_status()

    print("OK key-management")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
