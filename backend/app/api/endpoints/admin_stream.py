"""管理端 SSE 实时推送端点"""
from fastapi import Request, APIRouter, Depends
from app.core.sse import sse_response

from app.core.deps import require_admin_sse
from app.schemas.user_info import UserInfo
from app.core.pubsub import subscribe, unsubscribe

router = APIRouter()


@router.get("/stream")
async def admin_stream(
    request: Request,
    current_user: UserInfo = Depends(require_admin_sse),
):
    """管理端 SSE 流 - 推送所有管理相关事件"""
    return sse_response(
        request, "admin_global", subscribe_fn=subscribe, unsubscribe_fn=unsubscribe,
    )
