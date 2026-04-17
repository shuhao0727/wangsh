"""
Flow API 路由模块

包含所有 API 端点定义。
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_user, require_admin
from app.db.database import get_db
from app.api.pythonlab.constants import MAX_CODE_SIZE_BYTES

from .builder import parse_flow_internal
from .constants import (
    PROMPT_TEMPLATE_PATH,
    OPTIMIZE_CODE_TEMPLATE_PATH,
    MAX_TEMPLATE_SIZE,
    LOG_TYPES,
)

from .exceptions import (
    ValidationError,
    SizeLimitError,
    InternalError,
)

from .ai_service import (
    ai_chat_internal,
    generate_code_from_flow_internal,
    optimize_code_internal,
    test_agent_connection_internal,
)

from .optimization_service import (
    apply_optimization_internal,
    rollback_optimization_internal,
)

router = APIRouter()


@router.post("/optimize/code")
async def optimize_code(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize Python code using AI
    """
    code = payload.get("code")
    if not isinstance(code, str):
        raise ValidationError("code must be a string", field="code")

    # 限制代码大小
    if len(code.encode("utf-8")) > MAX_CODE_SIZE_BYTES:
        raise SizeLimitError("code 过大", limit=MAX_CODE_SIZE_BYTES)

    return await optimize_code_internal(code, current_user, db)


@router.post("/optimize/apply/{log_id}")
async def apply_optimization(
    log_id: int,
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark optimization as applied
    """
    return await apply_optimization_internal(log_id, db)


@router.get("/optimize/rollback/{log_id}")
async def rollback_optimization(
    log_id: int,
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get original content for rollback
    """
    return await rollback_optimization_internal(log_id, db)


@router.get("/flow/prompt_template")
async def get_prompt_template(current_user: Dict[str, Any] = Depends(require_admin)):
    """
    读取提示词模板文件内容
    """
    if not PROMPT_TEMPLATE_PATH.exists():
        return {"content": ""}
    try:
        content = PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8")
        return {"content": content}
    except Exception as e:
        raise InternalError(f"Failed to read prompt file: {e}", original_error=e)


@router.post("/flow/prompt_template")
async def save_prompt_template(payload: Dict[str, str], current_user: Dict[str, Any] = Depends(require_admin)):
    """
    保存提示词模板文件内容
    """
    content = payload.get("content", "")

    # 限制内容大小（1MB）
    if len(content.encode("utf-8")) > MAX_TEMPLATE_SIZE:
        raise SizeLimitError("模板内容过大", limit=MAX_TEMPLATE_SIZE)

    try:
        PROMPT_TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        PROMPT_TEMPLATE_PATH.write_text(content, encoding="utf-8")
        return {"success": True}
    except Exception as e:
        raise InternalError(f"Failed to write prompt file: {e}", original_error=e)


@router.post("/ai/chat")
async def ai_chat(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    通用 AI 对话接口
    """
    messages = payload.get("messages")
    if not isinstance(messages, list):
        raise ValidationError("messages must be a list", field="messages")

    return await ai_chat_internal(messages, db)


@router.post("/flow/generate_code")
async def generate_code_from_flow(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    使用 AI 智能体根据流程图生成 Python 代码
    """
    flow_json = payload.get("flow")
    if not isinstance(flow_json, dict):
        raise ValidationError("flow 必须为 JSON 对象", field="flow")

    return await generate_code_from_flow_internal(flow_json, db)


@router.post("/flow/test_agent_connection")
async def test_agent_connection(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_user)
):
    """
    测试智能体连接配置
    Uses chat_completion with a simple ping to verify connectivity and auth.
    """
    api_url = payload.get("api_url")
    api_key = payload.get("api_key")
    model = payload.get("model")

    # 验证 URL 格式
    if api_url and not isinstance(api_url, str):
        raise ValidationError("api_url must be a string", field="api_url")

    if api_url:
        # 简单的 URL 验证
        if not (api_url.startswith("http://") or api_url.startswith("https://")):
            raise ValidationError("api_url must be a valid HTTP/HTTPS URL", field="api_url")

        # 限制 URL 长度
        if len(api_url) > 500:
            raise ValidationError("api_url too long", field="api_url")

    # 验证 API key 长度
    if api_key and len(api_key) > 1000:
        raise ValidationError("api_key too long", field="api_key")

    # 验证 model 长度
    if model and len(model) > 100:
        raise ValidationError("model name too long", field="model")

    return await test_agent_connection_internal(api_url, api_key, model)


@router.post("/flow/parse")
async def parse_flow(payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_user)):
    """
    解析代码生成流程图
    """
    user_id = int(current_user.get("id") or 0)
    code = payload.get("code")
    if not isinstance(code, str):
        raise ValidationError("code 必须为字符串", field="code")

    if len(code.encode("utf-8")) > MAX_CODE_SIZE_BYTES:
        raise SizeLimitError("code 过大", limit=MAX_CODE_SIZE_BYTES)

    options = payload.get("options")
    if not isinstance(options, dict):
        options = {}

    return await parse_flow_internal(code, options, user_id)