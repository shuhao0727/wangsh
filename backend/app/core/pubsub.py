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
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "sse:"

# ── 本地状态 ──────────────────────────────────────────────
# channel -> {sub_id: asyncio.Queue}
_local_subs: Dict[str, Dict[str, asyncio.Queue]] = {}
# channel -> 后台监听 Task
_listener_tasks: Dict[str, asyncio.Task] = {}
# channel -> Redis PubSub 对象
_redis_pubsubs: Dict[str, object] = {}

# Redis 可用性缓存（None = 未检测）
_redis_available: Optional[bool] = None


# ── 公共 API ──────────────────────────────────────────────

async def publish(channel: str, event: dict) -> None:
    """向指定频道发布事件（优先 Redis，降级进程内）"""
    # 1. 尝试 Redis
    if await _is_redis_available():
        try:
            from app.utils.cache import cache  # 延迟导入避免循环依赖
            payload = json.dumps(event, ensure_ascii=False)
            client = await cache.get_client()
            await client.publish(f"{CHANNEL_PREFIX}{channel}", payload)
            return  # Redis 发布成功，由各 worker 的监听协程分发
        except Exception:
            logger.warning("Redis publish 失败，回退到进程内分发", exc_info=True)

    # 2. 降级：进程内直接分发
    _local_publish(channel, event)


async def subscribe(channel: str, sub_id: str) -> asyncio.Queue:
    """订阅频道，返回 asyncio.Queue 供 SSE 端点消费"""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _local_subs.setdefault(channel, {})[sub_id] = q

    # 确保该频道有 Redis 监听协程（首个订阅者触发创建）
    if await _is_redis_available() and channel not in _listener_tasks:
        task = asyncio.create_task(_redis_listener(channel))
        _listener_tasks[channel] = task

    return q


async def unsubscribe(channel: str, sub_id: str) -> None:
    """取消订阅"""
    subs = _local_subs.get(channel, {})
    subs.pop(sub_id, None)

    # 频道无订阅者时，停止 Redis 监听并清理
    if not subs:
        _local_subs.pop(channel, None)
        await _stop_listener(channel)


async def shutdown_pubsub() -> None:
    """应用关闭时清理所有 Redis 订阅和后台任务"""
    for channel in list(_listener_tasks):
        await _stop_listener(channel)
    _local_subs.clear()
    logger.info("pubsub 已关闭")


# ── 内部实现 ──────────────────────────────────────────────

async def _is_redis_available() -> bool:
    """检测 Redis pub/sub 是否可用（结果缓存）"""
    global _redis_available
    if _redis_available is not None:
        return _redis_available
    try:
        from app.core.config import settings
        if not getattr(settings, "SSE_REDIS_PUBSUB_ENABLED", True):
            _redis_available = False
            logger.info("SSE Redis pub/sub 已通过配置禁用，使用进程内模式")
            return False
        from app.utils.cache import cache
        client = await cache.get_client()
        await client.ping()  # type: ignore[misc]
        _redis_available = True
        logger.info("SSE pub/sub 使用 Redis 模式（支持多 worker）")
    except Exception:
        _redis_available = False
        logger.warning("Redis 不可用，SSE pub/sub 降级为进程内模式（仅单 worker）")
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
    redis_channel = f"{CHANNEL_PREFIX}{channel}"
    ps = None
    try:
        from app.utils.cache import cache
        client = await cache.get_client()
        ps = client.pubsub()
        await ps.subscribe(redis_channel)
        _redis_pubsubs[channel] = ps
        logger.debug("Redis listener 已启动: %s", redis_channel)

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
                logger.warning("Redis listener %s 读取异常，1s 后重试", redis_channel, exc_info=True)
                await asyncio.sleep(1)
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("Redis listener %s 异常退出", redis_channel)
    finally:
        _redis_pubsubs.pop(channel, None)
        _listener_tasks.pop(channel, None)
        if ps is not None:
            try:
                await ps.unsubscribe(redis_channel)
                await ps.close()
            except Exception:
                pass
        logger.debug("Redis listener 已停止: %s", redis_channel)


async def _stop_listener(channel: str) -> None:
    """停止指定频道的 Redis 监听协程"""
    task = _listener_tasks.pop(channel, None)
    if task is not None:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
    ps = _redis_pubsubs.pop(channel, None)
    if ps is not None:
        try:
            await ps.unsubscribe(f"{CHANNEL_PREFIX}{channel}")  # type: ignore[union-attr]
            await ps.close()  # type: ignore[union-attr]
        except Exception:
            pass
