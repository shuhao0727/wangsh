from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_registered_user
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
    current_user: UserInfo = Depends(require_registered_user),
):
    try:
        from app.services.agents.chat_stream import (
            _StreamSetupError,
            _sse_error,
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
            await db.close()
            setup_error = exc.err

            async def setup_error_stream():
                yield _sse_error(setup_error)

            return StreamingResponse(
                setup_error_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache, no-transform",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                },
            )

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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("流式对话失败", e),
        )
