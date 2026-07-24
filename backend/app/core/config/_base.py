"""
基础配置：项目信息、服务器、部署环境、前端、调试、时区、文件上传
"""

from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator

PROJECT_ROOT = Path(__file__).resolve().parents[4]


class BaseSettingsMixin:
    """项目基础、服务器、部署和前端相关配置"""

    # ==================== 项目信息 ====================
    PROJECT_NAME: str = Field(default="WangSh")
    APP_VERSION: Optional[str] = Field(default=None)
    VERSION: str = Field(default="")
    API_V1_STR: str = Field(default="/api/v1")

    # ==================== 部署环境 ====================
    DEPLOYMENT_ENV: str = Field(default="development")  # development, docker, production

    # ==================== 服务器配置 ====================
    BACKEND_HOST: str = Field(default="0.0.0.0")
    BACKEND_PORT: int = Field(default=8000)
    BACKEND_RELOAD: bool = Field(default=True)

    # ==================== 调试配置 ====================
    DEBUG: bool = Field(default=False)
    LOG_LEVEL: str = Field(default="INFO")

    # ==================== 时区配置 ====================
    TIMEZONE: str = Field(default="Asia/Shanghai")

    # ==================== 数据目录配置 ====================
    DATA_DIR: str = Field(default="./data")

    # ==================== 文件上传配置 ====================
    UPLOAD_FOLDER: str = Field(default="./uploads")
    MAX_UPLOAD_SIZE: int = Field(default=10485760)  # 10MB

    # ==================== 前端配置 ====================
    FRONTEND_PORT: int = Field(default=6608)
    REACT_APP_API_URL: str = Field(default="http://localhost:8000")
    REACT_APP_ENV: str = Field(default="development")
    FRONTEND_HOT_RELOAD: bool = Field(default=True)

    # ==================== 数据库调试配置 ====================
    SQLALCHEMY_ECHO: bool = Field(default=False)
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = Field(default=False)

    # ==================== HTTP 指标采样 ====================
    HTTP_METRICS_SAMPLE_SIZE: int = Field(default=500)

    AUTO_CREATE_TABLES: bool = Field(default=False)

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug_flag(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"debug", "dev", "development"}:
                return True
        return value

    @field_validator("TIMEZONE")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError(
                f"TIMEZONE 必须是有效的 IANA 时区名称，当前值为 {value!r}"
            ) from exc
        return value

    @model_validator(mode="after")
    def apply_app_version(self):
        av = (self.APP_VERSION or "").strip()
        if av:
            self.VERSION = av
        return self
