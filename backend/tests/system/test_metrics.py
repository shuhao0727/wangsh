"""
系统管理 - 指标工具测试

覆盖场景：
1. percentile 函数正确性
2. percentile 空列表返回 0
3. percentile 边界值
4. collect_db_pool_metrics 返回结构正确
5. 路由拆分后端点完整性检查
6. overview 路由检查
"""

import asyncio

from app.utils.metrics import percentile


def test_percentile_empty():
    """空列表返回 0"""
    assert percentile([], 0.5) == 0
    assert percentile([], 0.95) == 0


def test_percentile_single():
    """单元素列表"""
    assert percentile([42], 0.5) == 42
    assert percentile([42], 0.0) == 42
    assert percentile([42], 1.0) == 42


def test_percentile_sorted():
    """已排序列表"""
    values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    assert percentile(values, 0.5) == 50  # idx=round(9*0.5)=round(4.5)=4 → values[4]=50
    assert percentile(values, 0.0) == 10
    assert percentile(values, 1.0) == 100


def test_percentile_unsorted():
    """未排序列表（函数内部排序）"""
    values = [100, 10, 50, 30, 70]
    p50 = percentile(values, 0.5)
    assert p50 == 50  # sorted: [10,30,50,70,100], idx=round(4*0.5)=2 → 50


def test_percentile_p90():
    """P90 计算"""
    values = list(range(1, 101))  # 1..100
    p90 = percentile(values, 0.90)
    # idx = round(99 * 0.9) = round(89.1) = 89 → values[89] = 90
    assert p90 == 90


def test_percentile_p95():
    """P95 计算"""
    values = list(range(1, 101))
    p95 = percentile(values, 0.95)
    # idx = round(99 * 0.95) = round(94.05) = 94 → values[94] = 95
    assert p95 == 95


def test_collect_db_pool_metrics_structure():
    """collect_db_pool_metrics 返回正确的字典结构"""
    from app.utils.metrics import collect_db_pool_metrics

    result = collect_db_pool_metrics()
    assert isinstance(result, dict)
    expected_keys = {"pool_size", "checked_in", "checked_out", "overflow", "capacity_total"}
    assert set(result.keys()) == expected_keys
    # 所有值都是整数
    for k, v in result.items():
        assert isinstance(v, int), f"{k} should be int, got {type(v)}"


def test_system_router_includes_all_endpoints():
    """system router 包含所有预期的端点路径"""
    from app.api.endpoints.system import router

    all_paths = set()
    for route in router.routes:
        if hasattr(route, "path"):
            all_paths.add(route.path)

    # health 端点
    assert "/health" in all_paths
    assert "/ping" in all_paths
    assert "/version" in all_paths
    assert "/config" in all_paths

    # feature flags 端点
    assert "/system/feature-flags" in all_paths
    assert "/system/feature-flags/{key}" in all_paths
    assert "/system/public/feature-flags/{key}" in all_paths

    # overview 端点
    assert "/system/overview" in all_paths
    assert "/system/settings" in all_paths

    # metrics 端点
    assert "/system/typst-metrics" in all_paths
    assert "/system/typst-pdf-cleanup" in all_paths
    assert "/system/metrics" in all_paths


def test_overview_router_has_admin_auth():
    """overview 端点需要管理员认证"""
    from app.api.endpoints.system.overview import router

    for route in router.routes:
        if not hasattr(route, "path"):
            continue
        deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
        dep_names = [getattr(d, "__name__", str(d)) for d in deps]
        assert "require_admin" in dep_names, f"{route.path} missing require_admin"


def test_metrics_router_has_admin_auth():
    """metrics 端点需要管理员认证"""
    from app.api.endpoints.system.metrics import router

    for route in router.routes:
        if not hasattr(route, "path"):
            continue
        deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
        dep_names = [getattr(d, "__name__", str(d)) for d in deps]
        assert "require_admin" in dep_names, f"{route.path} missing require_admin"


def test_system_overview_includes_pythonlab_deprecated_alias_usage(monkeypatch):
    from app.api.endpoints.system import overview as overview_api

    class _ScalarResult:
        def __init__(self, value: int):
            self._value = value

        def scalar(self):
            return self._value

    class _FakeDb:
        def __init__(self):
            self._values = [11, 22, 33, 44, 55]

        async def execute(self, _query):
            return _ScalarResult(self._values.pop(0))

    async def _fake_http():
        return {"total": 1, "4xx": 0, "5xx": 0, "inflight": 0, "dur_ms": {"n": 0, "p50": 0, "p90": 0, "p95": 0, "max": 0}}

    async def _fake_pythonlab(days: int = 7):
        return {
            "window_days": days,
            "prefix": "/api/v1/debug",
            "successor_prefix": "/api/v2/pythonlab",
            "summary": {"http": 2, "websocket": 1, "total": 3},
            "days": [{"date": "2026-04-08", "http": 2, "websocket": 1, "total": 3}],
        }

    monkeypatch.setattr(overview_api, "collect_http_metrics", _fake_http)
    monkeypatch.setattr(overview_api, "collect_db_pool_metrics", lambda: {"pool_size": 1, "checked_in": 1, "checked_out": 0, "overflow": 0, "capacity_total": 8})
    monkeypatch.setattr(overview_api, "_collect_pythonlab_deprecated_usage", _fake_pythonlab)

    result = asyncio.run(overview_api.system_overview(db=_FakeDb(), _={"id": 1}))

    assert result["counts"]["users"] == 11
    assert result["observability"]["pythonlab"]["deprecated_v1_alias"]["summary"]["total"] == 3


def test_prometheus_metrics_include_pythonlab_deprecated_alias_usage(monkeypatch):
    from app.api.endpoints.system import metrics as metrics_api

    async def _fake_http():
        return {"total": 5, "4xx": 1, "5xx": 0, "inflight": 0, "dur_ms": {"n": 0, "p50": 0, "p90": 0, "p95": 0, "max": 0}}

    async def _fake_typst():
        return {
            "counts": {"total": 0, "hit": 0, "miss": 0, "fail": 0},
            "cache_hit_rate_recent": 0.0,
            "dur_ms": {"n": 0, "p50": 0, "p90": 0, "p95": 0, "max": 0},
            "waited_ms": {"n": 0, "p50": 0, "p90": 0, "p95": 0, "max": 0},
            "queue_length": {"typst": 0, "celery": 0},
            "sample_size": 0,
            "http_429_total": 0,
        }

    async def _fake_pythonlab(days: int = 7):
        return {
            "window_days": days,
            "prefix": "/api/v1/debug",
            "successor_prefix": "/api/v2/pythonlab",
            "summary": {"http": 4, "websocket": 6, "total": 10},
            "days": [],
        }

    monkeypatch.setattr(metrics_api, "collect_http_metrics", _fake_http)
    monkeypatch.setattr(metrics_api, "collect_typst_metrics", _fake_typst)
    monkeypatch.setattr(metrics_api, "collect_db_pool_metrics", lambda: {"pool_size": 1, "checked_in": 1, "checked_out": 0, "overflow": 0, "capacity_total": 8})
    monkeypatch.setattr(metrics_api, "_collect_pythonlab_deprecated_usage", _fake_pythonlab)

    response = asyncio.run(metrics_api.prometheus_metrics(_={"id": 1}))
    content = response.body.decode("utf-8")

    assert 'pythonlab_deprecated_v1_alias_requests_recent{transport="http",window_days="7"} 4' in content
    assert 'pythonlab_deprecated_v1_alias_requests_recent{transport="websocket",window_days="7"} 6' in content
    assert 'pythonlab_deprecated_v1_alias_requests_recent{transport="total",window_days="7"} 10' in content
