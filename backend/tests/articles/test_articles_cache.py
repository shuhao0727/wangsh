"""Articles 缓存键和失效行为测试。"""

import asyncio

from app.utils.cache import ArticleCacheKeys, clear_article_cache


def test_article_cache_patterns_cover_shared_and_targeted_keys():
    patterns = ArticleCacheKeys.clear_article(article_id=12, slug="hello-world")

    assert "articles:*:list:*" in patterns
    assert "articles:*:detail:*" in patterns
    assert "articles:*:detail:id:12:*" in patterns
    assert "articles:*:detail:slug:hello-world:*" in patterns
    assert "articles:p:detail:hello-world" in patterns


def test_clear_article_cache_clears_every_generated_pattern(monkeypatch):
    cleared_patterns = []

    async def fake_clear_pattern(pattern):
        cleared_patterns.append(pattern)
        return 1

    monkeypatch.setattr("app.utils.cache.cache.clear_pattern", fake_clear_pattern)

    asyncio.run(clear_article_cache(article_id=7, slug="cached-article"))

    assert cleared_patterns == ArticleCacheKeys.clear_article(7, "cached-article")
