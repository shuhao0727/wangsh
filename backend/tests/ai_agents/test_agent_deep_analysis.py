import asyncio
import importlib
import importlib.util
from datetime import datetime, timedelta, timezone

import app.services.agents.agent_deep_analysis as deep_analysis
from app.services.agents.agent_deep_analysis import (
    analyze_hot_questions_v2,
    analyze_student_chains_v2,
    summarize_chain_list_item,
    summarize_hot_list_item,
)

# 测试常量：避免硬编码字符串导致文案修改时误报失败
ANCHOR_REASON_SEMANTIC = "语义词重合"
HEAT_PROFILE_COMMONNESS = "共性热点"
SCORE_BASIS_CAUTION = "不等同于真实学习困难"


def test_deep_analysis_is_split_into_focused_modules():
    module_names = [
        "app.services.agents.agent_analysis_events",
        "app.services.agents.agent_hot_analysis",
        "app.services.agents.agent_chain_analysis",
        "app.services.agents.agent_analysis_summaries",
    ]
    for module_name in module_names:
        assert importlib.util.find_spec(module_name) is not None

    summaries = importlib.import_module(
        "app.services.agents.agent_analysis_summaries"
    )
    assert deep_analysis.summarize_hot_list_item is summaries.summarize_hot_list_item
    assert deep_analysis.summarize_chain_list_item is summaries.summarize_chain_list_item


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
    assert result["teacher_questions"]
    assert all(not key.startswith("_") for item in result["teacher_questions"] for key in item)
    assert set(result["teacher_questions"][0]) == {"id", "message_id", "time", "question", "source", "user_name"}

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
    assert result["teacher_mainline"]
    assert all(not key.startswith("_") for item in result["teacher_mainline"] for key in item)
    assert set(result["teacher_mainline"][0]) == {"id", "message_id", "time", "question", "source", "user_name"}

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


def test_hot_analysis_quality_filter_keeps_raw_evidence_but_excludes_prompt_echo_noise_and_duplicates():
    task_sheet = "请完成递归练习：定义 factorial(n) 递归函数，说明终止条件，并比较递归和迭代方法，提交完整代码。"
    db = FakeDb([
        row(1, 0, "student", task_sheet, user_id=1, session="a"),
        row(2, 1, "student", "嗯", user_id=2, name="学生乙", session="b"),
        row(3, 2, "student", "递归为什么需要终止条件？", user_id=3, name="学生丙", session="c"),
        row(4, 2, "student", "递归为什么需要终止条件？", user_id=3, name="学生丙", session="c"),
        row(5, 4, "student", "天气怎么样？", user_id=4, name="学生丁", session="d"),
        row(6, 5, "student", "递归函数报错 NameError 怎么调试？", user_id=5, name="学生戊", session="e"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet=task_sheet,
            bucket_seconds=180,
        )
    )

    assert result["summary"]["raw_count"] == 6
    assert result["summary"]["valid_question_count"] == 2
    assert result["summary"]["prompt_echo_count"] == 1
    assert result["summary"]["duplicate_count"] == 1
    assert result["summary"]["noise_count"] == 2
    assert result["data_quality"]["excluded_count"] == 4
    assert len(result["student_question_events"]) == 6
    assert result["evidence_index"]["1"]["quality_label"] == "prompt_echo"
    assert result["evidence_index"]["4"]["quality_label"] == "duplicate"
    assert result["evidence_index"]["5"]["quality_label"] == "off_track"
    assert "code_debug" in result["evidence_index"]["6"]["quality_flags"]
    assert all(theme["count"] <= 2 for theme in result["themes"])


def test_hot_analysis_quality_filter_does_not_use_keyword_mismatch_as_off_track_by_itself():
    db = FakeDb([
        row(1, 0, "student", "range 的结束值为什么取不到？", user_id=1),
        row(2, 1, "student", "for 循环为什么不包含最后一个数？", user_id=2, name="学生乙"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习 for 循环",
        )
    )

    assert result["summary"]["valid_question_count"] == 2
    assert result["summary"]["noise_count"] == 0


def test_hot_analysis_normalizes_question_intent_and_semantic_aliases():
    db = FakeDb([
        row(1, 0, "student", "for 循环里的 range 为什么不包含最后一个数？", user_id=1),
        row(2, 1, "student", "range 结束值为什么取不到？", user_id=2, name="学生乙"),
        row(3, 2, "student", "函数递归和循环哪个更好？", user_id=3, name="学生丙"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习 for 循环和函数",
        )
    )

    first = result["evidence_index"]["1"]
    second = result["evidence_index"]["2"]
    assert first["intent_code"] == "boundary_condition"
    assert second["intent_code"] == "boundary_condition"
    assert "边界" in first["semantic_terms"]
    assert "边界" in second["semantic_terms"]

    boundary_theme = next(theme for theme in result["themes"] if theme["intent_code"] == "boundary_condition")
    assert boundary_theme["count"] == 2
    assert boundary_theme["intent_label"] == "边界条件"
    assert result["summary"]["intent_distribution"]["boundary_condition"] == 2


def test_hotness_scores_reward_commonness_and_persistence_without_using_raw_count_alone():
    db = FakeDb([
        row(1, 0, "student", "range 的结束值为什么取不到？", user_id=1, session="a"),
        row(2, 1, "student", "range 的结束值为什么取不到？", user_id=2, name="学生乙", session="b"),
        row(3, 7, "student", "range 的结束值为什么取不到？", user_id=3, name="学生丙", session="c"),
        row(4, 7, "student", "range 的结束值为什么取不到？", user_id=4, name="学生丁", session="d"),
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

    boundary_theme = next(theme for theme in result["themes"] if theme["intent_code"] == "boundary_condition")
    assert boundary_theme["count"] == 4
    assert boundary_theme["unique_students"] == 4
    assert boundary_theme["commonness_score"] == 1.0
    assert boundary_theme["active_bucket_count"] == 2
    assert boundary_theme["persistence_score"] == 1.0
    assert boundary_theme["hotness_score"] > 70
    assert HEAT_PROFILE_COMMONNESS in boundary_theme["heat_profile"]
    assert "持续关注" in boundary_theme["heat_profile"]
    assert result["summary"]["top_hotness_score"] == boundary_theme["hotness_score"]
    assert len(result["course_hotspot_sequence"]) == 2

    for bucket in result["timeline_buckets"]:
        assert 0 <= bucket["volume_signal"] <= 1
        assert 0 <= bucket["growth_signal"] <= 1
        assert 0 <= bucket["student_diversity_signal"] <= 1
        assert 0 <= bucket["burst_score"] <= 100
        assert isinstance(bucket["burst_reasons"], list)


def test_hotness_difficulty_signal_distinguishes_debug_from_normal_follow_up():
    db = FakeDb([
        row(1, 0, "student", "递归为什么需要终止条件？", user_id=1, session="a"),
        row(2, 1, "student", "递归函数报错 NameError 怎么调试？", user_id=2, name="学生乙", session="b"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习递归函数",
        )
    )

    debug_theme = next(theme for theme in result["themes"] if theme["question_type_distribution"].get("debug", 0) > 0)
    follow_up_theme = next(theme for theme in result["themes"] if theme["question_type_distribution"].get("follow_up", 0) > 0)
    assert debug_theme["difficulty_signal_score"] > follow_up_theme["difficulty_signal_score"]
    assert debug_theme["hotness_score"] > follow_up_theme["hotness_score"]
    assert "困难信号" in debug_theme["heat_profile"]


def test_hotness_keeps_legacy_contract_and_excludes_quality_noise_from_scores():
    task_sheet = "请完成递归练习：定义 factorial(n) 递归函数，说明终止条件，并比较递归和迭代方法，提交完整代码。"
    db = FakeDb([
        row(1, 0, "student", task_sheet, user_id=1, session="a"),
        row(2, 1, "student", "递归为什么需要终止条件？", user_id=2, name="学生乙", session="b"),
        row(3, 1, "student", "递归为什么需要终止条件？", user_id=2, name="学生乙", session="b"),
        row(4, 2, "student", "嗯", user_id=3, name="学生丙", session="c"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet=task_sheet,
        )
    )

    assert result["analysis_version"] == "hot_v2"
    assert result["summary"]["raw_count"] == 4
    assert result["summary"]["valid_question_count"] == 1
    assert result["summary"]["prompt_echo_count"] == 1
    assert result["summary"]["duplicate_count"] == 1
    assert result["summary"]["noise_count"] == 1
    assert all(theme["count"] == 1 for theme in result["themes"])
    assert all(theme["unique_students"] == 1 for theme in result["themes"])
    assert all("hotness_score" in theme for theme in result["themes"])


def test_teacher_anchor_prefers_semantic_match_over_closer_unrelated_prompt():
    db = FakeDb([
        row(1, 0, "teacher", "函数参数如何传递给函数？", user_id=100, name="王老师", session="teacher"),
        row(2, 1, "teacher", "递归函数为什么需要终止条件？", user_id=100, name="王老师", session="teacher"),
        row(3, 2, "student", "递归为什么需要终止条件？", user_id=1, session="student"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习递归函数",
        )
    )

    event = result["student_question_events"][0]
    assert event["teacher_anchor_id"] == "teacher-2"
    assert event["teacher_anchor_match_type"] == "semantic_time"
    assert event["teacher_anchor_confidence"] == "high"
    assert event["teacher_anchor_score"] >= 0.7
    assert ANCHOR_REASON_SEMANTIC in event["teacher_anchor_reason"]
    assert result["summary"]["teacher_anchor_match_count"] == 1
    assert result["summary"]["teacher_anchor_coverage"] == 1.0


def test_teacher_anchor_summary_excludes_quality_filtered_events_but_keeps_evidence():
    task_sheet = "请完成递归练习：定义 factorial(n) 递归函数，说明终止条件，并比较递归和迭代方法，提交完整代码。"
    db = FakeDb([
        row(1, 0, "teacher", "递归函数为什么需要终止条件？", user_id=100, name="王老师", session="teacher"),
        row(2, 1, "student", "递归为什么需要终止条件？", user_id=1, session="student-valid"),
        row(3, 2, "student", task_sheet, user_id=2, name="学生乙", session="student-echo"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet=task_sheet,
        )
    )

    events = {item["message_id"]: item for item in result["student_question_events"]}
    assert events[2]["included_in_analysis"] is True
    assert events[3]["included_in_analysis"] is False
    assert events[3]["quality_label"] == "prompt_echo"
    # The excluded event remains traceable and may still show its candidate anchor.
    assert events[3]["teacher_anchor_id"] == "teacher-1"

    summary = result["summary"]
    assert summary["valid_question_count"] == 1
    assert summary["teacher_anchor_match_count"] == 1
    assert summary["teacher_anchor_coverage"] == 1.0
    assert summary["teacher_anchor_confidence_distribution"] == {"high": 1}

    audit = result["analysis_audit"]
    assert audit["audit_version"] == "hot_v2_audit_1"
    assert audit["raw_student_event_count"] == 2
    assert audit["valid_question_count"] == 1
    assert audit["excluded_event_count"] == 1
    assert audit["teacher_anchor_denominator"] == 1
    assert audit["teacher_anchor_match_count"] == 1
    assert audit["teacher_anchor_confidence_total"] == 1
    assert audit["teacher_anchor_statistics_consistent"] is True
    assert audit["warnings"] == []


def test_hot_analysis_audit_reports_inconsistent_anchor_accounting():
    audit = deep_analysis._build_analysis_audit(
        raw_event_count=3,
        raw_student_event_count=2,
        valid_question_count=1,
        excluded_event_count=1,
        teacher_anchor_denominator=2,
        anchor_stats={
            "match_count": 2,
            "coverage": 1.0,
            "confidence_distribution": {"high": 1},
        },
    )

    assert audit["teacher_anchor_statistics_consistent"] is False
    assert "anchor_denominator_mismatch" in audit["warnings"]
    assert "anchor_match_exceeds_valid_count" in audit["warnings"]
    assert "confidence_distribution_mismatch" in audit["warnings"]


def test_hotness_result_exposes_component_contributions_and_timeline_anchor_explanation():
    db = FakeDb([
        row(1, 0, "teacher", "递归函数为什么需要终止条件？", user_id=100, name="王老师", session="teacher"),
        row(2, 1, "student", "递归为什么需要终止条件？", user_id=1, session="a"),
        row(3, 4, "student", "递归函数的终止条件怎么写？", user_id=2, name="学生乙", session="b"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习递归函数",
            bucket_seconds=180,
        )
    )

    theme = result["themes"][0]
    components = theme["hotness_components"]
    assert set(components) == {"commonness", "difficulty", "persistence"}
    assert sum(item["contribution"] for item in components.values()) == theme["hotness_score"]
    assert len(theme["hotness_explanation"]) == 3
    assert SCORE_BASIS_CAUTION in theme["score_basis"]

    bucket = result["timeline_buckets"][0]
    assert bucket["teacher_anchor_id"] == "teacher-1"
    assert bucket["teacher_anchor_confidence"] in {"high", "medium", "low"}
    assert bucket["teacher_anchor_score"] is not None
    assert bucket["teacher_anchor_reason"]


def test_synonymous_questions_merge_but_different_topics_stay_separate():
    """同义问法应归并，但共享通用词（报错/调试）的不同知识点不得误并。"""
    db = FakeDb([
        row(1, 0, "student", "for 循环里的 range 为什么不包含最后一个数？", user_id=1),
        row(2, 1, "student", "range 结束值为什么取不到？", user_id=2, name="学生乙"),
        row(3, 2, "student", "for 循环 NameError 错误怎么调试？", user_id=3, name="学生丙"),
        row(4, 3, "student", "递归函数 RecursionError 错误怎么调试？", user_id=4, name="学生丁"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习 for 循环和函数",
        )
    )

    topics = [theme["topic"] for theme in result["themes"]]
    # 两个 range 边界问题应归并为同一主题（count=2）。
    merged = [theme for theme in result["themes"] if theme["count"] == 2]
    assert len(merged) == 1, f"应有一个 count=2 的归并主题，实际主题: {topics}"
    # "NameError"与"RecursionError"是不同错误类型，应分开。
    # 现在"错误"已从通用词移除，可以参与区分不同错误类型。
    for theme in result["themes"]:
        assert theme["count"] == 1 or theme["count"] == 2
        if theme["count"] == 2:
            assert "range" in theme["topic"] or "边界" in theme["topic"]


def test_word_cloud_uses_raw_terms_not_semantic_aliases():
    """词云必须只用事件原始 terms，不能混入 _semantic_terms 的派生别名。"""
    from app.services.agents.agent_analysis_events import (
        ConversationEvent,
        _extract_terms,
        _semantic_terms,
        _normalize_text,
    )
    from app.services.agents.agent_hot_analysis import _compute_word_cloud

    content = "for 循环报错 NameError 怎么调试？"
    terms = _extract_terms(content)
    semantic = _semantic_terms(content, terms)
    # 前提：该句的语义别名确实多出一个原文没有的"错误"。
    assert "错误" in semantic and "错误" not in terms

    event = ConversationEvent(
        message_id=1,
        created_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
        role_code="student",
        user_id=1,
        user_name="学生甲",
        student_id="S1",
        class_name="一班",
        agent_id=5,
        session_id="s1",
        message_type="text",
        content=content,
        normalized_text=_normalize_text(content),
        question_type="debug",
        bloom_level="理解",
        terms=terms,
        is_code_related=True,
        is_error_related=True,
        semantic_terms=semantic,
    )

    cloud_words = {item["word"] for item in _compute_word_cloud([], [event])}
    assert "错误" not in cloud_words, f"词云不应含派生别名，实际: {cloud_words}"
    assert "循环" in cloud_words
    assert "报错" in cloud_words


def test_chain_anchor_coverage_is_zero_without_teacher_questions():
    """无教师提问时，chain 锚点覆盖率应为 0，而不是被占位符顶成 1.0。"""
    db = FakeDb([
        row(1, 0, "student", "递归怎么理解？", user_id=1),
        row(2, 1, "student", "循环怎么写？", user_id=2, name="学生乙"),
    ])

    result = asyncio.run(
        analyze_student_chains_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习递归和循环",
        )
    )

    summary = result["student_chain_summary"]
    assert summary["teacher_anchor_match_count"] == 0
    assert summary["teacher_anchor_coverage"] == 0.0
    assert summary["teacher_anchor_confidence_distribution"] == {}


def test_timeline_bucket_does_not_leak_matching_internals():
    """时间桶内的 teacher_question 只暴露公开字段，不得泄漏匹配内部状态。"""
    db = FakeDb([
        row(1, 0, "teacher", "递归是什么？", user_id=100, name="王老师", session="t"),
        row(2, 1, "student", "递归为什么需要终止条件？", user_id=1),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习递归",
        )
    )

    def assert_no_internal(obj, path="result"):
        if isinstance(obj, dict):
            for key, value in obj.items():
                assert not key.startswith("_"), f"内部字段泄漏: {path}.{key}"
                assert_no_internal(value, f"{path}.{key}")
        elif isinstance(obj, list):
            for index, value in enumerate(obj):
                assert_no_internal(value, f"{path}[{index}]")

    assert_no_internal(result)


def test_hot_analysis_handles_empty_events():
    """空事件列表应返回零主题、空词云,不抛出 IndexError 或除零错误。"""
    db = FakeDb([])

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

    assert result["theme_count"] == 0
    assert result["word_cloud"] == []
    assert result["summary"]["valid_question_count"] == 0
    assert result["summary"]["raw_count"] == 0
    assert result["themes"] == []
    assert result["timeline_buckets"] == []
    assert result["course_hotspot_sequence"] == []
    assert result["teacher_questions"] == []


def test_hot_analysis_handles_single_question():
    """单条数据应计算 commonness_score == 1.0 且统计正确。"""
    db = FakeDb([
        row(1, 0, "student", "for 循环里的 range 为什么不包含最后一个数?", user_id=1),
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

    assert result["theme_count"] == 1
    assert result["summary"]["valid_question_count"] == 1
    assert result["summary"]["raw_count"] == 1
    assert len(result["themes"]) == 1
    theme = result["themes"][0]
    assert theme["count"] == 1
    assert theme["unique_students"] == 1
    assert theme["commonness_score"] == 1.0
    assert 0 <= theme["hotness_score"] <= 100
    assert len(result["timeline_buckets"]) >= 1
    assert len(result["word_cloud"]) > 0


import pytest


@pytest.mark.slow
def test_hot_analysis_performance_baseline():
    """性能基准:100 条不同问题应在 2 秒内完成。"""
    import time

    questions = [
        f"问题 {i}: for 循环的第 {i} 个参数是什么?" for i in range(100)
    ]
    rows = [
        row(i + 1, i % 10, "student", questions[i], user_id=(i % 20) + 1, name=f"学生{i % 20}", session=f"s{i}")
        for i in range(100)
    ]
    db = FakeDb(rows)

    start_time = time.time()
    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 20, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="学习 for 循环",
            bucket_seconds=180,
        )
    )
    elapsed = time.time() - start_time

    assert result["theme_count"] > 0
    assert result["summary"]["valid_question_count"] > 0
    assert elapsed < 2.0, f"性能基准未达标:耗时 {elapsed:.2f}秒 > 2秒"


def test_error_keyword_distinguishes_different_error_types():
    """验证'错误'作为核心主题词时能区分不同错误类型（如语法错误 vs 逻辑错误）。"""
    db = FakeDb([
        row(1, 0, "student", "什么是语法错误？", user_id=1),
        row(2, 1, "student", "语法错误怎么找？", user_id=2, name="学生乙"),
        row(3, 2, "student", "逻辑错误是什么？", user_id=3, name="学生丙"),
        row(4, 3, "student", "如何调试逻辑错误？", user_id=4, name="学生丁"),
    ])

    result = asyncio.run(
        analyze_hot_questions_v2(
            db,
            agent_id=5,
            start_at=datetime(2026, 5, 29, 1, 0, tzinfo=timezone.utc),
            end_at=datetime(2026, 5, 29, 1, 10, tzinfo=timezone.utc),
            class_name="一班",
            task_sheet="错误处理课程",
        )
    )

    topics = [theme["topic"] for theme in result["themes"]]
    # "语法错误"相关问题应归并（count=2），"逻辑错误"相关问题应归并（count=2）
    # 或至少应该能区分"语法"和"逻辑"两个不同主题
    assert len(result["themes"]) >= 2, f"应至少有2个不同主题，实际: {topics}"

    # 验证主题中包含区分性关键词
    topic_text = " ".join(topics)
    has_syntax_or_logic = "语法" in topic_text or "逻辑" in topic_text
    assert has_syntax_or_logic, f"主题应包含'语法'或'逻辑'等区分性词汇，实际主题: {topics}"
