import asyncio
import json
from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin, require_user
from app.core.config import settings
from app.schemas.agents import (
    GroupDiscussionJoinRequest,
    GroupDiscussionJoinResponse,
    GroupDiscussionMessageListResponse,
    GroupDiscussionMessageOut,
    GroupDiscussionSendRequest,
    GroupDiscussionGroupListResponse,
    GroupDiscussionGroupOut,
    GroupDiscussionAdminSessionListResponse,
    GroupDiscussionAdminSessionOut,
    GroupDiscussionAdminMessageListResponse,
    GroupDiscussionAdminAnalyzeRequest,
    GroupDiscussionAdminAnalyzeResponse,
    GroupDiscussionAdminCompareAnalyzeRequest,
    GroupDiscussionAdminAnalysisListResponse,
    GroupDiscussionAdminAnalysisOut,
    GroupDiscussionPublicConfig,
)
from app.services.agents.group_discussion import (
    admin_analyze_session,
    admin_compare_analyze_sessions,
    admin_list_analyses,
    admin_list_messages,
    admin_list_sessions,
    enforce_join_lock,
    get_or_create_today_session,
    list_today_groups,
    list_messages,
    send_message,
    set_group_name,
)
from app.services.agents.group_discussion_public_config import GroupDiscussionPublicConfigService
from app.utils.cache import cache


router = APIRouter(prefix="/group-discussion")
PUBLIC_CONFIG_CHANNEL = "znt:group_discussion:public_config"


def _require_discussion_user(user: Dict[str, Any]) -> Dict[str, Any]:
    if user.get("role_code") not in ["student", "admin", "super_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问讨论组")
    return user


async def _enforce_frontend_visibility(db: AsyncSession, user: Dict[str, Any]) -> None:
    role = str(user.get("role_code") or "")
    if role != "student":
        return
    enabled = await GroupDiscussionPublicConfigService.get_enabled(db)
    if not enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="小组讨论暂时关闭")


@router.get("/public-config", response_model=GroupDiscussionPublicConfig)
async def get_public_config(
    db: AsyncSession = Depends(get_db),
) -> GroupDiscussionPublicConfig:
    enabled = await GroupDiscussionPublicConfigService.get_enabled(db)
    return GroupDiscussionPublicConfig(enabled=enabled)


@router.get("/public-config/stream")
async def stream_public_config(
    db: AsyncSession = Depends(get_db),
):
    async def gen():
        enabled = await GroupDiscussionPublicConfigService.get_enabled(db)
        yield f"data: {json.dumps({'enabled': bool(enabled)}, ensure_ascii=False)}\n\n"

        pubsub = None
        if settings.GROUP_DISCUSSION_REDIS_ENABLED:
            try:
                client = await cache.get_client()
                pubsub = client.pubsub()
                await pubsub.subscribe(PUBLIC_CONFIG_CHANNEL)
            except Exception:
                pubsub = None

        last_enabled = bool(enabled)
        try:
            while True:
                try:
                    if pubsub is not None:
                        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
                        if msg is None:
                            yield ":keepalive\n\n"
                            continue
                        data = msg.get("data")
                        if isinstance(data, (bytes, bytearray)):
                            data = data.decode("utf-8", errors="ignore")
                        try:
                            payload = json.loads(str(data)) if data is not None else {}
                        except Exception:
                            payload = {}
                        enabled_val = bool(payload.get("enabled", last_enabled))
                    else:
                        await asyncio.sleep(2)
                        enabled_val = bool(await GroupDiscussionPublicConfigService.get_enabled(db))

                    if enabled_val != last_enabled:
                        last_enabled = enabled_val
                        yield f"data: {json.dumps({'enabled': bool(enabled_val)}, ensure_ascii=False)}\n\n"
                except asyncio.CancelledError:
                    break
                except Exception:
                    yield ":keepalive\n\n"
                    await asyncio.sleep(1)
        finally:
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(PUBLIC_CONFIG_CHANNEL)
                    await pubsub.close()
                except Exception:
                    pass

    return StreamingResponse(gen(), media_type="text/event-stream")



@router.put("/public-config", response_model=GroupDiscussionPublicConfig)
async def set_public_config(
    payload: GroupDiscussionPublicConfig,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionPublicConfig:
    enabled = await GroupDiscussionPublicConfigService.set_enabled(db, bool(payload.enabled))
    if settings.GROUP_DISCUSSION_REDIS_ENABLED:
        try:
            await cache.publish(PUBLIC_CONFIG_CHANNEL, {"enabled": bool(enabled)})
        except Exception:
            pass
    return GroupDiscussionPublicConfig(enabled=enabled)


@router.post("/join", response_model=GroupDiscussionJoinResponse)
async def join_group_discussion(
    payload: GroupDiscussionJoinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_user),
) -> GroupDiscussionJoinResponse:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    role = str(user.get("role_code") or "")
    if role == "student":
        class_name = (user.get("class_name") or "").strip() or "未知班级"
    else:
        class_name = "管理员"

    lock_seconds = await enforce_join_lock(user_id=int(user["id"]), requested_group_no=str(payload.group_no).strip())
    session = await get_or_create_today_session(
        db,
        class_name=class_name,
        group_no=payload.group_no,
        group_name=payload.group_name,
        user=user,
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
    keyword: Optional[str] = Query(None, description="可选：按组号或组名搜索"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_user),
) -> GroupDiscussionGroupListResponse:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
    role = str(user.get("role_code") or "")
    if role == "student":
        class_name = (user.get("class_name") or "").strip() or "未知班级"
    else:
        class_name = "管理员"
    rows = await list_today_groups(db, class_name=class_name, keyword=keyword, limit=limit)
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
    current_user: Dict[str, Any] = Depends(require_user),
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
    current_user: Dict[str, Any] = Depends(require_user),
) -> GroupDiscussionMessageListResponse:
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)
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
    session_id: int = Query(..., ge=1),
    after_id: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_user),
):
    user = _require_discussion_user(current_user)
    await _enforce_frontend_visibility(db, user)

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

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/messages", response_model=GroupDiscussionMessageOut)
async def post_group_discussion_message(
    payload: GroupDiscussionSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_user),
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


@router.get("/admin/sessions", response_model=GroupDiscussionAdminSessionListResponse)
async def admin_get_sessions(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    class_name: Optional[str] = Query(None),
    group_no: Optional[str] = Query(None),
    group_name: Optional[str] = Query(None),
    user_name: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionAdminSessionListResponse:
    rows, total, page_n, total_pages = await admin_list_sessions(
        db,
        start_date=start_date,
        end_date=end_date,
        class_name=class_name,
        group_no=group_no,
        group_name=group_name,
        user_name=user_name,
        page=page,
        size=size,
    )
    items = [
        GroupDiscussionAdminSessionOut(
            id=int(r.id),
            session_date=r.session_date,
            class_name=str(r.class_name),
            group_no=str(r.group_no),
            group_name=(str(r.group_name).strip() if r.group_name else None),
            message_count=int(r.message_count or 0),
            created_at=r.created_at,
            last_message_at=r.last_message_at,
        )
        for r in rows
    ]
    return GroupDiscussionAdminSessionListResponse(
        items=items,
        total=total,
        page=page_n,
        page_size=size,
        total_pages=total_pages,
    )


@router.get("/admin/messages", response_model=GroupDiscussionAdminMessageListResponse)
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


@router.post("/admin/analyze", response_model=GroupDiscussionAdminAnalyzeResponse)
async def admin_analyze(
    payload: GroupDiscussionAdminAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionAdminAnalyzeResponse:
    r = await admin_analyze_session(
        db,
        session_id=payload.session_id,
        agent_id=payload.agent_id,
        admin_user=admin_user,
        analysis_type=payload.analysis_type,
        prompt=payload.prompt,
    )
    return GroupDiscussionAdminAnalyzeResponse(
        analysis_id=int(r.id),
        result_text=str(r.result_text),
        created_at=r.created_at,
    )


@router.post("/admin/compare-analyze", response_model=GroupDiscussionAdminAnalyzeResponse)
async def admin_compare_analyze(
    payload: GroupDiscussionAdminCompareAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionAdminAnalyzeResponse:
    r = await admin_compare_analyze_sessions(
        db,
        session_ids=payload.session_ids,
        agent_id=payload.agent_id,
        admin_user=admin_user,
        bucket_seconds=payload.bucket_seconds,
        analysis_type=payload.analysis_type,
        prompt=payload.prompt,
        use_cache=payload.use_cache,
    )
    return GroupDiscussionAdminAnalyzeResponse(
        analysis_id=int(r.id),
        result_text=str(r.result_text),
        created_at=r.created_at,
    )


@router.get("/admin/analyses", response_model=GroupDiscussionAdminAnalysisListResponse)
async def admin_get_analyses(
    session_id: int = Query(..., ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> GroupDiscussionAdminAnalysisListResponse:
    rows = await admin_list_analyses(db, session_id=session_id, limit=limit)
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
