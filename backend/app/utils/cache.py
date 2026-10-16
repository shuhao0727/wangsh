"""
Redis缓存工具
为FastAPI应用提供简单的Redis缓存功能
"""

import asyncio
import json
import os
import sys
from typing import Any, List, Optional

import redis.asyncio as redis
from app.core.config import settings
from app.utils import cache_invalidation as _invalidation
from app.utils.cache_keys import (
    AnalysisCacheKeys,
    cache_key_generator,
    compact_cache_key_generator,
)
from app.utils.cache_query import query_cache_decorator
from app.utils.redis_client import (
    create_async_redis_client,
    create_async_sentinel_client,
)

from loguru import logger


def _optional_setting(name: str, default: Optional[str] = None) -> Optional[str]:
    """Read optional TLS settings without expanding the core config contract."""
    value = getattr(settings, name, None)
    if value not in (None, ""):
        return str(value)
    return os.getenv(name, default)


def _parse_sentinel_hosts(raw_hosts: str) -> list[tuple[str, int]]:
    hosts: list[tuple[str, int]] = []
    for item in raw_hosts.split(","):
        item = item.strip()
        if not item:
            continue
        if ":" in item:
            host, port = item.rsplit(":", 1)
            hosts.append((host.strip(), int(port.strip())))
        else:
            hosts.append((item, 26379))
    return hosts


def _sentinel_connection_options() -> dict[str, Any]:
    """Optional discovery overrides; absent values inherit the data TLS policy."""
    options: dict[str, Any] = {}
    for setting, option in (
        ("REDIS_SENTINEL_SSL", "ssl_enabled"),
        ("REDIS_SENTINEL_SSL_CERT_REQS", "ssl_cert_reqs"),
        ("REDIS_SENTINEL_SSL_CA_CERTS", "ssl_ca_certs"),
        ("REDIS_SENTINEL_SSL_CA_DATA", "ssl_ca_data"),
        ("REDIS_SENTINEL_SSL_CHECK_HOSTNAME", "ssl_check_hostname"),
        ("REDIS_SENTINEL_SSL_CERTFILE", "ssl_certfile"),
        ("REDIS_SENTINEL_SSL_KEYFILE", "ssl_keyfile"),
    ):
        value = _optional_setting(setting)
        if value is None:
            continue
        if option in {"ssl_enabled", "ssl_check_hostname"}:
            normalized = value.lower()
            if normalized not in {"true", "false", "1", "0"}:
                raise ValueError(f"Invalid boolean for {setting}")
            options[option] = normalized in {"true", "1"}
        else:
            options[option] = value
    return options


class RedisCache:
    """Redis缓存客户端封装"""

    _instance: Optional["RedisCache"] = None
    _client: Optional[redis.Redis] = None
    _initialized: bool = False
    _loop: Optional[asyncio.AbstractEventLoop] = None
    _initialize_locks: dict[int, asyncio.Lock] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._client = None
            cls._instance._initialized = False
            cls._instance._initialize_locks = {}
        return cls._instance

    def __init__(self):
        """初始化方法（单例模式下只调用一次）"""
        # 单例模式下，__init__只会在首次创建实例时调用
        pass

    async def initialize(self) -> None:
        """初始化Redis连接（支持连接池和 Sentinel 高可用模式）"""
        if self._initialized and self._client:
            return

        try:
            self._loop = asyncio.get_running_loop()

            if settings.REDIS_SENTINEL_ENABLED and settings.REDIS_SENTINEL_HOSTS:
                self._client = create_async_sentinel_client(
                    sentinels=_parse_sentinel_hosts(settings.REDIS_SENTINEL_HOSTS),
                    master_name=settings.REDIS_SENTINEL_MASTER,
                    sentinel_password=_optional_setting("REDIS_SENTINEL_PASSWORD"),
                    sentinel_options=_sentinel_connection_options(),
                    db=settings.REDIS_DB_CACHE,
                    password=settings.REDIS_PASSWORD,
                    decode_responses=True,
                    socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
                    socket_keepalive=True,
                    max_connections=settings.REDIS_MAX_CONNECTIONS,
                    ssl_enabled=settings.REDIS_SSL,
                    ssl_cert_reqs=settings.REDIS_SSL_CERT_REQS,
                    ssl_ca_certs=_optional_setting("REDIS_SSL_CA_CERTS"),
                    ssl_ca_data=_optional_setting("REDIS_SSL_CA_DATA"),
                    ssl_check_hostname=None,
                    ssl_certfile=_optional_setting("REDIS_SSL_CERTFILE"),
                    ssl_keyfile=_optional_setting("REDIS_SSL_KEYFILE"),
                )
                logger.info(f"Redis Sentinel 模式初始化成功，master={settings.REDIS_SENTINEL_MASTER}")
            else:
                self._client = create_async_redis_client(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB_CACHE,
                    password=settings.REDIS_PASSWORD,
                    decode_responses=True,
                    socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
                    socket_keepalive=True,
                    max_connections=settings.REDIS_MAX_CONNECTIONS,
                    ssl_enabled=settings.REDIS_SSL,
                    ssl_cert_reqs=settings.REDIS_SSL_CERT_REQS,
                    ssl_ca_certs=_optional_setting("REDIS_SSL_CA_CERTS"),
                    ssl_ca_data=_optional_setting("REDIS_SSL_CA_DATA"),
                    ssl_check_hostname=None,
                    ssl_certfile=_optional_setting("REDIS_SSL_CERTFILE"),
                    ssl_keyfile=_optional_setting("REDIS_SSL_KEYFILE"),
                )
                logger.info(f"Redis 单机模式初始化成功，max_connections={settings.REDIS_MAX_CONNECTIONS}")

            # 测试连接
            await asyncio.wait_for(
                self._client.ping(), timeout=max(0.1, settings.REDIS_CONNECT_TIMEOUT)
            )
            self._initialized = True

        except BaseException as e:
            # A failed/cancelled candidate must not leave an owned pool behind.
            failed_client, self._client = self._client, None
            self._initialized = False
            self._loop = None
            if failed_client is not None:
                try:
                    await asyncio.wait_for(failed_client.aclose(), timeout=1.0)
                except (Exception, asyncio.CancelledError):
                    pass
            if not isinstance(e, asyncio.CancelledError):
                logger.error(f"Redis缓存客户端初始化失败: {e}")
            raise

    async def get_client(self) -> redis.Redis:
        """获取 Redis 客户端实例，并在同一事件循环内串行初始化。"""
        loop = asyncio.get_running_loop()
        lock = self._initialize_locks.setdefault(id(loop), asyncio.Lock())
        async with lock:
            if self._loop is not None and getattr(self._loop, "is_closed", lambda: False)():
                self._client = None
                self._initialized = False
                self._loop = None
            if self._loop is not None and loop is not self._loop:
                try:
                    if self._client:
                        await self._client.aclose()
                except Exception:
                    pass
                self._client = None
                self._initialized = False
                self._loop = None
            if not self._initialized or self._client is None:
                await self.initialize()
            if self._client is None:
                raise RuntimeError("Redis客户端初始化失败")
            return self._client

    async def close(self) -> None:
        """关闭Redis连接"""
        if self._client:
            try:
                await self._client.aclose()
            except Exception as e:
                logger.warning(f"Redis关闭连接时出错: {e}")
            finally:
                self._client = None
                self._initialized = False
                self._loop = None
                logger.info("Redis缓存客户端已关闭")

    async def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        try:
            client = await self.get_client()
            value = await client.get(key)
            if value is None:
                return None
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                # 如果不是JSON，直接返回字符串
                return value
        except Exception as e:
            logger.warning(f"Redis获取缓存失败: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        expire_seconds: Optional[int] = None,
        nx: bool = False,
    ) -> bool:
        """设置缓存值"""
        try:
            client = await self.get_client()
            # 序列化值
            if isinstance(value, (dict, list, tuple, int, float, bool, type(None))):
                serialized_value = json.dumps(value, ensure_ascii=False)
            else:
                serialized_value = str(value)

            if expire_seconds:
                result = await client.set(key, serialized_value, ex=expire_seconds, nx=nx)
            else:
                result = await client.set(key, serialized_value, nx=nx)
            return result is True
        except Exception as e:
            logger.warning(f"Redis设置缓存失败: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """删除缓存键"""
        try:
            client = await self.get_client()
            result = await client.delete(key)
            return result > 0
        except Exception as e:
            logger.warning(f"Redis删除缓存失败: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        try:
            client = await self.get_client()
            result = await client.exists(key)
            return result > 0
        except Exception as e:
            logger.warning(f"Redis检查缓存存在失败: {e}")
            return False

    async def clear_pattern(self, pattern: str) -> int:
        """清除匹配模式的缓存键"""
        try:
            client = await self.get_client()
            deleted_total = 0
            cursor: int = 0
            batch: list[str] = []

            while True:
                cursor, keys = await client.scan(cursor=cursor, match=pattern, count=1000)
                if keys:
                    batch.extend(list(keys))
                while len(batch) >= 500:
                    chunk = batch[:500]
                    batch = batch[500:]
                    deleted_total += int(await client.delete(*chunk) or 0)
                if cursor == 0:
                    break

            if batch:
                deleted_total += int(await client.delete(*batch) or 0)

            if deleted_total:
                logger.info(f"清除了 {deleted_total} 个匹配模式 '{pattern}' 的缓存键")
            return deleted_total
        except Exception as e:
            logger.warning(f"Redis清除模式缓存失败: {e}")
            return 0

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """递增计数器"""
        try:
            client = await self.get_client()
            result = await client.incrby(key, amount)
            return result
        except Exception as e:
            logger.warning(f"Redis递增失败: {e}")
            return None

    async def ttl(self, key: str) -> Optional[int]:
        """获取键的剩余生存时间（秒）"""
        try:
            client = await self.get_client()
            ttl = await client.ttl(key)
            # Redis返回-1表示没有过期时间，-2表示键不存在
            if ttl == -1:
                return None  # 永不过期
            elif ttl == -2:
                return None  # 键不存在
            return ttl
        except Exception as e:
            logger.warning(f"Redis获取TTL失败: {e}")
            return None

    async def publish(self, channel: str, message: Any) -> bool:
        try:
            client = await self.get_client()
            value = json.dumps(message, ensure_ascii=False) if isinstance(message, (dict, list, tuple)) else str(message)
            result = await client.publish(channel, value)
            return int(result or 0) >= 0
        except Exception as e:
            logger.warning(f"Redis发布失败: {e}")
            return False


# 全局缓存实例 - 添加类型注释帮助类型检查器
cache: RedisCache = RedisCache()  # type: ignore[awaitable-is-bool]


# 缓存装饰器：保留旧入口以及可 monkeypatch 的模块依赖。
def cache_decorator(
    prefix: str,
    expire_seconds: int = 300,  # 默认5分钟
    ignore_args: Optional[List[str]] = None,
):
    """缓存装饰器；ignore_args 不参与键生成，None 结果不写入缓存。"""
    return query_cache_decorator(
        prefix, expire_seconds, ignore_args, sys.modules[__name__]
    )


# 特定功能的缓存键生成器
class ArticleCacheKeys:
    """文章相关缓存键生成器（优化版）"""

    @staticmethod
    def public_list(
        page: int = 1, size: int = 20, category_id: Optional[int] = None, q: Optional[str] = None
    ) -> str:
        """公开文章列表缓存键（紧凑版）"""
        return compact_cache_key_generator(
            "articles:p:list",
            page,
            size,
            category_id or 0,
            q or "",
        )

    @staticmethod
    def public_detail(slug: str) -> str:
        """公开文章详情缓存键"""
        return f"articles:p:detail:{slug}"

    @staticmethod
    def admin_list(
        page: int = 1,
        size: int = 20,
        published_only: bool = True,
        include_relations: bool = False,
        category_id: Optional[int] = None,
        author_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> str:
        """管理文章列表缓存键（紧凑版）"""
        # 使用固定顺序，搜索词必须参与分区，避免不同结果互相污染。
        published_num = 1 if published_only else 0
        relation_num = 1 if include_relations else 0
        return compact_cache_key_generator(
            "articles:a:list",
            page,
            size,
            published_num,
            relation_num,
            category_id or 0,
            author_id or 0,
            (search or "").strip(),
        )

    @staticmethod
    def article_detail(article_id: int) -> str:
        """文章详情缓存键"""
        return f"articles:detail:{article_id}"

    @staticmethod
    def article_by_slug(slug: str) -> str:
        """文章slug缓存键"""
        return f"articles:slug:{slug}"

    @staticmethod
    def admin_detail_by_id(article_id: int, include_relations: bool = True) -> str:
        """管理员文章详情缓存键（根据ID，紧凑版）"""
        relation_num = 1 if include_relations else 0
        return f"articles:a:detail:id:{article_id}:{relation_num}"

    @staticmethod
    def admin_detail_by_slug(slug: str, include_relations: bool = True) -> str:
        """管理员文章详情缓存键（根据slug，紧凑版）"""
        relation_num = 1 if include_relations else 0
        return f"articles:a:detail:slug:{slug}:{relation_num}"

    @staticmethod
    def user_detail_by_id(article_id: int, user_id: int, include_relations: bool = True) -> str:
        """用户文章详情缓存键（根据ID，包含用户权限，紧凑版）"""
        relation_num = 1 if include_relations else 0
        return f"articles:u:detail:id:{article_id}:{user_id}:{relation_num}"

    @staticmethod
    def user_detail_by_slug(slug: str, user_id: int, include_relations: bool = True) -> str:
        """用户文章详情缓存键（根据slug，包含用户权限，紧凑版）"""
        relation_num = 1 if include_relations else 0
        return f"articles:u:detail:slug:{slug}:{user_id}:{relation_num}"

    @staticmethod
    def clear_article(article_id: Optional[int] = None, slug: Optional[str] = None):
        """清除文章相关缓存（兼容新旧键格式）"""
        patterns = [
            "articles:*:list:*",      # 匹配所有列表
            "articles:*:detail:*",    # 匹配所有详情
            "articles:detail:*",      # 匹配旧版详情键
            "articles:slug:*",        # 匹配旧版slug键
        ]

        if article_id:
            patterns.append(f"articles:detail:{article_id}")
            patterns.append(f"articles:*:detail:id:{article_id}:*")
        if slug:
            patterns.append(f"articles:slug:{slug}")
            patterns.append(f"articles:*:detail:slug:{slug}:*")
            patterns.append(f"articles:p:detail:{slug}")

        return patterns


# 缓存清理工具：保留原签名，helper 动态读取此模块的 cache/keys/logger。
async def clear_article_cache(
    article_id: Optional[int] = None,
    slug: Optional[str] = None,
) -> None:
    """清除文章相关缓存（兼容新旧键格式）。"""
    await _invalidation.clear_article_cache(sys.modules[__name__], article_id, slug)


async def clear_all_article_cache() -> None:
    """清除所有文章缓存。"""
    await _invalidation.clear_all_article_cache(sys.modules[__name__])


async def clear_analysis_cache(
    analysis_type: Optional[str] = None,
    analysis_id: Optional[int] = None,
) -> None:
    """清除分析相关缓存；None 表示全部类型，记录 ID 为可选项。"""
    await _invalidation.clear_analysis_cache(
        sys.modules[__name__], analysis_type, analysis_id
    )


# FastAPI生命周期事件
async def startup_cache():
    """应用启动时初始化缓存"""
    await cache.initialize()
    logger.info("缓存服务启动完成")


async def shutdown_cache():
    """应用关闭时清理缓存连接"""
    await cache.close()
    logger.info("缓存服务已关闭")
