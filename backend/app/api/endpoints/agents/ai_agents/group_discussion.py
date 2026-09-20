import asyncio
import json
from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    get_db,
    require_admin,
    require_registered_user,
    require_registered_user_sse,
)
from app.core.config import settings
from app.schemas.agents import (
    GroupDiscussionAdminAnalysisListResponse,
    GroupDiscussionAdminAnalysisOut,
    GroupDiscussionAdminMessageListResponse,
    GroupDiscussionJoinRequest,
    GroupDiscussionJoinResponse,
    GroupDiscussionMuteRequest,
    GroupDiscussionUnmuteRequest,
    GroupDiscussionAddMemberRequest,
    GroupDiscussionRemoveMemberRequest,
    GroupDiscussionMessageListResponse,
    GroupDiscussionMessageOut,
    GroupDiscussionSendRequest,
    GroupDiscussionGroupListResponse,
    GroupDiscussionGroupOut,
)
from app.services.agents.group_discussion import (
    enforce_join_lock,
    ensure_session_view_access,
    set_join_lock,
    get_or_create_today_session,
    list_today_groups,
    list_messages,
    send_message,
    set_group_name,
    mute_member,
    unmute_member,
    admin_add_member,
    admin_remove_member,
    admin_list_messages,
    admin_list_analyses,
)
from app.services.agents.group_discussion_public_config import (  # noqa: F401  见下方回导说明
    GroupDiscussionPublicConfigService,
)
from app.utils.cache import cache
from app.core.stream_session import session_checked_stream

from .group_discussion_common import (
    _enforce_frontend_visibility,
    _require_discussion_user,
)
from .group_discussion_admin import router as admin_router
# public-config 路由本体已拆到独立模块。这里回导它的公开名字（并保留上方导入的
# GroupDiscussionPublicConfigService），使本模块的属性集合与拆分前完全一致：
# 测试会替换 group_discussion.GroupDiscussionPublicConfigService，并用
# group_discussion.router 组装应用，这些名字必须继续作为本模块属性存在。
from .group_discussion_public_config import (  # noqa: F401  有意回导，非未使用导入
    PUBLIC_CONFIG_CHANNEL,
    get_public_config,
    set_public_config,
    stream_public_config,
    router as public_config_router,
)


router = APIRouter(prefix="/group-discussion")

# 路由聚合顺序须与原单文件实现一致：public-config -> 用户端路由 -> admin 路由
router.include_router(public_config_router)


@router.post("/join", response_model=GroupDiscussionJoinResponse)
async def join_group_discussion(
    payload: GroupDiscussionJoinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_registered_user),
) -> GroupDiscussionJoinResponse:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    role = str(user.get("role_code") or "")

    lock_seconds = await enforce_join_lock(
        user_id=int(user["id"]),
        requested_group_no=str(payload.group_no).strip(),
        user_role=role,
    )
    session = await get_or_create_today_session(
        db,
        class_name=payload.class_name,
        group_no=payload.group_no,
        group_name=payload.group_name,
        user=user,
    )
    await set_join_lock(
        user_id=int(user["id"]),
        requested_group_no=str(session.group_no),
        user_role=role,
    )
    display_name = (user.get("full_name") or user.get("student_id") or user.get("username") or "").strip()
    return GroupDiscussionJoinResponse(
        session_id=int(session.id),
        session_date=session.session_date,
        class_name=str(session.class_name),
        group_no=session.group_no,
        group_name=(str(session.group_name).strip() if session.group_name else None),
        display_name=display_name or f"用户{user.get('id')}",
        group_lock_seconds=int(lock_seconds),
    )


@router.get("/groups", response_model=GroupDiscussionGroupListResponse)
async def list_groups(
    date: Optional[date] = Query(None, description="可选：按日期筛选"),
    class_name: Optional[str] = Query(None, description="可选：按班级筛选"),
    keyword: Optional[str] = Query(None, description="可选：按组号或组名搜索"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_registered_user),
) -> GroupDiscussionGroupListResponse:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    role = str(user.get("role_code") or "")
    if role == "student":
        final_class_name = (user.get("class_name") or "").strip() or "未知班级"
        ignore_time = False
    else:
        final_class_name = class_name
        # 管理员，或者指定了日期（可能是查询历史），则忽略时间限制
        ignore_time = True if (role in ["admin", "super_admin"] or date) else False

    rows = await list_today_groups(
        db,
        date=date,
        class_name=final_class_name,
        keyword=keyword,
        limit=limit,
        ignore_time_limit=ignore_time
    )
    items = [
        GroupDiscussionGroupOut(
            session_id=int(r.id),
            session_date=r.session_date,
            class_name=str(r.class_name),
            group_no=str(r.group_no),
            group_name=(str(r.group_name).strip() if r.group_name else None),
            message_count=int(r.message_count or 0),
            member_count=int(count or 0),
            last_message_at=r.last_message_at,
        )
        for r, count in rows
    ]
    return GroupDiscussionGroupListResponse(items=items)


@router.put("/session/{session_id}/name", response_model=GroupDiscussionJoinResponse)
async def update_group_name(
    session_id: int,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_registered_user),
) -> GroupDiscussionJoinResponse:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    group_name = str(payload.get("group_name") or "")
    session = await set_group_name(db, session_id=session_id, user=user, group_name=group_name)
    display_name = (user.get("full_name") or user.get("student_id") or user.get("username") or "").strip()
    return GroupDiscussionJoinResponse(
        session_id=int(session.id),
        session_date=session.session_date,
        class_name=str(session.class_name),
        group_no=str(session.group_no),
        group_name=(str(session.group_name).strip() if session.group_name else None),
        display_name=display_name or f"用户{user.get('id')}",
        group_lock_seconds=0,
    )


@router.get("/messages", response_model=GroupDiscussionMessageListResponse)
async def get_group_discussion_messages(
    session_id: int = Query(..., ge=1),
    after_id: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_registered_user),
) -> GroupDiscussionMessageListResponse:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    await ensure_session_view_access(db, session_id=session_id, user=user)
    rows, next_after = await list_messages(db, session_id=session_id, after_id=after_id, limit=limit)
    items = [
        GroupDiscussionMessageOut(
            id=int(r.id),
            session_id=int(r.session_id),
            user_id=int(r.user_id),
            user_display_name=str(r.user_display_name),
            content=str(r.content),
            created_at=r.created_at,
        )
        for r in rows
    ]
    return GroupDiscussionMessageListResponse(items=items, next_after_id=int(next_after))

@router.get("/stream")
async def stream_group_discussion_messages(
    request: Request = None,
    session_id: int = Query(..., ge=1),
    after_id: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_registered_user_sse),
):
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    await ensure_session_view_access(db, session_id=session_id, user=user)

    async def gen():
        nonlocal after_id
        channel = f"znt:group_discussion:ch:{int(session_id)}"
        pubsub = None
        if settings.GROUP_DISCUSSION_REDIS_ENABLED:
            try:
                client = await cache.get_client()
                pubsub = client.pubsub()
                await pubsub.subscribe(channel)
            except Exception:
                pubsub = None

        try:
            while True:
                try:
                    if pubsub is not None:
                        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                        if msg is None:
                            yield ":keepalive\n\n"
                            continue
                    else:
                        await asyncio.sleep(1)

                    rows, next_after = await list_messages(
                        db, session_id=int(session_id), after_id=int(after_id or 0), limit=200
                    )
                    if rows:
                        items = [
                            {
                                "id": int(r.id),
                                "session_id": int(r.session_id),
                                "user_id": int(r.user_id),
                                "user_display_name": str(r.user_display_name),
                                "content": str(r.content),
                                "created_at": r.created_at.isoformat(),
                            }
                            for r in rows
                        ]
                        after_id = int(next_after)
                        payload = json.dumps(
                            {"items": items, "next_after_id": int(next_after)},
                            ensure_ascii=False,
                        )
                        yield f"data: {payload}\n\n"
                except asyncio.CancelledError:
                    break
                except Exception:
                    yield ":keepalive\n\n"
                    await asyncio.sleep(1)
        finally:
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.close()
                except Exception:
                    pass

    return StreamingResponse(
        session_checked_stream(gen(), request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/messages", response_model=GroupDiscussionMessageOut)
async def post_group_discussion_message(
    payload: GroupDiscussionSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_registered_user),
) -> GroupDiscussionMessageOut:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    r = await send_message(db, session_id=payload.session_id, student_user=user, content=payload.content)
    return GroupDiscussionMessageOut(
        id=int(r.id),
        session_id=int(r.session_id),
        user_id=int(r.user_id),
        user_display_name=str(r.user_display_name),
        content=str(r.content),
        created_at=r.created_at,
    )


@router.post("/mute", status_code=status.HTTP_200_OK)
async def mute_user(
    payload: GroupDiscussionMuteRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    await mute_member(db, session_id=payload.session_id, user_id=payload.user_id, minutes=payload.minutes)
    return {"success": True}


@router.post("/unmute", status_code=status.HTTP_200_OK)
async def unmute_user(
    payload: GroupDiscussionUnmuteRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    await unmute_member(db, session_id=payload.session_id, user_id=payload.user_id)
    return {"success": True}


@router.post("/add-member", status_code=status.HTTP_200_OK)
async def add_member_to_session(
    payload: GroupDiscussionAddMemberRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    await admin_add_member(db, session_id=payload.session_id, user_id=payload.user_id)
    return {"success": True}


@router.post("/remove-member", status_code=status.HTTP_200_OK)
async def remove_member_from_session(
    payload: GroupDiscussionRemoveMemberRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    await admin_remove_member(db, session_id=payload.session_id, user_id=payload.user_id)
    return {"success": True}


# 以下两个路由的函数体在本模块解析全局名（admin_list_messages / admin_list_analyses），
# 测试会在 `group_discussion` 模块上 monkeypatch 这两个名字，因此必须定义在本模块内，
# 并用 admin_router 注册（路径写全，与 group_discussion_admin.py 的约定一致）。
# admin_router 的聚合放在本文件末尾，确保注册进 admin_router 的所有路由都被聚合。
@admin_router.get("/admin/messages", response_model=GroupDiscussionAdminMessageListResponse)
async def admin_get_messages(
    session_id: int = Query(..., ge=1),
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionAdminMessageListResponse:
    rows, total, page_n, total_pages = await admin_list_messages(db, session_id=session_id, page=page, size=size)
    items = [
        GroupDiscussionMessageOut(
            id=int(r.id),
            session_id=int(r.session_id),
            user_id=int(r.user_id),
            user_display_name=str(r.user_display_name),
            content=str(r.content),
            created_at=r.created_at,
        )
        for r in rows
    ]
    return GroupDiscussionAdminMessageListResponse(
        items=items,
        total=total,
        page=page_n,
        page_size=size,
        total_pages=total_pages,
    )


@admin_router.get("/admin/analyses", response_model=GroupDiscussionAdminAnalysisListResponse)
async def admin_get_analyses(
    session_id: int = Query(..., ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionAdminAnalysisListResponse:
    rows, _total = await admin_list_analyses(db, session_id=session_id, page=1, size=limit)
    items = [
        GroupDiscussionAdminAnalysisOut(
            id=int(r.id),
            session_id=int(r.session_id),
            agent_id=int(r.agent_id),
            analysis_type=str(r.analysis_type),
            prompt=str(r.prompt),
            result_text=str(r.result_text),
            created_at=r.created_at,
            compare_session_ids=r.compare_session_ids,
        )
        for r in rows
    ]
    return GroupDiscussionAdminAnalysisListResponse(items=items)


# admin 路由聚合放末尾：admin_router 的所有路由须先注册完毕，再整体聚合进本模块 router。
router.include_router(admin_router)
