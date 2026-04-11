"""
Flow AI 服务模块

包含 AI 相关的服务函数，如代码优化、AI 对话、代码生成等。
"""

import asyncio
import ast
import json
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.core.feature_flag import FeatureFlag
from app.models.agents.optimization import OptimizeLog
from app.services.agents.code_generator import code_generator_client

from .constants import (
    PROMPT_TEMPLATE_PATH,
    OPTIMIZE_CODE_TEMPLATE_PATH,
    DEFAULT_OPTIMIZE_CODE_PROMPT,
    OPTIMIZATION_STATUS,
    LOG_TYPES,
)

from .exceptions import (
    AIAgentError,
    AIAgentTimeoutError,
    AIAgentNotConfiguredError,
)


def _strip_markdown_fence(content: str) -> str:
    """去除 Markdown 代码块标记"""
    text = (content or "").strip()
    if not text:
        return ""
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```python"):
            lines = lines[1:]
        elif lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _normalize_optimized_python_code(raw: str) -> str:
    """规范化优化后的 Python 代码"""
    code = _strip_markdown_fence(raw)
    if not code:
        return ""
    # 移除末尾的空白行
    lines = code.rstrip().splitlines()
    # 确保每行不以空格结尾
    lines = [line.rstrip() for line in lines]
    normalized_code = "\n".join(lines)
    try:
        ast.parse(normalized_code)
    except SyntaxError as exc:
        raise AIAgentError(f"AI returned invalid python code: {exc}", error_type="INVALID_CODE") from exc
    return normalized_code


def _ensure_conservative_code_optimization(original_code: str, optimized_code: str) -> str:
    """确保代码优化是保守的（不改变关键函数/类名）"""
    try:
        orig_tree = ast.parse(original_code)
        opt_tree = ast.parse(optimized_code)
    except SyntaxError as exc:
        raise AIAgentError(f"AI returned invalid python code: {exc}", error_type="INVALID_CODE") from exc

    # 检查函数名是否改变
    orig_funcs = {node.name for node in ast.walk(orig_tree) if isinstance(node, ast.FunctionDef)}
    opt_funcs = {node.name for node in ast.walk(opt_tree) if isinstance(node, ast.FunctionDef)}
    if orig_funcs and not orig_funcs.issubset(opt_funcs):
        raise AIAgentError("AI changed key function names; optimization rejected", error_type="FUNCTION_NAME_CHANGED")

    # 检查类名是否改变
    orig_classes = {node.name for node in ast.walk(orig_tree) if isinstance(node, ast.ClassDef)}
    opt_classes = {node.name for node in ast.walk(opt_tree) if isinstance(node, ast.ClassDef)}
    if orig_classes and not orig_classes.issubset(opt_classes):
        raise AIAgentError("AI changed key class names; optimization rejected", error_type="CLASS_NAME_CHANGED")

    return optimized_code


async def _get_agent_config(db: AsyncSession) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """获取 AI 智能体配置"""
    query = select(FeatureFlag).where(FeatureFlag.key == "ai_agent_config")
    result = await db.execute(query)
    flag = result.scalar_one_or_none()

    if not flag or not isinstance(flag.value, dict):
        return None, None, None

    config = flag.value
    api_url = config.get("api_url")
    api_key = config.get("api_key")
    model = config.get("model")

    return api_url, api_key, model


async def optimize_code_internal(
    code: str,
    current_user: Dict[str, Any],
    db: AsyncSession
) -> Dict[str, Any]:
    """内部代码优化函数"""
    # 获取智能体配置
    api_url, api_key, model = await _get_agent_config(db)
    if not api_url or not api_key:
        raise AIAgentNotConfiguredError("AI Agent not configured")

    # 读取优化提示词模板
    optimize_prompt = DEFAULT_OPTIMIZE_CODE_PROMPT
    if OPTIMIZE_CODE_TEMPLATE_PATH.exists():
        try:
            optimize_prompt = OPTIMIZE_CODE_TEMPLATE_PATH.read_text(encoding="utf-8")
        except Exception:
            pass

    # 构建消息
    messages = [
        {"role": "system", "content": optimize_prompt},
        {"role": "user", "content": code},
    ]

    try:
        # 调用 AI 智能体
        result = await asyncio.wait_for(
            code_generator_client.chat_completion(
                messages=messages,
                api_url=api_url,
                api_key=api_key,
                model=model
            ),
            timeout=30.0
        )
    except asyncio.TimeoutError:
        raise AIAgentTimeoutError("AI request timed out")
    except Exception as e:
        raise AIAgentError(f"AI request failed: {e}", error_type="REQUEST_FAILED")

    if not result.get("success"):
        raise AIAgentError(result.get("error", "AI request failed"), error_type="REQUEST_FAILED")

    # 处理 AI 响应
    raw_response = result.get("message", "")
    optimized_code = _normalize_optimized_python_code(raw_response)

    if not optimized_code:
        raise AIAgentError("AI returned empty code", error_type="EMPTY_RESPONSE")

    # 确保优化是保守的
    optimized_code = _ensure_conservative_code_optimization(code, optimized_code)

    # 保存到数据库
    log_entry = OptimizeLog(
        user_id=int(current_user.get("id") or 0),
        type=LOG_TYPES["CODE"],
        original_content=code,
        optimized_content=optimized_code,
        status=OPTIMIZATION_STATUS["PENDING"]
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    return {"optimized_code": optimized_code, "log_id": log_entry.id, "rollback_id": log_entry.rollback_id}


async def ai_chat_internal(
    messages: List[Dict[str, str]],
    db: AsyncSession
) -> Dict[str, Any]:
    """内部 AI 对话函数"""
    # 获取智能体配置
    api_url, api_key, model = await _get_agent_config(db)
    if not api_url or not api_key:
        raise AIAgentNotConfiguredError("AI Agent not configured")

    try:
        # 调用 AI 智能体
        result = await asyncio.wait_for(
            code_generator_client.chat_completion(
                messages=messages,
                api_url=api_url,
                api_key=api_key,
                model=model
            ),
            timeout=30.0
        )
    except asyncio.TimeoutError:
        raise AIAgentTimeoutError("AI request timed out")
    except Exception as e:
        raise AIAgentError(f"AI request failed: {e}", error_type="REQUEST_FAILED")

    if not result.get("success"):
        raise AIAgentError(result.get("error", "AI request failed"), error_type="REQUEST_FAILED")

    return {"message": result.get("message", "")}


async def generate_code_from_flow_internal(
    flow_data: Dict[str, Any],
    db: AsyncSession
) -> Dict[str, Any]:
    """内部从流程图生成代码函数"""
    # 获取智能体配置
    api_url, api_key, model = await _get_agent_config(db)
    if not api_url or not api_key:
        raise AIAgentNotConfiguredError("AI Agent not configured")

    # 读取提示词模板
    prompt_template = ""
    if PROMPT_TEMPLATE_PATH.exists():
        try:
            prompt_template = PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8")
        except Exception:
            pass

    # 构建消息
    flow_json = json.dumps(flow_data, ensure_ascii=False, indent=2)
    messages = [
        {"role": "system", "content": prompt_template},
        {"role": "user", "content": f"根据以下流程图生成 Python 代码：\n\n{flow_json}"},
    ]

    try:
        # 调用 AI 智能体
        result = await asyncio.wait_for(
            code_generator_client.chat_completion(
                messages=messages,
                api_url=api_url,
                api_key=api_key,
                model=model
            ),
            timeout=30.0
        )
    except asyncio.TimeoutError:
        raise AIAgentTimeoutError("AI request timed out")
    except Exception as e:
        raise AIAgentError(f"AI request failed: {e}", error_type="REQUEST_FAILED")

    if not result.get("success"):
        raise AIAgentError(result.get("error", "AI request failed"), error_type="REQUEST_FAILED")

    # 处理 AI 响应
    raw_response = result.get("message", "")
    code = _normalize_optimized_python_code(raw_response)

    if not code:
        raise AIAgentError("AI returned empty code", error_type="EMPTY_RESPONSE")

    return {"code": code}


async def test_agent_connection_internal(
    api_url: Optional[str],
    api_key: Optional[str],
    model: Optional[str]
) -> Dict[str, Any]:
    """内部测试智能体连接函数"""
    if not api_url or not api_key:
        return {"success": False, "error": "API URL and API key are required", "python_code": ""}

    messages = [{"role": "user", "content": "Hello, are you online?"}]

    try:
        result = await asyncio.wait_for(
            code_generator_client.chat_completion(
                messages=messages,
                api_url=api_url,
                api_key=api_key,
                model=model,
            ),
            timeout=10.0,
        )
    except asyncio.TimeoutError:
        return {"success": False, "error": "Connection timeout", "python_code": ""}
    except Exception as e:
        return {"success": False, "error": str(e), "python_code": ""}

    if not result.get("success"):
        return {"success": False, "error": result.get("error", "Unknown error"), "python_code": ""}

    return {"success": True, "python_code": f"# Connection Successful\n# AI Response: {result.get('message', '')}"}
