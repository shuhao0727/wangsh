import json
import httpx
from datetime import datetime
from typing import Optional
from app.schemas.agents import AgentTestResponse
from app.services.agents.agent_testing import redirect_rejected_message


def _dify_success_response(path: str, model_name: Optional[str], test_message: str) -> AgentTestResponse:
    display_model = (model_name or "").replace("-", " ").replace("_", " ").title()
    msg = f"✅ Dify智能体连接测试成功\n\n📡 API路径: {path}\n🧠 聊天测试: ✅ 成功{f' (使用模型: {display_model})' if model_name else ''}\n💬 测试消息: {test_message[:50]}"
    return AgentTestResponse(success=True, message=msg, response_time=None, timestamp=datetime.now())


async def run_dify_test(api_endpoint: str, headers: dict, test_message: str, model_name: Optional[str]) -> AgentTestResponse:
    base_url = api_endpoint.rstrip("/")
    base_lower = base_url.lower()
    if base_lower.endswith("/v1") or base_lower.endswith("/api/v1"):
        chat_paths = ["/chat-messages", "/v1/chat-messages", "/api/chat-messages", "/api/v1/chat-messages"]
    else:
        chat_paths = ["/v1/chat-messages", "/chat-messages", "/api/v1/chat-messages", "/api/chat-messages"]
    payload = {
        "query": test_message or "Hello",
        "user": "test_user",
        "response_mode": "streaming",
        "inputs": {}
    }
    timeout = httpx.Timeout(10.0, connect=6.0, read=10.0)
    # 不跟随重定向：出站硬校验只覆盖 api_endpoint 所在主机。
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        last_error = None
        for path in chat_paths:
            url = f"{base_url}{path}"
            try:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    if 300 <= resp.status_code < 400:
                        # 不读取、不回显重定向响应体；终止探测，避免被后续路径的错误覆盖。
                        last_error = redirect_rejected_message(resp.status_code)
                        break
                    ct = resp.headers.get("content-type", "").lower()
                    if resp.status_code == 200 and "text/event-stream" in ct:
                        return _dify_success_response(path, model_name, test_message)
                    body = await resp.aread()
                    text = body.decode("utf-8", errors="ignore")
                    if resp.status_code in (401, 403):
                        last_error = f"{resp.status_code}:{text[:80]}"
                        break
                    if resp.status_code == 200 and "text/html" not in ct:
                        try:
                            data = json.loads(text)
                            if isinstance(data, dict) and ("answer" in data or "message" in data or "choices" in data):
                                return _dify_success_response(path, model_name, test_message)
                        except Exception:
                            pass
                    last_error = f"{resp.status_code}:{text[:80]}"
            except Exception as e:
                last_error = str(e)[:120]
                continue
    return AgentTestResponse(
        success=False,
        message=f"❌ Dify测试失败，错误: {last_error or '未知错误'}",
        response_time=None,
        timestamp=datetime.now(),
    )
