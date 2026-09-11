"""
数据库驱动的认证 API 端点
从数据库验证用户，不再使用硬编码逻辑
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Form, Body, Response, Request
import jwt
from jwt.exceptions import PyJWTError
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.session_family import (
    refresh_family, verify_access_family, valid_family_nonce,
    claim_durable_session, revoke_durable_session, session_state,
)
from app.core.deps import get_db, get_current_user as require_current_user
from app.services.auth import (
    authenticate_user_auto,
    create_access_token,
    issue_login_refresh_token,
    lock_user_for_login,
    resolve_legacy_subject,
    verify_refresh_token,
    lock_refresh_token_owner_for_logout,
    rotate_refresh_token,
    revoke_all_user_refresh_tokens,
)
from app.schemas.user_info import UserInfo
from app.core.session_guard import (
    on_successful_login, get_user_session, get_user_session_strict,
    rotate_user_session, extract_client_ip, set_ip_binding,
)
from app.utils.rate_limit import rate_limiter

router = APIRouter()


@router.post("/login")
async def login_for_access_token(
    response: Response,
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    数据库驱动的登录端点 - 从数据库验证用户
    """
    # 速率限制：同一 IP 每 2 秒最多 1 次登录请求
    client_ip = extract_client_ip(request)
    await rate_limiter.check(f"login:{client_ip}", interval_seconds=2)

    # 从数据库验证用户
    user = await authenticate_user_auto(db, username, password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 准备令牌数据
    token_data = {
        "sub": user.get("username") or user.get("student_id") or "anonymous",
        "role_code": user.get("role_code", "guest"),
        "name": user.get("full_name", ""),
        "username": user.get("username", ""),
        "type": "admin"
    }
    
    user_id = int(user["id"])
    if not await lock_user_for_login(db, user_id):
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号已停用或不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Durable refresh replacement must succeed before any Redis side effect.
        refresh_token = await issue_login_refresh_token(
            db,
            user_id,
            user_locked=True,
            commit=False,
        )
        await claim_durable_session(db, user_id, refresh_family(refresh_token), client_ip)
        await db.commit()
        # COMMIT releases the first user lock. Reacquire it and revalidate this
        # exact issuance before publishing; a newer login/logout may have won.
        nonce, client_ip = await _publish_committed_login(db, user_id, refresh_token, request)
        access_token = create_access_token(
            data={**token_data, "sn": nonce, **({"sf": 1} if refresh_family(refresh_token) else {})},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
    except Exception:
        await db.rollback()
        raise

    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )

    # 准备响应数据
    response_data = {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "refresh_token": refresh_token,
        "refresh_token_expires_in": settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # 转换为秒
        "role_code": user.get("role_code", "guest"),
        "full_name": user.get("full_name", ""),
        "username": user.get("username", ""),
        "client_ip": client_ip,
    }
    
    # 如果是学生，添加学生相关字段
    if user.get("role_code") == "student":
        response_data["student_id"] = user.get("student_id")
        response_data["class_name"] = user.get("class_name")
        response_data["study_year"] = user.get("study_year")
    
    return response_data




async def _publish_committed_login(
    db: AsyncSession, user_id: int, refresh_token: str, request: Request,
    *, preserve_cache_ttl: bool = False,
) -> tuple[str, str]:
    """Publish a projection only AFTER the authoritative transaction committed.

    An ambiguous Redis result cannot undo a durable eviction. The second lock
    prevents another auth mutation from publishing over this one in flight.
    """
    try:
        if not await lock_user_for_login(db, user_id):
            raise HTTPException(status_code=401, detail="账号已停用或不存在")
        owner = await verify_refresh_token(db, refresh_token)
        state = await session_state(db, user_id)
        family = refresh_family(refresh_token)
        if (not owner or int(owner["user_id"]) != user_id or state is None
                or not state.active or (family and state.nonce != family)):
            raise HTTPException(status_code=409, detail="登录已被新的会话操作替换，请重试")
        if preserve_cache_ttl:
            cached = await get_user_session_strict(user_id)
            if isinstance(cached, dict) and cached.get("nonce") == state.nonce and cached.get("ip") == state.ip:
                return state.nonce, state.ip
        await rotate_user_session(user_id, keep_ip=state.ip, nonce=state.nonce)
        deadline = state.ip_expires_at
        if deadline is not None:
            if deadline.tzinfo is None:  # SQLite isolated tests return naive UTC.
                deadline = deadline.replace(tzinfo=timezone.utc)
            remaining = int((deadline - datetime.now(timezone.utc)).total_seconds())
            if remaining > 0 and not await set_ip_binding(
                state.ip, {"user_id": user_id, "nonce": state.nonce}, ttl=remaining,
            ):
                raise RuntimeError("无法写入服务端IP绑定")
        return state.nonce, state.ip
    finally:
        await db.rollback()


def _normalize_user_datetime(value: Any) -> str:
    """将用户时间字段归一化为 ISO 字符串"""
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return datetime.now().isoformat()


@router.get("/me")
async def read_users_me(
    current_user: UserInfo = Depends(require_current_user),
) -> Dict[str, Any]:
    """
    获取当前用户信息 - 从统一认证依赖返回真实用户信息
    """
    user = current_user

    # 格式化响应数据
    user_info = {
        "id": user.get("id", 0),
        "role_code": user.get("role_code", "guest"),
        "username": user.get("username"),
        "full_name": user.get("full_name", ""),
        "is_active": user.get("is_active", True),
        "created_at": _normalize_user_datetime(user.get("created_at")),
        "updated_at": _normalize_user_datetime(user.get("updated_at")),
    }

    # 如果是学生，添加学生相关字段
    if user.get("role_code") == "student":
        user_info["student_id"] = user.get("student_id")
        user_info["class_name"] = user.get("class_name")
        user_info["study_year"] = user.get("study_year")

    return user_info


def _decode_logout_access(request: Request) -> Dict[str, Any]:
    """按既有优先级读取 access；不放宽验签或过期校验。"""
    token = (
        request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        or request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
        or request.cookies.get("access_token")
    )
    if token:
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except (PyJWTError, ValueError, TypeError):
            # 不忽略过期/验签；改用仍有效的 refresh 证明退出权限。
            pass
    return {}


class LogoutSessionReadError(RuntimeError):
    """Access authority could not be checked; an independent refresh may suffice."""


async def _lock_logout_access_owner(db: AsyncSession, payload: Dict[str, Any]) -> int | None:
    """仅返回锁内 nonce 匹配的身份；失败时释放候选锁再允许 refresh fallback。"""
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        return None

    # Use the same conservative live-identity resolver as HTTP/SSE/service callers.
    # Ambiguity rejects this access only; an independent refresh can still authorize logout.
    candidate = await resolve_legacy_subject(db, subject)
    candidate_id = candidate.id if candidate is not None else None
    if candidate_id and await lock_user_for_login(db, candidate_id):
        try:
            session = await get_user_session_strict(candidate_id)
        except Exception as exc:
            logger.warning("退出时无法读取会话，将尝试 refresh 凭据", exc_info=True)
            # Do not retain an access-owner lock when falling back to another uid.
            await db.rollback()
            raise LogoutSessionReadError("无法确认访问会话撤销状态") from exc
        token_nonce = payload.get("sn")
        # A versioned access token must prove both the Redis session nonce and
        # the durable refresh family.  Otherwise a revoked access token could
        # win the owner race and prevent an independent refresh cookie from
        # authorizing logout for the currently active identity.
        try:
            active = await verify_access_family(candidate_id, payload, db=db)
        except Exception as exc:
            await db.rollback()
            raise LogoutSessionReadError("无法确认访问会话撤销状态") from exc
        if not active:
            await db.rollback()
            return None
        current_nonce = session.get("nonce") if isinstance(session, dict) else None
        if isinstance(token_nonce, str) and token_nonce and token_nonce == current_nonce:
            return candidate_id

    # 释放 access 候选用户的锁，避免再用 refresh 锁另一个用户。
    await db.rollback()
    return None


async def _revoke_logout_owner(db: AsyncSession, user_id: int) -> None:
    """Commit the legacy/ws1 nonce fence before any cache side effect.

    Do not rotate Redis after releasing the lock: a newer login could win.
    The stale cache can remain until TTL; every access checks the durable fence.
    """
    await revoke_durable_session(db, user_id)
    await db.commit()


async def _rollback_failed_logout(db: AsyncSession) -> None:
    """尽力回滚服务端失败，不让回滚异常阻断 Cookie 清理响应。"""
    rollback = getattr(db, "rollback", None)
    if rollback is not None:
        try:
            await rollback()
        except Exception:
            logger.warning("登出失败后的数据库回滚也未完成", exc_info=True)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Revoke the proven session; failures clear cookies but do not claim success."""
    revocation_failed = False
    try:
        access_unconfirmed = False
        try:
            user_id = await _lock_logout_access_owner(db, _decode_logout_access(request))
        except LogoutSessionReadError:
            user_id = None
            access_unconfirmed = True
        if user_id is None:
            refresh_token = (
                request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
                or request.cookies.get("refresh_token")
            )
            if refresh_token:
                user_id = await lock_refresh_token_owner_for_logout(db, refresh_token)

        if user_id is not None:
            # 一个请求只撤销一个已证明的身份；有效 access 优先于冲突的 Cookie。
            await _revoke_logout_owner(db, user_id)
        elif access_unconfirmed:
            raise LogoutSessionReadError("访问会话不可读取且无有效刷新凭据")
    except Exception:
        revocation_failed = True
        logger.warning("登出时服务端会话撤销失败，继续清理客户端 Cookie", exc_info=True)
        await _rollback_failed_logout(db)
    finally:
        # 即使服务端撤销失败，也必须清除当前浏览器的认证 Cookie。
        response.delete_cookie(key=settings.ACCESS_TOKEN_COOKIE_NAME, path="/", domain=settings.COOKIE_DOMAIN)
        response.delete_cookie(key=settings.REFRESH_TOKEN_COOKIE_NAME, path="/", domain=settings.COOKIE_DOMAIN)
    if revocation_failed:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "message": "服务端会话撤销未完成，客户端 Cookie 已清理，请稍后重试",
            "revocation_status": "incomplete",
            "timestamp": datetime.now().isoformat(),
        }
    return {
        "message": "登出成功",
        "timestamp": datetime.now().isoformat(),
    }


@router.post("/refresh")
async def refresh_access_token(
    request: Request,
    response: Response,
    refresh_token: str | None = Body(default=None, embed=True),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    使用刷新令牌获取新的访问令牌
    
    令牌轮换：生成新的刷新令牌，撤销旧的刷新令牌
    """
    # 速率限制：同一 IP 每 5 秒最多 1 次刷新请求
    client_ip = extract_client_ip(request)
    await rate_limiter.check(f"refresh:{client_ip}", interval_seconds=5)

    rt = refresh_token or request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME) or request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供刷新令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        family = refresh_family(rt)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="无效的刷新令牌") from exc
    user_info = await rotate_refresh_token(db, rt, commit=False)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或过期的刷新令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # 准备新的访问令牌数据
        token_data = {
            "sub": user_info.get("username") or user_info.get("student_id") or "anonymous",
            "role_code": user_info.get("role_code", "guest"),
            "name": user_info.get("full_name", ""),
            "username": user_info.get("username", ""),
            "type": "admin"
        }

        user_id = int(user_info["user_id"])
        state = await session_state(db, user_id)
        try:
            sess = await get_user_session_strict(user_id)
        except Exception as exc:
            raise HTTPException(status_code=503, detail="无法核验刷新会话，请稍后重试") from exc
        if sess is not None and (not isinstance(sess, dict) or not valid_family_nonce(sess.get("nonce"))):
            raise HTTPException(status_code=503, detail="刷新会话记录无效，请稍后重试")
        if state is None or not state.active or (family and state.nonce != family):
            raise HTTPException(status_code=401, detail="刷新会话未接管或已被替换，请重新登录")
        if sess is None and state.ip != client_ip:
            # Existing cache-loss policy uses the requesting IP, but does not
            # claim a new IP binding. Never overwrite another owner's lease.
            state.ip, state.ip_expires_at = client_ip, None
        nonce = state.nonce
        # Durable rotation/recovery is committed before Redis publication.
        # A consumed refresh stays consumed if the response is lost (existing
        # one-use policy); an explicit fresh login is always the recovery route.
        new_refresh_token = user_info["refresh_token"]
        await db.commit()
        nonce, _ = await _publish_committed_login(
            db, user_id, new_refresh_token, request, preserve_cache_ttl=True,
        )

        access_token = create_access_token(
            data={**token_data, "sn": nonce, **({"sf": 1} if family else {})},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
    except Exception:
        await db.rollback()
        raise
    
    # 准备响应数据
    response_data = {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "refresh_token": new_refresh_token,
        "refresh_token_expires_in": settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    }
    
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=new_refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )

    return response_data


@router.get("/health")
async def auth_health_check() -> Dict[str, str]:
    """
    认证服务健康检查
    """
    return {
        "status": "healthy",
        "service": "auth",
        "version": "1.0.0",
        "description": "简化版认证服务",
    }
