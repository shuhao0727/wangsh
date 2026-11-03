"""
测试深度分析异步任务

验证 Celery 任务的提交、状态查询和结果获取流程
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.agents.ai_agents.analysis_async import list_analysis_tasks
from app.db.database import Base
from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis
from app.tasks.agent_analysis import analyze_hot_questions_task, analyze_student_chains_task


class TestAsyncAnalysisTasks:
    """异步分析任务测试"""

    def test_fresh_loop_disposes_engine_after_task(self, monkeypatch):
        import app.tasks.agent_analysis as task_module

        class FakeEngine:
            disposed = 0

            async def dispose(self):
                self.disposed += 1

        fake = FakeEngine()
        monkeypatch.setattr(task_module, "engine", fake)
        assert task_module.run_analysis_in_fresh_loop(asyncio.sleep(0, result=7)) == 7
        assert fake.disposed == 1

    def test_fresh_loop_disposes_engine_on_error(self, monkeypatch):
        import app.tasks.agent_analysis as task_module

        class FakeEngine:
            disposed = 0

            async def dispose(self):
                self.disposed += 1

        fake = FakeEngine()
        monkeypatch.setattr(task_module, "engine", fake)

        async def fail():
            raise RuntimeError("synthetic failure")

        with pytest.raises(RuntimeError, match="synthetic failure"):
            task_module.run_analysis_in_fresh_loop(fail())
        assert fake.disposed == 1

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

    @pytest.mark.asyncio
    async def test_mixed_task_list_applies_skip_and_returns_full_total(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[HotQuestionAnalysis.__table__, StudentChainAnalysis.__table__],
            ))
        factory = async_sessionmaker(engine, expire_on_commit=False)
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        async with factory() as db:
            for index in range(3):
                db.add(HotQuestionAnalysis(
                    title=f"hot-{index}", task_sheet="synthetic",
                    created_at=base + timedelta(minutes=index), result={},
                ))
                db.add(StudentChainAnalysis(
                    title=f"chain-{index}",
                    created_at=base + timedelta(minutes=index + 10), result={},
                ))
            await db.commit()

            first = await list_analysis_tasks(
                skip=0, limit=2, analysis_type=None, current_user={}, db=db,
            )
            second = await list_analysis_tasks(
                skip=2, limit=2, analysis_type=None, current_user={}, db=db,
            )
            hot = await list_analysis_tasks(
                skip=0, limit=2, analysis_type="hot_questions", current_user={}, db=db,
            )

            assert first["total"] == 6
            assert second["total"] == 6
            assert len(first["data"]) == 2
            assert [item["id"] for item in first["data"]] != [item["id"] for item in second["data"]]
            assert first["data"][0]["title"] == "chain-2"
            assert hot["total"] == 3
            assert [item["type"] for item in hot["data"]] == ["hot_questions"] * 2
        await engine.dispose()

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
