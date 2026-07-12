"""
数据库驱动的认证 API 端点
从数据库验证用户，不再使用硬编码逻辑
"""

from datetime import datetime, timedelta
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Form, Body, Response, Request
import jwt
from jwt.exceptions import PyJWTError
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, get_current_user as require_current_user
from app.services.auth import (
    authenticate_user_auto,
    create_access_token,
    issue_login_refresh_token,
    lock_user_for_login,
    rotate_refresh_token,
    revoke_all_user_refresh_tokens,
)
from app.schemas.user_info import UserInfo
from app.core.session_guard import on_successful_login, get_user_session, rotate_user_session, extract_client_ip
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
        # 用户行锁覆盖 Redis nonce 旋转和 refresh token 替换，确保并发登录
        # 只有最后一个完成的事务保留可刷新的会话。
        nonce, client_ip = await on_successful_login(user_id, request)
        access_token = create_access_token(
            data={**token_data, "sn": nonce},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        refresh_token = await issue_login_refresh_token(
            db,
            user_id,
            user_locked=True,
            commit=False,
        )
        await db.commit()
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


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """
    用户登出 - 撤销所有刷新令牌并轮换会话nonce，确保已颁发的令牌无法再使用
    适用于共享电脑场景（如教室机房），防止登出后令牌被复用
    """
    # 服务端撤销是尽力而为：无论数据库或 Redis 是否可用，当前浏览器
    # 都必须收到一个正常响应和清 Cookie 指令。
    try:
        token = (
            request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            or request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
            or request.cookies.get("access_token")
        )
        if token:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            subject = payload.get("sub")
            if subject:
                # 通过subject查找用户ID
                from sqlalchemy import select, or_
                from app.models import User
                query = select(User.id).where(
                    or_(User.username == subject, User.full_name == subject, User.student_id == subject),
                    User.is_deleted.is_(False),
                )
                result = await db.execute(query)
                user_id = result.scalar_one_or_none()
                if user_id:
                    if await lock_user_for_login(db, user_id):
                        session = await get_user_session(user_id)
                        token_nonce = str(payload.get("sn", ""))
                        current_nonce = str(session.get("nonce", "")) if session else ""
                        if token_nonce and token_nonce == current_nonce:
                            # 与 login/refresh 使用同一用户锁顺序，避免并发 refresh
                            # 在 logout 的撤销快照之后插入仍有效的新 token。
                            await revoke_all_user_refresh_tokens(
                                db,
                                user_id,
                                commit=False,
                            )
                            await rotate_user_session(user_id)
                            await db.commit()
                        else:
                            await db.rollback()
                    else:
                        await db.rollback()
    except (PyJWTError, ValueError, TypeError):
        # 令牌无效、已过期或数据异常 - 仍然允许登出（清除cookie即可）
        pass
    except Exception:
        logger.warning("登出时服务端会话撤销失败，继续清理客户端 Cookie", exc_info=True)
        rollback = getattr(db, "rollback", None)
        if rollback is not None:
            try:
                await rollback()
            except Exception:
                logger.warning("登出失败后的数据库回滚也未完成", exc_info=True)
    finally:
        # 即使服务端撤销失败，也必须清除当前浏览器的认证 Cookie。
        response.delete_cookie(key=settings.ACCESS_TOKEN_COOKIE_NAME, path="/", domain=settings.COOKIE_DOMAIN)
        response.delete_cookie(key=settings.REFRESH_TOKEN_COOKIE_NAME, path="/", domain=settings.COOKIE_DOMAIN)
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

        # 从会话守卫读取当前nonce；若不存在则由 refresh 流程显式建立新会话
        user_id = int(user_info["user_id"])
        sess = await get_user_session(user_id)
        nonce = (sess or {}).get("nonce")
        if not nonce:
            try:
                sess = await rotate_user_session(user_id, keep_ip=client_ip)
            except RuntimeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="无法建立登录会话，请重新登录",
                ) from exc
            nonce = (sess or {}).get("nonce")
        if not nonce:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="无法建立登录会话，请重新登录",
            )

        access_token = create_access_token(
            data={**token_data, "sn": nonce},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        new_refresh_token = user_info["refresh_token"]
        await db.commit()
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
