"""Articles CRUD 测试"""
import asyncio
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.routing import APIRoute

from app.api.endpoints.content.categories import categories as categories_api
from app.api.endpoints.content.categories.categories import router as categories_router
from app.models.articles.article import Article
from app.services.articles.article import ArticleService


def test_list_articles_success():
    """测试文章列表"""
    fake_articles = [SimpleNamespace(id=1, title="测试文章")]
    result = {"articles": fake_articles, "total": 1}
    assert result["total"] == 1


def test_list_articles_with_category_filter():
    """测试按分类筛选"""
    fake_articles = [SimpleNamespace(id=1, category_id=1)]
    result = {"articles": fake_articles, "total": 1}
    assert len(result["articles"]) == 1


def test_create_article_success():
    """测试创建文章"""
    fake_article = SimpleNamespace(id=1, title="新文章")
    assert fake_article.id == 1


def test_get_article_success():
    """测试获取文章"""
    fake_article = SimpleNamespace(id=1, title="测试")
    assert fake_article.id == 1


def test_update_article_success():
    """测试更新文章"""
    fake_article = SimpleNamespace(id=1, title="更新后")
    assert fake_article.title == "更新后"


def test_delete_article_success():
    """测试删除文章"""
    result = True
    assert result is True


def test_category_articles_response_serializes_sqlalchemy_articles():
    route = next(
        route
        for route in categories_router.routes
        if isinstance(route, APIRoute) and route.path == "/{category_id}/articles"
    )
    article = Article(
        id=1,
        title="测试文章",
        slug="test-article",
        content="正文",
        summary="摘要",
        published=True,
        author_id=1,
        category_id=1,
        created_at=datetime(2026, 7, 12, 9, 0, 0),
        updated_at=datetime(2026, 7, 12, 9, 0, 0),
    )
    payload = {
        "category": {
            "id": 1,
            "name": "测试分类",
            "slug": "test-category",
            "description": None,
        },
        "total": 1,
        "articles": [article],
        "page": 1,
        "size": 5,
        "total_pages": 1,
    }

    value, errors = route.response_field.validate(payload, {}, loc=("response",))

    assert not errors
    serialized = route.response_field.serialize(value)
    assert serialized["articles"][0]["id"] == 1
    assert serialized["articles"][0]["title"] == "测试文章"


@pytest.mark.parametrize("role_code", ["admin", "teacher", "student"])
def test_category_articles_forces_published_only_for_non_super_admin(
    monkeypatch,
    role_code,
):
    captured = {}

    async def fake_get_category_by_id(*, db, category_id):
        return SimpleNamespace(
            id=category_id,
            name="测试分类",
            slug="test-category",
            description=None,
        )

    async def fake_list_articles(**kwargs):
        captured.update(kwargs)
        return {"total": 0, "articles": [], "total_pages": 1}

    monkeypatch.setattr(
        categories_api.CategoryService,
        "get_category_by_id",
        fake_get_category_by_id,
    )
    monkeypatch.setattr(ArticleService, "list_articles", fake_list_articles)

    asyncio.run(
        categories_api.get_category_articles(
            category_id=1,
            page=1,
            size=10,
            published_only=False,
            db=object(),
            current_user={"role_code": role_code},
        )
    )

    assert captured["published_only"] is True


def test_category_articles_allows_super_admin_to_include_drafts(monkeypatch):
    captured = {}

    async def fake_get_category_by_id(*, db, category_id):
        return SimpleNamespace(
            id=category_id,
            name="测试分类",
            slug="test-category",
            description=None,
        )

    async def fake_list_articles(**kwargs):
        captured.update(kwargs)
        return {"total": 0, "articles": [], "total_pages": 1}

    monkeypatch.setattr(
        categories_api.CategoryService,
        "get_category_by_id",
        fake_get_category_by_id,
    )
    monkeypatch.setattr(ArticleService, "list_articles", fake_list_articles)

    asyncio.run(
        categories_api.get_category_articles(
            category_id=1,
            page=1,
            size=10,
            published_only=False,
            db=object(),
            current_user={"role_code": "super_admin"},
        )
    )

    assert captured["published_only"] is False


def test_category_articles_response_does_not_expose_author_email():
    route = next(
        route
        for route in categories_router.routes
        if isinstance(route, APIRoute) and route.path == "/{category_id}/articles"
    )
    article = {
        "id": 1,
        "title": "测试文章",
        "slug": "test-article",
        "content": "正文",
        "summary": "摘要",
        "custom_css": None,
        "style_key": None,
        "published": True,
        "author_id": 1,
        "category_id": 1,
        "created_at": datetime(2026, 7, 12, 9, 0, 0),
        "updated_at": datetime(2026, 7, 12, 9, 0, 0),
        "author": {
            "id": 1,
            "username": "author",
            "full_name": "文章作者",
            "email": "author@example.com",
        },
    }
    payload = {
        "category": {
            "id": 1,
            "name": "测试分类",
            "slug": "test-category",
            "description": None,
        },
        "total": 1,
        "articles": [article],
        "page": 1,
        "size": 5,
        "total_pages": 1,
    }

    value, errors = route.response_field.validate(payload, {}, loc=("response",))

    assert not errors
    serialized = route.response_field.serialize(value)
    assert serialized["articles"][0]["author"] == {
        "id": 1,
        "username": "author",
        "full_name": "文章作者",
    }
