import asyncio
from typing import Any

from app.models.articles.markdown_style import MarkdownStyle
from app.services.articles.markdown_style_examples import (
    STYLE_EXAMPLES,
    ensure_style_examples,
)


class _ScalarResult:
    def __init__(self, value: MarkdownStyle | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> MarkdownStyle | None:
        return self._value


class _InMemoryStyleSession:
    def __init__(self, styles: list[MarkdownStyle] | None = None) -> None:
        self.styles = {style.key: style for style in styles or []}

    async def execute(self, statement: Any) -> _ScalarResult:
        key = next(iter(statement.compile().params.values()))
        return _ScalarResult(self.styles.get(key))

    def add(self, style: MarkdownStyle) -> None:
        self.styles[style.key] = style

    async def commit(self) -> None:
        return None

    async def refresh(self, _style: MarkdownStyle) -> None:
        return None


def test_ensure_style_examples_creates_missing_defaults() -> None:
    db = _InMemoryStyleSession()

    asyncio.run(ensure_style_examples(db))

    assert set(db.styles) == {item["key"] for item in STYLE_EXAMPLES}
    for item in STYLE_EXAMPLES:
        style = db.styles[item["key"]]
        assert style.title == item["title"]
        assert style.content == item["content"]
        assert style.sort_order == item["sort_order"]


def test_ensure_style_examples_keeps_existing_style_unchanged() -> None:
    custom_style = MarkdownStyle(
        key="terminal",
        title="管理员自定义标题",
        content=".ws-markdown { color: hotpink; }",
        sort_order=777,
    )
    db = _InMemoryStyleSession([custom_style])

    asyncio.run(ensure_style_examples(db))

    assert db.styles["terminal"] is custom_style
    assert custom_style.title == "管理员自定义标题"
    assert custom_style.content == ".ws-markdown { color: hotpink; }"
    assert custom_style.sort_order == 777
    assert {"paper", "minimal"} <= set(db.styles)
