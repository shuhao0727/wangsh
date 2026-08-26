"""ML 学习书服务。"""

import json
from typing import Any, Dict, List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ml.book import MLBook, MLBookChapter
from app.schemas.ml.book import (
    MLBookChapterIn,
    MLBookChapterReorderItem,
    MLBookIn,
)


def _safe_json_loads(value: str | None, fallback: Any = None) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _chapter_out(chapter: MLBookChapter) -> Dict[str, Any]:
    return {
        "id": chapter.id,
        "book_id": chapter.book_id,
        "slug": chapter.slug,
        "chapter_number": chapter.chapter_number,
        "title": chapter.title,
        "summary": chapter.summary,
        "difficulty": chapter.difficulty,
        "estimated_minutes": chapter.estimated_minutes,
        "markdown": chapter.markdown,
        "goals": _safe_json_loads(chapter.goals, []),
        "checklist": _safe_json_loads(chapter.checklist, []),
        "experiments": _safe_json_loads(chapter.experiments, []),
        "glossary": _safe_json_loads(chapter.glossary, []),
        "references": _safe_json_loads(chapter.references, []),
        "prerequisites": _safe_json_loads(chapter.prerequisites, []),
        "keywords": _safe_json_loads(chapter.keywords, []),
        "quiz": _safe_json_loads(chapter.quiz, []),
        "sort_order": chapter.sort_order,
        "enabled": chapter.enabled,
        "created_at": chapter.created_at,
        "updated_at": chapter.updated_at,
    }


def _book_out(book: MLBook) -> Dict[str, Any]:
    return {
        "id": book.id,
        "module_key": book.module_key,
        "title": book.title,
        "subtitle": book.subtitle,
        "description": book.description,
        "audience": book.audience,
        "outcomes": _safe_json_loads(book.outcomes, []),
        "enabled": book.enabled,
        "created_at": book.created_at,
        "updated_at": book.updated_at,
        "chapters": [_chapter_out(ch) for ch in (book.chapters or [])],
    }


async def get_book(db: AsyncSession, module_key: str) -> MLBook:
    """按模块获取书籍（含全部章节）；不存在时抛 404。"""
    stmt = (
        select(MLBook)
        .where(MLBook.module_key == module_key)
        .options(selectinload(MLBook.chapters))
    )
    result = await db.execute(stmt)
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(status_code=404, detail="未找到该模块的书籍")
    return book


async def get_public_book(db: AsyncSession, module_key: str) -> Dict[str, Any]:
    """获取已启用的书籍（含所有已启用章节），供学生端使用。"""
    stmt = (
        select(MLBook)
        .where(MLBook.module_key == module_key, MLBook.enabled.is_(True))
        .options(selectinload(MLBook.chapters))
    )
    result = await db.execute(stmt)
    book = result.scalar_one_or_none()
    if book is None:
        return {"book": None}

    enabled_chapters = [ch for ch in book.chapters if ch.enabled]
    enabled_chapters.sort(key=lambda ch: ch.sort_order)

    return {
        "book": {
            "id": book.id,
            "module_key": book.module_key,
            "title": book.title,
            "subtitle": book.subtitle,
            "description": book.description,
            "audience": book.audience,
            "outcomes": _safe_json_loads(book.outcomes, []),
            "chapters": [_chapter_out(ch) for ch in enabled_chapters],
        }
    }


async def get_admin_book(db: AsyncSession, module_key: str) -> Dict[str, Any]:
    """获取书籍完整数据（含所有章节）；不存在时返回 book=None。"""
    try:
        book = await get_book(db, module_key)
    except HTTPException:
        return {"book": None}
    return {"book": _book_out(book)}


async def upsert_book(db: AsyncSession, module_key: str, data: MLBookIn) -> Dict[str, Any]:
    """创建或更新书籍元数据。"""
    stmt = select(MLBook).where(MLBook.module_key == module_key)
    result = await db.execute(stmt)
    book = result.scalar_one_or_none()

    if book is None:
        book = MLBook(module_key=module_key)
        db.add(book)

    book.title = data.title
    book.subtitle = data.subtitle
    book.description = data.description
    book.audience = data.audience
    book.outcomes = json.dumps(data.outcomes, ensure_ascii=False)
    book.enabled = data.enabled

    await db.commit()
    await db.refresh(book)

    book = await get_book(db, module_key)
    return {"book": _book_out(book)}


async def get_chapter(db: AsyncSession, module_key: str, slug: str) -> Dict[str, Any]:
    """获取单个章节。"""
    book = await get_book(db, module_key)
    chapter = next((ch for ch in book.chapters if ch.slug == slug), None)
    if chapter is None:
        raise HTTPException(status_code=404, detail="未找到该章节")
    return {"chapter": _chapter_out(chapter)}


async def upsert_chapter(
    db: AsyncSession, module_key: str, slug: str, data: MLBookChapterIn
) -> Dict[str, Any]:
    """创建或更新章节。"""
    book = await get_book(db, module_key)

    stmt = select(MLBookChapter).where(
        MLBookChapter.book_id == book.id,
        MLBookChapter.slug == slug,
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()

    if chapter is None:
        chapter = MLBookChapter(book_id=book.id, slug=slug)
        db.add(chapter)

    chapter.chapter_number = data.chapter_number
    chapter.title = data.title
    chapter.summary = data.summary
    chapter.difficulty = data.difficulty
    chapter.estimated_minutes = data.estimated_minutes
    chapter.markdown = data.markdown
    chapter.goals = json.dumps(data.goals, ensure_ascii=False) if data.goals else None
    chapter.checklist = json.dumps(data.checklist, ensure_ascii=False) if data.checklist else None
    chapter.experiments = json.dumps(data.experiments, ensure_ascii=False) if data.experiments else None
    chapter.glossary = json.dumps(data.glossary, ensure_ascii=False) if data.glossary else None
    chapter.references = json.dumps(data.references, ensure_ascii=False) if data.references else None
    chapter.prerequisites = json.dumps(data.prerequisites, ensure_ascii=False) if data.prerequisites else None
    chapter.keywords = json.dumps(data.keywords, ensure_ascii=False) if data.keywords else None
    chapter.quiz = json.dumps(data.quiz, ensure_ascii=False) if data.quiz else None
    chapter.sort_order = data.sort_order
    chapter.enabled = data.enabled

    await db.commit()
    await db.refresh(chapter)
    return {"chapter": _chapter_out(chapter)}


async def delete_chapter(db: AsyncSession, module_key: str, slug: str) -> Dict[str, Any]:
    """删除章节。"""
    book = await get_book(db, module_key)

    stmt = select(MLBookChapter).where(
        MLBookChapter.book_id == book.id,
        MLBookChapter.slug == slug,
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    if chapter is None:
        raise HTTPException(status_code=404, detail="未找到该章节")

    await db.delete(chapter)
    await db.commit()
    return {"message": "章节已删除"}


async def reorder_chapters(
    db: AsyncSession, module_key: str, items: List[MLBookChapterReorderItem]
) -> Dict[str, Any]:
    """批量重新排序章节。"""
    book = await get_book(db, module_key)

    slug_map = {item.slug: item.chapter_number for item in items}
    for chapter in book.chapters:
        if chapter.slug in slug_map:
            chapter.chapter_number = slug_map[chapter.slug]
            chapter.sort_order = slug_map[chapter.slug]

    await db.commit()
    return {"message": f"已更新 {len(slug_map)} 个章节的排序"}


async def toggle_chapter(
    db: AsyncSession, module_key: str, slug: str, enabled: bool
) -> Dict[str, Any]:
    """启用或禁用章节。"""
    book = await get_book(db, module_key)

    chapter = next((ch for ch in book.chapters if ch.slug == slug), None)
    if chapter is None:
        raise HTTPException(status_code=404, detail="未找到该章节")

    chapter.enabled = enabled
    await db.commit()
    await db.refresh(chapter)
    return {"chapter": _chapter_out(chapter)}
