"""
安全配置：密钥、JWT、CORS、Cookie、超级管理员、会话/IP 控制
"""

import json
from typing import List, Optional, Union
from pydantic import Field, field_validator


class SecuritySettingsMixin:
    """认证、授权和安全相关配置"""

    # ==================== 安全配置 ====================
    SECRET_KEY: str = Field(default="change_me")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_COOKIE_NAME: str = Field(default="ws_access_token")
    REFRESH_TOKEN_COOKIE_NAME: str = Field(default="ws_refresh_token")
    COOKIE_SAMESITE: str = Field(default="lax")
    COOKIE_SECURE: bool = Field(default=False)
    COOKIE_DOMAIN: Optional[str] = Field(default=None)

    # ==================== CORS 配置 ====================
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:6608", "http://127.0.0.1:6608"])

    # ==================== 超级管理员配置 ====================
    SUPER_ADMIN_USERNAME: str = Field(default="admin")
    SUPER_ADMIN_PASSWORD: str = Field(default="change_me")
    SUPER_ADMIN_EMAIL: str = Field(default="admin@wangsh.com")
    SUPER_ADMIN_FULL_NAME: str = Field(default="系统超级管理员")

    # ==================== 会话/IP 唯一性控制 ====================
    AUTH_TRUST_X_FORWARDED_FOR: bool = Field(default=True)
    AUTH_IP_HEADER_ORDER: str = Field(default="X-Forwarded-For,X-Real-IP,Forwarded,Remote-Addr")
    AUTH_USER_UNIQUE_PER_IP: bool = Field(default=True)
    AUTH_IP_UNIQUE_PER_USER: bool = Field(default=True)
    AUTH_ENFORCE_SAME_IP_PER_REQUEST: bool = Field(default=False)
    # 0 表示自动取 ACCESS_TOKEN_EXPIRE_MINUTES*60 或 STUDENT_SESSION_TTL
    AUTH_SESSION_TTL_SECONDS: int = Field(default=0)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """解析 CORS_ORIGINS，支持 JSON 字符串或逗号分隔"""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
