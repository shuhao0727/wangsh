"""
认证服务
简化的认证功能
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from sqlalchemy import or_

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # 使用utils.security中的verify_password函数，确保一致性
    from app.utils.security import verify_password as utils_verify_password
    return utils_verify_password(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    from app.utils.security import get_password_hash as utils_get_password_hash
    return utils_get_password_hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """验证 JWT 令牌"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def authenticate_user(db, identifier: str, credential: str, user_type: str = "admin"):
    """
    统一用户认证 - 支持管理员和学生登录
    
    Args:
        db: 数据库会话
        identifier: 用户标识符（管理员用username，学生用student_id或username）
        credential: 凭证（管理员用password，学生用name）
        user_type: 用户类型 'admin' 或 'student'
        
    Returns:
        用户信息字典或None
    """
    from sqlalchemy import select, or_
    from app.models import User
    from app.utils.security import verify_password
    
    if user_type == "admin":
        # 教职工认证：支持 username+password 或 full_name+student_id
        query = select(User).where(
            or_(
                User.username == identifier,
                User.full_name == identifier,
            ),
            User.role_code.in_(['teacher', 'admin', 'super_admin']),
            User.is_deleted.is_(False),
            User.is_active.is_(True)
        )
    elif user_type == "student":
        # 学生认证：full_name + student_id（或反向兼容）
        query = select(User).where(
            or_(
                User.full_name == identifier,
                User.student_id == identifier
            ),
            User.role_code == 'student',
            User.is_deleted.is_(False),
            User.is_active.is_(True)
        )
    else:
        return None

    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        return None

    if user_type == "admin":
        # 验证教职工凭证：支持 hashed_password 或 student_id
        if user.hashed_password and verify_password(credential, user.hashed_password):
            pass  # 密码验证通过
        elif user.student_id and user.student_id == credential:
            pass  # 学号作为密码验证通过
        else:
            return None
    elif user_type == "student":
        # 验证学生凭证：student_id 或 full_name
        if user.full_name == identifier:
            if user.student_id != credential:
                return None
        elif user.student_id == identifier:
            if user.full_name != credential:
                return None
        else:
            return None
    
    # 返回用户信息
    return {
        "id": user.id,
        "role_code": user.role_code,
        "username": user.username,
        "student_id": user.student_id,
        "full_name": user.full_name,
        "class_name": user.class_name,
        "study_year": user.study_year,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at
    }


async def authenticate_user_auto(db, identifier: str, credential: str):
    """自动识别用户类型进行认证（先尝试教职工，再尝试学生）"""
    user = await authenticate_user(db, identifier, credential, "admin")
    if user:
        return user
    return await authenticate_user(db, identifier, credential, "student")


async def get_current_user(token: str, db = None):
    """
    获取当前用户 - 支持统一用户系统
    根据令牌中的type字段区分管理员和学生
    """
    from sqlalchemy import select, or_
    from app.models import User
    
    payload = verify_token(token)
    if payload is None:
        return None
    
    user_type = payload.get("type", "admin")  # 默认为admin类型
    subject = payload.get("sub")  # JWT中的subject
    role_code = payload.get("role_code")  # 从令牌中获取角色代码
    
    if subject is None:
        return None
    
    # 如果有数据库连接，从数据库获取用户
    if db:
        if user_type == "admin":
            role_condition = User.role_code == role_code if role_code else User.role_code.in_(['teacher', 'admin', 'super_admin'])
            query = select(User).where(
                or_(
                    User.username == subject,
                    User.full_name == subject,
                    User.student_id == subject,
                ),
                role_condition,
                User.is_deleted.is_(False),
                User.is_active.is_(True)
            )
        elif user_type == "student":
            query = select(User).where(
                User.student_id == subject,
                User.role_code == 'student',
                User.is_deleted.is_(False),
                User.is_active.is_(True)
            )
        else:
            return None
        
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        
        if user:
            return {
                "id": user.id,
                "role_code": user.role_code,
                "username": user.username,
                "student_id": user.student_id,
                "full_name": user.full_name,
                "class_name": user.class_name,
                "study_year": user.study_year,
                "is_active": user.is_active,
                "created_at": user.created_at,
                "updated_at": user.updated_at
            }
    
    # 如果没有数据库连接或用户不存在，返回令牌中的基本用户信息
    if user_type == "student":
        return {
            "id": 0,
            "role_code": "student",
            "student_id": subject,
            "full_name": payload.get("name", ""),
            "is_active": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    else:
        return {
            "id": 0,
            "role_code": "admin",
            "username": subject,
            "is_active": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }


async def get_current_user_or_student(
    token: Optional[str] = None,
    db = None
):
    """
    获取当前用户或学生
    
    安全加固：仅在提供有效token且验证成功时返回用户
    """
    if not token:
        return None
    
    # 尝试获取用户
    user = await get_current_user(token, db)
    return user


# ==================== 刷新令牌功能 ====================

async def create_refresh_token(db, user_id: int) -> str:
    """
    创建刷新令牌并保存到数据库
    
    Args:
        db: 数据库会话
        user_id: 用户ID
    
    Returns:
        刷新令牌字符串
    """
    from app.models import RefreshToken
    import secrets
    
    # 生成安全的随机令牌
    token = secrets.token_urlsafe(64)
    
    # 计算过期时间（默认30天）
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    # 创建刷新令牌记录
    refresh_token = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at,
        is_revoked=False
    )
    
    db.add(refresh_token)
    await db.commit()
    
    return token


async def verify_refresh_token(db, token: str) -> Optional[Dict[str, Any]]:
    """
    验证刷新令牌有效性
    
    Args:
        db: 数据库会话
        token: 刷新令牌
    
    Returns:
        用户ID字典或None
    """
    from sqlalchemy import select, and_
    from app.models import RefreshToken, User
    
    # 查询有效的刷新令牌
    query = select(RefreshToken).where(
        and_(
            RefreshToken.token == token,
            RefreshToken.expires_at > datetime.now(timezone.utc),
            RefreshToken.is_revoked == False
        )
    )
    
    result = await db.execute(query)
    refresh_token_record = result.scalar_one_or_none()
    
    if not refresh_token_record:
        return None
    
    # 获取关联的用户信息
    user_query = select(User).where(User.id == refresh_token_record.user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if not user:
        return None
    
    return {
        "user_id": user.id,
        "role_code": user.role_code,
        "username": user.username,
        "student_id": user.student_id,
        "full_name": user.full_name,
        "class_name": user.class_name,
        "study_year": user.study_year
    }


async def revoke_refresh_token(db, token: str) -> bool:
    """
    撤销刷新令牌
    
    Args:
        db: 数据库会话
        token: 刷新令牌
    
    Returns:
        是否成功撤销
    """
    from sqlalchemy import select, update
    from app.models import RefreshToken
    
    # 查找令牌
    query = select(RefreshToken).where(RefreshToken.token == token)
    result = await db.execute(query)
    refresh_token = result.scalar_one_or_none()
    
    if not refresh_token:
        return False
    
    # 标记为已撤销
    refresh_token.is_revoked = True
    await db.commit()
    
    return True


async def revoke_all_user_refresh_tokens(db, user_id: int) -> bool:
    """
    撤销用户的所有刷新令牌
    
    Args:
        db: 数据库会话
        user_id: 用户ID
    
    Returns:
        是否成功撤销
    """
    from sqlalchemy import update
    from app.models import RefreshToken
    
    # 更新所有该用户的令牌为已撤销
    stmt = update(RefreshToken).where(
        RefreshToken.user_id == user_id
    ).values(is_revoked=True)
    
    await db.execute(stmt)
    await db.commit()
    
    return True


async def cleanup_expired_refresh_tokens(db) -> int:
    """
    清理过期的刷新令牌
    
    Args:
        db: 数据库会话
    
    Returns:
        删除的令牌数量
    """
    from sqlalchemy import delete
    from app.models import RefreshToken
    
    # 删除已过期或已撤销的令牌
    stmt = delete(RefreshToken).where(
        (RefreshToken.expires_at <= datetime.now(timezone.utc)) |
        (RefreshToken.is_revoked == True)
    )
    
    result = await db.execute(stmt)
    await db.commit()
    
    return result.rowcount
