import asyncio
from types import SimpleNamespace

from app.schemas.articles import ArticleUpdate
from app.services.articles.article import ArticleService


class FakeDb:
    def __init__(self):
        self.values = None
        self.committed = False

    async def execute(self, stmt):
        self.values = stmt.compile().params
        return None

    async def commit(self):
        self.committed = True


def _install_fake_get(monkeypatch):
    article = SimpleNamespace(id=1, slug="test-slug")

    async def fake_get_article_by_id(*args, **kwargs):
        return article

    monkeypatch.setattr(ArticleService, "get_article_by_id", fake_get_article_by_id)
    return article


def test_update_article_explicit_null_clears_optional_fields(monkeypatch):
    article = _install_fake_get(monkeypatch)
    db = FakeDb()
    article_data = ArticleUpdate(
        summary=None,
        custom_css=None,
        style_key=None,
        category_id=None,
    )

    result = asyncio.run(ArticleService.update_article(db, 1, article_data))

    assert result is article
    assert db.values["summary"] is None
    assert db.values["custom_css"] is None
    assert db.values["style_key"] is None
    assert db.values["category_id"] is None
    assert db.committed


def test_update_article_omitted_fields_are_not_written(monkeypatch):
    _install_fake_get(monkeypatch)
    db = FakeDb()
    article_data = ArticleUpdate(title="New title")

    asyncio.run(ArticleService.update_article(db, 1, article_data))

    assert db.values["title"] == "New title"
    assert "summary" not in db.values
    assert "custom_css" not in db.values
    assert "style_key" not in db.values
    assert "category_id" not in db.values
