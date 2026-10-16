"""
Redis缓存工具
为FastAPI应用提供简单的Redis缓存功能
"""

from typing import Optional

from loguru import logger

from app.utils.cache_helpers import (  # 有意回导，保持原导入路径
    AnalysisCacheKeys,
    ArticleCacheKeys,
    RedisCache,
    cache_decorator,
    cache_key_generator,
    compact_cache_key_generator,
)


# 全局缓存实例 - 添加类型注释帮助类型检查器
cache: RedisCache = RedisCache()  # type: ignore[awaitable-is-bool]


# 缓存装饰器
# 特定功能的缓存键生成器
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


async def clear_analysis_cache(
    analysis_type: Optional[str] = None,
    analysis_id: Optional[int] = None
) -> None:
    """清除分析相关缓存

    Args:
        analysis_type: 分析类型 (hot/chain/task)，None 表示清除所有
        analysis_id: 分析记录ID，None 表示清除该类型所有缓存
    """
    patterns = []

    if analysis_type is None:
        # 清除所有分析缓存
        patterns.append("analysis:*")
    else:
        if analysis_id:
            # 清除特定分析记录的缓存
            patterns.append(f"analysis:{analysis_type}:{analysis_id}")

        # 清除该类型的列表缓存和趋势缓存
        patterns.append(f"analysis:{analysis_type}:list:*")
        patterns.append(f"analysis:trends:*:{analysis_type}:*")

    deleted_total = 0
    for pattern in patterns:
        deleted = await cache.clear_pattern(pattern)
        deleted_total += deleted

    if deleted_total > 0:
        logger.info(f"清除了 {deleted_total} 个分析相关缓存")


# FastAPI生命周期事件
async def startup_cache():
    """应用启动时初始化缓存"""
    await cache.initialize()
    logger.info("缓存服务启动完成")


async def shutdown_cache():
    """应用关闭时清理缓存连接"""
    await cache.close()
    logger.info("缓存服务已关闭")
