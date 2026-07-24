"""游戏资源库 — API 端点

公开（无需登录）:
  GET  /it/games              — 游戏列表（支持 ?category=&search=&page=&size=）
  GET  /it/games/categories   — 分类列表
  GET  /it/games/{id}         — 游戏详情

需要登录:
  GET  /it/games/{id}/download — 下载游戏文件（记录日志）

管理员:
  POST   /admin/it/games              — 上传游戏
  PUT    /admin/it/games/{id}         — 编辑游戏
  DELETE /admin/it/games/{id}         — 删除游戏
  GET    /admin/it/games/{id}/logs    — 下载记录
"""

import os
from typing import Any, BinaryIO, Dict, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.core.deps import get_current_user, require_admin
from app.core.session_guard import extract_client_ip
from app.db.database import get_db
from app.schemas.it.game import (
    GameResourceUpdate,
    GameResourceResponse,
    GameResourceListResponse,
)
from app.services.it import games as game_service

router = APIRouter(prefix="/it/games", tags=["it-games"])

admin_router = APIRouter(prefix="/admin/it/games", tags=["admin-it-games"])


def _open_descriptor_path(file_descriptor: int) -> str:
    """Return a stable path for an already-open file on supported Unix hosts."""
    for root in ("/proc/self/fd", "/dev/fd"):
        if os.path.isdir(root):
            return f"{root}/{file_descriptor}"
    raise RuntimeError("当前运行环境不支持安全的文件描述符下载")


# ── 公开端点 ──────────────────────────────────────────


@router.get("", response_model=GameResourceListResponse)
async def list_public_games(
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    items, total = await game_service.list_games(
        db,
        category=category,
        search=search,
        page=page,
        size=size,
        active_only=True,
    )
    return GameResourceListResponse(
        items=[GameResourceResponse.model_validate(g) for g in items],
        total=total,
    )


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    return {"categories": await game_service.get_categories(db)}


@router.get("/{game_id}", response_model=GameResourceResponse)
async def get_public_game(game_id: int, db: AsyncSession = Depends(get_db)):
    game = await game_service.get_game(db, game_id)
    if not game or not game.is_active:
        raise HTTPException(status_code=404, detail="游戏不存在或已下架")
    return GameResourceResponse.model_validate(game)


@router.get("/{game_id}/download")
async def download_game(
    game_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """下载游戏文件（需要登录），记录下载日志"""
    game = await game_service.get_game(db, game_id)
    if not game or not game.is_active:
        raise HTTPException(status_code=404, detail="游戏不存在或已下架")
    if not game.stored_path:
        raise HTTPException(status_code=500, detail="文件路径缺失，请联系管理员")

    file_path = game_service.resolve_game_file_path(game)
    if file_path is None:
        raise HTTPException(status_code=404, detail="游戏文件不存在或路径非法")

    file_handle: Optional[BinaryIO] = None
    try:
        try:
            file_handle = file_path.open("rb")
        except OSError:
            raise HTTPException(status_code=404, detail="游戏文件不存在或无法读取")

        try:
            user_id = int(user.get("id"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录信息无效")
        if user_id <= 0:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录信息无效")

        logged_game = await game_service.record_download(
            db,
            game_id=game_id,
            user_id=user_id,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
        )
        if not logged_game:
            raise HTTPException(status_code=404, detail="游戏不存在或已下架")

        file_descriptor = file_handle.fileno()
        response = FileResponse(
            path=_open_descriptor_path(file_descriptor),
            filename=logged_game.filename,
            media_type=logged_game.file_mime or "application/octet-stream",
            stat_result=os.fstat(file_descriptor),
            background=BackgroundTask(file_handle.close),
        )
        file_handle = None
        return response
    finally:
        if file_handle is not None:
            file_handle.close()


# ── 管理员端点 ────────────────────────────────────────


@admin_router.get("", response_model=GameResourceListResponse)
async def admin_list_games(
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: Dict[str, Any] = Depends(require_admin),
):
    """管理员列表：返回全部游戏（含已下架），支持分类筛选和搜索"""
    items, total = await game_service.list_games(
        db, category=category, search=search, page=page, size=size, active_only=False
    )
    return GameResourceListResponse(
        items=[GameResourceResponse.model_validate(g) for g in items],
        total=total,
    )


@admin_router.post("", response_model=GameResourceResponse)
async def admin_create_game(
    title: str = Form(..., min_length=1, max_length=200, description="游戏名称"),
    description: Optional[str] = Form(None),
    category: str = Form(..., min_length=1, max_length=100, description="分类"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: Dict[str, Any] = Depends(require_admin),
):
    try:
        game = await game_service.create_game(
            db,
            title=title,
            description=description,
            category=category,
            file=file,
            uploaded_by=int(admin.get("id") or 0),
        )
    except ValueError as e:
        # 上传安全校验失败（扩展名/大小/magic byte）→ 400
        raise HTTPException(status_code=400, detail=str(e))
    return GameResourceResponse.model_validate(game)


@admin_router.put("/{game_id}", response_model=GameResourceResponse)
async def admin_update_game(
    game_id: int,
    body: GameResourceUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Dict[str, Any] = Depends(require_admin),
):
    game = await game_service.update_game(
        db,
        game_id,
        title=body.title,
        description=body.description,
        category=body.category,
        icon_url=body.icon_url,
        is_active=body.is_active,
    )
    if not game:
        raise HTTPException(status_code=404, detail="游戏不存在")
    return GameResourceResponse.model_validate(game)


@admin_router.delete("/{game_id}")
async def admin_delete_game(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Dict[str, Any] = Depends(require_admin),
):
    ok = await game_service.delete_game(db, game_id)
    if not ok:
        raise HTTPException(status_code=404, detail="游戏不存在")
    return {"ok": True}


@admin_router.get("/{game_id}/logs")
async def admin_get_download_logs(
    game_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: Dict[str, Any] = Depends(require_admin),
):
    items, total = await game_service.get_download_logs(db, game_id, page=page, size=size)
    return {"items": items, "total": total}
