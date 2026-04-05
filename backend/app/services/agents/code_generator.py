import httpx
import json
import asyncio
from loguru import logger
from typing import Optional, Dict, Any
from app.core.config import settings

class CodeGeneratorClient:
    """
    智能体代码生成客户端
    负责调用外部 Agent API 将流程图转换为 Python 代码
    """
    
    def __init__(self):
        self.api_url = settings.AGENT_API_URL
        self.api_key = settings.AGENT_API_KEY
        self.client = httpx.AsyncClient(
            timeout=60.0,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )

    @staticmethod
    def _format_http_error(e: Exception) -> str:
        if isinstance(e, httpx.HTTPStatusError):
            status = e.response.status_code
            body = ""
            try:
                body = e.response.text or ""
            except Exception:
                body = ""
            if body:
                return f"HTTP {status}: {body[:600]}"
            return f"HTTP {status}: {e}"
        return str(e)

    @staticmethod
    def _normalize_chat_completions_url(raw_url: str) -> str:
        """将用户配置的 base URL 归一化为 chat/completions 端点。"""
        base = (raw_url or "").strip().rstrip("/")
        lower = base.lower()
        if lower.endswith("/chat/completions"):
            return base
        if lower.endswith("/v1"):
            return f"{base}/chat/completions"
        if any(x in lower for x in ("siliconflow", "openai", "deepseek", "aliyun")):
            return f"{base}/v1/chat/completions"
        return f"{base}/v1/chat/completions"

    @staticmethod
    def _resolve_model_name(api_url: str, model: Optional[str]) -> str:
        """按服务商兜底模型名，并修正常见误配（DeepSeek + gpt-*）。"""
        provided = (model or "").strip()
        lower = (api_url or "").lower()
        if "deepseek" in lower:
            if provided and provided.lower().startswith("gpt-"):
                logger.warning(
                    "Detected DeepSeek endpoint with incompatible model '{}', auto-fallback to deepseek-chat",
                    provided,
                )
                return "deepseek-chat"
            return provided or "deepseek-chat"
        return provided or "gpt-3.5-turbo"

    async def generate_code(self, flow_json: Dict[str, Any], api_url: Optional[str] = None, api_key: Optional[str] = None, prompt_template: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """
        调用 Agent API 生成代码
        :param flow_json: 流程图 JSON 数据
        :param api_url: 可选，覆盖默认 API URL
        :param api_key: 可选，覆盖默认 API Key
        :param prompt_template: 可选，覆盖默认提示词模板
        :param model: 可选，模型名称
        :return: {"success": bool, "python_code": str, "error": str}
        """
        target_url = api_url or self.api_url
        target_key = api_key or self.api_key

        if not target_url or not target_key:
            logger.warning("Agent API 未配置，跳过智能生成")
            return {"success": False, "error": "Agent API not configured", "python_code": ""}

        target_url = self._normalize_chat_completions_url(target_url)
        model_name = self._resolve_model_name(target_url, model)

        headers = {
            "Authorization": f"Bearer {target_key}",
            "Content-Type": "application/json"
        }

        # Check if it's likely an OpenAI-compatible API
        is_openai_compatible = "chat/completions" in target_url or model

        if is_openai_compatible:
            # Construct OpenAI Chat Completion Payload
            system_prompt = prompt_template or "You are a Python expert."
            user_content = json.dumps(flow_json, ensure_ascii=False)
            
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "stream": False,
                "temperature": 0.1
            }
        else:
            # Legacy custom format
            payload = {
                "flowchart": flow_json,
                "language": "python",
                "version": "3.10",
                "context": "education"
            }
            if prompt_template:
                payload["prompt_template"] = prompt_template

        retries = 3
        for attempt in range(retries):
            try:
                response = await self.client.post(
                    target_url,
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
                
                code = ""
                if is_openai_compatible:
                    # Parse OpenAI response
                    if "choices" in data and len(data["choices"]) > 0:
                        content = data["choices"][0]["message"]["content"]
                        # Strip markdown fences if present
                        code = content.replace("```python", "").replace("```", "").strip()
                else:
                    # Parse custom response
                    code = data.get("python_code") or data.get("code") or ""

                if not code:
                    return {"success": False, "error": "Empty code returned", "python_code": ""}
                
                # --- AST Validation ---
                try:
                    import ast
                    ast.parse(code)
                except SyntaxError as e:
                    logger.warning(f"Generated code has syntax error: {e}")
                    # Optional: Retry logic could be added here, asking AI to fix.
                    # For now, we return the error to let the user know.
                    return {"success": False, "error": f"Generated code has syntax error: {e}", "python_code": code}
                except Exception:
                    pass # Ignore other AST errors for now
                # ----------------------

                return {"success": True, "python_code": code, "error": ""}

            except httpx.HTTPStatusError as e:
                err_text = self._format_http_error(e)
                logger.error(f"Agent API HTTP error (attempt {attempt+1}/{retries}): {err_text}")
                if e.response.status_code >= 500:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                    continue
                return {"success": False, "error": err_text, "python_code": ""}
            except Exception as e:
                err_text = self._format_http_error(e)
                logger.error(f"Agent API error (attempt {attempt+1}/{retries}): {err_text}")
                await asyncio.sleep(0.5 * (2 ** attempt))
        
        return {"success": False, "error": "Max retries exceeded", "python_code": ""}

    async def chat_completion(self, messages: list[Dict[str, str]], api_url: Optional[str] = None, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """
        Generic Chat Completion
        """
        target_url = api_url or self.api_url
        target_key = api_key or self.api_key

        if not target_url or not target_key:
            return {"success": False, "error": "Agent API not configured", "message": ""}

        target_url = self._normalize_chat_completions_url(target_url)
        model_name = self._resolve_model_name(target_url, model)

        headers = {
            "Authorization": f"Bearer {target_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model_name,
            "messages": messages,
            "stream": False,
            "temperature": 0.7
        }

        retries = 3
        for attempt in range(retries):
            try:
                response = await self.client.post(
                    target_url,
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
                
                content = ""
                if "choices" in data and len(data["choices"]) > 0:
                    content = data["choices"][0]["message"]["content"]
                
                # Allow empty content for now, or just return what we have
                return {"success": True, "message": content or "(No content returned)", "error": ""}

            except Exception as e:
                err_text = self._format_http_error(e)
                logger.error(f"Agent Chat API error: {err_text}")
                if attempt == retries - 1:
                    return {"success": False, "error": err_text, "message": ""}
                await asyncio.sleep(0.5 * (2 ** attempt))
        return {"success": False, "error": "Unknown error", "message": ""}

    async def close(self):
        await self.client.aclose()

# Global instance
code_generator_client = CodeGeneratorClient()
