"""
进程内 SSE pub/sub 模块
从 classroom.py 提取，供所有模块共用。

NOTE: 进程内实现，仅支持单 worker 部署。
若需多 worker 横向扩展，需替换为 Redis Pub/Sub。
"""

import asyncio
from typing import Dict

_subscribers: Dict[str, Dict[str, asyncio.Queue]] = {}  # channel -> {sub_id: queue}


def publish(channel: str, event: dict):
    """向指定频道的所有订阅者推送事件"""
    subs = _subscribers.get(channel, {})
    for q in subs.values():
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


def subscribe(channel: str, sub_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.setdefault(channel, {})[sub_id] = q
    return q


def unsubscribe(channel: str, sub_id: str):
    subs = _subscribers.get(channel, {})
    subs.pop(sub_id, None)
    if not subs:
        _subscribers.pop(channel, None)
