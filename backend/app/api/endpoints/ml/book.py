"""ML 学习书 API。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.schemas.ml.book import (
    MLBookChapterIn,
    MLBookChapterReorderIn,
    MLBookIn,
    MLBookToggleIn,
)
from app.schemas.user_info import UserInfo
from app.services.ml import book_service as book_svc

VALID_MODULE_KEYS = ("ml", "ai", "agents")

public_router = APIRouter()
admin_router = APIRouter(prefix="/admin/ml/book", tags=["ml-book-admin"])


def _validate_module_key(module_key: str) -> None:
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(status_code=400, detail="无效的模块标识，仅支持: ml, ai, agents")


# ═══════════════════ 公开 API ═══════════════════

@public_router.get("/ml/book/{module_key}")
async def get_public_book(module_key: str, db: AsyncSession = Depends(get_db)):
    """获取已启用的书籍（含所有已启用章节），供学生端使用。"""
    _validate_module_key(module_key)
    return await book_svc.get_public_book(db, module_key)


# ═══════════════════ 管理 API ═══════════════════

@admin_router.get("/{module_key}")
async def get_admin_book(
    module_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    """获取书籍完整数据（含所有章节）。"""
    _validate_module_key(module_key)
    return await book_svc.get_admin_book(db, module_key)


@admin_router.put("/{module_key}")
async def upsert_book(
    module_key: str,
    data: MLBookIn,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    """创建或更新书籍元数据。"""
    _validate_module_key(module_key)
    return await book_svc.upsert_book(db, module_key, data)


@admin_router.get("/{module_key}/chapters/{slug}")
async def get_chapter(
    module_key: str,
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    """获取单个章节。"""
    _validate_module_key(module_key)
    return await book_svc.get_chapter(db, module_key, slug)


@admin_router.put("/{module_key}/chapters/{slug}")
async def upsert_chapter(
    module_key: str,
    slug: str,
    data: MLBookChapterIn,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    """创建或更新章节。"""
    _validate_module_key(module_key)
    if data.slug != slug:
        raise HTTPException(status_code=400, detail="路径参数 slug 与请求体不一致")
    return await book_svc.upsert_chapter(db, module_key, slug, data)


@admin_router.delete("/{module_key}/chapters/{slug}")
async def delete_chapter(
    module_key: str,
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    """删除章节。"""
    _validate_module_key(module_key)
    return await book_svc.delete_chapter(db, module_key, slug)


@admin_router.patch("/{module_key}/chapters/reorder")
async def reorder_chapters(
    module_key: str,
    data: MLBookChapterReorderIn,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    """批量重新排序章节。"""
    _validate_module_key(module_key)
    return await book_svc.reorder_chapters(db, module_key, data.items)


@admin_router.patch("/{module_key}/chapters/{slug}/toggle")
async def toggle_chapter(
    module_key: str,
    slug: str,
    data: MLBookToggleIn,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
):
    """启用或禁用章节。"""
    _validate_module_key(module_key)
    return await book_svc.toggle_chapter(db, module_key, slug, data.enabled)


# 合并路由器
router = APIRouter()
router.include_router(public_router)
router.include_router(admin_router)
