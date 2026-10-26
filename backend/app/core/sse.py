"""SSE 通道流的统一构造。

管理端、课堂端等事件流此前各自复制同一段生成器：订阅频道、发送 connected、
循环取事件、超时发 keepalive、取消即退出、finally 退订。这里收拢成一处，
避免各处超时与心跳策略漂移。
"""
import asyncio
import json
import uuid
from typing import Any, Awaitable, Callable, Optional

from fastapi import Request
from fastapi.responses import StreamingResponse

from app.core.pubsub import subscribe, unsubscribe
from app.core.stream_session import session_checked_stream

# 空闲多久发一次心跳注释，防止代理断连
KEEPALIVE_SECONDS = 15.0

Subscriber = Callable[[str, str], Any]


def sse_response(
    request: Request,
    channel: str,
    *,
    sub_id: Optional[str] = None,
    subscribe_fn: Optional[Callable[[str, str], Awaitable[Any]]] = None,
    unsubscribe_fn: Optional[Callable[[str, str], Awaitable[None]]] = None,
) -> StreamingResponse:
    """构造一个订阅 ``channel`` 的 SSE 响应。

    ``subscribe_fn`` / ``unsubscribe_fn`` 默认用全局 pubsub；课堂等服务层自带
    同名函数时传入即可，避免重复实现整段生成器。
    """
    stream_id = sub_id or str(uuid.uuid4())
    # 订阅函数由调用方传入：端点多以模块级引用暴露 subscribe，测试会替换它，
    # 工厂内提前绑定会让替换失效。
    sub = subscribe_fn or subscribe
    unsub = unsubscribe_fn or unsubscribe

    async def gen():
        queue = await sub(channel, stream_id)
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ":keepalive\n\n"
                except asyncio.CancelledError:
                    break
        finally:
            await unsub(channel, stream_id)

    return StreamingResponse(
        session_checked_stream(gen(), request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
