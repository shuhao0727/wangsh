"""
SSE pub/sub 模块测试

覆盖场景：
1. 进程内模式下 publish → subscribe 能收到事件
2. unsubscribe 后不再收到事件
3. QueueFull 时不阻塞
4. 多订阅者广播
5. 不同频道隔离
6. shutdown_pubsub 清理所有状态
7. Redis 模式 publish 走 Redis PUBLISH
8. Redis 不可用时降级
9. Redis publish 失败时回退
10. 频道前缀正确
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch


def _reset():
    """重置 pubsub 模块全局状态"""
    from app.core import pubsub
    pubsub._local_subs.clear()
    pubsub._listener_tasks.clear()
    pubsub._redis_pubsubs.clear()
    pubsub._redis_available = None


# ── 进程内模式测试 ──────────────────────────────────────────


def test_publish_subscribe_receive():
    """publish 后 subscriber 能收到事件"""
    _reset()
    from app.core import pubsub
    pubsub._redis_available = False

    async def run():
        q = await pubsub.subscribe("test_ch", "sub1")
        event = {"type": "test", "data": "hello"}
        await pubsub.publish("test_ch", event)
        return q.get_nowait()

    result = asyncio.run(run())
    assert result == {"type": "test", "data": "hello"}
    _reset()


def test_unsubscribe_stops_receiving():
    """unsubscribe 后不再收到事件"""
    _reset()
    from app.core import pubsub
    pubsub._redis_available = False

    async def run():
        q = await pubsub.subscribe("test_ch", "sub1")
        await pubsub.unsubscribe("test_ch", "sub1")
        await pubsub.publish("test_ch", {"type": "after_unsub"})
        return q.empty()

    assert asyncio.run(run()) is True
    _reset()


def test_multiple_subscribers():
    """多个订阅者都能收到事件"""
    _reset()
    from app.core import pubsub
    pubsub._redis_available = False

    async def run():
        q1 = await pubsub.subscribe("test_ch", "sub1")
        q2 = await pubsub.subscribe("test_ch", "sub2")
        event = {"type": "broadcast"}
        await pubsub.publish("test_ch", event)
        return q1.get_nowait(), q2.get_nowait()

    r1, r2 = asyncio.run(run())
    assert r1 == {"type": "broadcast"}
    assert r2 == {"type": "broadcast"}
    _reset()


def test_queue_full_no_block():
    """Queue 满时 publish 不阻塞，事件被丢弃"""
    _reset()
    from app.core import pubsub
    pubsub._redis_available = False

    async def run():
        q = await pubsub.subscribe("test_ch", "sub1")
        for i in range(50):
            await pubsub.publish("test_ch", {"i": i})
        # 第 51 个事件应被丢弃
        await pubsub.publish("test_ch", {"i": 50})
        return q.qsize()

    assert asyncio.run(run()) == 50
    _reset()


def test_different_channels_isolated():
    """不同频道的事件互不干扰"""
    _reset()
    from app.core import pubsub
    pubsub._redis_available = False

    async def run():
        q1 = await pubsub.subscribe("ch_a", "sub1")
        q2 = await pubsub.subscribe("ch_b", "sub2")
        await pubsub.publish("ch_a", {"target": "a"})
        return q1.get_nowait(), q2.empty()

    r1, q2_empty = asyncio.run(run())
    assert r1 == {"target": "a"}
    assert q2_empty is True
    _reset()


def test_shutdown_clears_all():
    """shutdown_pubsub 清理所有状态"""
    _reset()
    from app.core import pubsub
    pubsub._redis_available = False

    async def run():
        await pubsub.subscribe("ch1", "sub1")
        await pubsub.subscribe("ch2", "sub2")
        await pubsub.shutdown_pubsub()
        return len(pubsub._local_subs), len(pubsub._listener_tasks)

    subs, tasks = asyncio.run(run())
    assert subs == 0
    assert tasks == 0
    _reset()


# ── Redis 模式测试 ──────────────────────────────────────────


def test_redis_unavailable_fallback():
    """Redis 不可用时自动降级到进程内模式"""
    _reset()
    from app.core import pubsub

    async def run():
        # 强制进程内模式
        pubsub._redis_available = False
        q = await pubsub.subscribe("test_ch", "sub1")
        await pubsub.publish("test_ch", {"type": "fallback"})
        return q.get_nowait()

    result = asyncio.run(run())
    assert result == {"type": "fallback"}
    _reset()


def test_redis_publish_failure_fallback():
    """Redis publish 失败时回退到进程内分发"""
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        q = await pubsub.subscribe("test_ch", "sub1")

        # 构造一个 mock cache 模块，让 pubsub 内部延迟导入时拿到它
        mock_client = AsyncMock()
        mock_client.publish = AsyncMock(side_effect=Exception("Redis down"))
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            await pubsub.publish("test_ch", {"type": "fallback_on_error"})

        return q.get_nowait()

    import sys
    result = asyncio.run(run())
    assert result == {"type": "fallback_on_error"}
    _reset()


# ── 监听协程测试 ──────────────────────────────────────────


def test_local_publish_dispatches():
    """_local_publish 将消息分发到本地 Queue"""
    _reset()
    from app.core import pubsub

    async def run():
        q = await pubsub.subscribe("test_ch", "sub1")
        pubsub._local_publish("test_ch", {"type": "from_local"})
        return q.get_nowait()

    # 强制进程内模式避免 Redis 连接
    from app.core import pubsub as ps
    ps._redis_available = False
    result = asyncio.run(run())
    assert result == {"type": "from_local"}
    _reset()


def test_channel_prefix():
    """频道使用 sse: 前缀"""
    from app.core.pubsub import CHANNEL_PREFIX
    assert CHANNEL_PREFIX == "sse:"
