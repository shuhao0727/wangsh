"""
FastAPI 依赖注入工具 - 权限控制和用户认证
"""

from typing import Optional, Dict, Any, cast
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.database import get_db
from app.core.config import settings
from app.services.auth import get_current_user as auth_get_current_user
from app.services.auth import verify_token
from app.core.session_guard import verify_request_session, verify_request_session_detail
from app.schemas.user_info import UserInfo

# OAuth2 配置
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def _token_from_request(request: Request) -> Optional[str]:
    """从 request 中读取 cookie 中的 access token。"""
    return (
        request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
        or request.cookies.get("access_token")
        or request.cookies.get("ws_access_token")
    )


async def get_access_token(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[str]:
    # 安全审计 S-3：通用路径不再接受 query token（token 会进入 URL/日志），
    # 仅限 SSE 场景使用 get_access_token_sse 放行 query token。
    if token:
        return token
    return _token_from_request(request)


async def get_access_token_sse(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[str]:
    """SSE (EventSource) 专用 token 解析：不支持自定义 header，允许从 query param 读取 token。

    仅限 SSE 端点使用（见 get_current_user_sse）；普通 HTTP 端点应使用 get_access_token。
    """
    if token:
        return token
    qt = request.query_params.get("token")
    if qt:
        return qt
    return _token_from_request(request)


async def get_current_user(
    token: Optional[str] = Depends(get_access_token),
    db: AsyncSession = Depends(get_db),
    request: Request = None  # type: ignore[assignment]
) -> UserInfo:
    """
    获取当前认证用户（必须有有效的认证令牌）
    
    返回:
        用户信息字典
        
    异常:
        401: 未授权访问
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌",
        )
    
    user = await auth_get_current_user(token, db)
    effective_token = token
    if not user and request is not None:
        cookie_token = (
            request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
            or request.cookies.get("access_token")
            or request.cookies.get("ws_access_token")
        )
        if cookie_token and cookie_token != token:
            user = await auth_get_current_user(cookie_token, db)
            if user:
                effective_token = cookie_token
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
        )
    # 会话有效性校验（基于nonce，必要时校验IP）
    try:
        payload = verify_token(effective_token) or {}
        result = await verify_request_session_detail(int(user.get("id") or 0), payload, request)
        if not result.get("ok"):
            reason = str(result.get("reason") or "")
            detail = "会话已失效，请重新登录"
            if reason == "replaced_by_new_login":
                detail = "账号已在其他地方登录，请重新登录"
            elif reason == "ip_mismatch":
                detail = "登录环境已变更，请重新登录"
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=detail,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("会话验证异常: {}", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="会话验证失败，请重新登录",
        )
    return cast(UserInfo, user)


async def get_current_user_sse(
    token: Optional[str] = Depends(get_access_token_sse),
    db: AsyncSession = Depends(get_db),
    request: Request = None  # type: ignore[assignment]
) -> UserInfo:
    """
    获取当前认证用户（SSE 端点专用）

    仅对 SSE (EventSource) 场景放行 query token；鉴权逻辑与 get_current_user 完全一致，
    返回类型同为 UserInfo。非 SSE 请求携带 query token 会被拒绝（见 get_access_token）。
    """
    return await get_current_user(token=token, db=db, request=request)


async def get_current_user_or_none(
    token: Optional[str] = Depends(get_access_token),
    db: AsyncSession = Depends(get_db)
) -> Optional[UserInfo]:
    """
    获取当前认证用户（如果存在）
    
    返回:
        用户信息字典或None（如果未认证）
    """
    if not token:
        return None
    
    user = await auth_get_current_user(token, db)
    return cast(UserInfo, user) if user else None


async def require_super_admin(
    current_user: UserInfo = Depends(get_current_user)
) -> UserInfo:
    """
    要求用户必须是超级管理员
    
    返回:
        用户信息字典（如果是超级管理员）
        
    异常:
        403: 权限不足
    """
    if current_user.get("role_code") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要超级管理员权限",
        )
    return current_user


async def require_admin(
    current_user: UserInfo = Depends(get_current_user)
) -> UserInfo:
    """
    要求用户必须是管理员（包括超级管理员）
    
    返回:
        用户信息字典（如果是管理员）
        
    异常:
        403: 权限不足
    """
    if current_user.get("role_code") not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current_user


async def require_admin_sse(
    current_user: UserInfo = Depends(get_current_user_sse)
) -> UserInfo:
    """
    SSE 版 require_admin：放行 query token（EventSource 无法自定义 header）
    """
    if current_user.get("role_code") not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current_user


async def require_student(
    current_user: UserInfo = Depends(get_current_user)
) -> UserInfo:
    """
    要求用户必须是学生
    
    返回:
        用户信息字典（如果是学生）
        
    异常:
        403: 权限不足
    """
    if current_user.get("role_code") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要学生权限",
        )
    return current_user


async def require_student_sse(
    current_user: UserInfo = Depends(get_current_user_sse)
) -> UserInfo:
    """
    SSE 版 require_student：放行 query token（EventSource 无法自定义 header）
    """
    if current_user.get("role_code") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要学生权限",
        )
    return current_user


async def require_staff(
    current_user: UserInfo = Depends(get_current_user)
) -> UserInfo:
    """
    要求用户必须是教职工（教师/管理员/超级管理员均可）
    用于课堂互动、课堂计划、测评等教学共享模块
    """
    if current_user.get("role_code") not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要教职工权限",
        )
    return current_user


async def require_student_or_staff(
    current_user: UserInfo = Depends(get_current_user)
) -> UserInfo:
    """
    要求用户必须是学生或教职工（student/teacher/admin/super_admin 均可）
    用于学生自主测评等以学生为主、但允许教师/管理员访问的模块
    """
    if current_user.get("role_code") not in ["student", "teacher", "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要学生或教职工权限",
        )
    return current_user


async def require_user(
    current_user: UserInfo = Depends(get_current_user)
) -> UserInfo:
    """
    要求用户必须是已认证用户（任何角色）

    返回:
        用户信息字典
    """
    return current_user


async def require_user_sse(
    current_user: UserInfo = Depends(get_current_user_sse)
) -> UserInfo:
    """
    SSE 版 require_user：放行 query token（EventSource 无法自定义 header）
    """
    return current_user


