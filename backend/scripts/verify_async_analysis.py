#!/usr/bin/env python3
"""
深度分析异步任务验证脚本

验证清单：
1. Celery 任务已注册
2. API 路由已挂载
3. 任务逻辑完整性
4. 前端集成文档存在
"""

import sys
from pathlib import Path

# 添加项目路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


def verify_celery_tasks():
    """验证 Celery 任务定义"""
    print("\n=== 验证 Celery 任务 ===")

    try:
        from app.tasks.agent_analysis import (
            analyze_hot_questions_task,
            analyze_student_chains_task,
        )

        print(f"✓ 热点分析任务: {analyze_hot_questions_task.name}")
        print(f"✓ 问题链分析任务: {analyze_student_chains_task.name}")

        # 检查任务基类
        hot_base = analyze_hot_questions_task.__class__.__bases__[0].__name__
        chain_base = analyze_student_chains_task.__class__.__bases__[0].__name__
        print(f"✓ 热点分析任务基类: {hot_base}")
        print(f"✓ 问题链分析任务基类: {chain_base}")

        return True
    except Exception as e:
        print(f"✗ 任务验证失败: {e}")
        return False


def verify_celery_config():
    """验证 Celery 配置"""
    print("\n=== 验证 Celery 配置 ===")

    try:
        from app.core.celery_app import celery_app

        # 检查任务是否在 include 列表中
        includes = celery_app.conf.include
        if "app.tasks.agent_analysis" in includes:
            print("✓ agent_analysis 已在 Celery include 列表")
        else:
            print("✗ agent_analysis 未在 Celery include 列表")
            return False

        # 检查超时配置
        soft_limit = celery_app.conf.task_soft_time_limit
        hard_limit = celery_app.conf.task_time_limit
        print(f"✓ 任务超时配置: 软超时 {soft_limit}s, 硬超时 {hard_limit}s")

        return True
    except Exception as e:
        print(f"✗ 配置验证失败: {e}")
        return False


def verify_api_routes():
    """验证 API 路由"""
    print("\n=== 验证 API 路由 ===")

    try:
        from app.api.endpoints.agents.ai_agents.analysis_async import router as async_router
        from app.api.endpoints.agents.ai_agents.ai_agents import router as main_router

        # 检查异步路由端点
        routes = [route.path for route in async_router.routes]
        expected_routes = [
            "/analyses/hot-questions/async",
            "/analyses/student-chains/async",
            "/analyses/tasks/{task_id}",
            "/analyses/tasks",
        ]

        for expected in expected_routes:
            if expected in routes:
                print(f"✓ 路由已注册: {expected}")
            else:
                print(f"✗ 路由缺失: {expected}")
                return False

        return True
    except Exception as e:
        print(f"✗ 路由验证失败: {e}")
        return False


def verify_task_logic():
    """验证任务逻辑完整性"""
    print("\n=== 验证任务逻辑 ===")

    try:
        from app.tasks.agent_analysis import (
            analyze_hot_questions_task,
            analyze_student_chains_task,
        )

        # 检查必需参数
        hot_params = analyze_hot_questions_task.run.__code__.co_varnames
        chain_params = analyze_student_chains_task.run.__code__.co_varnames

        hot_required = ["agent_id", "start_at", "end_at", "task_sheet"]
        chain_required = ["agent_id", "start_at", "end_at"]

        for param in hot_required:
            if param in hot_params:
                print(f"✓ 热点分析参数: {param}")
            else:
                print(f"✗ 热点分析缺少参数: {param}")
                return False

        for param in chain_required:
            if param in chain_params:
                print(f"✓ 问题链分析参数: {param}")
            else:
                print(f"✗ 问题链分析缺少参数: {param}")
                return False

        return True
    except Exception as e:
        print(f"✗ 逻辑验证失败: {e}")
        return False


def verify_database_models():
    """验证数据库模型"""
    print("\n=== 验证数据库模型 ===")

    try:
        from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis

        # 检查必需字段
        hot_fields = [col.name for col in HotQuestionAnalysis.__table__.columns]
        chain_fields = [col.name for col in StudentChainAnalysis.__table__.columns]

        required_fields = ["id", "title", "agent_id", "result", "created_at"]

        for field in required_fields:
            if field in hot_fields:
                print(f"✓ HotQuestionAnalysis 字段: {field}")
            else:
                print(f"✗ HotQuestionAnalysis 缺少字段: {field}")
                return False

        for field in required_fields:
            if field in chain_fields:
                print(f"✓ StudentChainAnalysis 字段: {field}")
            else:
                print(f"✗ StudentChainAnalysis 缺少字段: {field}")
                return False

        return True
    except Exception as e:
        print(f"✗ 模型验证失败: {e}")
        return False


def verify_documentation():
    """验证文档完整性"""
    print("\n=== 验证文档 ===")

    doc_path = backend_dir.parent / "docs" / "analysis" / "ASYNC_ANALYSIS.md"

    if doc_path.exists():
        print(f"✓ 文档已创建: {doc_path}")

        # 检查文档内容
        content = doc_path.read_text()
        required_sections = [
            "API 端点",
            "前端集成示例",
            "运维配置",
            "故障排查",
        ]

        for section in required_sections:
            if section in content:
                print(f"✓ 文档包含章节: {section}")
            else:
                print(f"✗ 文档缺少章节: {section}")
                return False

        return True
    else:
        print(f"✗ 文档不存在: {doc_path}")
        return False


def verify_sync_api_compatibility():
    """验证同步 API 兼容性"""
    print("\n=== 验证同步 API 兼容性 ===")

    try:
        from app.api.endpoints.agents.ai_agents.analysis import router as sync_router

        # 检查同步端点是否仍然存在
        routes = [route.path for route in sync_router.routes]
        sync_endpoints = [
            "/analysis/hot-questions/live",
            "/analysis/student-chains/live",
        ]

        for endpoint in sync_endpoints:
            if endpoint in routes:
                print(f"✓ 同步端点保留: {endpoint}")
            else:
                print(f"⚠ 同步端点已移除: {endpoint}")

        return True
    except Exception as e:
        print(f"✗ 兼容性验证失败: {e}")
        return False


def main():
    """运行所有验证"""
    print("=" * 60)
    print("深度分析异步任务验证")
    print("=" * 60)

    results = []

    # 依次执行验证
    results.append(("Celery 任务", verify_celery_tasks()))
    results.append(("Celery 配置", verify_celery_config()))
    results.append(("API 路由", verify_api_routes()))
    results.append(("任务逻辑", verify_task_logic()))
    results.append(("数据库模型", verify_database_models()))
    results.append(("文档完整性", verify_documentation()))
    results.append(("同步 API 兼容性", verify_sync_api_compatibility()))

    # 汇总结果
    print("\n" + "=" * 60)
    print("验证结果汇总")
    print("=" * 60)

    passed = 0
    failed = 0

    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{name:20s} {status}")
        if result:
            passed += 1
        else:
            failed += 1

    print("=" * 60)
    print(f"总计: {passed} 通过, {failed} 失败")

    if failed == 0:
        print("\n✓ 所有验证通过！异步分析功能已就绪。")
        return 0
    else:
        print(f"\n✗ {failed} 项验证失败，请检查上述错误。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
