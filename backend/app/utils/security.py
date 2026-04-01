"""
安全工具模块
提供密码哈希和验证功能
使用环境变量配置超级管理员密码
使用直接 bcrypt 库绕过 passlib 兼容性问题
"""

import bcrypt
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_password_hash(password: str) -> str:
    """
    生成密码哈希
    使用 bcrypt 算法，直接调用 bcrypt 库
    """
    try:
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            raise ValueError("密码超过 bcrypt 72 字节限制")
        
        # 生成 salt 并哈希密码
        salt = bcrypt.gensalt()
        hashed_bytes = bcrypt.hashpw(password_bytes, salt)
        
        # 将字节转换为字符串存储
        return hashed_bytes.decode('utf-8')
    except Exception as e:
        logger.error(f"密码哈希失败: {e}")
        raise


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    使用 bcrypt 验证
    """
    try:
        plain_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"密码验证失败: {e}")
        return False


def needs_rehash(hashed_password: str) -> bool:
    """
    检查密码是否需要重新哈希
    bcrypt 默认不需要重新哈希
    """
    try:
        # 检查 bcrypt 哈希的轮数（cost factor）
        # 如果哈希使用旧的/较低的轮数，可能需要重新哈希
        # 这里简单返回 False，实际项目中可以检查轮数
        return False
    except Exception:
        return False


def hash_super_admin_password() -> str:
    """
    专门用于哈希超级管理员密码的函数
    使用环境变量中的密码进行哈希
    """
    admin_password = settings.SUPER_ADMIN_PASSWORD
    if not admin_password:
        raise ValueError("超级管理员密码未配置，请检查 .env 文件中的 SUPER_ADMIN_PASSWORD 设置")
    
    # bcrypt 有 72 字节限制，超过应拒绝而非静默截断
    if len(admin_password.encode('utf-8')) > 72:
        raise ValueError("超级管理员密码超过 bcrypt 72 字节限制，请缩短密码")

    return get_password_hash(admin_password)
