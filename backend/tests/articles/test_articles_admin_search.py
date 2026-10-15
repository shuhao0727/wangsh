"""管理员文章搜索回归测试。"""

import asyncio

from app.api.endpoints.content.articles import articles as articles_api


def test_admin_article_list_forwards_search_and_partitions_cache(monkeypatch):
    captured = {}

    async def fake_cache_get(key):
        captured["cache_key"] = key
        return None

    async def fake_cache_set(_key, _value, expire_seconds=None):
        captured["expire_seconds"] = expire_seconds
        return True

    async def fake_list_articles(**kwargs):
        captured.update(kwargs)
        return {"total": 0, "articles": [], "total_pages": 1}

    monkeypatch.setattr(articles_api.cache, "get", fake_cache_get)
    monkeypatch.setattr(articles_api.cache, "set", fake_cache_set)
    monkeypatch.setattr(articles_api.ArticleService, "list_articles", fake_list_articles)

    result = asyncio.run(
        articles_api.list_articles(
            page=2,
            size=10,
            published_only=False,
            category_id=None,
            author_id=None,
            search="python",
            include_relations=True,
            db=object(),
            _={"role_code": "super_admin"},
        )
    )

    assert result["total"] == 0
    assert captured["search"] == "python"
    assert captured["page"] == 2
    assert captured["size"] == 10
    assert captured["include_relations"] is True
    assert captured["cache_key"].endswith(":python")
