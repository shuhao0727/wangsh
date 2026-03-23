from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_user
from app.schemas.agents import AgentChatRequest
from app.schemas.user_info import UserInfo

router = APIRouter()


@router.post("/stream")
async def stream_agent_chat_endpoint(
    request: AgentChatRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_user),
):
    try:
        from app.services.agents.chat_stream import stream_agent_chat

        # 构建对话历史：优先使用 messages 字段，否则用单条 message 兼容旧版
        history: Optional[List[Dict[str, str]]] = None
        if request.messages:
            history = [{"role": m.role, "content": m.content} for m in request.messages]

        gen = stream_agent_chat(
            db,
            request.agent_id,
            request.message,
            request.user,
            request.inputs,
            history=history,
        )
        return StreamingResponse(
            gen,
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
            detail=f"流式对话失败: {str(e)}",
        )

