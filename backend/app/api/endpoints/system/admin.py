from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.deps import require_admin, get_db
from app.core.config import settings
from app.utils.cache import cache
from app.services.informatics.typst_pdf_cleanup import cleanup_unreferenced_pdfs
from app.db.database import engine

router = APIRouter(prefix="/system")


@router.get("/overview")
async def system_overview(
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    users = await db.execute(text("SELECT COUNT(1) FROM sys_users WHERE is_deleted = false"))
    articles = await db.execute(text("SELECT COUNT(1) FROM wz_articles"))
    agents = await db.execute(text("SELECT COUNT(1) FROM znt_agents WHERE is_deleted = false"))
    sessions = await db.execute(text("SELECT COUNT(1) FROM znt_group_discussion_sessions"))
    messages = await db.execute(text("SELECT COUNT(1) FROM znt_group_discussion_messages"))

    http_total = http_4xx = http_5xx = http_inflight = 0
    http_dur_ms: list[int] = []
    try:
        client = await cache.get_client()
        vals = await client.mget("http:req:total", "http:req:4xx", "http:req:5xx", "http:req:inflight")
        http_total = int(vals[0] or 0)
        http_4xx = int(vals[1] or 0)
        http_5xx = int(vals[2] or 0)
        http_inflight = max(0, int(vals[3] or 0))
        raw_http = await client.lrange("http:req:dur_ms", 0, max(0, int(settings.HTTP_METRICS_SAMPLE_SIZE) - 1))
        http_dur_ms = [int(x) for x in raw_http if str(x).isdigit()]
    except Exception:
        pass

    def q(values: list[int], p: float) -> int:
        if not values:
            return 0
        s = sorted(values)
        idx = int(round((len(s) - 1) * p))
        idx = max(0, min(idx, len(s) - 1))
        return int(s[idx])

    pool_size = checkedin = checkedout = overflow_raw = 0
    overflow = 0
    try:
        p = engine.sync_engine.pool
        pool_size = int(getattr(p, "size")() if callable(getattr(p, "size", None)) else 0)
        checkedin = int(getattr(p, "checkedin")() if callable(getattr(p, "checkedin", None)) else 0)
        checkedout = int(getattr(p, "checkedout")() if callable(getattr(p, "checkedout", None)) else 0)
        overflow_raw = int(getattr(p, "overflow")() if callable(getattr(p, "overflow", None)) else 0)
        overflow = max(0, overflow_raw)
    except Exception:
        pass

    return {
        "timestamp": datetime.now().isoformat(),
        "counts": {
            "users": int(users.scalar() or 0),
            "articles": int(articles.scalar() or 0),
            "agents": int(agents.scalar() or 0),
            "group_sessions": int(sessions.scalar() or 0),
            "group_messages": int(messages.scalar() or 0),
        },
        "observability": {
            "http": {
                "total": http_total,
                "4xx": http_4xx,
                "5xx": http_5xx,
                "inflight": http_inflight,
                "dur_ms": {
                    "n": len(http_dur_ms),
                    "p50": q(http_dur_ms, 0.50),
                    "p90": q(http_dur_ms, 0.90),
                    "p95": q(http_dur_ms, 0.95),
                    "max": max(http_dur_ms) if http_dur_ms else 0,
                },
            },
            "db": {
                "pool_size": pool_size,
                "checked_in": checkedin,
                "checked_out": checkedout,
                "overflow": overflow,
                "capacity_total": int(settings.POSTGRES_MAX_CONNECTIONS) + int(settings.DB_MAX_OVERFLOW),
            },
        },
    }


@router.get("/settings")
async def system_settings(
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    return {
        "project": {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "api_version": settings.API_V1_STR,
            "environment": settings.REACT_APP_ENV,
            "debug": settings.DEBUG,
        },
        "features": {
            "auto_create_tables": bool(settings.AUTO_CREATE_TABLES),
        },
        "server": {
            "host": settings.BACKEND_HOST,
            "port": settings.BACKEND_PORT,
            "log_level": settings.LOG_LEVEL,
            "timezone": settings.TIMEZONE,
        },
        "database": {
            "host": settings.POSTGRES_HOST,
            "port": settings.POSTGRES_PORT,
            "db": settings.POSTGRES_DB,
            "max_connections": settings.POSTGRES_MAX_CONNECTIONS,
            "url_configured": bool(settings.DATABASE_URL),
        },
        "redis": {
            "host": settings.REDIS_HOST,
            "port": settings.REDIS_PORT,
        },
        "security": {
            "jwt_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            "algorithm": settings.ALGORITHM,
        },
        "cors": {
            "origins": settings.CORS_ORIGINS,
        },
    }


@router.get("/typst-metrics")
async def typst_metrics(
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    def pct(values: list[int], p: float) -> int:
        if not values:
            return 0
        values_sorted = sorted(values)
        idx = int(round((len(values_sorted) - 1) * p))
        idx = max(0, min(idx, len(values_sorted) - 1))
        return int(values_sorted[idx])

    total = hit = miss = fail = http_429 = 0
    queue_typst = queue_celery = 0
    dur_ms: list[int] = []
    waited_ms: list[int] = []
    cache_hit_samples: list[int] = []

    try:
        client = await cache.get_client()
        vals = await client.mget("typst:compile:total", "typst:compile:hit", "typst:compile:miss", "typst:compile:fail", "http:429")
        total = int(vals[0] or 0)
        hit = int(vals[1] or 0)
        miss = int(vals[2] or 0)
        fail = int(vals[3] or 0)
        http_429 = int(vals[4] or 0)

        try:
            queue_typst = int(await client.llen("typst") or 0)
        except Exception:
            queue_typst = 0
        try:
            queue_celery = int(await client.llen("celery") or 0)
        except Exception:
            queue_celery = 0

        raw_dur = await client.lrange("typst:compile:dur_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        raw_waited = await client.lrange("typst:compile:waited_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        raw_hit = await client.lrange("typst:compile:cache_hit", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        dur_ms = [int(x) for x in raw_dur if str(x).isdigit()]
        waited_ms = [int(x) for x in raw_waited if str(x).isdigit()]
        cache_hit_samples = [int(x) for x in raw_hit if str(x).isdigit()]
    except Exception:
        pass

    sample_n = len(dur_ms)
    hit_rate = 0.0
    if cache_hit_samples:
        hit_rate = float(sum(1 for x in cache_hit_samples if x == 1)) / float(len(cache_hit_samples))

    return {
        "typst_compile": {
            "counts": {"total": total, "hit": hit, "miss": miss, "fail": fail},
            "cache_hit_rate_recent": hit_rate,
            "dur_ms": {"n": sample_n, "p50": pct(dur_ms, 0.50), "p90": pct(dur_ms, 0.90), "p95": pct(dur_ms, 0.95), "max": max(dur_ms) if dur_ms else 0},
            "waited_ms": {"n": len(waited_ms), "p50": pct(waited_ms, 0.50), "p90": pct(waited_ms, 0.90), "p95": pct(waited_ms, 0.95), "max": max(waited_ms) if waited_ms else 0},
            "queue_length": {"typst": queue_typst, "celery": queue_celery},
            "sample_size": int(settings.TYPST_METRICS_SAMPLE_SIZE),
        },
        "http": {"429_total": http_429},
    }


@router.post("/typst-pdf-cleanup")
async def typst_pdf_cleanup(
    dry_run: bool = True,
    retention_days: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    days = int(retention_days) if retention_days is not None else int(settings.TYPST_PDF_RETENTION_DAYS)
    return await cleanup_unreferenced_pdfs(db=db, retention_days=days, dry_run=bool(dry_run))


@router.get("/metrics")
async def prometheus_metrics(
    _: Dict[str, Any] = Depends(require_admin),
):
    def q(values: list[int], p: float) -> int:
        if not values:
            return 0
        s = sorted(values)
        idx = int(round((len(s) - 1) * p))
        idx = max(0, min(idx, len(s) - 1))
        return int(s[idx])

    total = hit = miss = fail = http_429 = 0
    http_total = http_4xx = http_5xx = http_inflight = 0
    queue_typst = queue_celery = 0
    dur_ms: list[int] = []
    waited_ms: list[int] = []
    cache_hit_samples: list[int] = []
    http_dur_ms: list[int] = []

    try:
        client = await cache.get_client()
        vals = await client.mget(
            "typst:compile:total",
            "typst:compile:hit",
            "typst:compile:miss",
            "typst:compile:fail",
            "http:429",
            "http:req:total",
            "http:req:4xx",
            "http:req:5xx",
            "http:req:inflight",
        )
        total = int(vals[0] or 0)
        hit = int(vals[1] or 0)
        miss = int(vals[2] or 0)
        fail = int(vals[3] or 0)
        http_429 = int(vals[4] or 0)
        http_total = int(vals[5] or 0)
        http_4xx = int(vals[6] or 0)
        http_5xx = int(vals[7] or 0)
        http_inflight = max(0, int(vals[8] or 0))
        queue_typst = int(await client.llen("typst") or 0)
        queue_celery = int(await client.llen("celery") or 0)
        raw_dur = await client.lrange("typst:compile:dur_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        raw_waited = await client.lrange("typst:compile:waited_ms", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        raw_hit = await client.lrange("typst:compile:cache_hit", 0, max(0, int(settings.TYPST_METRICS_SAMPLE_SIZE) - 1))
        dur_ms = [int(x) for x in raw_dur if str(x).isdigit()]
        waited_ms = [int(x) for x in raw_waited if str(x).isdigit()]
        cache_hit_samples = [int(x) for x in raw_hit if str(x).isdigit()]

        raw_http = await client.lrange("http:req:dur_ms", 0, max(0, int(settings.HTTP_METRICS_SAMPLE_SIZE) - 1))
        http_dur_ms = [int(x) for x in raw_http if str(x).isdigit()]
    except Exception:
        pass

    hit_rate = 0.0
    if cache_hit_samples:
        hit_rate = float(sum(1 for x in cache_hit_samples if x == 1)) / float(len(cache_hit_samples))

    pool_size = checkedin = checkedout = overflow_raw = 0
    overflow = 0
    try:
        p = engine.sync_engine.pool
        pool_size = int(getattr(p, "size")() if callable(getattr(p, "size", None)) else 0)
        checkedin = int(getattr(p, "checkedin")() if callable(getattr(p, "checkedin", None)) else 0)
        checkedout = int(getattr(p, "checkedout")() if callable(getattr(p, "checkedout", None)) else 0)
        overflow_raw = int(getattr(p, "overflow")() if callable(getattr(p, "overflow", None)) else 0)
        overflow = max(0, overflow_raw)
    except Exception:
        pass

    lines = [
        "# HELP http_requests_total Total HTTP requests",
        "# TYPE http_requests_total counter",
        f"http_requests_total {http_total}",
        "# HELP ws_http_requests_total Total HTTP requests",
        "# TYPE ws_http_requests_total counter",
        f"ws_http_requests_total {http_total}",
        "# HELP http_requests_4xx_total Total HTTP 4xx responses",
        "# TYPE http_requests_4xx_total counter",
        f"http_requests_4xx_total {http_4xx}",
        "# HELP ws_http_requests_4xx_total Total HTTP 4xx responses",
        "# TYPE ws_http_requests_4xx_total counter",
        f"ws_http_requests_4xx_total {http_4xx}",
        "# HELP http_requests_5xx_total Total HTTP 5xx responses",
        "# TYPE http_requests_5xx_total counter",
        f"http_requests_5xx_total {http_5xx}",
        "# HELP ws_http_requests_5xx_total Total HTTP 5xx responses",
        "# TYPE ws_http_requests_5xx_total counter",
        f"ws_http_requests_5xx_total {http_5xx}",
        "# HELP http_inflight Current in-flight HTTP requests (per worker)",
        "# TYPE http_inflight gauge",
        f"http_inflight {http_inflight}",
        "# HELP ws_http_inflight Current in-flight HTTP requests (per worker)",
        "# TYPE ws_http_inflight gauge",
        f"ws_http_inflight {http_inflight}",
        "# HELP http_request_duration_ms HTTP request duration quantiles (ms, recent samples)",
        "# TYPE http_request_duration_ms gauge",
        f'http_request_duration_ms{{quantile=\"0.5\"}} {q(http_dur_ms, 0.50)}',
        f'http_request_duration_ms{{quantile=\"0.9\"}} {q(http_dur_ms, 0.90)}',
        f'http_request_duration_ms{{quantile=\"0.95\"}} {q(http_dur_ms, 0.95)}',
        f'http_request_duration_ms{{quantile=\"1\"}} {max(http_dur_ms) if http_dur_ms else 0}',
        "# HELP ws_http_request_duration_ms HTTP request duration quantiles (ms, recent samples)",
        "# TYPE ws_http_request_duration_ms gauge",
        f'ws_http_request_duration_ms{{quantile=\"0.5\"}} {q(http_dur_ms, 0.50)}',
        f'ws_http_request_duration_ms{{quantile=\"0.9\"}} {q(http_dur_ms, 0.90)}',
        f'ws_http_request_duration_ms{{quantile=\"0.95\"}} {q(http_dur_ms, 0.95)}',
        f'ws_http_request_duration_ms{{quantile=\"1\"}} {max(http_dur_ms) if http_dur_ms else 0}',
        "# HELP typst_compile_total Total typst compile attempts",
        "# TYPE typst_compile_total counter",
        f"typst_compile_total {total}",
        "# HELP typst_compile_hit_total Cache hit compiles",
        "# TYPE typst_compile_hit_total counter",
        f"typst_compile_hit_total {hit}",
        "# HELP typst_compile_miss_total Cache miss compiles",
        "# TYPE typst_compile_miss_total counter",
        f"typst_compile_miss_total {miss}",
        "# HELP typst_compile_fail_total Failed compiles",
        "# TYPE typst_compile_fail_total counter",
        f"typst_compile_fail_total {fail}",
        "# HELP typst_compile_cache_hit_rate_recent Recent cache hit rate (0-1)",
        "# TYPE typst_compile_cache_hit_rate_recent gauge",
        f"typst_compile_cache_hit_rate_recent {hit_rate}",
        "# HELP typst_compile_dur_ms Compile duration quantiles",
        "# TYPE typst_compile_dur_ms gauge",
        f'typst_compile_dur_ms{{quantile=\"0.5\"}} {q(dur_ms, 0.50)}',
        f'typst_compile_dur_ms{{quantile=\"0.9\"}} {q(dur_ms, 0.90)}',
        f'typst_compile_dur_ms{{quantile=\"0.95\"}} {q(dur_ms, 0.95)}',
        f'typst_compile_dur_ms{{quantile=\"1\"}} {max(dur_ms) if dur_ms else 0}',
        "# HELP typst_compile_waited_ms Semaphore/queue waited ms quantiles",
        "# TYPE typst_compile_waited_ms gauge",
        f'typst_compile_waited_ms{{quantile=\"0.5\"}} {q(waited_ms, 0.50)}',
        f'typst_compile_waited_ms{{quantile=\"0.9\"}} {q(waited_ms, 0.90)}',
        f'typst_compile_waited_ms{{quantile=\"0.95\"}} {q(waited_ms, 0.95)}',
        f'typst_compile_waited_ms{{quantile=\"1\"}} {max(waited_ms) if waited_ms else 0}',
        "# HELP typst_queue_length Queue length",
        "# TYPE typst_queue_length gauge",
        f'typst_queue_length{{queue=\"typst\"}} {queue_typst}',
        f'typst_queue_length{{queue=\"celery\"}} {queue_celery}',
        "# HELP http_429_total Total 429 responses counted by limiter",
        "# TYPE http_429_total counter",
        f"http_429_total {http_429}",
        "# HELP db_pool_size SQLAlchemy pool size",
        "# TYPE db_pool_size gauge",
        f"db_pool_size {pool_size}",
        "# HELP ws_db_pool_size SQLAlchemy pool size",
        "# TYPE ws_db_pool_size gauge",
        f"ws_db_pool_size {pool_size}",
        "# HELP db_pool_checked_in Checked-in connections",
        "# TYPE db_pool_checked_in gauge",
        f"db_pool_checked_in {checkedin}",
        "# HELP ws_db_pool_checked_in Checked-in connections",
        "# TYPE ws_db_pool_checked_in gauge",
        f"ws_db_pool_checked_in {checkedin}",
        "# HELP db_pool_checked_out Checked-out connections",
        "# TYPE db_pool_checked_out gauge",
        f"db_pool_checked_out {checkedout}",
        "# HELP ws_db_pool_checked_out Checked-out connections",
        "# TYPE ws_db_pool_checked_out gauge",
        f"ws_db_pool_checked_out {checkedout}",
        "# HELP db_pool_overflow Overflow connections",
        "# TYPE db_pool_overflow gauge",
        f"db_pool_overflow {overflow}",
        "# HELP ws_db_pool_overflow Overflow connections",
        "# TYPE ws_db_pool_overflow gauge",
        f"ws_db_pool_overflow {overflow}",
        "# HELP db_pool_capacity_total Total configured capacity (pool_size + max_overflow)",
        "# TYPE db_pool_capacity_total gauge",
        f"db_pool_capacity_total {int(settings.POSTGRES_MAX_CONNECTIONS) + int(settings.DB_MAX_OVERFLOW)}",
        "# HELP ws_db_pool_capacity_total Total configured capacity (pool_size + max_overflow)",
        "# TYPE ws_db_pool_capacity_total gauge",
        f"ws_db_pool_capacity_total {int(settings.POSTGRES_MAX_CONNECTIONS) + int(settings.DB_MAX_OVERFLOW)}",
    ]
    return Response(content="\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")
