"""
服务配置：AI 智能体、HTTPX、文章缓存、Typst、GitHub 同步、SSE、群组讨论
"""

from typing import Optional
from pydantic import Field


class ServicesSettingsMixin:
    """外部服务、智能体、文章、Typst、GitHub 同步等配置"""

    # ==================== 外部 AI 服务（可选） ====================
    OPENROUTER_API_URL: str = Field(default="https://openrouter.ai/api/v1")
    OPENROUTER_API_KEY: Optional[str] = Field(default=None)
    AGENT_API_KEY_ENCRYPTION_KEY: Optional[str] = Field(default=None)

    # ==================== 智能体服务配置 ====================
    AGENT_API_URL: Optional[str] = Field(default=None)
    AGENT_API_KEY: Optional[str] = Field(default=None)
    AI_AGENT_MAX_OUTPUT_TOKENS: int = Field(default=8192, ge=256, le=65536)

    # ==================== HTTPX 客户端配置 ====================
    HTTPX_MAX_CONNECTIONS: int = Field(default=100)
    HTTPX_MAX_KEEPALIVE_CONNECTIONS: int = Field(default=20)
    HTTPX_TIMEOUT: float = Field(default=60.0)
    HTTPX_CONNECT_TIMEOUT: float = Field(default=10.0)

    # ==================== Agent 缓存配置 ====================
    AGENT_CACHE_TTL: int = Field(default=60)
    AGENT_CACHE_MAXSIZE: int = Field(default=1000)

    # ==================== 文章相关配置 ====================
    ARTICLE_CACHE_ADMIN_LIST_TTL: int = Field(default=180)
    ARTICLE_CACHE_ADMIN_DETAIL_TTL: int = Field(default=300)
    ARTICLE_CACHE_USER_DETAIL_TTL: int = Field(default=600)
    ARTICLE_CACHE_PUBLIC_LIST_TTL: int = Field(default=600)
    ARTICLE_CACHE_PUBLIC_DETAIL_TTL: int = Field(default=600)
    ARTICLE_CACHE_DEFAULT_TTL: int = Field(default=300)

    ARTICLE_PAGE_SIZE_DEFAULT: int = Field(default=20)
    ARTICLE_PAGE_SIZE_MAX: int = Field(default=100)
    CATEGORY_PAGE_SIZE_DEFAULT: int = Field(default=20)
    CATEGORY_PAGE_SIZE_MAX: int = Field(default=200)
    CATEGORY_PUBLIC_PAGE_SIZE: int = Field(default=50)
    CATEGORY_POPULAR_LIMIT: int = Field(default=10)
    CATEGORY_SEARCH_LIMIT: int = Field(default=20)

    # ==================== SSE pub/sub 配置 ====================
    SSE_REDIS_PUBSUB_ENABLED: bool = Field(default=True)

    # ==================== 群组讨论 ====================
    GROUP_DISCUSSION_REDIS_ENABLED: bool = Field(default=True)
    GROUP_DISCUSSION_METRICS_ENABLED: bool = Field(default=True)
    GROUP_DISCUSSION_LAST_ID_TTL: int = Field(default=86400)
    GROUP_DISCUSSION_LAST_AT_TTL: int = Field(default=86400)
    GROUP_DISCUSSION_RATE_LIMIT_SECONDS: int = Field(default=2)
    GROUP_DISCUSSION_JOIN_LOCK_SECONDS: int = Field(default=300)
    GROUP_DISCUSSION_COMPARE_CACHE_TTL: int = Field(default=600)
    GROUP_DISCUSSION_LIST_RECENT_HOURS: int = Field(default=1)

    # ==================== IT 游戏资源库 ====================
    IT_GAME_MAX_UPLOAD_BYTES: int = Field(default=500 * 1024 * 1024, gt=0)

    # ==================== Typst 编译 ====================
    TYPST_COMPILE_MAX_CONCURRENCY: int = Field(default=2)
    TYPST_COMPILE_RATE_LIMIT_SECONDS: int = Field(default=1)
    # 单次 typst 编译最大耗时（秒），超时则终止，防止恶意/超大文件阻塞有限的编译并发槽
    TYPST_COMPILE_TIMEOUT_SECONDS: int = Field(default=120)
    TYPST_COMPILE_USE_CELERY: bool = Field(default=False)
    TYPST_PDF_STORAGE_DIR: str = Field(default="/app/data/typst_pdfs")
    TYPST_STORE_PDF_IN_DB: bool = Field(default=False)
    TYPST_METRICS_SAMPLE_SIZE: int = Field(default=200)
    TYPST_PDF_RETENTION_DAYS: int = Field(default=30)
    TYPST_ASSET_MAX_BYTES: int = Field(default=5 * 1024 * 1024)
    TYPST_ASSET_ALLOWED_EXTS: str = Field(default="png,jpg,jpeg,gif,webp,svg,pdf")
    TYPST_ASSET_UPLOAD_RATE_LIMIT_SECONDS: float = Field(default=1.0)

    # ==================== GitHub 同步（信息学笔记） ====================
    GITHUB_SYNC_ENABLED: bool = Field(default=False)
    GITHUB_SYNC_INTERVAL_HOURS: int = Field(default=48)
    GITHUB_SYNC_REPO_OWNER: str = Field(default="shuhao0727")
    GITHUB_SYNC_REPO_NAME: str = Field(default="2-My-notes")
    GITHUB_SYNC_REPO_BRANCH: str = Field(default="main")
    GITHUB_SYNC_TOKEN: str = Field(default="")
    GITHUB_SYNC_DELETE_MODE: str = Field(default="unpublish")
