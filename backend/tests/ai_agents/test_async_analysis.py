"""
测试深度分析异步任务

验证 Celery 任务的提交、状态查询和结果获取流程
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.tasks.agent_analysis import analyze_hot_questions_task, analyze_student_chains_task


class TestAsyncAnalysisTasks:
    """异步分析任务测试"""

    def test_hot_questions_task_signature(self):
        """测试热点分析任务签名和参数"""
        # 验证任务已注册
        assert analyze_hot_questions_task.name == "analyze_hot_questions_async"

        # 验证任务可以创建签名
        now = datetime.now(timezone.utc)
        signature = analyze_hot_questions_task.s(
            agent_id=1,
            start_at=now.isoformat(),
            end_at=(now + timedelta(hours=1)).isoformat(),
            task_sheet="测试任务单",
            title="测试分析",
        )
        assert signature is not None

    def test_student_chains_task_signature(self):
        """测试问题链分析任务签名和参数"""
        # 验证任务已注册
        assert analyze_student_chains_task.name == "analyze_student_chains_async"

        # 验证任务可以创建签名
        now = datetime.now(timezone.utc)
        signature = analyze_student_chains_task.s(
            agent_id=1,
            start_at=now.isoformat(),
            end_at=(now + timedelta(hours=1)).isoformat(),
            title="测试问题链分析",
        )
        assert signature is not None

    def test_hot_questions_task_structure(self):
        """测试热点分析任务结构和配置"""
        # 验证任务名称
        assert analyze_hot_questions_task.name == "analyze_hot_questions_async"
        # 验证任务已注册
        assert analyze_hot_questions_task.app is not None

    def test_student_chains_task_structure(self):
        """测试问题链分析任务结构和配置"""
        # 验证任务名称
        assert analyze_student_chains_task.name == "analyze_student_chains_async"
        # 验证任务已注册
        assert analyze_student_chains_task.app is not None


class TestAsyncAnalysisAPI:
    """异步分析 API 端点测试"""

    def test_async_endpoints_registered(self):
        """验证异步端点已注册"""
        from app.api.endpoints.agents.ai_agents.analysis_async import router

        # 验证路由存在
        assert router is not None

        # 验证端点数量
        routes = [r for r in router.routes]
        assert len(routes) == 5  # POST hot, POST chain, GET status, DELETE cancel, GET list

        # 验证端点路径
        paths = [r.path for r in routes]
        assert "/analyses/hot-questions/async" in paths
        assert "/analyses/student-chains/async" in paths
        assert "/analyses/tasks/{task_id}" in paths

    def test_hot_analysis_request_schema(self):
        """测试热点分析请求 schema"""
        from app.api.endpoints.agents.ai_agents.analysis_async import HotAnalysisAsyncRequest

        now = datetime.now(timezone.utc)
        request = HotAnalysisAsyncRequest(
            agent_id=1,
            start_at=now.isoformat(),
            end_at=(now + timedelta(hours=1)).isoformat(),
            task_sheet="测试任务单",
            title="测试热点分析",
        )

        assert request.agent_id == 1
        assert request.task_sheet == "测试任务单"
        assert request.bucket_seconds == 180  # 默认值

    def test_chain_analysis_request_schema(self):
        """测试问题链分析请求 schema"""
        from app.api.endpoints.agents.ai_agents.analysis_async import ChainAnalysisAsyncRequest

        now = datetime.now(timezone.utc)
        request = ChainAnalysisAsyncRequest(
            agent_id=1,
            start_at=now.isoformat(),
            end_at=(now + timedelta(hours=1)).isoformat(),
            title="测试问题链分析",
        )

        assert request.agent_id == 1
        assert request.merge_threshold == 0.30  # 默认值

    def test_task_status_response_schema(self):
        """测试任务状态响应 schema"""
        from app.api.endpoints.agents.ai_agents.analysis_async import TaskStatusResponse

        # 测试进行中状态
        response = TaskStatusResponse(
            task_id="test-task-id",
            status="progress",
            progress=50,
            message="正在分析...",
        )
        assert response.status == "progress"
        assert response.progress == 50

        # 测试完成状态
        response = TaskStatusResponse(
            task_id="test-task-id",
            status="completed",
            progress=100,
            result={"analysis_id": 123},
        )
        assert response.status == "completed"
        assert response.result["analysis_id"] == 123


@pytest.mark.integration
class TestAsyncAnalysisIntegration:
    """异步分析集成测试（需要 Celery worker 运行）"""

    @pytest.mark.skip(reason="需要 Celery worker 运行")
    def test_full_async_workflow(self):
        """
        完整异步工作流测试

        该测试需要：
        1. Redis/RabbitMQ broker 运行
        2. Celery worker 运行
        3. 数据库可访问

        测试步骤：
        1. 提交异步任务
        2. 查询任务状态
        3. 等待任务完成
        4. 验证结果已保存到数据库
        """
        pass
