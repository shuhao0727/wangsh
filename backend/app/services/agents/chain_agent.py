"""
学生问题链 AI 深度分析 Agent

使用 LLM 对 v2 确定性流水线产出的学生链数据进行深度分析，产出：
- 个体学生认知轨迹分析（6种轨迹类型判断）
- 课堂连锁反应检测（社交模仿 vs 好奇驱动）
- 教师提问效果量化评估
- 学习漏洞诊断与优先级排序
- 分层干预方案（全班/小组/个体）

指令文档见: docs/features/assessment/chain_agent.md
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .llm_agent_base import call_llm


_CHAIN_AGENT_SYSTEM_PROMPT = """你是一位学习科学与认知诊断专家。
你追踪和分析学生的思维过程，理解学生的学习路径如何形成、演化和受阻。
你的诊断基于：认知建构主义、最近发展区理论、社交学习理论、Bloom 认知分类学。

请严格按照以下要求输出 JSON（不要包含 markdown 代码块标记）：
{
  "participation_profile": {"total_students_with_questions": N, "avg_questions_per_student": N, "student_categories": {"深度追问者":{"count":N,"names":[...]}, "概念确认者":{"count":N}, "模板粘贴者":{"count":N}, "噪音制造者":{"count":N,"names":[...]}, "零参与":{"count":N}}, "class_bloom_distribution": {"记忆":0,"理解":0,"应用":0,"分析":0,"评价":0,"创造":0}},
  "cognitive_trajectories": [{"student_name":"...", "class_name":"...", "question_count":N, "questions_sequence":[{"time":"...","question":"...","bloom_level":"..."}], "trajectory_type":"正向递进/渐进试探/概念卡滞/主题漂移/U型回退/认知退缩/认知跳跃", "confidence":"高/中/低", "bloom_progression":[...], "overall_trend":"上升/持平/下降", "key_turning_point":{"question":"...","change":"..."}, "root_cause":"...", "learning_suggestion":"...", "alternative_trajectory":"..."}],
  "chain_reactions": [{"trigger_question":"... — 姓名 — 时间", "followers_count":N, "follower_questions":[...], "time_span":"...", "similarity_level":"A/B/C", "driver":"好奇驱动/社交模仿/混合型", "driver_confidence":"高/中/低", "insight":"..."}],
  "teacher_question_evaluations": [{"teacher_question_id":"...", "teacher_question":"...", "triggered_count":N, "triggered_bloom_distribution":{"记忆":0,"理解":0,"应用":0,"分析":0,"评价":0,"创造":0}, "effectiveness_score": N, "evaluation":"...", "improvement_suggestion":"..."}],
  "learning_gaps": {"universal_gaps":[{"gap_name":"...","severity":"高/中/低","affected_count":N,"affected_students":[...],"evidence":[...],"root_cause":"...","intervention":"..."}], "individual_gaps":[{"student":"...","gap":"...","evidence":"...","intervention":"..."}], "cognitive_ceiling":{"bloom_level":"...","percentage_stuck":"...","barrier_description":"...","breakthrough_strategy":"..."}},
  "intervention_plan": {"whole_class":[{"target_gap":"...","action":"...","when":"..."}], "small_group":[{"target_students":[...],"common_issue":"...","action":"..."}], "individual":[{"student":"...","current_state":"...","goal":"...","action":"...","urgency":"高/中/低"}]},
  "class_differences": {"enabled":true/false,"classes_compared":[...],"comparison":"...","teaching_implications":"..."},
  "executive_summary": "150-200字认知诊断总结",
  "unresolved_items": [{"question":"...","reason":"数据不足"}],
  "low_confidence_items": [{"conclusion":"...","confidence":"低","alternatives":[...]}]
}

分析要求：
1. 只分析 ≥ 2 条问题的学生；对 1 条问题的学生标注"单点提问 — 不足推断轨迹"
2. 认知轨迹类型使用判断树精确判定，标注置信度
3. 连锁反应需通过时间窗口（120秒）+ 语义窗口双重验证
4. 教师提问效果使用 0-100 量化评分
5. 学习漏洞按优先级公式排序（影响范围 + Bloom阻断 + 可修复性）
6. 干预方案分三层：全班层/小组层/个体层
7. 数据不足时标注"低置信度"，列出备选解释
8. 区分"有效 AI 使用"和"AI 依赖"
9. 明确标注"基于时间相关性推断，非严格因果"
10. 沉默/零参与学生至少被提及一次

## 问题合并审查

你将收到系统预聚类的候选合并组（merged_groups）。请按以下标准审查和调整：

### 合并条件（全部满足才合并）：
1. 来自不同学生（同一学生的多个问题是思维链条，不合并）
2. 时间差 ≤ 2 分钟
3. 指向同一个知识困惑点（语义相似，不要求字面相同）

### 判断"语义相似"的标准：
- 问的是同一个知识点的同一层面（如都在问 range 的边界值）
- 表达不同但困惑相同（"包含10吗" ≈ "为什么到9" ≈ "最后一个数是什么"）
- 注意区分：追问（递进）vs 重复（相似）
  - "range 参数是什么？" → "步长可以是负数吗？" = 递进，不合并
  - "range 包含 10 吗？" ≈ "range(10) 为什么到 9？" = 相似，合并

### 不合并的情况：
- 同一学生的不同问题（即使话题相同）
- 时间差 > 2 分钟的问题（视为独立教学事件）
- 字面有关但困惑层面不同（如"for 语法" vs "for 效率"）

### 输出要求：
在 JSON 输出中增加 `merged_groups_review` 字段：
```json
{
  "merged_groups_review": {
    "confirmed": [1, 3, 5],
    "split": [{"group_id": 2, "reason": "困惑层面不同", "new_groups": [[q_id1, q_id2], [q_id3]]}],
    "new_merges": [{"question_ids": [q_id4, q_id5], "topic_label": "循环边界", "reason": "语义等价"}]
  }
}
```
- confirmed: 确认正确的合并组 ID 列表
- split: 需要拆分的组（给出原因和新分组）
- new_merges: 系统遗漏的应该合并的问题（给出原因）

## 数据清洗与归一化

在分析前，请注意以下数据质量规则：

1. **时间归一化**：默认课堂时长为 40 分钟。如果数据跨度超过 45 分钟，请仅关注连续活跃区间（首个学生提问到最后一个教师提问之间），忽略首尾的零散数据。

2. **噪声过滤**：以下类型的数据应被标记为噪声，不纳入主要分析：
   - 课前/课后的测试性提问（通常是"你好"、"测试"等无意义内容）
   - 与教学内容完全无关的闲聊（判断标准：与任务单关键词无任何交集）
   - 同一学生在 10 秒内的重复提问（系统误发）

3. **有效时间窗口**：在生成时间线相关分析（热点脉冲、教学区间等）时，以教师首次提问为 T0 起点，不要使用绝对时间戳。

4. **异常值处理**：如果某个时间桶的提问数超过前后平均值的 5 倍以上，标注为"可能的系统异常"而非教学事件。"""


async def deep_analyze_student_chains(
    prepared_data: Dict[str, Any],
    *,
    custom_prompt: Optional[str] = None,
    api_endpoint: str = "",
    api_key: str = "",
    agent_type: str = "",
    agent_model: str = "",
) -> Dict[str, Any]:
    """对 v2 确定性流水线产出的学生链数据进行 AI 深度认知诊断。

    Args:
        prepared_data: 结构化的分析输入，包含 student_chains, teacher_questions 等
        custom_prompt: 教师自定义指令
        api_endpoint: LLM API 地址
        api_key: LLM API Key
        agent_type: "dify" or "openai-compatible"
        agent_model: 模型名称
    """
    user_prompt = _build_chain_prompt(prepared_data, custom_prompt)

    result = await call_llm(
        prompt=_CHAIN_AGENT_SYSTEM_PROMPT + "\n\n" + user_prompt,
        api_endpoint=api_endpoint,
        api_key=api_key,
        agent_type=agent_type,
        agent_model=agent_model,
        response_format="json",
        timeout=300.0,
    )

    # 确保最小结构
    result.setdefault("participation_profile", {})
    result.setdefault("cognitive_trajectories", [])
    result.setdefault("chain_reactions", [])
    result.setdefault("teacher_question_evaluations", [])
    result.setdefault("learning_gaps", {})
    result.setdefault("intervention_plan", {})
    result.setdefault("class_differences", {"enabled": False})
    result.setdefault("executive_summary", "")
    result.setdefault("unresolved_items", [])
    result.setdefault("low_confidence_items", [])

    return result


def _build_chain_prompt(data: Dict[str, Any], custom_prompt: Optional[str] = None) -> str:
    """构建学生问题链分析的 LLM prompt。"""
    meta = data.get("meta") or {}
    teacher_questions = data.get("teacher_questions") or []
    student_chains = data.get("student_chains") or []
    themes = data.get("themes") or []
    task_sheet = data.get("task_sheet") or ""
    ai_main_question_chain = data.get("ai_main_question_chain") or []
    unresolved_questions = data.get("unresolved_questions") or []

    # 精简 student_chains：只保留高频学生的完整链，低频学生的摘要
    compact_chains: List[Dict[str, Any]] = []
    for chain in student_chains:
        qs = chain.get("questions") or []
        if len(qs) >= 2:
            # 多问题学生：保留完整链
            compact_qs = []
            for q in qs:
                compact_qs.append({
                    "time": q.get("time", "")[:19],
                    "question": q.get("question", ""),
                    "question_type": q.get("question_type_label", ""),
                    "bloom_level": q.get("bloom_level", ""),
                    "teacher_anchor_id": q.get("teacher_anchor_id", ""),
                })
            compact_chains.append({
                "student_name": chain.get("student_name", "?"),
                "student_id": chain.get("student_id", ""),
                "class_name": chain.get("class_name", "?"),
                "questions": compact_qs,
            })
    # 限制总链数以控制 token
    if len(compact_chains) > 50:
        compact_chains = sorted(compact_chains, key=lambda c: -len(c["questions"]))[:50]

    input_data: Dict[str, Any] = {
        "meta": meta,
        "task_sheet": task_sheet[:2000],
        "teacher_questions": [
            {"id": tq.get("id", ""), "time": str(tq.get("time", ""))[:19], "question": tq.get("question", ""), "source": tq.get("source", "auto")}
            for tq in teacher_questions[:30]
        ],
        "student_chains": compact_chains,
        "themes": themes[:20],
        "ai_main_question_chain": [
            {
                "stage": item.get("stage"),
                "teacher_or_topic_question": item.get("question"),
                "student_response_summary": item.get("student_response_summary"),
                "next_ai_question": item.get("next_ai_question"),
                "evidence": (item.get("evidence") or [])[:3],
            }
            for item in ai_main_question_chain[:12]
        ],
        "unresolved_questions": [
            {
                "student": item.get("user_name"),
                "class": item.get("class_name"),
                "time": str(item.get("created_at", ""))[:19],
                "question": item.get("content", ""),
                "question_type": item.get("question_type_label") or item.get("question_type"),
                "bloom_level": item.get("bloom_level"),
            }
            for item in unresolved_questions[:30]
        ],
        "student_chain_statistics": {
            "total_chains": len(student_chains),
            "multi_question_students": len(compact_chains),
            "total_questions": sum(len(c.get("questions") or []) for c in student_chains),
        },
    }

    prompt_parts = ["## 输入数据\n", json.dumps(input_data, ensure_ascii=False, indent=2)]

    if custom_prompt and custom_prompt.strip():
        prompt_parts.append(f"\n## 教师自定义指令\n{custom_prompt.strip()}\n")

    # 合并组数据（供 LLM 审查）
    merged_groups = data.get("merged_groups")
    if merged_groups and len(merged_groups) > 0:
        multi_member_groups = [g for g in merged_groups if g.get("member_count", 1) > 1]
        if multi_member_groups:
            prompt_parts.append("\n## 候选合并组（请审查）")
            for g in multi_member_groups[:20]:  # 最多展示20组
                members = ", ".join(str(sid) for sid in g.get("student_ids", []))
                prompt_parts.append(f"- 组{g['group_id']}「{g.get('topic_label', '')}」: {g.get('representative_question', '')} (学生: {members}, {g.get('member_count', 0)}人)")

    prompt_parts.append("\n请基于以上数据，按照系统指令要求进行深度认知诊断。只输出 JSON。")

    return "\n".join(prompt_parts)
