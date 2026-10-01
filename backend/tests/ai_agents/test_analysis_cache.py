"""测试分析结果的 Redis 缓存功能"""

import pytest
from app.utils.cache import AnalysisCacheKeys


class TestAnalysisCacheKeys:
    """测试缓存键生成器"""

    def test_hot_analysis_detail_key(self):
        """热点问题分析详情缓存键格式正确"""
        key = AnalysisCacheKeys.hot_analysis_detail(123)
        assert key == "analysis:hot:123"

    def test_chain_analysis_detail_key(self):
        """学生问题链分析详情缓存键格式正确"""
        key = AnalysisCacheKeys.chain_analysis_detail(456)
        assert key == "analysis:chain:456"

    def test_task_analysis_detail_key(self):
        """任务分析详情缓存键格式正确"""
        key = AnalysisCacheKeys.task_analysis_detail(789)
        assert key == "analysis:task:789"

    def test_hot_analysis_list_key(self):
        """热点问题分析列表缓存键格式正确"""
        key = AnalysisCacheKeys.hot_analysis_list(skip=0, limit=50)
        assert key == "analysis:hot:list:0:50"

    def test_chain_analysis_list_key(self):
        """学生问题链分析列表缓存键格式正确"""
        key = AnalysisCacheKeys.chain_analysis_list(skip=10, limit=20)
        assert key == "analysis:chain:list:10:20"

    def test_task_analysis_list_key(self):
        """任务分析列表缓存键格式正确"""
        key = AnalysisCacheKeys.task_analysis_list(skip=5, limit=15)
        assert key == "analysis:task:list:5:15"

    def test_trends_summary_key(self):
        """趋势摘要缓存键格式正确"""
        key = AnalysisCacheKeys.trends_summary(agent_id=1, analysis_type="hot_questions", limit=10)
        assert key == "analysis:trends:1:hot_questions:10"
