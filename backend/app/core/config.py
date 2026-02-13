"""
应用配置管理
从环境变量加载配置，提供类型安全的配置访问
"""

import os
import json
from pathlib import Path
from typing import List, Optional, Union
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, model_validator

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """应用配置类，从环境变量加载所有配置"""
    
    # ==================== 项目信息 ====================
    PROJECT_NAME: str = Field(default="WangSh")
    VERSION: str = Field(default="1.0.0")
    API_V1_STR: str = Field(default="/api/v1")
    
    # ==================== 部署环境 ====================
    DEPLOYMENT_ENV: str = Field(default="development")  # development, docker, production
    
    # ==================== 服务器配置 ====================
    BACKEND_HOST: str = Field(default="0.0.0.0")
    BACKEND_PORT: int = Field(default=8000)
    BACKEND_RELOAD: bool = Field(default=True)  # 开发模式热重载
    
    # ==================== 安全配置 ====================
    SECRET_KEY: str = Field(default="change_me")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=11520)  # 8 days (60*24*8)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30)       # 30 days
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_COOKIE_NAME: str = Field(default="ws_access_token")
    REFRESH_TOKEN_COOKIE_NAME: str = Field(default="ws_refresh_token")
    COOKIE_SAMESITE: str = Field(default="lax")
    COOKIE_SECURE: bool = Field(default=False)
    COOKIE_DOMAIN: Optional[str] = Field(default=None)
    
    # ==================== 调试配置 ====================
    DEBUG: bool = Field(default=True)
    LOG_LEVEL: str = Field(default="INFO")
    
    # ==================== CORS 配置 ====================
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:6608", "http://127.0.0.1:6608"])

    # ==================== 外部 AI 服务（可选） ====================
    OPENROUTER_API_URL: str = Field(default="https://openrouter.ai/api/v1")
    OPENROUTER_API_KEY: Optional[str] = Field(default=None)
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """解析CORS_ORIGINS，支持JSON字符串或列表"""
        if isinstance(v, str):
            try:
                # 尝试解析JSON
                return json.loads(v)
            except json.JSONDecodeError:
                # 如果不是JSON，尝试按逗号分割
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    # ==================== 数据库配置 ====================
    POSTGRES_USER: str = Field(default="admin")
    POSTGRES_PASSWORD: str = Field(default="change_me")
    POSTGRES_DB: str = Field(default="wangsh_db")
    POSTGRES_HOST: str = Field(default="127.0.0.1")
    POSTGRES_PORT: str = Field(default="5432")
    POSTGRES_MAX_CONNECTIONS: int = Field(default=20)
    DB_MAX_OVERFLOW: int = Field(default=20)
    DB_POOL_TIMEOUT_SECONDS: int = Field(default=30)
    POSTGRES_STATEMENT_TIMEOUT: int = Field(default=30000)
    DATABASE_DRIVER: str = Field(default="asyncpg")
    
    # 数据库URL - 优先使用环境变量中的值
    DATABASE_URL: Optional[str] = Field(default=None)
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> Optional[str]:
        """构建数据库连接 URL"""
        # 如果环境变量中已经有DATABASE_URL，直接使用
        if v:
            # 处理环境变量中的变量插值
            if "${DATABASE_DRIVER}" in v and "${POSTGRES_USER}" in v and "${POSTGRES_PASSWORD}" in v and "${POSTGRES_HOST}" in v and "${POSTGRES_PORT}" in v and "${POSTGRES_DB}" in v:
                values = info.data
                driver = values.get("DATABASE_DRIVER", "asyncpg")
                username = values.get("POSTGRES_USER")
                password = values.get("POSTGRES_PASSWORD")
                host = values.get("POSTGRES_HOST")
                port = values.get("POSTGRES_PORT")
                db = values.get("POSTGRES_DB")
                
                if all([driver, username, password, host, port, db]):
                    return v.replace("${DATABASE_DRIVER}", driver) \
                           .replace("${POSTGRES_USER}", username) \
                           .replace("${POSTGRES_PASSWORD}", password) \
                           .replace("${POSTGRES_HOST}", host) \
                           .replace("${POSTGRES_PORT}", port) \
                           .replace("${POSTGRES_DB}", db)
            return v
        
        # 否则从各个组件构建
        values = info.data
        driver = values.get("DATABASE_DRIVER", "asyncpg")
        username = values.get("POSTGRES_USER")
        password = values.get("POSTGRES_PASSWORD")
        host = values.get("POSTGRES_HOST")
        port = values.get("POSTGRES_PORT")
        db = values.get("POSTGRES_DB")
        
        if all([driver, username, password, host, port, db]):
            return f"postgresql+{driver}://{username}:{password}@{host}:{port}/{db}"
        return None
    
    # ==================== Redis 配置 ====================
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_CONTAINER_NAME: str = Field(default="wangsh-redis")
    
    @field_validator("POSTGRES_HOST", "REDIS_HOST", mode="after")
    @classmethod
    def adjust_host_for_environment(cls, v: str, info):
        """智能检测运行环境并调整主机地址"""
        values = info.data
        deployment_env = values.get("DEPLOYMENT_ENV", "development")
        
        # 智能检测是否在Docker容器中运行
        def is_in_docker_container() -> bool:
            """检测是否在Docker容器中运行"""
            try:
                # 方法1: 检查/.dockerenv文件是否存在
                if os.path.exists("/.dockerenv"):
                    return True
                
                # 方法2: 检查cgroup信息
                try:
                    with open("/proc/self/cgroup", "r") as f:
                        cgroup_content = f.read()
                        if "docker" in cgroup_content or "kubepods" in cgroup_content:
                            return True
                except:
                    pass
                
                # 方法3: 检查容器ID文件
                if os.path.exists("/proc/self/cgroup") and "docker" in open("/proc/self/cgroup").read():
                    return True
                    
            except:
                pass
            return False
        
        # 获取配置的容器名称
        container_name = values.get("REDIS_CONTAINER_NAME", "wangsh-redis")
        
        # 决策逻辑
        if deployment_env == "docker":
            # 明确指定Docker环境
            if v in ["127.0.0.1", "localhost"]:
                return "postgres" if "POSTGRES" in info.field_name else "redis"
        
        elif deployment_env == "production":
            # 生产环境中，保持原值（应该由环境变量指定具体地址）
            return v
        
        elif is_in_docker_container():
            # 自动检测到在容器中运行，但部署环境未明确设置
            if v in ["127.0.0.1", "localhost"]:
                return "postgres" if "POSTGRES" in info.field_name else container_name
        
        # 开发环境中，保持原值
        return v
    
    REDIS_URL: str = Field(default="redis://${REDIS_HOST}:${REDIS_PORT}/0")
    REDIS_CACHE_URL: str = Field(default="redis://${REDIS_HOST}:${REDIS_PORT}/1")
    
    # ==================== Celery 配置 ====================
    CELERY_BROKER_URL: str = Field(default="${REDIS_URL}")
    CELERY_RESULT_BACKEND: str = Field(default="${REDIS_URL}")
    CELERY_TASK_SERIALIZER: str = Field(default="json")
    CELERY_RESULT_SERIALIZER: str = Field(default="json")
    CELERY_ACCEPT_CONTENT: List[str] = Field(default=["json"])
    
    @field_validator("REDIS_URL", "REDIS_CACHE_URL", mode="before")
    @classmethod
    def replace_redis_url_variables(cls, v: str, info) -> str:
        """替换Redis URL中的HOST和PORT变量"""
        if v and "${REDIS_HOST}" in v and "${REDIS_PORT}" in v:
            values = info.data
            host = values.get("REDIS_HOST")
            port = values.get("REDIS_PORT")
            if host and port:
                return v.replace("${REDIS_HOST}", host).replace("${REDIS_PORT}", str(port))
        return v
    
    @field_validator("CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", mode="before")
    @classmethod
    def replace_celery_redis_variables(cls, v: str, info) -> str:
        """替换Celery URL中的REDIS_URL变量"""
        if v and "${REDIS_URL}" in v:
            values = info.data
            redis_url = values.get("REDIS_URL")
            if redis_url:
                return v.replace("${REDIS_URL}", redis_url)
        return v
    
    @field_validator("CELERY_ACCEPT_CONTENT", mode="before")
    @classmethod
    def parse_celery_accept_content(cls, v: Union[str, List[str]]) -> List[str]:
        """解析CELERY_ACCEPT_CONTENT"""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [item.strip() for item in v.split(",") if item.strip()]
        return v
    
    # ==================== 文件上传配置 ====================
    UPLOAD_FOLDER: str = Field(default="./uploads")
    MAX_UPLOAD_SIZE: int = Field(default=10485760)  # 10MB
    
    # ==================== 向量数据库配置（预留） ====================
    VECTOR_DB_HOST: Optional[str] = Field(default=None)
    VECTOR_DB_PORT: Optional[int] = Field(default=None)
    VECTOR_DB_URL: Optional[str] = Field(default=None)
    
    @field_validator("VECTOR_DB_URL", mode="before")
    @classmethod
    def replace_vector_db_variables(cls, v: Optional[str], info) -> Optional[str]:
        """替换向量数据库URL中的变量"""
        if v and "${VECTOR_DB_HOST}" in v and "${VECTOR_DB_PORT}" in v:
            values = info.data
            host = values.get("VECTOR_DB_HOST")
            port = values.get("VECTOR_DB_PORT")
            if host and port:
                return v.replace("${VECTOR_DB_HOST}", host).replace("${VECTOR_DB_PORT}", str(port))
        return v
    
    # ==================== 数据目录配置 ====================
    DATA_DIR: str = Field(default="./data")
    
    # ==================== 前端配置 ====================
    FRONTEND_PORT: int = Field(default=6608)
    REACT_APP_API_URL: str = Field(default="http://localhost:8000")
    REACT_APP_ENV: str = Field(default="development")
    FRONTEND_HOT_RELOAD: bool = Field(default=True)
    
    # ==================== 数据库调试配置 ====================
    SQLALCHEMY_ECHO: bool = Field(default=False)
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = Field(default=False)
    
    # ==================== 超级管理员配置 ====================
    SUPER_ADMIN_USERNAME: str = Field(default="admin")
    SUPER_ADMIN_PASSWORD: str = Field(default="change_me")
    SUPER_ADMIN_EMAIL: str = Field(default="admin@wangsh.com")
    SUPER_ADMIN_FULL_NAME: str = Field(default="系统超级管理员")
    
    # ==================== 时区配置 ====================
    TIMEZONE: str = Field(default="Asia/Shanghai")
    
    # ==================== 文章相关配置 ====================
    # 缓存配置
    ARTICLE_CACHE_ADMIN_LIST_TTL: int = Field(default=180)      # 管理员列表3分钟
    ARTICLE_CACHE_ADMIN_DETAIL_TTL: int = Field(default=300)    # 管理员详情5分钟
    ARTICLE_CACHE_USER_DETAIL_TTL: int = Field(default=600)     # 用户详情10分钟
    ARTICLE_CACHE_PUBLIC_LIST_TTL: int = Field(default=300)     # 公开列表5分钟
    ARTICLE_CACHE_PUBLIC_DETAIL_TTL: int = Field(default=600)   # 公开详情10分钟
    ARTICLE_CACHE_DEFAULT_TTL: int = Field(default=300)         # 默认5分钟
    
    # 分页配置
    ARTICLE_PAGE_SIZE_DEFAULT: int = Field(default=20)          # 默认分页大小
    ARTICLE_PAGE_SIZE_MAX: int = Field(default=100)             # 最大分页大小
    CATEGORY_PAGE_SIZE_DEFAULT: int = Field(default=20)         # 分类默认分页
    CATEGORY_PAGE_SIZE_MAX: int = Field(default=100)            # 分类最大分页
    CATEGORY_PUBLIC_PAGE_SIZE: int = Field(default=50)          # 公开分类分页
    CATEGORY_POPULAR_LIMIT: int = Field(default=10)             # 热门分类限制
    CATEGORY_SEARCH_LIMIT: int = Field(default=20)              # 搜索分类限制
    
    # Redis连接优化配置
    REDIS_CONNECT_TIMEOUT: int = Field(default=5)               # 连接超时秒数
    STUDENT_SESSION_TTL: int = Field(default=7200)              # 学生会话有效期（秒）2小时
    REDIS_DB_CACHE: int = Field(default=0)                      # 缓存数据库索引

    GROUP_DISCUSSION_REDIS_ENABLED: bool = Field(default=True)
    GROUP_DISCUSSION_METRICS_ENABLED: bool = Field(default=False)
    GROUP_DISCUSSION_LAST_ID_TTL: int = Field(default=86400)
    GROUP_DISCUSSION_LAST_AT_TTL: int = Field(default=86400)
    GROUP_DISCUSSION_RATE_LIMIT_SECONDS: int = Field(default=2)
    GROUP_DISCUSSION_COMPARE_CACHE_TTL: int = Field(default=600)

    AUTO_CREATE_TABLES: bool = Field(default=False)

    TYPST_COMPILE_MAX_CONCURRENCY: int = Field(default=2)
    TYPST_COMPILE_RATE_LIMIT_SECONDS: int = Field(default=1)
    TYPST_COMPILE_USE_CELERY: bool = Field(default=False)
    TYPST_PDF_STORAGE_DIR: str = Field(default="/app/data/typst_pdfs")
    TYPST_STORE_PDF_IN_DB: bool = Field(default=False)
    TYPST_METRICS_SAMPLE_SIZE: int = Field(default=200)
    TYPST_PDF_RETENTION_DAYS: int = Field(default=30)
    TYPST_ASSET_MAX_BYTES: int = Field(default=5 * 1024 * 1024)
    TYPST_ASSET_ALLOWED_EXTS: str = Field(default="png,jpg,jpeg,gif,webp,svg,pdf")
    TYPST_ASSET_UPLOAD_RATE_LIMIT_SECONDS: float = Field(default=1.0)
    HTTP_METRICS_SAMPLE_SIZE: int = Field(default=500)

    @model_validator(mode="after")
    def validate_security_settings(self):
        if "POSTGRES_MAX_CONNECTIONS" not in self.model_fields_set:
            self.POSTGRES_MAX_CONNECTIONS = 20 if self.DEBUG else 50
        if "DB_MAX_OVERFLOW" not in self.model_fields_set:
            self.DB_MAX_OVERFLOW = 10 if self.DEBUG else 20
        if "DB_POOL_TIMEOUT_SECONDS" not in self.model_fields_set:
            self.DB_POOL_TIMEOUT_SECONDS = 15 if self.DEBUG else 30
        self.COOKIE_SAMESITE = (self.COOKIE_SAMESITE or "lax").lower()

        if self.DEBUG:
            return self

        def must_set(name: str, value: str):
            if not value or str(value).strip() in {"", "change_me"}:
                raise ValueError(f"{name} 未配置或仍为默认值，请在 .env 中设置为安全值")

        must_set("SECRET_KEY", self.SECRET_KEY)
        must_set("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD)
        must_set("SUPER_ADMIN_PASSWORD", self.SUPER_ADMIN_PASSWORD)

        if len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY 长度过短，建议至少 32 字符")

        return self
    
    class Config:
        env_file = str(PROJECT_ROOT / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = False  # 环境变量不区分大小写
        extra = "ignore"  # 忽略额外的环境变量


# 创建全局配置实例
settings = Settings()
