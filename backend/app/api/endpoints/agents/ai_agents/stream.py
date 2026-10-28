from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, require_registered_user
from app.core.stream_session import session_checked_stream
from app.utils.errors import safe_error_detail
from app.schemas.agents import AgentChatRequest
from app.schemas.user_info import UserInfo

router = APIRouter()

# 设置阶段的错误码 → HTTP 状态码。
# 判断依据：智能体不存在属于资源不存在（404）；未配置、已停用、熔断中属于
# 当前资源「暂时/永久不可用」（409，与阻塞路径 run_agent_chat_blocking 抛
# ValueError 的语义一致）；配置加载异常属于服务端/基础设施故障（503）。
# 这些错误都发生在 EventSourceResponse 开始之前，HTTP 状态码可以如实表达；
# 流开始之后的错误（上游超时、断连）仍只能走 `event: error` 帧。
_SETUP_ERROR_STATUS: Dict[str, int] = {
    "invalid_agent": status.HTTP_404_NOT_FOUND,
    "agent_inactive": status.HTTP_409_CONFLICT,
    "missing_endpoint": status.HTTP_409_CONFLICT,
    "missing_api_key": status.HTTP_409_CONFLICT,
    "circuit_open": status.HTTP_409_CONFLICT,
    "model_not_configured": status.HTTP_409_CONFLICT,
    "stream_setup_failed": status.HTTP_503_SERVICE_UNAVAILABLE,
    "stream_failed": status.HTTP_503_SERVICE_UNAVAILABLE,
}


def _setup_error_status(err: Dict) -> HTTPException:
    """把设置阶段的错误字典转换为 HTTPException。

    detail 保留原错误字典结构（`{"error": ..., "message": ...}`），使前端既能
    按状态码、也能按错误码判定失败；`stream_failed` 的 detail 字段在非 DEBUG
    模式下去掉，避免把基础设施异常原文暴露给客户端。
    """
    code = str((err or {}).get("error") or "")
    code = code if code in _SETUP_ERROR_STATUS else "stream_setup_failed"
    detail = dict(err or {})
    detail["error"] = code
    if code == "stream_failed" and not settings.DEBUG:
        detail.pop("detail", None)
    return HTTPException(status_code=_SETUP_ERROR_STATUS[code], detail=detail)



@router.post("/stream")
async def stream_agent_chat_endpoint(
    request: Request,
    body: AgentChatRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_registered_user),
):
    try:
        from app.services.agents.chat_stream import (
            _StreamSetupError,
            prepare_agent_stream,
            stream_agent_chat,
        )

        # 构建对话历史：优先使用 messages 字段，否则用单条 message 兼容旧版
        history: Optional[List[Dict[str, str]]] = None
        if body.messages:
            history = [{"role": m.role, "content": m.content} for m in body.messages]

        # Prepare every DB-backed value before opening the long-lived response.
        # The generator receives only immutable provider/request state, so this
        # request-scoped session can be returned to the pool immediately.
        try:
            prepared = await prepare_agent_stream(
                db,
                body.agent_id,
                body.message,
                history=history,
            )
        except _StreamSetupError as exc:
            # 设置阶段失败属于请求级错误：必须在响应开始前用非 200 暴露，
            # 而不是先发 200 再塞一个 event: error 帧（见 _setup_error_status）。
            # 先把 db 置空，避免下面的兜底分支重复关闭同一个会话。
            db_to_close, db = db, None
            await db_to_close.close()
            raise _setup_error_status(exc.err) from None

        await db.close()
        dify_user = f"wangsh:user:{int(current_user['id'])}:agent:{body.agent_id}"
        gen = stream_agent_chat(
            None,
            body.agent_id,
            body.message,
            dify_user,
            body.inputs,
            history=history,
            prepared=prepared,
        )
        return StreamingResponse(
            session_checked_stream(gen, request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        if db is not None:
            await db.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("流式对话失败", e),
        )
