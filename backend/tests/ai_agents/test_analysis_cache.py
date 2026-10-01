"""测试分析详情接口的 Redis 缓存功能

验证：
1. 缓存键生成
2. 缓存命中率统计
3. 缓存失效逻辑
"""

import pytest

from app.utils.cache import AnalysisCacheKeys, cache, clear_analysis_cache


def test_analysis_cache_keys_generation():
    """测试缓存键生成器"""
    # 热点分析
    hot_key = AnalysisCacheKeys.hot_analysis_detail(123)
    assert hot_key == "analysis:hot:123"

    # 学生链分析
    chain_key = AnalysisCacheKeys.chain_analysis_detail(456)
    assert chain_key == "analysis:chain:456"

    # 任务分析
    task_key = AnalysisCacheKeys.task_analysis_detail(789)
    assert task_key == "analysis:task:789"

    # 列表缓存键
    hot_list_key = AnalysisCacheKeys.hot_analysis_list(0, 50)
    assert hot_list_key == "analysis:hot:list:0:50"

    chain_list_key = AnalysisCacheKeys.chain_analysis_list(10, 20)
    assert chain_list_key == "analysis:chain:list:10:20"

    task_list_key = AnalysisCacheKeys.task_analysis_list(0, 20)
    assert task_list_key == "analysis:task:list:0:20"


@pytest.mark.anyio
async def test_analysis_cache_basic_operations():
    """测试缓存基本操作（写入、读取、删除）"""
    test_key = "test:analysis:cache:1"
    test_value = {"id": 1, "title": "测试分析", "result": {"data": "test"}}

    try:
        # 写入缓存
        success = await cache.set(test_key, test_value, expire_seconds=60)
        assert success is True

        # 读取缓存
        cached = await cache.get(test_key)
        assert cached is not None
        assert cached["id"] == 1
        assert cached["title"] == "测试分析"

        # 验证TTL
        ttl = await cache.ttl(test_key)
        assert ttl is not None
        assert 50 < ttl <= 60

        # 删除缓存
        deleted = await cache.delete(test_key)
        assert deleted is True

        # 验证已删除
        cached_after = await cache.get(test_key)
        assert cached_after is None
    finally:
        # 清理
        await cache.delete(test_key)


@pytest.mark.anyio
async def test_cache_hit_miss_counters():
    """测试缓存命中/未命中计数器"""
    hit_key = "analysis:cache:hit"
    miss_key = "analysis:cache:miss"

    try:
        # 清空计数器
        await cache.delete(hit_key)
        await cache.delete(miss_key)

        # 模拟缓存未命中
        await cache.increment(miss_key)
        miss_count = await cache.get(miss_key)
        assert miss_count == 1

        # 模拟缓存命中
        await cache.increment(hit_key)
        await cache.increment(hit_key)
        await cache.increment(hit_key)
        hit_count = await cache.get(hit_key)
        assert hit_count == 3

        # 计算命中率
        total = hit_count + miss_count
        hit_rate = hit_count / total
        assert hit_rate == 0.75  # 3/(3+1) = 0.75
    finally:
        # 清理
        await cache.delete(hit_key)
        await cache.delete(miss_key)


@pytest.mark.anyio
async def test_clear_analysis_cache():
    """测试分析缓存清除函数"""
    # 创建测试缓存键
    hot_detail_key = AnalysisCacheKeys.hot_analysis_detail(1)
    hot_list_key = AnalysisCacheKeys.hot_analysis_list(0, 50)
    chain_detail_key = AnalysisCacheKeys.chain_analysis_detail(2)

    try:
        # 写入测试数据
        await cache.set(hot_detail_key, {"id": 1}, expire_seconds=60)
        await cache.set(hot_list_key, [{"id": 1}], expire_seconds=60)
        await cache.set(chain_detail_key, {"id": 2}, expire_seconds=60)

        # 验证缓存已写入
        assert await cache.get(hot_detail_key) is not None
        assert await cache.get(hot_list_key) is not None
        assert await cache.get(chain_detail_key) is not None

        # 清除热点分析缓存（包括列表）
        await clear_analysis_cache(analysis_type="hot", analysis_id=1)

        # 验证热点分析缓存已清除
        assert await cache.get(hot_detail_key) is None
        # 列表缓存也应该被清除
        assert await cache.get(hot_list_key) is None
        # 学生链缓存应该保留
        assert await cache.get(chain_detail_key) is not None

    finally:
        # 清理
        await cache.delete(hot_detail_key)
        await cache.delete(hot_list_key)
        await cache.delete(chain_detail_key)


@pytest.mark.anyio
async def test_cache_ttl_one_hour():
    """测试缓存TTL为1小时（3600秒）"""
    test_key = "test:ttl:analysis"

    try:
        # 写入缓存，TTL 1小时
        await cache.set(test_key, {"test": "data"}, expire_seconds=3600)

        # 验证TTL
        ttl = await cache.ttl(test_key)
        assert ttl is not None
        # 允许5秒误差
        assert 3595 < ttl <= 3600
    finally:
        await cache.delete(test_key)
