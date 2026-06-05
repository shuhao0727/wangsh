"""
热点问题 AI 深度分析 Agent

使用 LLM 对 v2 确定性流水线的输出进行深度分析，产出：
- 基于 Bloom 认知分类学的主题聚类解读
- 课堂时间阶段分析
- 任务单盲区发现
- 可执行的教学改进建议
- 跨班级对比分析

指令文档见: docs/features/assessment/hot_agent.md
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .llm_agent_base import call_llm


_HOT_AGENT_SYSTEM_PROMPT = """你是一位课堂教学诊断专家，拥有 15 年以上教学研究经验。
你通过分析学生课堂提问来诊断教学效果、发现教学设计盲区、并为教师提供具体可执行的教学改进建议。
你的分析方法论基于：Bloom 认知分类学、教学设计对齐理论、证据驱动诊断。

请严格按照以下要求输出 JSON（不要包含 markdown 代码块标记）：
{
  "data_profile": {"summary": "200字数据画像", "noise_ratio": "...", "noise_types": [...], "participation_pattern": "..."},
  "theme_analysis": [{"theme": "...", "question_count": N, "unique_students": N, "bloom_distribution": {"记忆":0,"理解":0,"应用":0,"分析":0,"评价":0,"创造":0}, "overall_bloom_level": "...", "representative_questions": [...], "covered_by_task_sheet": true/false, "student_behavior": "...", "diagnosis": "教学诊断"}],
  "timeline_phases": [{"phase_index": 1, "phase_name": "...", "time_range": "...", "question_count": N, "dominant_themes": [...], "bloom_profile": "...", "phase_description": "...", "transition_driver": "...", "insight": "教学洞察"}],
  "task_sheet_analysis": {"covered_topics": [...], "blind_spots": [{"topic": "...", "actual_questions": N, "insight": "..."}], "underperformed_topics": [{"topic": "...", "possible_reason": "..."}], "bloom_gap_analysis": "..."},
  "teaching_suggestions": [{"priority": "高/中/低", "category": "课堂教学/课前准备/课后巩固/AI助教使用", "observation": "...", "root_cause": "...", "suggested_action": "...", "expected_effect": "...", "target_students": [...], "verification_indicator": "..."}],
  "class_comparison": {"enabled": true/false, "classes_compared": [...], "differences": {"volume": "...", "themes": "...", "quality": "...", "rhythm": "..."}, "insight": "..."},
  "executive_summary": "150-200字教学诊断总结"
}

分析要求：
1. 主题诊断必须做根因分析 — 不只要描述"学生问了什么"，还要解释"为什么学生这样问"
2. 教学建议必须具体到教师能直接执行的程度，配验证指标
3. 每个结论必须有 ≥ 2 个学生提问原文支撑
4. 区分"个别学生"和"多数学生"，不将个体表现误判为全班特征
5. 至少提及一次沉默学生/无提问记录学生的情况
6. 使用教学语言，不堆砌数据科学术语
7. 覆盖课前准备/课堂讲授/AI使用规范/课后巩固四个维度"""


async def deep_analyze_hot_questions(
    prepared_data: Dict[str, Any],
    *,
    custom_prompt: Optional[str] = None,
    api_endpoint: str = "",
    api_key: str = "",
    agent_type: str = "",
    agent_model: str = "",
) -> Dict[str, Any]:
    """对 v2 确定性流水线产出的数据进行 AI 深度分析。

    Args:
        prepared_data: 结构化的分析输入，包含 meta, student_questions, topic_distribution 等
        custom_prompt: 教师自定义指令（来自提示词模板），会作为补充指令追加到 system prompt
        api_endpoint: LLM API 地址
        api_key: LLM API Key
        agent_type: "dify" or "openai-compatible"
        agent_model: 模型名称
    """
    # 构建 prompt
    user_prompt = _build_analysis_prompt(prepared_data, custom_prompt)

    result = await call_llm(
        prompt=_HOT_AGENT_SYSTEM_PROMPT + "\n\n" + user_prompt,
        api_endpoint=api_endpoint,
        api_key=api_key,
        agent_type=agent_type,
        agent_model=agent_model,
        response_format="json",
        timeout=300.0,
    )

    # 确保最小结构
    result.setdefault("data_profile", {})
    result.setdefault("theme_analysis", [])
    result.setdefault("timeline_phases", [])
    result.setdefault("task_sheet_analysis", {})
    result.setdefault("teaching_suggestions", [])
    result.setdefault("class_comparison", {"enabled": False})
    result.setdefault("executive_summary", "")

    return result


def _build_analysis_prompt(data: Dict[str, Any], custom_prompt: Optional[str] = None) -> str:
    """构建发给 LLM 的完整分析 prompt。"""
    import json

    # 控制数据量：学生问题太多时做摘要
    student_questions = data.get("student_questions") or []
    meta = data.get("meta") or {}
    topic_dist = data.get("topic_distribution") or {}
    noise = data.get("noise_questions") or []
    task_sheet = data.get("task_sheet") or ""
    teacher_questions = data.get("teacher_questions") or []
    timeline_buckets = data.get("timeline_buckets") or []
    course_sequence = data.get("course_hotspot_sequence") or []

    # 构建精简但信息完整的输入
    input_data: Dict[str, Any] = {
        "meta": meta,
        "task_sheet": task_sheet[:2000],  # 截断过长的任务单
        "topic_distribution": topic_dist,
        "teacher_questions": [
            {
                "id": item.get("id"),
                "time": str(item.get("time", ""))[:19],
                "question": item.get("question", ""),
                "source": item.get("source", ""),
            }
            for item in teacher_questions[:30]
        ],
        "timeline_buckets": [
            {
                "time_range": f"{str(item.get('bucket_start', ''))[:19]} ~ {str(item.get('bucket_end', ''))[:19]}",
                "question_count": item.get("question_count", 0),
                "unique_students": item.get("unique_students", 0),
                "is_burst": bool(item.get("is_burst")),
                "near_teacher_mark": item.get("near_teacher_mark"),
                "dominant_themes": list((item.get("theme_distribution") or {}).keys())[:4],
                "top_questions": [
                    q.get("question", "") for q in (item.get("top_questions") or [])[:3]
                ],
            }
            for item in timeline_buckets[:40]
        ],
        "course_hotspot_sequence": [
            {
                "stage": item.get("stage"),
                "time_range": f"{str(item.get('start_at', ''))[:19]} ~ {str(item.get('end_at', ''))[:19]}",
                "teacher_question": item.get("teacher_question"),
                "dominant_theme": item.get("dominant_theme"),
                "question_count": item.get("question_count", 0),
                "unique_students": item.get("unique_students", 0),
                "phase_type": item.get("phase_type"),
                "representative_questions": (item.get("representative_questions") or [])[:3],
            }
            for item in course_sequence[:20]
        ],
        "noise_summary": {
            "count": len(noise),
            "examples": noise[:10],
        },
        "student_questions": _compact_questions(student_questions),
    }

    # 按主题分组示例
    examples_by_topic: Dict[str, List[Dict]] = {}
    for q in student_questions:
        terms = tuple(q.get("terms") or [])
        topic_key = terms[0] if terms else "其他"
        if topic_key not in examples_by_topic:
            examples_by_topic[topic_key] = []
        if len(examples_by_topic[topic_key]) < 5:
            examples_by_topic[topic_key].append({
                "student": q.get("student_name", "?"),
                "class": q.get("class_name", "?"),
                "time": q.get("time", "")[:19],
                "question": q.get("question", ""),
                "question_type": q.get("question_type_label", ""),
                "bloom_level": q.get("bloom_level", ""),
            })
    input_data["question_examples_by_topic"] = examples_by_topic

    prompt_parts = ["## 输入数据\n", json.dumps(input_data, ensure_ascii=False, indent=2)]

    if custom_prompt and custom_prompt.strip():
        prompt_parts.append(f"\n## 教师自定义指令\n{custom_prompt.strip()}\n")

    prompt_parts.append("\n请基于以上数据，按照系统指令要求进行深度分析。只输出 JSON。")

    return "\n".join(prompt_parts)


def _compact_questions(questions: List[Dict[str, Any]], max_count: int = 300) -> List[Dict[str, Any]]:
    """压缩问题列表——按主题分层抽样，确保每个主题至少保留 5 个代表问题。"""
    if len(questions) <= max_count:
        return questions

    from collections import defaultdict
    by_theme: Dict[str, List[Dict]] = defaultdict(list)
    for q in questions:
        terms = q.get("terms") or []
        key = terms[0] if terms else "其他"
        by_theme[key].append(q)

    result: List[Dict[str, Any]] = []
    per_theme = max(5, max_count // max(len(by_theme), 1))
    for theme_qs in by_theme.values():
        result.extend(theme_qs[:per_theme])
        if len(result) >= max_count:
            break

    return result[:max_count]
