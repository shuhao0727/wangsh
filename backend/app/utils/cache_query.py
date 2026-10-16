"""Cached query execution with dependencies resolved through the live facade.

The namespace is injected by app.utils.cache: monkeypatching its cache, key
formatter or logger continues to affect already-decorated functions.
"""

from typing import Any, List, Optional


def query_cache_decorator(
    prefix: str,
    expire_seconds: int,
    ignore_args: Optional[List[str]],
    namespace: Any,
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
                # 简单处理：只考虑关键字参数
                pass

            # 移除忽略的参数
            if ignore_args:
                for arg in ignore_args:
                    cache_kwargs.pop(arg, None)

            # 生成缓存键
            key = namespace.cache_key_generator(prefix, **cache_kwargs)

            # 尝试从缓存获取
            cached_value = await namespace.cache.get(key)
            if cached_value is not None:
                namespace.logger.debug(f"缓存命中: {key}")
                return cached_value

            # 缓存未命中，执行函数
            namespace.logger.debug(f"缓存未命中: {key}")
            result = await func(*args, **kwargs)

            # 缓存结果
            if result is not None:
                await namespace.cache.set(key, result, expire_seconds)

            return result

        return wrapper

    return decorator
