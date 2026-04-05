"""
系统管理 - 指标与监控

从 admin.py 拆分出的 Typst 指标、Prometheus 指标和 PDF 清理端点。
使用 utils/metrics.py 中的公共指标采集函数消除重复代码。
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, require_admin
from app.services.informatics.typst_pdf_cleanup import cleanup_unreferenced_pdfs
from app.utils.metrics import (
    collect_db_pool_metrics,
    collect_http_metrics,
    collect_typst_metrics,
    percentile,
)

router = APIRouter(prefix="/system")


@router.get("/typst-metrics")
async def typst_metrics(
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    typst = await collect_typst_metrics()
    return {
        "typst_compile": {
            "counts": typst["counts"],
            "cache_hit_rate_recent": typst["cache_hit_rate_recent"],
            "dur_ms": typst["dur_ms"],
            "waited_ms": typst["waited_ms"],
            "queue_length": typst["queue_length"],
            "sample_size": typst["sample_size"],
        },
        "http": {"429_total": typst["http_429_total"]},
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
    """Prometheus 格式指标端点

    复用 collect_http_metrics / collect_typst_metrics / collect_db_pool_metrics
    消除原来 175 行的重复代码。
    """
    http = await collect_http_metrics()
    typst = await collect_typst_metrics()
    db_pool = collect_db_pool_metrics()

    # 从 typst 结构中提取原始值列表用于 percentile 计算已在 collect 函数中完成
    # 这里直接使用已计算好的值

    lines = [
        # HTTP metrics
        "# HELP http_requests_total Total HTTP requests",
        "# TYPE http_requests_total counter",
        f"http_requests_total {http['total']}",
        "# HELP ws_http_requests_total Total HTTP requests",
        "# TYPE ws_http_requests_total counter",
        f"ws_http_requests_total {http['total']}",
        "# HELP http_requests_4xx_total Total HTTP 4xx responses",
        "# TYPE http_requests_4xx_total counter",
        f"http_requests_4xx_total {http['4xx']}",
        "# HELP ws_http_requests_4xx_total Total HTTP 4xx responses",
        "# TYPE ws_http_requests_4xx_total counter",
        f"ws_http_requests_4xx_total {http['4xx']}",
        "# HELP http_requests_5xx_total Total HTTP 5xx responses",
        "# TYPE http_requests_5xx_total counter",
        f"http_requests_5xx_total {http['5xx']}",
        "# HELP ws_http_requests_5xx_total Total HTTP 5xx responses",
        "# TYPE ws_http_requests_5xx_total counter",
        f"ws_http_requests_5xx_total {http['5xx']}",
        "# HELP http_inflight Current in-flight HTTP requests (per worker)",
        "# TYPE http_inflight gauge",
        f"http_inflight {http['inflight']}",
        "# HELP ws_http_inflight Current in-flight HTTP requests (per worker)",
        "# TYPE ws_http_inflight gauge",
        f"ws_http_inflight {http['inflight']}",
        "# HELP http_request_duration_ms HTTP request duration quantiles (ms, recent samples)",
        "# TYPE http_request_duration_ms gauge",
        f'http_request_duration_ms{{quantile="0.5"}} {http["dur_ms"]["p50"]}',
        f'http_request_duration_ms{{quantile="0.9"}} {http["dur_ms"]["p90"]}',
        f'http_request_duration_ms{{quantile="0.95"}} {http["dur_ms"]["p95"]}',
        f'http_request_duration_ms{{quantile="1"}} {http["dur_ms"]["max"]}',
        "# HELP ws_http_request_duration_ms HTTP request duration quantiles (ms, recent samples)",
        "# TYPE ws_http_request_duration_ms gauge",
        f'ws_http_request_duration_ms{{quantile="0.5"}} {http["dur_ms"]["p50"]}',
        f'ws_http_request_duration_ms{{quantile="0.9"}} {http["dur_ms"]["p90"]}',
        f'ws_http_request_duration_ms{{quantile="0.95"}} {http["dur_ms"]["p95"]}',
        f'ws_http_request_duration_ms{{quantile="1"}} {http["dur_ms"]["max"]}',
        # Typst metrics
        "# HELP typst_compile_total Total typst compile attempts",
        "# TYPE typst_compile_total counter",
        f"typst_compile_total {typst['counts']['total']}",
        "# HELP typst_compile_hit_total Cache hit compiles",
        "# TYPE typst_compile_hit_total counter",
        f"typst_compile_hit_total {typst['counts']['hit']}",
        "# HELP typst_compile_miss_total Cache miss compiles",
        "# TYPE typst_compile_miss_total counter",
        f"typst_compile_miss_total {typst['counts']['miss']}",
        "# HELP typst_compile_fail_total Failed compiles",
        "# TYPE typst_compile_fail_total counter",
        f"typst_compile_fail_total {typst['counts']['fail']}",
        "# HELP typst_compile_cache_hit_rate_recent Recent cache hit rate (0-1)",
        "# TYPE typst_compile_cache_hit_rate_recent gauge",
        f"typst_compile_cache_hit_rate_recent {typst['cache_hit_rate_recent']}",
        "# HELP typst_compile_dur_ms Compile duration quantiles",
        "# TYPE typst_compile_dur_ms gauge",
        f'typst_compile_dur_ms{{quantile="0.5"}} {typst["dur_ms"]["p50"]}',
        f'typst_compile_dur_ms{{quantile="0.9"}} {typst["dur_ms"]["p90"]}',
        f'typst_compile_dur_ms{{quantile="0.95"}} {typst["dur_ms"]["p95"]}',
        f'typst_compile_dur_ms{{quantile="1"}} {typst["dur_ms"]["max"]}',
        "# HELP typst_compile_waited_ms Semaphore/queue waited ms quantiles",
        "# TYPE typst_compile_waited_ms gauge",
        f'typst_compile_waited_ms{{quantile="0.5"}} {typst["waited_ms"]["p50"]}',
        f'typst_compile_waited_ms{{quantile="0.9"}} {typst["waited_ms"]["p90"]}',
        f'typst_compile_waited_ms{{quantile="0.95"}} {typst["waited_ms"]["p95"]}',
        f'typst_compile_waited_ms{{quantile="1"}} {typst["waited_ms"]["max"]}',
        "# HELP typst_queue_length Queue length",
        "# TYPE typst_queue_length gauge",
        f'typst_queue_length{{queue="typst"}} {typst["queue_length"]["typst"]}',
        f'typst_queue_length{{queue="celery"}} {typst["queue_length"]["celery"]}',
        "# HELP http_429_total Total 429 responses counted by limiter",
        "# TYPE http_429_total counter",
        f"http_429_total {typst['http_429_total']}",
        # DB pool metrics
        "# HELP db_pool_size SQLAlchemy pool size",
        "# TYPE db_pool_size gauge",
        f"db_pool_size {db_pool['pool_size']}",
        "# HELP ws_db_pool_size SQLAlchemy pool size",
        "# TYPE ws_db_pool_size gauge",
        f"ws_db_pool_size {db_pool['pool_size']}",
        "# HELP db_pool_checked_in Checked-in connections",
        "# TYPE db_pool_checked_in gauge",
        f"db_pool_checked_in {db_pool['checked_in']}",
        "# HELP ws_db_pool_checked_in Checked-in connections",
        "# TYPE ws_db_pool_checked_in gauge",
        f"ws_db_pool_checked_in {db_pool['checked_in']}",
        "# HELP db_pool_checked_out Checked-out connections",
        "# TYPE db_pool_checked_out gauge",
        f"db_pool_checked_out {db_pool['checked_out']}",
        "# HELP ws_db_pool_checked_out Checked-out connections",
        "# TYPE ws_db_pool_checked_out gauge",
        f"ws_db_pool_checked_out {db_pool['checked_out']}",
        "# HELP db_pool_overflow Overflow connections",
        "# TYPE db_pool_overflow gauge",
        f"db_pool_overflow {db_pool['overflow']}",
        "# HELP ws_db_pool_overflow Overflow connections",
        "# TYPE ws_db_pool_overflow gauge",
        f"ws_db_pool_overflow {db_pool['overflow']}",
        "# HELP db_pool_capacity_total Total configured capacity (pool_size + max_overflow)",
        "# TYPE db_pool_capacity_total gauge",
        f"db_pool_capacity_total {db_pool['capacity_total']}",
        "# HELP ws_db_pool_capacity_total Total configured capacity (pool_size + max_overflow)",
        "# TYPE ws_db_pool_capacity_total gauge",
        f"ws_db_pool_capacity_total {db_pool['capacity_total']}",
    ]
    return Response(content="\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")
