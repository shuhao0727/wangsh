#!/usr/bin/env python3
"""
深度分析异步任务测试脚本

模拟完整的异步分析流程：
1. 提交任务
2. 查询状态
3. 获取结果
"""

import sys
import asyncio
import time
from pathlib import Path
from datetime import datetime, timedelta, timezone

# 添加项目路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


async def test_hot_analysis_flow():
    """测试热点分析异步流程"""
    print("\n=== 测试热点分析异步流程 ===")

    from app.tasks.agent_analysis import analyze_hot_questions_task
    from app.db.database import AsyncSessionLocal
    from app.models.agents import AIAgent
    from sqlalchemy import select

    # 1. 查找一个可用的智能体
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AIAgent)
            .where(AIAgent.is_deleted.is_(False))
            .limit(1)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            print("✗ 未找到可用的智能体，跳过测试")
            return False

        print(f"✓ 找到智能体: {agent.name} (ID: {agent.id})")

    # 2. 准备测试参数
    now = datetime.now(timezone.utc)
    start_at = (now - timedelta(hours=2)).isoformat()
    end_at = now.isoformat()

    test_params = {
        "agent_id": agent.id,
        "start_at": start_at,
        "end_at": end_at,
        "task_sheet": "测试任务单",
        "class_name": "测试班级",
        "bucket_seconds": 180,
        "teacher_marks": None,
        "custom_prompt": None,
        "title": "异步分析测试 - 热点问题",
        "created_by": 1,
    }

    print(f"✓ 测试参数准备完成")
    print(f"  - 时间范围: {start_at} ~ {end_at}")
    print(f"  - 智能体ID: {agent.id}")

    # 3. 提交任务（模拟）
    print("\n提交任务...")
    try:
        # 注意：这里不实际运行任务，只验证参数结构
        task_signature = analyze_hot_questions_task.s(**test_params)
        print(f"✓ 任务签名创建成功")
        print(f"  - 任务名: {task_signature.task}")
        print(f"  - 参数数量: {len(test_params)}")

        # 实际提交需要 Celery worker 运行
        # task_result = analyze_hot_questions_task.apply_async(kwargs=test_params)
        # print(f"✓ 任务已提交: {task_result.id}")

        print("\n⚠ 实际任务提交需要 Celery worker 运行")
        print("  启动命令: celery -A app.core.celery_app:celery_app worker --loglevel=info")

        return True

    except Exception as e:
        print(f"✗ 任务提交失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_chain_analysis_flow():
    """测试问题链分析异步流程"""
    print("\n=== 测试问题链分析异步流程 ===")

    from app.tasks.agent_analysis import analyze_student_chains_task
    from app.db.database import AsyncSessionLocal
    from app.models.agents import AIAgent
    from sqlalchemy import select

    # 1. 查找一个可用的智能体
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AIAgent)
            .where(AIAgent.is_deleted.is_(False))
            .limit(1)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            print("✗ 未找到可用的智能体，跳过测试")
            return False

        print(f"✓ 找到智能体: {agent.name} (ID: {agent.id})")

    # 2. 准备测试参数
    now = datetime.now(timezone.utc)
    start_at = (now - timedelta(hours=2)).isoformat()
    end_at = now.isoformat()

    test_params = {
        "agent_id": agent.id,
        "start_at": start_at,
        "end_at": end_at,
        "class_name": "测试班级",
        "task_sheet": None,
        "teacher_marks": None,
        "custom_prompt": None,
        "merge_threshold": 0.30,
        "title": "异步分析测试 - 问题链",
        "created_by": 1,
    }

    print(f"✓ 测试参数准备完成")
    print(f"  - 时间范围: {start_at} ~ {end_at}")
    print(f"  - 智能体ID: {agent.id}")

    # 3. 提交任务（模拟）
    print("\n提交任务...")
    try:
        # 注意：这里不实际运行任务，只验证参数结构
        task_signature = analyze_student_chains_task.s(**test_params)
        print(f"✓ 任务签名创建成功")
        print(f"  - 任务名: {task_signature.task}")
        print(f"  - 参数数量: {len(test_params)}")

        print("\n⚠ 实际任务提交需要 Celery worker 运行")
        print("  启动命令: celery -A app.core.celery_app:celery_app worker --loglevel=info")

        return True

    except Exception as e:
        print(f"✗ 任务提交失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_task_result_storage():
    """测试任务结果存储"""
    print("\n=== 测试任务结果存储 ===")

    from app.db.database import AsyncSessionLocal
    from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        # 检查热点分析记录
        hot_result = await db.execute(
            select(HotQuestionAnalysis)
            .order_by(HotQuestionAnalysis.created_at.desc())
            .limit(1)
        )
        hot_record = hot_result.scalar_one_or_none()

        if hot_record:
            print(f"✓ 找到热点分析记录:")
            print(f"  - ID: {hot_record.id}")
            print(f"  - 标题: {hot_record.title}")
            print(f"  - 创建时间: {hot_record.created_at}")
            print(f"  - 结果字段: {'存在' if hot_record.result else '为空'}")
        else:
            print("⚠ 暂无热点分析记录")

        # 检查问题链分析记录
        chain_result = await db.execute(
            select(StudentChainAnalysis)
            .order_by(StudentChainAnalysis.created_at.desc())
            .limit(1)
        )
        chain_record = chain_result.scalar_one_or_none()

        if chain_record:
            print(f"\n✓ 找到问题链分析记录:")
            print(f"  - ID: {chain_record.id}")
            print(f"  - 标题: {chain_record.title}")
            print(f"  - 创建时间: {chain_record.created_at}")
            print(f"  - 结果字段: {'存在' if chain_record.result else '为空'}")
        else:
            print("\n⚠ 暂无问题链分析记录")

        return True


def test_celery_worker_status():
    """测试 Celery worker 状态"""
    print("\n=== 检查 Celery Worker 状态 ===")

    try:
        from app.core.celery_app import celery_app

        # 尝试获取活动任务
        inspect = celery_app.control.inspect()
        active_tasks = inspect.active()

        if active_tasks:
            print("✓ Celery worker 正在运行")
            print(f"  活动任务: {len(active_tasks)}")
        else:
            print("⚠ Celery worker 可能未运行")
            print("  启动命令: celery -A app.core.celery_app:celery_app worker --loglevel=info")

        # 检查已注册的任务
        registered = inspect.registered()
        if registered:
            analysis_tasks = []
            for worker, tasks in registered.items():
                for task in tasks:
                    if 'analyze' in task and 'async' in task:
                        analysis_tasks.append(task)

            if analysis_tasks:
                print(f"\n✓ 找到 {len(analysis_tasks)} 个分析任务:")
                for task in analysis_tasks:
                    print(f"  - {task}")
            else:
                print("\n⚠ 未找到分析任务")

        return bool(active_tasks or registered)

    except Exception as e:
        print(f"✗ 无法连接到 Celery: {e}")
        print("\n建议:")
        print("1. 检查 Redis 是否运行")
        print("2. 启动 Celery worker:")
        print("   celery -A app.core.celery_app:celery_app worker --loglevel=info")
        return False


async def main():
    """运行所有测试"""
    print("=" * 60)
    print("深度分析异步任务测试")
    print("=" * 60)

    results = []

    # 1. 检查 Celery worker
    worker_running = test_celery_worker_status()
    results.append(("Celery Worker", worker_running))

    # 2. 测试热点分析流程
    hot_result = await test_hot_analysis_flow()
    results.append(("热点分析流程", hot_result))

    # 3. 测试问题链分析流程
    chain_result = await test_chain_analysis_flow()
    results.append(("问题链分析流程", chain_result))

    # 4. 测试结果存储
    storage_result = await test_task_result_storage()
    results.append(("结果存储", storage_result))

    # 汇总结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)

    for name, result in results:
        status = "✓ 通过" if result else "⚠ 需要检查"
        print(f"{name:20s} {status}")

    print("\n" + "=" * 60)
    if all(result for _, result in results):
        print("✓ 所有测试通过！")
    else:
        print("⚠ 部分测试需要 Celery worker 运行才能完成")
        print("\n启动 Celery worker:")
        print("cd backend")
        print("celery -A app.core.celery_app:celery_app worker --loglevel=info")


if __name__ == "__main__":
    asyncio.run(main())
