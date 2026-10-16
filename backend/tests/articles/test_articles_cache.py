"""Articles 缓存键和失效行为测试。"""

import asyncio

from app.api.endpoints.content.articles import articles as articles_api
from app.utils.cache import ArticleCacheKeys, clear_article_cache


def test_public_article_list_cache_is_partitioned_by_search_query(monkeypatch):
    cached_values = {}
    service_calls = []

    async def fake_cache_get(key):
        return cached_values.get(key)

    async def fake_cache_set(key, value, expire_seconds=None):
        cached_values[key] = value
        return True

    async def fake_list_articles(**kwargs):
        search = kwargs["search"]
        service_calls.append(search)
        totals = {None: 2, "smoke": 0, "python": 1}
        return {
            "total": totals[search],
            "articles": [],
            "total_pages": 1,
        }

    monkeypatch.setattr(articles_api.cache, "get", fake_cache_get)
    monkeypatch.setattr(articles_api.cache, "set", fake_cache_set)
    monkeypatch.setattr(
        articles_api.ArticleService,
        "list_articles",
        fake_list_articles,
    )

    async def run_requests():
        smoke = await articles_api.list_public_articles(
            page=1,
            size=20,
            category_id=None,
            q="smoke",
            db=object(),
        )
        unfiltered = await articles_api.list_public_articles(
            page=1,
            size=20,
            category_id=None,
            q=None,
            db=object(),
        )
        python = await articles_api.list_public_articles(
            page=1,
            size=20,
            category_id=None,
            q="python",
            db=object(),
        )
        smoke_cached = await articles_api.list_public_articles(
            page=1,
            size=20,
            category_id=None,
            q="smoke",
            db=object(),
        )
        unfiltered_cached = await articles_api.list_public_articles(
            page=1,
            size=20,
            category_id=None,
            q=None,
            db=object(),
        )
        return smoke, unfiltered, python, smoke_cached, unfiltered_cached

    smoke, unfiltered, python, smoke_cached, unfiltered_cached = asyncio.run(
        run_requests()
    )

    assert smoke["total"] == smoke_cached["total"] == 0
    assert unfiltered["total"] == unfiltered_cached["total"] == 2
    assert python["total"] == 1
    assert service_calls == ["smoke", None, "python"]
    assert len(cached_values) == 3


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
