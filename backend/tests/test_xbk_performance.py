"""XBK 模块性能测试"""
import pytest
import time
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app


@pytest.mark.asyncio
async def test_xbk_summary_performance(async_client: AsyncClient):
    """测试统计摘要接口性能"""
    start = time.time()
    response = await async_client.get(
        "/api/v1/xbk/analysis/summary",
        params={"year": 2024, "term": "上学期"}
    )
    elapsed = time.time() - start

    assert response.status_code in [200, 401]  # 401 表示需要登录
    assert elapsed < 0.5, f"响应时间 {elapsed:.3f}s 超过 500ms"
    print(f"✓ Summary API 响应时间: {elapsed:.3f}s")


@pytest.mark.asyncio
async def test_xbk_course_stats_performance(async_client: AsyncClient):
    """测试课程统计接口性能"""
    start = time.time()
    response = await async_client.get(
        "/api/v1/xbk/analysis/course-stats",
        params={"year": 2024, "term": "上学期"}
    )
    elapsed = time.time() - start

    assert response.status_code in [200, 401]
    assert elapsed < 0.3, f"响应时间 {elapsed:.3f}s 超过 300ms"
    print(f"✓ Course Stats API 响应时间: {elapsed:.3f}s")
