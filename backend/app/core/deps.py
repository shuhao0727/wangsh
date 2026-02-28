"""
FastAPI 依赖注入工具 - 权限控制和用户认证
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.config import settings
from app.services.auth import get_current_user as auth_get_current_user
from app.services.auth import get_current_user_or_student
from app.services.auth import verify_token
from app.core.session_guard import verify_request_session

# OAuth2 配置
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

async def get_access_token(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[str]:
    if token:
        return token
    return (
        request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
        or request.cookies.get("access_token")
        or request.cookies.get("ws_access_token")
    )


async def get_current_user(
    token: Optional[str] = Depends(get_access_token),
    db: AsyncSession = Depends(get_db),
    request: Request = None
) -> Dict[str, Any]:
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
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
        )
    # 会话有效性校验（基于nonce，必要时校验IP）
    try:
        payload = verify_token(token) or {}
        ok = await verify_request_session(int(user.get("id") or 0), payload, request)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="会话已失效，请重新登录",
            )
    except HTTPException:
        raise
    except Exception:
        # 降级为允许通过，避免硬失败（可按需开启严格模式）
        pass
    return user


async def get_current_user_or_none(
    token: Optional[str] = Depends(get_access_token),
    db: AsyncSession = Depends(get_db)
) -> Optional[Dict[str, Any]]:
    """
    获取当前认证用户（如果存在）
    
    返回:
        用户信息字典或None（如果未认证）
    """
    if not token:
        return None
    
    user = await auth_get_current_user(token, db)
    return user


async def require_super_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
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
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
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


async def require_student(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
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


async def require_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    要求用户必须是已认证用户（任何角色）
    
    返回:
        用户信息字典
    """
    return current_user


async def get_current_user_for_znt(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(get_access_token)
) -> Dict[str, Any]:
    """
    为znt_users API提供的兼容性用户获取函数
    如果没有提供token，返回一个模拟的管理员用户
    """
    return await get_current_user_or_student(token, db)
