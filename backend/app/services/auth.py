"""
认证服务
简化的认证功能
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import or_

from app.core.config import settings

# 密码哈希上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # 使用utils.security中的verify_password函数，确保一致性
    from app.utils.security import verify_password as utils_verify_password
    return utils_verify_password(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
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
        # 管理员认证：username + password
        query = select(User).where(
            User.username == identifier,
            User.role_code.in_(['admin', 'super_admin']),
            User.is_deleted.is_(False),
            User.is_active.is_(True)
        )
    elif user_type == "student":
        # 学生认证：支持多种登录方式
        # 1. 姓名（full_name）作为用户名 + 学号（student_id）作为密码
        # 2. 学号（student_id）作为用户名 + 姓名（full_name）作为密码（向后兼容）
        # 查询时同时检查 full_name 和 student_id
        query = select(User).where(
            or_(
                User.full_name == identifier,  # 方式1：姓名作为用户名
                User.student_id == identifier   # 方式2：学号作为用户名（向后兼容）
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
        # 验证管理员密码
        if not user.hashed_password or not verify_password(credential, user.hashed_password):
            return None
    elif user_type == "student":
        # 验证学生登录凭证
        # 学生登录有两种方式：
        # 1. 姓名作为用户名 + 学号作为密码（主模式）
        # 2. 学号作为用户名 + 姓名作为密码（向后兼容）
        
        # 如果identifier匹配的是full_name（方式1），那么credential应该是student_id
        if user.full_name == identifier:
            if user.student_id != credential:
                return None
        # 如果identifier匹配的是student_id（方式2），那么credential应该是full_name（向后兼容）
        elif user.student_id == identifier:
            if user.full_name != credential:
                return None
        else:
            return None  # 不应该发生，但作为安全措施
    
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
    """
    自动识别用户类型进行认证
    
    简化认证逻辑：
    1. 管理员用户：username + password（密码验证）
    2. 学生用户：全名（full_name） + 学号（student_id）
    
    Args:
        db: 数据库会话
        identifier: 用户标识符
        credential: 凭证
        
    Returns:
        用户信息字典或None
    """
    from sqlalchemy import select, or_
    from app.models import User
    from app.utils.security import verify_password
    
    # 先尝试管理员认证：username + password
    admin_query = select(User).where(
        User.username == identifier,
        User.role_code.in_(['admin', 'super_admin']),
        User.is_deleted.is_(False),
        User.is_active.is_(True)
    )
    result = await db.execute(admin_query)
    admin_user = result.scalar_one_or_none()
    
    if admin_user and admin_user.hashed_password and verify_password(credential, admin_user.hashed_password):
        return {
            "id": admin_user.id,
            "role_code": admin_user.role_code,
            "username": admin_user.username,
            "full_name": admin_user.full_name,
            "is_active": admin_user.is_active,
            "created_at": admin_user.created_at,
            "updated_at": admin_user.updated_at
        }
    
    # 再尝试学生认证：全名（full_name） + 学号（student_id）
    # 只支持这一种方式：identifier是全名，credential是学号
    student_query = select(User).where(
        User.full_name == identifier,
        User.role_code == 'student',
        User.is_deleted.is_(False),
        User.is_active.is_(True)
    )
    result = await db.execute(student_query)
    student_user = result.scalar_one_or_none()
    
    if student_user and student_user.student_id == credential:
        return {
            "id": student_user.id,
            "role_code": student_user.role_code,
            "student_id": student_user.student_id,
            "full_name": student_user.full_name,
            "class_name": student_user.class_name,
            "study_year": student_user.study_year,
            "is_active": student_user.is_active,
            "created_at": student_user.created_at,
            "updated_at": student_user.updated_at
        }
    
    return None


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
            # 根据令牌中的role_code查询，如果令牌中有role_code则使用，否则默认查admin
            role_condition = User.role_code == role_code if role_code else User.role_code.in_(['admin', 'super_admin'])
            query = select(User).where(
                User.username == subject,
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
    获取当前用户或学生 - 简化的实现，实际应根据需求扩展
    这个函数是为了兼容znt_users API而临时添加的
    """
    # 如果没有提供token，返回一个模拟的管理员用户
    if token is None:
        return {
            "id": 1,
            "username": "admin",
            "role_code": "super_admin",
            "is_active": True,
            "full_name": "系统管理员",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    
    # 此时 token 一定不是 None，尝试获取用户
    user = await get_current_user(token, db)
    if user:
        return user
    
    # 如果token无效，返回模拟的学生用户
    return {
        "id": 1001,
        "username": "student_demo",
        "role_code": "student",
        "is_active": True,
        "full_name": "演示学生",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }


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
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
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
            RefreshToken.expires_at > datetime.utcnow(),
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
        (RefreshToken.expires_at <= datetime.utcnow()) |
        (RefreshToken.is_revoked == True)
    )
    
    result = await db.execute(stmt)
    await db.commit()
    
    return result.rowcount
