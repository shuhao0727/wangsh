import asyncio
from datetime import datetime
from types import SimpleNamespace

from app.api.endpoints.content.articles import articles
from app.schemas.articles import ArticleWithRelations


class FakeCache:
    def __init__(self):
        self.stored = {}
        self.get_calls = 0
        self.set_calls = 0

    async def get(self, key):
        self.get_calls += 1
        return None

    async def set(self, key, value, expire_seconds=None):
        self.set_calls += 1
        self.stored[key] = value


def make_article(**overrides):
    article = SimpleNamespace(
        id=10,
        title="Hello",
        slug="hello",
        content="body",
        summary=None,
        custom_css=None,
        style_key=None,
        published=True,
        author_id=1,
        category_id=2,
        created_at=datetime(2026, 1, 1, 12, 0, 0),
        updated_at=datetime(2026, 1, 2, 12, 0, 0),
        author=SimpleNamespace(
            id=1,
            username="teacher",
            email="teacher@example.com",
            full_name="Teacher",
        ),
        category=SimpleNamespace(
            id=2,
            name="Category",
            slug="cat",
            description="desc",
        ),
        style=SimpleNamespace(
            key="default",
            title="Default",
            sort_order=1,
            content="css",
            created_at=datetime(2026, 1, 1, 12, 0, 0),
            updated_at=datetime(2026, 1, 2, 12, 0, 0),
        ),
    )
    for key, value in overrides.items():
        setattr(article, key, value)
    return article


def fake_service(article):
    class FakeArticleService:
        @staticmethod
        async def list_articles(**kwargs):
            return {"articles": [article], "total": 1, "total_pages": 1}

        @staticmethod
        async def get_article_by_id(**kwargs):
            return article

        @staticmethod
        async def get_article_by_slug(**kwargs):
            return article

    return FakeArticleService


def install(monkeypatch, article):
    monkeypatch.setattr(articles, "ArticleService", fake_service(article))
    monkeypatch.setattr(articles, "cache", FakeCache())


def test_admin_list_serialization_relations_on_and_off(monkeypatch):
    article = make_article()
    install(monkeypatch, article)

    with_relations = asyncio.run(articles.list_articles(
        page=1,
        size=10,
        published_only=True,
        category_id=None,
        author_id=None,
        include_relations=True,
        db=object(),
        _={},
    ))
    item = with_relations["articles"][0]
    assert item["summary"] == ""
    assert item["author"]["email"] == "teacher@example.com"
    assert item["category"] == {
        "id": 2,
        "name": "Category",
        "slug": "cat",
        "description": "desc",
    }
    assert item["style"]["key"] == "default"
    assert item["tags"] == []

    without_relations = asyncio.run(articles.list_articles(
        page=1,
        size=10,
        published_only=True,
        category_id=None,
        author_id=None,
        include_relations=False,
        db=object(),
        _={},
    ))
    item = without_relations["articles"][0]
    assert item["author"] is None
    assert item["category"] is None
    assert item["style"] is None
    assert item["tags"] == []


def test_get_article_serialization_relations_on_and_off(monkeypatch):
    article = make_article()
    install(monkeypatch, article)

    with_relations = asyncio.run(articles.get_article(
        10,
        include_relations=True,
        db=object(),
        current_user={"id": 1, "role_code": "super_admin"},
    ))
    assert with_relations["category"] == {
        "id": 2,
        "name": "Category",
        "slug": "cat",
    }
    assert "description" not in with_relations["category"]
    assert with_relations["author"]["username"] == "teacher"
    validated = ArticleWithRelations.model_validate(with_relations)
    assert validated.category.slug == "cat"

    without_relations = asyncio.run(articles.get_article(
        10,
        include_relations=False,
        db=object(),
        current_user={"id": 1, "role_code": "super_admin"},
    ))
    assert "author" not in without_relations
    assert "category" not in without_relations
    assert without_relations["style"] is None


def test_get_article_by_slug_serialization_uses_detail_shape(monkeypatch):
    article = make_article()
    install(monkeypatch, article)

    result = asyncio.run(articles.get_article_by_slug(
        "hello",
        include_relations=True,
        db=object(),
        current_user={"id": 1, "role_code": "super_admin"},
    ))

    assert result["category"] == {"id": 2, "name": "Category", "slug": "cat"}
    assert "description" not in result["category"]


def test_public_list_serialization(monkeypatch):
    article = make_article()
    install(monkeypatch, article)

    result = asyncio.run(articles.list_public_articles(
        page=1,
        size=10,
        category_id=None,
        q=None,
        db=object(),
    ))
    item = result["articles"][0]
    assert item["author"]["email"] == "teacher@example.com"
    assert item["category"]["description"] == "desc"
    assert item["tags"] == []


def test_public_list_missing_category_sets_category_id_none(monkeypatch):
    article = make_article(category=None, category_id=99)
    install(monkeypatch, article)

    result = asyncio.run(articles.list_public_articles(
        page=1,
        size=10,
        category_id=None,
        q=None,
        db=object(),
    ))
    item = result["articles"][0]
    assert item["category_id"] is None
    assert item["category"] is None


def test_public_detail_serialization(monkeypatch):
    article = make_article()
    install(monkeypatch, article)

    result = asyncio.run(articles.get_public_article_by_slug("hello", db=object()))

    assert result["author"]["email"] == "teacher@example.com"
    assert result["category"]["description"] == "desc"
    assert result["style"]["key"] == "default"
    assert result["tags"] == []


def test_admin_list_category_slug_falls_back_when_empty(monkeypatch):
    article = make_article(
        category=SimpleNamespace(id=2, name="Category", slug="", description=None),
    )
    install(monkeypatch, article)

    result = asyncio.run(articles.list_articles(
        page=1,
        size=10,
        published_only=True,
        category_id=None,
        author_id=None,
        include_relations=True,
        db=object(),
        _={},
    ))

    assert result["articles"][0]["category"]["slug"] == "category-2"
