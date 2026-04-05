"""
公共指标采集工具

从 system/admin.py 提取的可复用指标函数，消除 3 处重复的百分位计算
和 Redis/DB 指标采集代码。
"""

from typing import List, Tuple

from app.core.config import settings
from app.db.database import engine
from app.utils.cache import cache


def percentile(values: List[int], p: float) -> int:
    """计算百分位数

    Args:
        values: 整数列表
        p: 百分位 (0.0 ~ 1.0)

    Returns:
        百分位值，空列表返回 0
    """
    if not values:
        return 0
    s = sorted(values)
    idx = int(round((len(s) - 1) * p))
    idx = max(0, min(idx, len(s) - 1))
    return int(s[idx])


async def collect_http_metrics() -> dict:
    """采集 HTTP 请求指标（从 Redis）

    Returns:
        {
            "total": int, "4xx": int, "5xx": int, "inflight": int,
            "dur_ms": {"n": int, "p50": int, "p90": int, "p95": int, "max": int}
        }
    """
    total = http_4xx = http_5xx = inflight = 0
    dur_ms: List[int] = []

    try:
        client = await cache.get_client()
        vals = await client.mget(
            "http:req:total", "http:req:4xx", "http:req:5xx", "http:req:inflight"
        )
        total = int(vals[0] or 0)
        http_4xx = int(vals[1] or 0)
        http_5xx = int(vals[2] or 0)
        inflight = max(0, int(vals[3] or 0))

        raw = await client.lrange(  # type: ignore[misc]
            "http:req:dur_ms", 0, max(0, settings.HTTP_METRICS_SAMPLE_SIZE - 1)
        )
        dur_ms = [int(x) for x in raw if str(x).isdigit()]
    except Exception:
        pass

    return {
        "total": total,
        "4xx": http_4xx,
        "5xx": http_5xx,
        "inflight": inflight,
        "dur_ms": {
            "n": len(dur_ms),
            "p50": percentile(dur_ms, 0.50),
            "p90": percentile(dur_ms, 0.90),
            "p95": percentile(dur_ms, 0.95),
            "max": max(dur_ms) if dur_ms else 0,
        },
    }


async def collect_typst_metrics() -> dict:
    """采集 Typst 编译指标（从 Redis）

    Returns:
        {
            "counts": {...}, "cache_hit_rate_recent": float,
            "dur_ms": {...}, "waited_ms": {...},
            "queue_length": {...}, "sample_size": int,
            "http_429_total": int
        }
    """
    total = hit = miss = fail = http_429 = 0
    queue_typst = queue_celery = 0
    dur_ms: List[int] = []
    waited_ms: List[int] = []
    cache_hit_samples: List[int] = []

    try:
        client = await cache.get_client()
        vals = await client.mget(
            "typst:compile:total",
            "typst:compile:hit",
            "typst:compile:miss",
            "typst:compile:fail",
            "http:429",
        )
        total = int(vals[0] or 0)
        hit = int(vals[1] or 0)
        miss = int(vals[2] or 0)
        fail = int(vals[3] or 0)
        http_429 = int(vals[4] or 0)

        try:
            queue_typst = int(await client.llen("typst") or 0)  # type: ignore[misc]
        except Exception:
            queue_typst = 0
        try:
            queue_celery = int(await client.llen("celery") or 0)  # type: ignore[misc]
        except Exception:
            queue_celery = 0

        sample_size = max(0, settings.TYPST_METRICS_SAMPLE_SIZE - 1)
        raw_dur = await client.lrange("typst:compile:dur_ms", 0, sample_size)  # type: ignore[misc]
        raw_waited = await client.lrange("typst:compile:waited_ms", 0, sample_size)  # type: ignore[misc]
        raw_hit = await client.lrange("typst:compile:cache_hit", 0, sample_size)  # type: ignore[misc]
        dur_ms = [int(x) for x in raw_dur if str(x).isdigit()]
        waited_ms = [int(x) for x in raw_waited if str(x).isdigit()]
        cache_hit_samples = [int(x) for x in raw_hit if str(x).isdigit()]
    except Exception:
        pass

    hit_rate = 0.0
    if cache_hit_samples:
        hit_rate = float(sum(1 for x in cache_hit_samples if x == 1)) / float(
            len(cache_hit_samples)
        )

    return {
        "counts": {"total": total, "hit": hit, "miss": miss, "fail": fail},
        "cache_hit_rate_recent": hit_rate,
        "dur_ms": {
            "n": len(dur_ms),
            "p50": percentile(dur_ms, 0.50),
            "p90": percentile(dur_ms, 0.90),
            "p95": percentile(dur_ms, 0.95),
            "max": max(dur_ms) if dur_ms else 0,
        },
        "waited_ms": {
            "n": len(waited_ms),
            "p50": percentile(waited_ms, 0.50),
            "p90": percentile(waited_ms, 0.90),
            "p95": percentile(waited_ms, 0.95),
            "max": max(waited_ms) if waited_ms else 0,
        },
        "queue_length": {"typst": queue_typst, "celery": queue_celery},
        "sample_size": settings.TYPST_METRICS_SAMPLE_SIZE,
        "http_429_total": http_429,
    }


def collect_db_pool_metrics() -> dict:
    """采集数据库连接池指标（同步）

    Returns:
        {
            "pool_size": int, "checked_in": int, "checked_out": int,
            "overflow": int, "capacity_total": int
        }
    """
    pool_size = checkedin = checkedout = overflow = 0

    try:
        p = engine.sync_engine.pool
        pool_size = int(
            getattr(p, "size")() if callable(getattr(p, "size", None)) else 0
        )
        checkedin = int(
            getattr(p, "checkedin")() if callable(getattr(p, "checkedin", None)) else 0
        )
        checkedout = int(
            getattr(p, "checkedout")()
            if callable(getattr(p, "checkedout", None))
            else 0
        )
        overflow_raw = int(
            getattr(p, "overflow")()
            if callable(getattr(p, "overflow", None))
            else 0
        )
        overflow = max(0, overflow_raw)
    except Exception:
        pass

    return {
        "pool_size": pool_size,
        "checked_in": checkedin,
        "checked_out": checkedout,
        "overflow": overflow,
        "capacity_total": int(settings.POSTGRES_MAX_CONNECTIONS)
        + int(settings.DB_MAX_OVERFLOW),
    }
