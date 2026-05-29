import asyncio
from datetime import datetime, timedelta, timezone

from app.services.agents.agent_deep_analysis import (
    analyze_hot_questions_v2,
    analyze_student_chains_v2,
    summarize_chain_list_item,
    summarize_hot_list_item,
)


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self

    def all(self):
        return self._rows


class FakeDb:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, *_args, **_kwargs):
        return FakeResult(self.rows)


def row(message_id, minutes, role, content, *, user_id=1, name="学生甲", session="s1"):
    base = datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc)
    return {
        "message_id": message_id,
        "created_at": base + timedelta(minutes=minutes),
        "user_id": user_id,
        "user_name": name,
        "student_id": f"S{user_id}",
        "class_name": "一班",
        "role_code": role,
        "agent_id": 5,
        "session_id": session,
        "message_type": "question",
        "content": content,
    }


def test_hot_analysis_v2_builds_themes_timeline_and_teacher_anchors():
    db = FakeDb([
        row(1, 0, "teacher", "for 循环的三个部分分别是什么？", user_id=100, name="王老师", session="t"),
        row(2, 2, "student", "for 循环里的 range 为什么不包含最后一个数？", user_id=1, session="a"),
        row(3, 3, "student", "range 结束值为什么取不到？", user_id=2, name="学生乙", session="b"),
        row(4, 4, "student", "for 循环报错 NameError 怎么调试？", user_id=3, name="学生丙", session="c"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习 for 循环",
            bucket_seconds=180,
        )
    )

    assert result["analysis_version"] == "hot_v2"
    assert result["theme_count"] > 0
    assert result["summary"]["teacher_anchor_count"] == 1
    assert result["timeline_buckets"]
    assert result["course_hotspot_sequence"]
    assert result["evidence_index"]["2"]["content"].startswith("for 循环")

    stats = summarize_hot_list_item(result)
    assert stats["theme_count"] == result["theme_count"]
    assert stats["question_count"] == 3


def test_chain_analysis_v2_builds_teacher_mainline_and_beam_graph():
    db = FakeDb([
        row(1, 0, "admin", "函数为什么要有参数？", user_id=100, name="管理员老师", session="t"),
        row(2, 1, "student", "函数参数是什么意思？", user_id=1, session="a"),
        row(3, 2, "student", "如果参数换成列表可以吗？", user_id=1, session="a"),
        row(4, 4, "student", "函数递归和循环哪个更好？", user_id=2, name="学生乙", session="b"),
    ])

    result = asyncio.run(
        analyze_student_chains_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习函数",
        )
    )

    assert result["analysis_version"] == "chain_v2"
    assert result["teacher_mainline"]
    assert result["student_chain_summary"]["chain_count"] == 2
    assert result["ai_main_question_chain"]
    assert any(node["kind"] == "teacher_anchor" for node in result["beam_nodes"])
    assert any(edge["relation"] == "teacher_trigger" for edge in result["beam_edges"])

    stats = summarize_chain_list_item(result)
    assert stats["chain_count"] == 2
    assert stats["teacher_anchor_count"] == 1


def test_list_stats_fallback_for_legacy_hot_and_chain_results():
    hot_stats = summarize_hot_list_item({
        "timeline_buckets": [
            {"question_count": 3, "is_burst": True},
            {"question_count": 2, "is_burst": False},
        ],
        "uncovered": [
            {"topic": "循环边界", "count": 2},
            {"topic": "调试报错", "count": 3},
        ],
        "burst_points": [{"bucket_start": "2026-05-29T01:00:00Z"}],
    })
    assert hot_stats["theme_count"] == 2
    assert hot_stats["question_count"] == 5
    assert hot_stats["burst_count"] == 1

    chain_stats = summarize_chain_list_item({
        "uncovered": [
            {"topic": "函数参数", "questions": ["参数是什么意思？", "参数能换成列表吗？"]},
            {"topic": "递归迁移", "count": 1},
        ],
        "main_question_chain": [{"stage": "主线", "question": "函数为什么要参数？"}],
        "teacher_marks": [{"question": "函数为什么要参数？"}],
    })
    assert chain_stats["chain_count"] == 2
    assert chain_stats["question_count"] == 3
    assert chain_stats["teacher_anchor_count"] == 1
    assert chain_stats["ai_chain_node_count"] == 1
