#!/usr/bin/env python3
"""独立运行热点分析和学生问题链分析，结果写入数据库。"""
import asyncio, json, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.db.database import AsyncSessionLocal
from app.services.agents import analyze_hot_questions_v2, analyze_student_chains_v2


async def main():
    agent_id = 1
    class_name = "高三(1)班"
    start_at = datetime(2026, 5, 20, 9, 0, 0, tzinfo=timezone(timedelta(hours=8)))
    end_at = datetime(2026, 5, 20, 9, 40, 0, tzinfo=timezone(timedelta(hours=8)))

    async with AsyncSessionLocal() as db:
        print("=== 热点问题分析 ===")
        hot_result = await analyze_hot_questions_v2(
            db, agent_id=agent_id, start_at=start_at, end_at=end_at,
            class_name=class_name, task_sheet="掌握Python循环与列表操作",
            bucket_seconds=180,
        )
        await db.execute(text("""
            INSERT INTO hot_question_analyses (title, agent_id, class_name, start_at, end_at, task_sheet, bucket_seconds, teacher_marks, result, created_by, created_at)
            VALUES (:t, :aid, :cn, :sa, :ea, :ts, :bs, '[]'::jsonb, :r, :cb, NOW())
        """), {
            "t": "Python循环教学-热点分析", "aid": agent_id, "cn": class_name,
            "sa": start_at, "ea": end_at, "ts": "掌握Python循环与列表操作",
            "bs": 180, "r": json.dumps(hot_result), "cb": 1,
        })
        await db.commit()
        print(f"  热点分析完成: theme_count={hot_result.get('theme_count',0)}, uncovered={len(hot_result.get('uncovered',[]))}")

        print("=== 学生问题链分析 ===")
        chain_result = await analyze_student_chains_v2(
            db, agent_id=agent_id, start_at=start_at, end_at=end_at,
            class_name=class_name, task_sheet="掌握Python循环与列表操作",
        )
        await db.execute(text("""
            INSERT INTO student_chain_analyses (title, agent_id, class_name, start_at, end_at, task_sheet, result, created_by, created_at)
            VALUES (:t, :aid, :cn, :sa, :ea, :ts, :r, :cb, NOW())
        """), {
            "t": "Python循环教学-学生问题链", "aid": agent_id, "cn": class_name,
            "sa": start_at, "ea": end_at, "ts": "掌握Python循环与列表操作",
            "r": json.dumps(chain_result), "cb": 1,
        })
        await db.commit()
        print(f"  问题链分析完成: chain_count={chain_result.get('student_chain_summary',{}).get('chain_count',0)}")

    print("Done!")


asyncio.run(main())
