"""
SSE pub/sub 模块 — Redis 优先，进程内降级

当 Redis 可用且 SSE_REDIS_PUBSUB_ENABLED=True 时：
  - publish() 通过 Redis PUBLISH 广播事件
  - subscribe() 启动后台监听协程，将 Redis 消息分发到本地 asyncio.Queue
  - 多 worker 部署时所有 worker 都能收到事件

当 Redis 不可用时自动降级为进程内模式（与旧版行为一致，仅单 worker 有效）。

频道命名空间：所有 Redis 频道自动添加 ``sse:`` 前缀，
与小组讨论等已有 Redis pub/sub 频道隔离。
"""

import asyncio
import json
import time
from typing import Dict, Optional

from loguru import logger

CHANNEL_PREFIX = "sse:"

# ── 本地状态 ──────────────────────────────────────────────
# channel -> {sub_id: asyncio.Queue}
_local_subs: Dict[str, Dict[str, asyncio.Queue]] = {}
# channel -> 后台监听 Task
_listener_tasks: Dict[str, asyncio.Task] = {}
# channel -> Redis PubSub 对象
_redis_pubsubs: Dict[str, object] = {}
# channel -> listener 完成 Redis SUBSCRIBE 的就绪信号
_listener_ready: Dict[str, asyncio.Event] = {}
# channel -> 串行化 Redis SUBSCRIBE 握手和并发 publish
_channel_locks: Dict[str, asyncio.Lock] = {}
# listener 启动失败或超时的频道继续使用本地分发，不影响其他健康频道
_local_only_channels: set[str] = set()

# Redis 可用性缓存（None = 未检测）
_redis_available: Optional[bool] = None
_redis_checked_at: float = 0.0
_REDIS_CHECK_TTL: float = 60.0  # 每 60 秒重新检查 Redis 可用性
_LISTENER_READY_TIMEOUT: float = 5.0


# ── 公共 API ──────────────────────────────────────────────

async def publish(channel: str, event: dict) -> None:
    """向指定频道发布事件（优先 Redis，降级进程内）"""
    # 1. 尝试 Redis
    if await _is_redis_available():
        deliver_locally = channel in _local_only_channels
        try:
            from app.utils.cache import cache  # 延迟导入避免循环依赖
            payload = json.dumps(event, ensure_ascii=False)
            client = await cache.get_client()
            lock = _channel_locks.get(channel)
            if lock is None:
                await client.publish(f"{CHANNEL_PREFIX}{channel}", payload)
            else:
                # listener 在同一把锁内完成 SUBSCRIBE。若 publish 先拿到锁，
                # 本地 listener 必然尚未订阅，可以安全地本地补发且不会重复。
                async with lock:
                    ready = _listener_ready.get(channel)
                    deliver_locally = deliver_locally or (
                        ready is not None and not ready.is_set()
                    )
                    await client.publish(f"{CHANNEL_PREFIX}{channel}", payload)
            if deliver_locally:
                _local_publish(channel, event)
            return
        except Exception:
            logger.warning("Redis publish 失败，回退到进程内分发", exc_info=True)

    # 2. 降级：进程内直接分发
    _local_publish(channel, event)


async def subscribe(channel: str, sub_id: str) -> asyncio.Queue:
    """订阅频道，返回 asyncio.Queue 供 SSE 端点消费"""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _local_subs.setdefault(channel, {})[sub_id] = q

    # 确保该频道有 Redis 监听协程（首个订阅者触发创建）
    if await _is_redis_available() and channel not in _local_only_channels:
        ready = _listener_ready.get(channel)
        if channel not in _listener_tasks:
            ready = asyncio.Event()
            _listener_ready[channel] = ready
            _channel_locks.setdefault(channel, asyncio.Lock())
            task = asyncio.create_task(_redis_listener(channel))
            _listener_tasks[channel] = task
        if ready is not None:
            try:
                await asyncio.wait_for(
                    ready.wait(),
                    timeout=_LISTENER_READY_TIMEOUT,
                )
            except TimeoutError:
                _local_only_channels.add(channel)
                logger.warning(
                    "Redis listener {} 就绪超时，回退到进程内模式",
                    channel,
                )
                await _stop_listener(channel)
            except asyncio.CancelledError:
                await asyncio.shield(unsubscribe(channel, sub_id))
                raise

    return q


async def unsubscribe(channel: str, sub_id: str) -> None:
    """取消订阅"""
    subs = _local_subs.get(channel, {})
    subs.pop(sub_id, None)

    # 频道无订阅者时，停止 Redis 监听并清理
    if not subs:
        _local_subs.pop(channel, None)
        await _stop_listener(channel)
        _local_only_channels.discard(channel)
        _channel_locks.pop(channel, None)


async def shutdown_pubsub() -> None:
    """应用关闭时清理所有 Redis 订阅和后台任务"""
    for channel in list(_listener_tasks):
        await _stop_listener(channel)
    _local_subs.clear()
    _listener_ready.clear()
    _local_only_channels.clear()
    _channel_locks.clear()
    logger.info("pubsub 已关闭")


# ── 内部实现 ──────────────────────────────────────────────

async def _is_redis_available() -> bool:
    """检测 Redis pub/sub 是否可用（带 TTL 缓存，每 60s 重新检查）"""
    global _redis_available, _redis_checked_at
    now = time.monotonic()
    if _redis_available is not None and (now - _redis_checked_at) < _REDIS_CHECK_TTL:
        return _redis_available
    try:
        from app.core.config import settings
        if not getattr(settings, "SSE_REDIS_PUBSUB_ENABLED", True):
            _redis_available = False
            _redis_checked_at = now
            logger.info("SSE Redis pub/sub 已通过配置禁用，使用进程内模式")
            return False
        from app.utils.cache import cache
        client = await cache.get_client()
        await client.ping()  # type: ignore[misc]
        _redis_available = True
        logger.debug("SSE pub/sub Redis 检查通过")
    except Exception:
        _redis_available = False
        logger.warning("Redis 不可用，SSE pub/sub 降级为进程内模式（仅单 worker）")
    _redis_checked_at = now
    return _redis_available


def _local_publish(channel: str, event: dict) -> None:
    """进程内直接分发到本地 Queue（降级路径）"""
    subs = _local_subs.get(channel, {})
    for q in subs.values():
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass  # SSE 队列满时丢弃事件，避免阻塞


async def _redis_listener(channel: str) -> None:
    """后台协程：监听 Redis 频道，将消息分发到本地 Queue"""
    global _redis_available, _redis_checked_at
    redis_channel = f"{CHANNEL_PREFIX}{channel}"
    ps = None
    ready = _listener_ready.get(channel)
    lock = _channel_locks.setdefault(channel, asyncio.Lock())
    try:
        from app.utils.cache import cache
        client = await cache.get_client()
        ps = client.pubsub()
        async with lock:
            await ps.subscribe(redis_channel)
            _redis_pubsubs[channel] = ps
            if ready is not None:
                ready.set()
        logger.debug("Redis listener 已启动: {}", redis_channel)

        while True:
            try:
                msg = await ps.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if msg and msg.get("type") == "message":
                    try:
                        data = msg["data"]
                        # redis.asyncio decode_responses=True 时 data 已是 str
                        event = json.loads(data) if isinstance(data, str) else json.loads(data.decode())
                        _local_publish(channel, event)
                    except (json.JSONDecodeError, KeyError, UnicodeDecodeError):
                        logger.warning("Redis listener 收到无法解析的消息: %s", msg)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.warning("Redis listener {} 读取异常，1s 后重试", redis_channel, exc_info=True)
                await asyncio.sleep(1)
    except asyncio.CancelledError:
        pass
    except Exception:
        # 只降级当前频道。其他频道已有的 Redis listener 仍可继续工作；
        # 同时让下一次全局探测重新 ping，而不是缓存 60 秒失败状态。
        _local_only_channels.add(channel)
        _redis_available = None
        _redis_checked_at = 0.0
        logger.exception("Redis listener {} 异常退出，回退到进程内模式", redis_channel)
    finally:
        if ready is not None:
            ready.set()
        _listener_ready.pop(channel, None)
        _redis_pubsubs.pop(channel, None)
        _listener_tasks.pop(channel, None)
        if ps is not None:
            await _close_pubsub(ps, redis_channel)
        logger.debug("Redis listener 已停止: {}", redis_channel)


async def _stop_listener(channel: str) -> None:
    """停止指定频道的 Redis 监听协程"""
    _listener_ready.pop(channel, None)
    task = _listener_tasks.pop(channel, None)
    if task is not None:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
    ps = _redis_pubsubs.pop(channel, None)
    if ps is not None:
        await _close_pubsub(ps, f"{CHANNEL_PREFIX}{channel}")


async def _close_pubsub(ps: object, redis_channel: str) -> None:
    """尽力取消订阅，并确保 unsubscribe 失败时仍关闭底层连接。"""
    try:
        await ps.unsubscribe(redis_channel)  # type: ignore[union-attr]
    except Exception:
        logger.debug("Redis pubsub 取消订阅失败: {}", redis_channel, exc_info=True)

    close = getattr(ps, "aclose", None) or getattr(ps, "close", None)
    if close is not None:
        try:
            await close()
        except Exception:
            logger.debug("Redis pubsub 连接关闭失败: {}", redis_channel, exc_info=True)
