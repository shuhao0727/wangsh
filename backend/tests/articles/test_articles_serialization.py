"""Article contracts extracted from the mixed utilities suite for atomic delivery."""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from app.api.endpoints.content.articles import articles as articles_api

def _article(**extra):
    now = datetime(2026, 1, 2, tzinfo=timezone.utc)
    values = dict(id=7, title=None, slug="article", content=None, summary=None, published=True,
                  author_id=3, category_id=4, created_at=now, updated_at=now,
                  author=None, category=None, style=None)
    values.update(extra)
    return SimpleNamespace(**values)


@pytest.mark.parametrize("include_relations", [False, True])
@pytest.mark.parametrize("present_relations", [False, True])
def test_admin_list_response_and_ttl_stay_compatible(monkeypatch, include_relations, present_relations):
    now = datetime(2026, 1, 2, tzinfo=timezone.utc)
    article = _article(author=SimpleNamespace(id=3, username="author"),
                       category=SimpleNamespace(id=4, name=None, slug=""),
                       style=SimpleNamespace(key="style", title=None, sort_order=None, content=None, created_at=now, updated_at=now))
    if not present_relations:
        article.author = article.category = article.style = None
    get = AsyncMock(return_value=None)
    set_value = AsyncMock(return_value=True)
    service = AsyncMock(return_value={"total": 1, "articles": [article], "total_pages": 1})
    monkeypatch.setattr(articles_api.cache, "get", get)
    monkeypatch.setattr(articles_api.cache, "set", set_value)
    monkeypatch.setattr(articles_api.ArticleService, "list_articles", service)
    result = asyncio.run(articles_api.list_articles(
        page=1, size=20, published_only=False, category_id=None, author_id=None,
        search="q", include_relations=include_relations, db=object(), _={"role_code": "super_admin"},
    ))
    row = result["articles"][0]
    assert result["total"] == 1 and result["page"] == 1 and result["size"] == 20
    assert row["title"] == row["content"] == row["summary"] == ""
    assert row["created_at"] == now.isoformat() and row["tags"] == []
    assert row["category_id"] == 4 and row["custom_css"] is None and row["style_key"] is None
    if include_relations and present_relations:
        assert row["author"] == {"id": 3, "username": "author", "email": None, "full_name": None}
        assert row["category"] == {"id": 4, "name": None, "slug": "category-4", "description": None}
        assert row["style"]["title"] == row["style"]["content"] == ""
        assert row["style"]["sort_order"] == 0
    else:
        assert row["author"] is row["category"] is row["style"] is None
    assert set_value.await_args.kwargs == {"expire_seconds": articles_api.settings.ARTICLE_CACHE_ADMIN_LIST_TTL}
    assert set_value.await_args.args[1] is result


def test_admin_list_without_relations_does_not_touch_lazy_properties(monkeypatch):
    class LazyArticle:
        def __init__(self):
            self.__dict__.update(_article().__dict__)
            for key in ("author", "category", "style"):
                del self.__dict__[key]

        def __getattr__(self, name):
            if name in ("author", "category", "style"):
                raise AssertionError("Lazy relationship must not be read")
            raise AttributeError(name)

    monkeypatch.setattr(articles_api.cache, "get", AsyncMock(return_value=None))
    monkeypatch.setattr(articles_api.cache, "set", AsyncMock())
    monkeypatch.setattr(articles_api.ArticleService, "list_articles", AsyncMock(return_value={"total": 1, "articles": [LazyArticle()], "total_pages": 1}))
    result = asyncio.run(articles_api.list_articles(page=1, size=20, published_only=False, category_id=None, author_id=None,
                         search=None, include_relations=False, db=object(), _={"role_code": "super_admin"}))
    assert result["articles"][0]["author"] is None


@pytest.mark.parametrize("role", ["super_admin", "admin", "student"])
def test_draft_permission_and_role_cache_partition_stay_compatible(monkeypatch, role):
    get = AsyncMock(return_value=None)
    set_value = AsyncMock()
    monkeypatch.setattr(articles_api.cache, "get", get)
    monkeypatch.setattr(articles_api.cache, "set", set_value)
    monkeypatch.setattr(articles_api.ArticleService, "get_article_by_id", AsyncMock(return_value=_article(published=False)))
    request = articles_api.get_article(7, include_relations=False, db=object(), current_user={"id": 9, "role_code": role})
    if role == "super_admin":
        assert asyncio.run(request)["published"] is False
        assert set_value.await_args.args[2] == articles_api.settings.ARTICLE_CACHE_ADMIN_DETAIL_TTL
        assert get.await_args.args[0] == "articles:a:detail:id:7:0"
    else:
        with pytest.raises(HTTPException) as caught:
            asyncio.run(request)
        assert caught.value.status_code == 403
        assert caught.value.detail == "没有权限查看未发布的文章"
        assert get.await_args.args[0] == "articles:u:detail:id:7:9:0"
        set_value.assert_not_called()
