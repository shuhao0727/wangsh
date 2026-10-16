"""Pure admin-list serialization; detail/public endpoints keep their contracts."""

from typing import Any


def _serialize_author(author: Any) -> dict[str, Any] | None:
    if not author:
        return None
    return {
        "id": author.id,
        "username": author.username,
        "email": getattr(author, "email", None),
        "full_name": author.full_name if hasattr(author, "full_name") else None,
    }


def _serialize_category(category: Any) -> dict[str, Any] | None:
    if not category:
        return None
    # 列表的空 slug 回退和 description 字段不同于详情接口，不能混用。
    if hasattr(category, "slug") and category.slug:
        category_slug = category.slug
    else:
        category_slug = f"category-{category.id}"
    return {
        "id": category.id,
        "name": category.name,
        "slug": category_slug,
        "description": category.description if hasattr(category, "description") else None,
    }


def _serialize_style(style: Any) -> dict[str, Any] | None:
    if not style:
        return None
    return {
        "key": style.key,
        "title": style.title or "",
        "sort_order": style.sort_order or 0,
        "content": style.content or "",
        "created_at": style.created_at.isoformat(),
        "updated_at": style.updated_at.isoformat(),
    }


def _serialize_admin_article(article: Any, include_relations: bool) -> dict[str, Any]:
    # 构建文章字典（匹配Pydantic模型），保留空值与日期字符串的原合同。
    article_dict = {
        "id": article.id,
        "title": article.title or "",
        "slug": article.slug,
        "content": article.content or "",
        "summary": article.summary or "",
        "custom_css": getattr(article, "custom_css", None),
        "style_key": getattr(article, "style_key", None),
        "published": article.published,
        "author_id": article.author_id,  # Article模型有author_id字段
        "category_id": article.category_id,
        "created_at": article.created_at.isoformat(),
        "updated_at": article.updated_at.isoformat(),
    }
    # include_relations=False 时不能访问未加载的 SQLAlchemy 关联对象。
    if include_relations:
        article_dict["author"] = _serialize_author(article.author)
        article_dict["category"] = _serialize_category(article.category)
        article_dict["style"] = _serialize_style(getattr(article, "style", None))
    else:
        article_dict["author"] = None
        article_dict["category"] = None
        article_dict["style"] = None
    # 标签功能已移除，不再返回标签信息。
    article_dict["tags"] = []
    return article_dict


def serialize_admin_article_list(
    articles: list[Any], include_relations: bool,
) -> list[dict[str, Any]]:
    return [_serialize_admin_article(article, include_relations) for article in articles]
