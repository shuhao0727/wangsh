"""
数据库配置：PostgreSQL、Redis、Celery、向量数据库
"""

import os
import json
from typing import List, Optional, Union
from pydantic import Field, field_validator


class DatabaseSettingsMixin:
    """数据库、缓存和任务队列相关配置"""

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
    DATABASE_URL: Optional[str] = Field(default=None)

    # ==================== Redis 配置 ====================
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_CONTAINER_NAME: str = Field(default="wangsh-redis")
    REDIS_URL: str = Field(default="redis://${REDIS_HOST}:${REDIS_PORT}/0")
    REDIS_CACHE_URL: str = Field(default="redis://${REDIS_HOST}:${REDIS_PORT}/1")

    # ==================== Redis 连接优化 ====================
    REDIS_CONNECT_TIMEOUT: int = Field(default=5)
    REDIS_MAX_CONNECTIONS: int = Field(default=150)
    STUDENT_SESSION_TTL: int = Field(default=7200)
    REDIS_DB_CACHE: int = Field(default=1)
    REDIS_PASSWORD: Optional[str] = Field(default=None)
    REDIS_SSL: bool = Field(default=False)
    REDIS_SSL_CERT_REQS: str = Field(default="required")  # "required" | "optional" | "none"

    # ==================== Redis Sentinel 高可用 ====================
    REDIS_SENTINEL_ENABLED: bool = Field(default=False)
    REDIS_SENTINEL_MASTER: str = Field(default="mymaster")
    REDIS_SENTINEL_HOSTS: str = Field(default="")  # host1:port1,host2:port2

    # ==================== Celery 配置 ====================
    CELERY_BROKER_URL: str = Field(default="${REDIS_URL}")
    CELERY_RESULT_BACKEND: str = Field(default="${REDIS_URL}")
    CELERY_TASK_SERIALIZER: str = Field(default="json")
    CELERY_RESULT_SERIALIZER: str = Field(default="json")
    CELERY_ACCEPT_CONTENT: List[str] = Field(default=["json"])

    # ==================== 向量数据库配置（预留） ====================
    VECTOR_DB_HOST: Optional[str] = Field(default=None)
    VECTOR_DB_PORT: Optional[int] = Field(default=None)
    VECTOR_DB_URL: Optional[str] = Field(default=None)

    # ── validators ──

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> Optional[str]:
        """构建数据库连接 URL"""
        if v:
            if "${DATABASE_DRIVER}" in v and "${POSTGRES_USER}" in v:
                values = info.data
                driver = values.get("DATABASE_DRIVER", "asyncpg")
                username = values.get("POSTGRES_USER")
                password = values.get("POSTGRES_PASSWORD")
                host = values.get("POSTGRES_HOST")
                port = values.get("POSTGRES_PORT")
                db = values.get("POSTGRES_DB")
                if all([driver, username, password, host, port, db]):
                    return (v.replace("${DATABASE_DRIVER}", driver)
                             .replace("${POSTGRES_USER}", username)
                             .replace("${POSTGRES_PASSWORD}", password)
                             .replace("${POSTGRES_HOST}", host)
                             .replace("${POSTGRES_PORT}", port)
                             .replace("${POSTGRES_DB}", db))
            return v

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

    @field_validator("POSTGRES_HOST", "REDIS_HOST", mode="after")
    @classmethod
    def adjust_host_for_environment(cls, v: str, info):
        """智能检测运行环境并调整主机地址"""
        values = info.data
        deployment_env = values.get("DEPLOYMENT_ENV", "development")

        def _is_in_docker() -> bool:
            try:
                if os.path.exists("/.dockerenv"):
                    return True
                try:
                    with open("/proc/self/cgroup", "r") as f:
                        cg = f.read()
                        if "docker" in cg or "kubepods" in cg:
                            return True
                except (IOError, OSError):
                    pass
            except (IOError, OSError):
                pass
            return False

        container_name = values.get("REDIS_CONTAINER_NAME", "wangsh-redis")

        if deployment_env == "docker":
            if v in ["127.0.0.1", "localhost"]:
                return "postgres" if "POSTGRES" in info.field_name else "redis"
        elif deployment_env == "production":
            return v
        elif _is_in_docker():
            if v in ["127.0.0.1", "localhost"]:
                return "postgres" if "POSTGRES" in info.field_name else container_name
        return v

    @field_validator("REDIS_URL", "REDIS_CACHE_URL", mode="before")
    @classmethod
    def replace_redis_url_variables(cls, v: str, info) -> str:
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
        if v and "${REDIS_URL}" in v:
            values = info.data
            redis_url = values.get("REDIS_URL")
            if redis_url:
                return v.replace("${REDIS_URL}", redis_url)
        return v

    @field_validator("CELERY_ACCEPT_CONTENT", mode="before")
    @classmethod
    def parse_celery_accept_content(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @field_validator("VECTOR_DB_URL", mode="before")
    @classmethod
    def replace_vector_db_variables(cls, v: Optional[str], info) -> Optional[str]:
        if v and "${VECTOR_DB_HOST}" in v and "${VECTOR_DB_PORT}" in v:
            values = info.data
            host = values.get("VECTOR_DB_HOST")
            port = values.get("VECTOR_DB_PORT")
            if host and port:
                return v.replace("${VECTOR_DB_HOST}", host).replace("${VECTOR_DB_PORT}", str(port))
        return v
