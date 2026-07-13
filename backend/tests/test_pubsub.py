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
import time
from unittest.mock import AsyncMock, MagicMock, patch


def _reset():
    """重置 pubsub 模块全局状态"""
    from app.core import pubsub
    pubsub._local_subs.clear()
    pubsub._listener_tasks.clear()
    pubsub._redis_pubsubs.clear()
    pubsub._listener_ready.clear()
    pubsub._channel_locks.clear()
    pubsub._local_only_channels.clear()
    pubsub._redis_available = None
    pubsub._redis_checked_at = time.monotonic()


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


def test_subscribe_waits_until_redis_listener_is_ready():
    """subscribe 仅在 Redis 已完成 SUBSCRIBE 后返回，避免首事件丢失。"""
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        subscribe_entered = asyncio.Event()
        allow_subscribe = asyncio.Event()

        mock_pubsub = MagicMock()

        async def delayed_subscribe(_channel):
            subscribe_entered.set()
            await allow_subscribe.wait()

        mock_pubsub.subscribe = delayed_subscribe

        async def idle_get_message(**_kwargs):
            await asyncio.sleep(0)
            return None

        mock_pubsub.get_message = idle_get_message
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.aclose = AsyncMock()

        mock_client = MagicMock()
        mock_client.pubsub.return_value = mock_pubsub
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            first_task = asyncio.create_task(pubsub.subscribe("ready_ch", "sub1"))
            await asyncio.wait_for(subscribe_entered.wait(), timeout=1)
            second_task = asyncio.create_task(pubsub.subscribe("ready_ch", "sub2"))
            await asyncio.sleep(0)

            assert first_task.done() is False
            assert second_task.done() is False

            allow_subscribe.set()
            first_queue, second_queue = await asyncio.wait_for(
                asyncio.gather(first_task, second_task),
                timeout=1,
            )
            await pubsub.unsubscribe("ready_ch", "sub1")
            await pubsub.unsubscribe("ready_ch", "sub2")
            return first_queue, second_queue

    queues = asyncio.run(run())
    assert all(isinstance(queue, asyncio.Queue) for queue in queues)
    _reset()


def test_listener_subscribe_failure_falls_back_to_local_delivery():
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        mock_pubsub = MagicMock()
        mock_pubsub.subscribe = AsyncMock(side_effect=ConnectionError("redis down"))
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.aclose = AsyncMock()

        mock_client = MagicMock()
        mock_client.pubsub.return_value = mock_pubsub
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            queue = await pubsub.subscribe("fallback_ch", "sub1")
            await pubsub.publish("fallback_ch", {"type": "local"})
            result = queue.get_nowait()
            await pubsub.unsubscribe("fallback_ch", "sub1")
            return result, pubsub._redis_available

    result, redis_available = asyncio.run(run())
    assert result == {"type": "local"}
    assert redis_available is False
    _reset()


def test_listener_cleanup_supports_legacy_close():
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        mock_pubsub = MagicMock(spec=["subscribe", "get_message", "unsubscribe", "close"])
        mock_pubsub.subscribe = AsyncMock()

        async def idle_get_message(**_kwargs):
            await asyncio.sleep(0)
            return None

        mock_pubsub.get_message = idle_get_message
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.close = AsyncMock()

        mock_client = MagicMock()
        mock_client.pubsub.return_value = mock_pubsub
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            await pubsub.subscribe("legacy_close_ch", "sub1")
            await pubsub.unsubscribe("legacy_close_ch", "sub1")
        return mock_pubsub.close.await_count

    assert asyncio.run(run()) == 1
    _reset()


def test_subscribe_ready_timeout_falls_back_and_stops_listener(monkeypatch):
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        monkeypatch.setattr(pubsub, "_LISTENER_READY_TIMEOUT", 0.01)

        mock_pubsub = MagicMock()

        async def hanging_subscribe(_channel):
            await asyncio.Event().wait()

        mock_pubsub.subscribe = hanging_subscribe
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.aclose = AsyncMock()

        mock_client = MagicMock()
        mock_client.pubsub.return_value = mock_pubsub
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            queue = await pubsub.subscribe("timeout_ch", "sub1")

        return (
            queue,
            pubsub._redis_available,
            "timeout_ch" in pubsub._local_only_channels,
            "timeout_ch" in pubsub._listener_tasks,
            "sub1" in pubsub._local_subs.get("timeout_ch", {}),
        )

    queue, redis_available, is_local_only, has_listener, has_local_sub = asyncio.run(run())
    assert isinstance(queue, asyncio.Queue)
    assert redis_available is True
    assert is_local_only is True
    assert has_listener is False
    assert has_local_sub is True
    _reset()


def test_publish_before_listener_acquires_handshake_lock_delivers_locally():
    """publish 先拿到握手锁时本地补发，避免 Redis 尚未订阅造成丢失。"""
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        queue = asyncio.Queue(maxsize=50)
        pubsub._local_subs["handshake_ch"] = {"sub1": queue}
        pubsub._listener_ready["handshake_ch"] = asyncio.Event()
        pubsub._channel_locks["handshake_ch"] = asyncio.Lock()

        mock_client = MagicMock()
        mock_client.publish = AsyncMock()
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            await pubsub.publish("handshake_ch", {"type": "first"})
            received = queue.get_nowait()
            queue_size = queue.qsize()

        return received, queue_size, mock_client.publish.await_count

    received, queue_size, publish_count = asyncio.run(run())
    assert received == {"type": "first"}
    assert queue_size == 0
    assert publish_count == 1
    _reset()


def test_listener_timeout_does_not_disable_healthy_channel(monkeypatch):
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        monkeypatch.setattr(pubsub, "_LISTENER_READY_TIMEOUT", 0.01)

        hanging_pubsub = MagicMock()

        async def hanging_subscribe(_channel):
            await asyncio.Event().wait()

        hanging_pubsub.subscribe = hanging_subscribe
        hanging_pubsub.unsubscribe = AsyncMock()
        hanging_pubsub.aclose = AsyncMock()

        mock_client = MagicMock()
        mock_client.pubsub.return_value = hanging_pubsub
        mock_client.publish = AsyncMock()
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            await pubsub.subscribe("slow_ch", "sub1")
            await pubsub.publish("healthy_ch", {"type": "remote"})

        return mock_client.publish.await_args_list

    publish_calls = asyncio.run(run())
    assert publish_calls[0].args[0] == "sse:healthy_ch"
    _reset()


def test_unsubscribe_failure_still_closes_pubsub():
    _reset()
    from app.core import pubsub

    async def run():
        mock_pubsub = MagicMock()
        mock_pubsub.unsubscribe = AsyncMock(side_effect=ConnectionError("down"))
        mock_pubsub.aclose = AsyncMock()

        await pubsub._close_pubsub(mock_pubsub, "sse:cleanup_ch")
        return mock_pubsub.aclose.await_count

    assert asyncio.run(run()) == 1
    _reset()


def test_cancelled_subscribe_removes_local_subscription(monkeypatch):
    _reset()
    from app.core import pubsub

    async def run():
        pubsub._redis_available = True
        monkeypatch.setattr(pubsub, "_LISTENER_READY_TIMEOUT", 10)
        subscribe_entered = asyncio.Event()

        mock_pubsub = MagicMock()

        async def hanging_subscribe(_channel):
            subscribe_entered.set()
            await asyncio.Event().wait()

        mock_pubsub.subscribe = hanging_subscribe
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.aclose = AsyncMock()

        mock_client = MagicMock()
        mock_client.pubsub.return_value = mock_pubsub
        mock_cache_obj = MagicMock()
        mock_cache_obj.get_client = AsyncMock(return_value=mock_client)
        mock_cache_module = MagicMock()
        mock_cache_module.cache = mock_cache_obj

        with patch.dict("sys.modules", {"app.utils.cache": mock_cache_module}):
            task = asyncio.create_task(pubsub.subscribe("cancel_ch", "sub1"))
            await asyncio.wait_for(subscribe_entered.wait(), timeout=1)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        return (
            "cancel_ch" in pubsub._local_subs,
            "cancel_ch" in pubsub._listener_tasks,
        )

    has_subs, has_listener = asyncio.run(run())
    assert has_subs is False
    assert has_listener is False
    _reset()
