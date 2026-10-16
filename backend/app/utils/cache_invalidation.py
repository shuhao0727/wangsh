"""Domain invalidation through the live cache facade, without Redis lifecycle IO."""

from typing import Optional


async def clear_article_cache(namespace,
    article_id: Optional[int] = None,
    slug: Optional[str] = None
) -> None:
    """清除文章相关缓存"""
    patterns = namespace.ArticleCacheKeys.clear_article(article_id, slug)

    deleted_total = 0
    for pattern in patterns:
        deleted = await namespace.cache.clear_pattern(pattern)
        deleted_total += deleted

    if deleted_total > 0:
        namespace.logger.info(f"清除了 {deleted_total} 个文章相关缓存")


async def clear_all_article_cache(namespace) -> None:
    """清除所有文章缓存"""
    patterns = [
        "articles:*"
    ]

    deleted_total = 0
    for pattern in patterns:
        deleted = await namespace.cache.clear_pattern(pattern)
        deleted_total += deleted

    if deleted_total > 0:
        namespace.logger.info(f"清除了 {deleted_total} 个文章缓存")


async def clear_analysis_cache(namespace,
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
        deleted = await namespace.cache.clear_pattern(pattern)
        deleted_total += deleted

    if deleted_total > 0:
        namespace.logger.info(f"清除了 {deleted_total} 个分析相关缓存")
