"""
AI 智能体深度分析异步任务

将热点问题分析和学生问题链分析改造为 Celery 异步任务，
避免长时间阻塞 HTTP 请求，支持进度追踪和结果持久化。
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from celery import Task
from sqlalchemy import select

from app.core.celery_app import celery_app
from app.db.database import AsyncSessionLocal
from app.models.agents import HotQuestionAnalysis, StudentChainAnalysis
from app.services.agents.agent_deep_analysis import (
    analyze_hot_questions_v2,
    analyze_student_chains_v2,
)

logger = logging.getLogger(__name__)


class AnalysisTask(Task):
    """分析任务基类，提供通用的错误处理和状态更新"""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        logger.error(f"分析任务失败 {task_id}: {exc}", exc_info=einfo)

    def on_success(self, retval, task_id, args, kwargs):
        """任务成功时的回调"""
        logger.info(f"分析任务完成 {task_id}")


@celery_app.task(name="analyze_hot_questions_async", bind=True, base=AnalysisTask)
def analyze_hot_questions_task(
    self,
    agent_id: int,
    start_at: str,  # ISO 格式时间字符串
    end_at: str,
    task_sheet: str,
    class_name: Optional[str] = None,
    bucket_seconds: int = 180,
    teacher_marks: Optional[List[Dict[str, Any]]] = None,
    custom_prompt: Optional[str] = None,
    title: str = "未命名分析",
    created_by: Optional[int] = None,
) -> Dict[str, Any]:
    """
    异步热点问题分析任务

    Args:
        agent_id: 智能体ID
        start_at: 开始时间(ISO格式)
        end_at: 结束时间(ISO格式)
        task_sheet: 任务单内容
        class_name: 班级名称
        bucket_seconds: 时间桶大小(秒)
        teacher_marks: 教师标记列表
        custom_prompt: 自定义提示词
        title: 分析标题
        created_by: 创建者用户ID

    Returns:
        包含 analysis_id 和结果摘要的字典
    """
    import asyncio

    # 更新进度: 开始分析
    self.update_state(state="PROGRESS", meta={"progress": 10, "status": "正在加载对话数据..."})

    async def _run_analysis():
        async with AsyncSessionLocal() as db:
            try:
                # 转换时间字符串为 datetime 对象
                start_dt = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(end_at.replace("Z", "+00:00"))

                # 更新进度: 数据分析中
                self.update_state(state="PROGRESS", meta={"progress": 30, "status": "正在进行热点分析..."})

                # 执行分析
                result = await analyze_hot_questions_v2(
                    db,
                    agent_id=agent_id,
                    start_at=start_dt,
                    end_at=end_dt,
                    task_sheet=task_sheet,
                    class_name=class_name,
                    bucket_seconds=bucket_seconds,
                    teacher_marks=teacher_marks,
                    custom_prompt=custom_prompt,
                )

                # 更新进度: 保存结果
                self.update_state(state="PROGRESS", meta={"progress": 80, "status": "正在保存分析结果..."})

                # 存储结果到数据库
                analysis = HotQuestionAnalysis(
                    title=title,
                    task_sheet=task_sheet,
                    agent_id=agent_id,
                    class_name=class_name,
                    start_at=start_dt,
                    end_at=end_dt,
                    bucket_seconds=bucket_seconds,
                    teacher_marks=teacher_marks or [],
                    custom_prompt=custom_prompt,
                    result=result,
                    created_by=created_by,
                )
                db.add(analysis)
                await db.commit()
                await db.refresh(analysis)

                # 提取摘要信息
                summary = result.get("summary", {})
                return {
                    "analysis_id": analysis.id,
                    "title": title,
                    "theme_count": summary.get("theme_count", 0),
                    "question_count": summary.get("question_count", 0),
                    "unique_students": summary.get("unique_students", 0),
                    "burst_count": summary.get("burst_count", 0),
                }
            except Exception as e:
                await db.rollback()
                logger.error(f"热点分析任务执行失败: {e}", exc_info=True)
                raise

    # 在事件循环中运行异步函数
    return asyncio.run(_run_analysis())


@celery_app.task(name="analyze_student_chains_async", bind=True, base=AnalysisTask)
def analyze_student_chains_task(
    self,
    agent_id: int,
    start_at: str,  # ISO 格式时间字符串
    end_at: str,
    class_name: Optional[str] = None,
    task_sheet: Optional[str] = None,
    teacher_marks: Optional[List[Dict[str, Any]]] = None,
    custom_prompt: Optional[str] = None,
    merge_threshold: float = 0.30,
    title: str = "未命名分析",
    created_by: Optional[int] = None,
) -> Dict[str, Any]:
    """
    异步学生问题链分析任务

    Args:
        agent_id: 智能体ID
        start_at: 开始时间(ISO格式)
        end_at: 结束时间(ISO格式)
        class_name: 班级名称
        task_sheet: 任务单内容
        teacher_marks: 教师标记列表
        custom_prompt: 自定义提示词
        merge_threshold: 相似问题合并阈值
        title: 分析标题
        created_by: 创建者用户ID

    Returns:
        包含 analysis_id 和结果摘要的字典
    """
    import asyncio

    # 更新进度: 开始分析
    self.update_state(state="PROGRESS", meta={"progress": 10, "status": "正在加载对话数据..."})

    async def _run_analysis():
        async with AsyncSessionLocal() as db:
            try:
                # 转换时间字符串为 datetime 对象
                start_dt = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(end_at.replace("Z", "+00:00"))

                # 更新进度: 数据分析中
                self.update_state(state="PROGRESS", meta={"progress": 30, "status": "正在构建问题链..."})

                # 执行分析
                result = await analyze_student_chains_v2(
                    db,
                    agent_id=agent_id,
                    start_at=start_dt,
                    end_at=end_dt,
                    class_name=class_name,
                    task_sheet=task_sheet,
                    teacher_marks=teacher_marks,
                    custom_prompt=custom_prompt,
                    merge_threshold=merge_threshold,
                )

                # 更新进度: 保存结果
                self.update_state(state="PROGRESS", meta={"progress": 80, "status": "正在保存分析结果..."})

                # 存储结果到数据库
                analysis = StudentChainAnalysis(
                    title=title,
                    agent_id=agent_id,
                    class_name=class_name,
                    start_at=start_dt,
                    end_at=end_dt,
                    task_sheet=task_sheet,
                    result=result,
                    created_by=created_by,
                )
                db.add(analysis)
                await db.commit()
                await db.refresh(analysis)

                # 提取摘要信息
                summary = result.get("student_chain_summary", {})
                return {
                    "analysis_id": analysis.id,
                    "title": title,
                    "chain_count": summary.get("chain_count", 0),
                    "question_count": summary.get("question_count", 0),
                    "unique_students": summary.get("unique_students", 0),
                    "teacher_anchor_count": summary.get("teacher_anchor_count", 0),
                }
            except Exception as e:
                await db.rollback()
                logger.error(f"问题链分析任务执行失败: {e}", exc_info=True)
                raise

    # 在事件循环中运行异步函数
    return asyncio.run(_run_analysis())
