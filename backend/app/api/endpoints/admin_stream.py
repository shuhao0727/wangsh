"""管理端 SSE 实时推送端点"""
import asyncio
import json
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.deps import require_admin
from app.schemas.user_info import UserInfo
from app.core.pubsub import subscribe, unsubscribe

router = APIRouter()


@router.get("/stream")
async def admin_stream(
    current_user: UserInfo = Depends(require_admin),
):
    """管理端 SSE 流 - 推送所有管理相关事件"""
    sub_id = str(uuid.uuid4())
    channel = "admin_global"  # 全局管理员频道

    async def gen():
        q = await subscribe(channel, sub_id)
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ":keepalive\n\n"
                except asyncio.CancelledError:
                    break
        finally:
            await unsubscribe(channel, sub_id)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
