"""
Redis缓存工具
为FastAPI应用提供简单的Redis缓存功能
"""

import json
import asyncio
from typing import Any, Optional, Dict, List, Union
from datetime import timedelta
import logging

import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis缓存客户端封装"""
    
    _instance: Optional["RedisCache"] = None
    _client: Optional[redis.Redis] = None
    _initialized: bool = False
    _loop: Optional[asyncio.AbstractEventLoop] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._client = None
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """初始化方法（单例模式下只调用一次）"""
        # 单例模式下，__init__只会在首次创建实例时调用
        pass
    
    async def initialize(self) -> None:
        """初始化Redis连接"""
        if self._initialized and self._client:
            return
            
        try:
            self._loop = asyncio.get_running_loop()
            self._client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB_CACHE,  # 使用配置的Redis数据库索引
                decode_responses=True,  # 自动解码返回的字符串
                socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
                socket_keepalive=True,
                retry_on_timeout=True
            )
            
            # 测试连接
            await self._client.ping()
            self._initialized = True
            logger.info("Redis缓存客户端初始化成功")
            
        except Exception as e:
            logger.error(f"Redis缓存客户端初始化失败: {e}")
            raise
    
    async def get_client(self) -> redis.Redis:
        """获取Redis客户端实例"""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if self._loop is not None and getattr(self._loop, "is_closed", lambda: False)():
            self._client = None
            self._initialized = False
            self._loop = None
        if loop is not None and self._loop is not None and loop is not self._loop:
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
        expire_seconds: Optional[int] = None
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
                result = await client.setex(key, expire_seconds, serialized_value)
            else:
                result = await client.set(key, serialized_value)
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


def cache_key_generator(
    prefix: str, 
    **kwargs
) -> str:
    """生成缓存键（优化版）"""
    if not kwargs:
        return prefix
    
    # 将布尔值转换为数字
    processed_kwargs = {}
    for key, value in kwargs.items():
        if isinstance(value, bool):
            processed_kwargs[key] = 1 if value else 0
        elif value is None:
            processed_kwargs[key] = 0  # 将None转换为0
        else:
            processed_kwargs[key] = value
    
    # 使用固定顺序的键，避免排序开销
    # 注意：调用方需要按固定顺序传递参数
    param_str = ":".join(str(processed_kwargs[key]) for key in sorted(kwargs.keys()))
    return f"{prefix}:{param_str}"


def compact_cache_key_generator(
    prefix: str,
    *args
) -> str:
    """紧凑版缓存键生成器（直接传递参数值）"""
    if not args:
        return prefix
    
    param_str = ":".join(str(arg) for arg in args)
    return f"{prefix}:{param_str}"


# 缓存装饰器
def cache_decorator(
    prefix: str,
    expire_seconds: int = 300,  # 默认5分钟
    ignore_args: Optional[List[str]] = None
):
    """
    缓存装饰器
    
    Args:
        prefix: 缓存键前缀
        expire_seconds: 缓存过期时间（秒）
        ignore_args: 忽略的参数列表（不参与缓存键生成）
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_kwargs = kwargs.copy()
            
            # 从args中提取参数（假设是FastAPI的依赖注入，第一个参数是self或request）
            if args:
                # 如果是类方法，跳过self
                start_idx = 1 if hasattr(args[0], '__class__') else 0
                # 简单处理：只考虑关键字参数
                pass
            
            # 移除忽略的参数
            if ignore_args:
                for arg in ignore_args:
                    cache_kwargs.pop(arg, None)
            
            # 生成缓存键
            key = cache_key_generator(prefix, **cache_kwargs)
            
            # 尝试从缓存获取
            cached_value = await cache.get(key)
            if cached_value is not None:
                logger.debug(f"缓存命中: {key}")
                return cached_value
            
            # 缓存未命中，执行函数
            logger.debug(f"缓存未命中: {key}")
            result = await func(*args, **kwargs)
            
            # 缓存结果
            if result is not None:
                await cache.set(key, result, expire_seconds)
            
            return result
        
        return wrapper
    
    return decorator


# 特定功能的缓存键生成器
class ArticleCacheKeys:
    """文章相关缓存键生成器（优化版）"""
    
    @staticmethod
    def public_list(
        page: int = 1,
        size: int = 20,
        category_id: Optional[int] = None
    ) -> str:
        """公开文章列表缓存键（紧凑版）"""
        return compact_cache_key_generator(
            "articles:p:list",
            page,
            size,
            category_id or 0
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
        author_id: Optional[int] = None
    ) -> str:
        """管理文章列表缓存键（紧凑版）"""
        # 使用固定顺序：page, size, published_only, include_relations, category_id, author_id
        published_num = 1 if published_only else 0
        relation_num = 1 if include_relations else 0
        return compact_cache_key_generator(
            "articles:a:list",
            page,
            size,
            published_num,
            relation_num,
            category_id or 0,
            author_id or 0
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


# 缓存清理工具
async def clear_article_cache(
    article_id: Optional[int] = None,
    slug: Optional[str] = None
) -> None:
    """清除文章相关缓存"""
    patterns = ArticleCacheKeys.clear_article(article_id, slug)
    
    deleted_total = 0
    for pattern in patterns:
        deleted = await cache.clear_pattern(pattern)
        deleted_total += deleted
    
    if deleted_total > 0:
        logger.info(f"清除了 {deleted_total} 个文章相关缓存")


async def clear_all_article_cache() -> None:
    """清除所有文章缓存"""
    patterns = [
        "articles:*"
    ]
    
    deleted_total = 0
    for pattern in patterns:
        deleted = await cache.clear_pattern(pattern)
        deleted_total += deleted
    
    if deleted_total > 0:
        logger.info(f"清除了 {deleted_total} 个文章缓存")


# FastAPI生命周期事件
async def startup_cache():
    """应用启动时初始化缓存"""
    await cache.initialize()
    logger.info("缓存服务启动完成")


async def shutdown_cache():
    """应用关闭时清理缓存连接"""
    await cache.close()
    logger.info("缓存服务已关闭")
