"""
服务配置：AI 智能体、HTTPX、文章缓存、Typst、GitHub 同步、SSE、群组讨论
"""

from dataclasses import dataclass
import re
from typing import Optional, Tuple
from urllib.parse import urlparse

from pydantic import Field, field_validator


# ==================== 受信内部端点白名单：声明与解析 ====================
# 放在配置层的原因：Settings 构造期就要校验配置（fail-fast），而这一层不能反向导入
# app.services（会经 app.models → app.core.config 形成循环导入）。本段只依赖标准库。
# 校验/放行的执行入口仍在 app.services.agents.endpoint_security，那里复用这里的定义。

@dataclass(frozen=True)
class TrustedEndpoint:
    """一条受信内部端点条目：scheme + host + 显式 port + path 前缀（四元组，缺一不算）。"""

    scheme: str
    host: str          # 小写归一化后的主机名，比较时双方都归一化
    port: int          # 必须是显式端口，不做默认端口推导
    path_prefix: str   # 为空串表示"该 host:port 下任意路径"；非空时按 / 边界前缀匹配

    def describe(self) -> str:
        """审计日志用的安全表示（四元组本身，不含密钥等敏感信息）。"""
        return f"{self.scheme}://{self.host}:{self.port}{self.path_prefix}"


# 条目里出现这些字符一律视为非法（通配、CIDR 的 query 写法、userinfo、query、fragment）
_FORBIDDEN_ENTRY_CHARS = ("*", "?", "#", "@")
_HOST_PATTERN = re.compile(r"[a-z0-9._\-:\[\]]+")


def _parse_one_trusted_endpoint(raw_entry: str) -> TrustedEndpoint:
    """解析单条白名单条目；任何不规范写法都抛 ValueError（启动期 fail-fast）。"""
    entry = raw_entry.strip()
    if not entry:
        raise ValueError("受信端点条目为空")
    for ch in _FORBIDDEN_ENTRY_CHARS:
        if ch in entry:
            raise ValueError(
                f"受信端点条目含非法字符 {ch!r}（不支持通配/CIDR/userinfo/query/fragment）：{entry}"
            )
    parsed = urlparse(entry)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"受信端点条目 scheme 仅支持 http/https：{entry}")
    if parsed.username or parsed.password:
        raise ValueError(f"受信端点条目不允许包含 userinfo：{entry}")
    if parsed.query or parsed.fragment:
        raise ValueError(f"受信端点条目不允许包含 query/fragment：{entry}")
    host = parsed.hostname
    if not host:
        raise ValueError(f"受信端点条目缺少主机名：{entry}")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError(f"受信端点条目端口非法：{entry}") from exc
    # 端口必须显式写出：漏写端口在生产里会静默落到 80/443，等于放宽了匹配条件
    if port is None:
        raise ValueError(f"受信端点条目必须显式写出端口：{entry}")
    host = host.lower().rstrip(".")
    if not _HOST_PATTERN.fullmatch(host):
        raise ValueError(f"受信端点条目主机名非法：{entry}")
    # 条目路径统一成"不带尾斜杠"的前缀，便于按 / 边界比较（"/v1/" 与 "/v1" 等价）
    path = (parsed.path or "").rstrip("/")
    return TrustedEndpoint(scheme=parsed.scheme, host=host, port=port, path_prefix=path)


def parse_trusted_endpoints(raw: str) -> Tuple[TrustedEndpoint, ...]:
    """解析逗号分隔的白名单配置；任一条非法即抛 ValueError（fail-fast，不带病运行）。"""
    if not raw or not raw.strip():
        return ()
    entries = []
    seen = set()
    for item in raw.split(","):
        parsed = _parse_one_trusted_endpoint(item)
        key = (parsed.scheme, parsed.host, parsed.port, parsed.path_prefix)
        if key in seen:  # 重复条目不报错，去重即可
            continue
        seen.add(key)
        entries.append(parsed)
    return tuple(entries)


def _path_prefix_matches(prefix: str, path: str) -> bool:
    """path 是否落在 prefix 之下，且边界是 '/'（/v1 匹配 /v1、/v1/x，不匹配 /v1x、/v10）。"""
    if not prefix:
        return True  # 条目只写了 host:port，视为该服务全部路径
    if path == prefix:
        return True
    return path.startswith(prefix + "/")


def matches_trusted_endpoint(url: str, entries: tuple) -> bool:
    """URL 是否精确命中受信端点条目（只比对配置串，不做 DNS 解析）。"""
    if not entries:
        return False
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower().rstrip(".")
        port = parsed.port
    except ValueError:
        return False  # 端口非法等：不命中，交给后面的常规校验拒绝
    if not host or parsed.username or parsed.password:
        return False
    path = parsed.path or "/"
    # 路径里出现 "." / ".." 段、反斜杠或百分号编码的 "."：httpx 发送前会做点段归一化，
    # 可能让 "/v1/../../other" 这类写法逃出前缀。命中判定按 fail-closed 直接不算命中。
    if "\\" in path or re.search(r"%2e", path, re.IGNORECASE):
        return False
    if any(seg in (".", "..") for seg in path.split("/")):
        return False
    for entry in entries:
        # 四元组逐项严格比对：scheme 完全一致、host 完全相等、port 显式等值、path 前缀边界一致
        if parsed.scheme == entry.scheme and host == entry.host and port == entry.port:
            if _path_prefix_matches(entry.path_prefix, path.rstrip("/") or "/"):
                return True
    return False


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

    # 显式受信的内部服务端点（逗号分隔 URL 前缀，如 http://docker-api-1:5001/v1）。
    # 只能来自部署配置，无任何 API 可写入；命中后跳过 SSRF 内网判定（四元组严格匹配，
    # scheme + host + 显式 port + path 前缀）。留空表示不启用任何内部放行。
    AGENT_TRUSTED_INTERNAL_ENDPOINTS: str = Field(default="")

    # Dify 长连接并发保护：跨 worker 使用 Redis 分布式租约。
    # 该值是保护阈值而非 Dify 官方容量承诺，应按上游配额和压测结果调整。
    DIFY_CONCURRENCY_ENABLED: bool = Field(default=True)
    DIFY_MAX_CONCURRENCY: int = Field(default=20, ge=1, le=10000)
    DIFY_CONCURRENCY_WAIT_SECONDS: float = Field(default=2.0, ge=0, le=60)
    DIFY_CONCURRENCY_LEASE_SECONDS: int = Field(default=180, ge=5, le=3600)

    # ==================== 单节课临时浮动榜单 ====================
    AI_PARTNER_LEADERBOARD_ROUND_ID: str = Field(
        default="classroom", min_length=1, max_length=128, pattern=r".*\S.*"
    )
    AI_PARTNER_SCORING_AGENT_ID: Optional[int] = Field(default=None, gt=0)
    AI_PARTNER_LEADERBOARD_DURATION_SECONDS: int = Field(default=3600, ge=1)

    @field_validator("AI_PARTNER_SCORING_AGENT_ID", mode="before")
    @classmethod
    def normalize_optional_scoring_agent_id(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("AGENT_TRUSTED_INTERNAL_ENDPOINTS")
    @classmethod
    def validate_trusted_internal_endpoints(cls, value: str) -> str:
        """启动期解析受信端点白名单：任一条非法直接让 Settings 构造失败（fail-fast）。

        条目非法（通配、CIDR、漏写端口、userinfo、query、fragment）时宁可起不来，
        也不能带着一条会放行"写错的地址"的配置运行。
        """
        parse_trusted_endpoints(value or "")
        return value or ""

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

    # ==================== XBK 导出 ====================
    # 选课表导出的工作表编辑保护密码。仅为防止误改的工作表保护，不构成文件加密；
    # 生产环境建议通过环境变量覆盖并定期轮换（默认值仅为兼容既有工作簿）。
    XBK_EXPORT_SHEET_PASSWORD: str = Field(default="wangshu0727")
