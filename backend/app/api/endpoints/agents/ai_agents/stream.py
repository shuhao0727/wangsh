from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.agents import AgentChatRequest

router = APIRouter()


@router.post("/stream")
async def stream_agent_chat_endpoint(
    request: AgentChatRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        from app.services.agents.chat_stream import stream_agent_chat

        gen = stream_agent_chat(db, request.agent_id, request.message, request.user, request.inputs)
        return StreamingResponse(gen, media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"流式对话失败: {str(e)}",
        )

