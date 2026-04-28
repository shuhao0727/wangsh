"""
应用配置 —— 按领域拆分后由主 Settings 类统一组装。

各模块文件：
  _base.py       — 项目信息、服务器、部署、前端、调试、时区
  _security.py   — 密钥、JWT、CORS、超级管理员、会话/IP
  _database.py   — PostgreSQL、Redis、Celery、向量数据库
  _pythonlab.py  — PythonLab 沙箱调试环境
  _services.py   — AI 智能体、HTTPX、文章缓存、Typst、GitHub 同步、SSE
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator

from app.core.config._base import BaseSettingsMixin, PROJECT_ROOT
from app.core.config._security import SecuritySettingsMixin
from app.core.config._database import DatabaseSettingsMixin
from app.core.config._pythonlab import PythonLabSettingsMixin
from app.core.config._services import ServicesSettingsMixin


class Settings(
    BaseSettingsMixin,
    SecuritySettingsMixin,
    DatabaseSettingsMixin,
    PythonLabSettingsMixin,
    ServicesSettingsMixin,
    BaseSettings,
):
    """WangSh 全局配置 —— 按领域继承各 Mixin，仅保留跨域校验逻辑"""

    # ── 跨域 model_validator ──

    @model_validator(mode="after")
    def validate_security_settings(self):
        """生产环境安全校验 + 开发/测试默认值填充"""

        # 连接池默认值
        if "POSTGRES_MAX_CONNECTIONS" not in self.model_fields_set:
            self.POSTGRES_MAX_CONNECTIONS = 20 if self.DEBUG else 50
        if "DB_MAX_OVERFLOW" not in self.model_fields_set:
            self.DB_MAX_OVERFLOW = 10 if self.DEBUG else 20
        if "DB_POOL_TIMEOUT_SECONDS" not in self.model_fields_set:
            self.DB_POOL_TIMEOUT_SECONDS = 15 if self.DEBUG else 30

        self.COOKIE_SAMESITE = (self.COOKIE_SAMESITE or "lax").lower()
        if not self.DEBUG and "COOKIE_SECURE" not in self.model_fields_set:
            self.COOKIE_SECURE = True

        # 开发/Docker 环境自动推导路径
        if self.DEBUG:
            if not (self.TYPST_PDF_STORAGE_DIR or "").strip() or str(self.TYPST_PDF_STORAGE_DIR).startswith("/app/"):
                if self.DEPLOYMENT_ENV == "docker" or os.path.exists("/.dockerenv"):
                    self.TYPST_PDF_STORAGE_DIR = "/app/data/typst_pdfs"
                else:
                    self.TYPST_PDF_STORAGE_DIR = str(PROJECT_ROOT / "data" / "typst_pdfs")
            if not (self.DAP_HOST_IP or "").strip():
                if self.DEPLOYMENT_ENV == "docker" or os.path.exists("/.dockerenv"):
                    self.DAP_HOST_IP = "host.docker.internal"
                else:
                    self.DAP_HOST_IP = "127.0.0.1"
            return self

        # 生产环境强制要求
        def must_set(name: str, value: str):
            if not value or str(value).strip() in {"", "change_me"}:
                raise ValueError(f"{name} 未配置或仍为默认值，请在 .env 中设置为安全值")

        must_set("SECRET_KEY", self.SECRET_KEY)
        must_set("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD)
        must_set("SUPER_ADMIN_PASSWORD", self.SUPER_ADMIN_PASSWORD)
        must_set("AGENT_API_KEY_ENCRYPTION_KEY", self.AGENT_API_KEY_ENCRYPTION_KEY or "")

        if len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY 长度过短，建议至少 32 字符")

        # 生产环境路径兜底
        if not (self.TYPST_PDF_STORAGE_DIR or "").strip() or str(self.TYPST_PDF_STORAGE_DIR).startswith("/app/"):
            if self.DEPLOYMENT_ENV == "docker" or os.path.exists("/.dockerenv"):
                self.TYPST_PDF_STORAGE_DIR = "/app/data/typst_pdfs"
            else:
                self.TYPST_PDF_STORAGE_DIR = str(PROJECT_ROOT / "data" / "typst_pdfs")
        if not (self.DAP_HOST_IP or "").strip():
            if self.DEPLOYMENT_ENV == "docker" or os.path.exists("/.dockerenv"):
                self.DAP_HOST_IP = "host.docker.internal"
            else:
                self.DAP_HOST_IP = "127.0.0.1"
        return self

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# 全局配置实例 —— 保持向后兼容：from app.core.config import settings
settings = Settings()
