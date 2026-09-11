from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_user
from app.core.stream_session import session_checked_stream
from app.utils.errors import safe_error_detail
from app.schemas.agents import AgentChatRequest
from app.schemas.user_info import UserInfo

router = APIRouter()


@router.post("/stream")
async def stream_agent_chat_endpoint(
    request: Request,
    body: AgentChatRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_user),
):
    try:
        from app.services.agents.chat_stream import stream_agent_chat

        # 构建对话历史：优先使用 messages 字段，否则用单条 message 兼容旧版
        history: Optional[List[Dict[str, str]]] = None
        if body.messages:
            history = [{"role": m.role, "content": m.content} for m in body.messages]

        gen = stream_agent_chat(
            db,
            body.agent_id,
            body.message,
            body.user,
            body.inputs,
            history=history,
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("流式对话失败", e),
        )

