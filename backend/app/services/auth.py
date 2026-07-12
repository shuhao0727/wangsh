"""
认证服务
简化的认证功能
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from jwt.exceptions import PyJWTError

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
    except PyJWTError:
        return None


async def authenticate_user(
    db, identifier: str, credential: str, user_type: str = "admin"
) -> Optional[Dict[str, Any]]:
    """
    统一用户认证 — 所有角色均使用 姓名(identifier) + 学号/密码(credential)

    identifier 用于定位用户（full_name / student_id / username，均为公开标识符）
    credential 优先匹配 student_id；有 hashed_password 的账号也可使用密码，
    保持项目统一的“姓名 + 学号”登录契约并兼容历史密码账号。
    """
    from sqlalchemy import select, or_
    from app.models import User
    from app.utils.security import verify_password

    query = select(User).where(
        or_(User.full_name == identifier, User.student_id == identifier, User.username == identifier),
        User.is_deleted.is_(False),
        User.is_active.is_(True)
    )
    result = await db.execute(query)
    candidates = result.scalars().all()
    matching_users = [
        user
        for user in candidates
        if (user.student_id and user.student_id == credential)
        or (user.hashed_password and verify_password(credential, user.hashed_password))
    ]
    if len(matching_users) != 1:
        return None
    user = matching_users[0]

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


async def authenticate_user_auto(
    db, identifier: str, credential: str
) -> Optional[Dict[str, Any]]:
    """统一认证 — 所有角色使用 姓名+学号"""
    return await authenticate_user(db, identifier, credential)


async def get_current_user(token: str, db=None) -> Optional[Dict[str, Any]]:
    """
    获取当前用户 - 支持统一用户系统
    根据令牌中的type字段区分管理员和学生
    """
    from sqlalchemy import select, or_
    from app.models import User
    
    payload = verify_token(token)
    if payload is None:
        return None

    subject = payload.get("sub")  # JWT中的subject
    role_code = payload.get("role_code")  # 从令牌中获取角色代码
    
    if subject is None:
        return None
    
    # 如果有数据库连接，从数据库获取用户
    if db:
        query = select(User).where(
            or_(User.username == subject, User.full_name == subject, User.student_id == subject),
            User.is_deleted.is_(False),
            User.is_active.is_(True)
        )

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
    
    # 没有数据库连接时，返回令牌中的基本用户信息
    return {
        "id": 0,
        "role_code": role_code or "guest",
        "username": subject,
        "full_name": payload.get("name", ""),
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }


async def get_current_user_or_student(
    token: Optional[str] = None,
    db=None,
) -> Optional[Dict[str, Any]]:
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


async def lock_user_for_login(db, user_id: int) -> bool:
    """串行化同一账号的登录流程，保证 nonce 与 refresh token 顺序一致。"""
    from sqlalchemy import select
    from app.models import User

    result = await db.execute(
        select(User.id)
        .where(
            User.id == user_id,
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
        .with_for_update()
    )
    return result.scalar_one_or_none() is not None


async def issue_login_refresh_token(
    db,
    user_id: int,
    *,
    user_locked: bool = False,
    commit: bool = True,
) -> str:
    """在用户行锁保护下撤销旧 refresh token，并原子签发唯一新 token。"""
    from sqlalchemy import update
    from app.models import RefreshToken
    import secrets

    try:
        if not user_locked and not await lock_user_for_login(db, user_id):
            raise ValueError("用户不存在或不可登录")

        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .values(is_revoked=True)
        )

        token = secrets.token_urlsafe(64)
        db.add(
            RefreshToken(
                user_id=user_id,
                token=token,
                expires_at=datetime.now(timezone.utc)
                + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
                is_revoked=False,
            )
        )
        if commit:
            await db.commit()
        return token
    except Exception:
        await db.rollback()
        raise


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
    user_query = select(User).where(
        User.id == refresh_token_record.user_id,
        User.is_active.is_(True),
        User.is_deleted.is_(False),
    )
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if not user or not user.is_active or user.is_deleted:
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


async def rotate_refresh_token(
    db,
    token: str,
    *,
    commit: bool = True,
) -> Optional[Dict[str, Any]]:
    """原子消费旧刷新令牌并签发新令牌，防止并发重放。"""
    from sqlalchemy import and_, select
    from app.models import RefreshToken, User
    import secrets

    try:
        # 先只读取 user_id，再按与登录一致的顺序获取“用户行 -> token 行”锁。
        # 锁后必须重新校验 token，避免登录在等待期间已经将其撤销。
        owner_query = select(RefreshToken.user_id).where(
            and_(
                RefreshToken.token == token,
                RefreshToken.expires_at > datetime.now(timezone.utc),
                RefreshToken.is_revoked.is_(False),
            )
        )
        owner_result = await db.execute(owner_query)
        user_id = owner_result.scalar_one_or_none()
        if user_id is None:
            await db.rollback()
            return None

        user_query = (
            select(User)
            .where(
                User.id == user_id,
                User.is_active.is_(True),
                User.is_deleted.is_(False),
            )
            .with_for_update()
        )
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active or user.is_deleted:
            await db.rollback()
            return None

        token_query = (
            select(RefreshToken)
            .where(
                and_(
                    RefreshToken.token == token,
                    RefreshToken.user_id == user_id,
                    RefreshToken.expires_at > datetime.now(timezone.utc),
                    RefreshToken.is_revoked.is_(False),
                )
            )
            .with_for_update()
        )
        result = await db.execute(token_query)
        refresh_token_record = result.scalar_one_or_none()
        if not refresh_token_record:
            await db.rollback()
            return None

        new_token = secrets.token_urlsafe(64)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        refresh_token_record.is_revoked = True
        db.add(
            RefreshToken(
                user_id=user.id,
                token=new_token,
                expires_at=expires_at,
                is_revoked=False,
            )
        )
        if commit:
            await db.commit()

        return {
            "user_id": user.id,
            "role_code": user.role_code,
            "username": user.username,
            "student_id": user.student_id,
            "full_name": user.full_name,
            "class_name": user.class_name,
            "study_year": user.study_year,
            "refresh_token": new_token,
        }
    except Exception:
        await db.rollback()
        raise


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


async def revoke_all_user_refresh_tokens(
    db,
    user_id: int,
    *,
    commit: bool = True,
) -> bool:
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
    if commit:
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
