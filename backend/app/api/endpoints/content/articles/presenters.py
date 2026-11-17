"""文章响应序列化辅助函数，供管理端与公开端点复用。"""

from typing import Any, Dict, Optional


def article_base_dict(article: Any) -> Dict[str, Any]:
    return {
        "id": article.id,
        "title": article.title or "",
        "slug": article.slug,
        "content": article.content or "",
        "summary": article.summary or "",
        "custom_css": getattr(article, "custom_css", None),
        "style_key": getattr(article, "style_key", None),
        "published": article.published,
        "author_id": article.author_id,
        "category_id": article.category_id,
        "created_at": article.created_at.isoformat(),
        "updated_at": article.updated_at.isoformat(),
    }


def article_author_dict(article: Any) -> Optional[Dict[str, Any]]:
    if not article.author:
        return None
    return {
        "id": article.author.id,
        "username": article.author.username,
        "email": getattr(article.author, "email", None),
        "full_name": article.author.full_name if hasattr(article.author, "full_name") else None,
    }


def article_category_dict(
    article: Any,
    *,
    include_description: bool,
    name_or_empty: bool,
    slug_fallback: bool,
) -> Optional[Dict[str, Any]]:
    category = getattr(article, "category", None)
    if not category:
        return None
    if slug_fallback:
        slug = category.slug if getattr(category, "slug", None) else f"category-{category.id}"
    else:
        slug = category.slug if hasattr(category, "slug") else f"category-{category.id}"
    data: Dict[str, Any] = {
        "id": category.id,
        "name": (category.name or "") if name_or_empty else category.name,
        "slug": slug,
    }
    if include_description:
        data["description"] = category.description if hasattr(category, "description") else None
    return data


def article_style_dict(article: Any) -> Optional[Dict[str, Any]]:
    style = getattr(article, "style", None)
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
