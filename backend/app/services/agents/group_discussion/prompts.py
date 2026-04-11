"""
Group Discussion 提示词模块

包含所有提示词生成函数。
"""

from typing import List

from app.models.agents.group_discussion import GroupDiscussionSession


def _default_prompt(session: GroupDiscussionSession, analysis_type: str, content: str) -> str:
    """生成默认分析提示词"""
    ctx = (
        f"你是一位经验丰富的教学分析助手，擅长从学生讨论中发现深层学习问题。\n"
        f"讨论日期：{session.session_date}\n"
        f"班级：{getattr(session, 'class_name', '')}\n"
        f"组号：{session.group_no}\n\n"
    )
    if analysis_type == "learning_topics":
        task = (
            "请深入分析本次讨论的学习主题，输出 Markdown 格式：\n\n"
            "## 一、学习主题（按重要性排序）\n"
            "每个主题请标注：\n"
            "- 讨论深度：浅层提及 / 深入探讨 / 有争议\n"
            "- 核心要点与代表性发言\n"
            "- 学生暴露的认知误区或概念混淆（如有）\n\n"
            "## 二、知识薄弱点\n"
            "从讨论中识别学生理解不到位的知识点，说明判断依据。\n\n"
            "## 三、教学建议\n"
            "针对发现的薄弱点，给教师 3 条具体的补充讲解建议。\n"
        )
    elif analysis_type == "question_chain":
        task = (
            "请深入梳理本次讨论的问题链条，输出 Markdown 格式：\n\n"
            "## 一、问题链条\n"
            "按步骤列出：初始问题 → 追问 → 分歧 → 验证 → 结论。\n"
            "每个问题请标注认知层次（记忆/理解/应用/分析/评价/创造）。\n\n"
            "## 二、断裂点\n"
            "识别问题链中断、话题跳转、无人回应的问题，分析可能原因。\n\n"
            "## 三、解答状态\n"
            "标注哪些问题得到了有效解答，哪些仍悬而未决，未解决的问题给出建议的解答方向。\n"
        )
    elif analysis_type == "timeline":
        task = (
            "请按时间线深入分析本次讨论，输出 Markdown 格式：\n\n"
            "## 一、时间线总结\n"
            "按 3 分钟为桶，每段标注：\n"
            "- 主要内容与关键问题\n"
            "- 讨论质量评估（活跃度高/中/低、深度浅/中/深、是否偏题）\n\n"
            "## 二、关键转折点\n"
            "识别话题转换、突破性理解、争议爆发等关键时刻，说明其教学意义。\n\n"
            "## 三、时间利用效率\n"
            "评估整体时间分配是否合理，哪些阶段效率高/低，给出优化建议。\n"
        )
    else:
        task = (
            "请对本次讨论做深度结构化分析，输出 Markdown 格式：\n\n"
            "## 一、学习主题与关键观点\n"
            "提炼核心主题，列出关键观点和代表性发言。\n\n"
            "## 二、学生参与度评估\n"
            "评估每位学生的参与情况：发言次数、有效发言比例、角色（主导者/跟随者/沉默者）。\n\n"
            "## 三、问题链条与待解决问题\n"
            "梳理讨论中的问题演进，标注已解决和未解决的问题。\n\n"
            "## 四、小组协作质量\n"
            "给出协作质量评分（1-10）及理由，分析互动模式。\n\n"
            "## 五、改进建议\n"
            "- 给学生的 3 条建议\n"
            "- 给教师的 3 条建议\n"
        )
    return f"{ctx}{task}\n讨论记录如下（按时间顺序）：\n{content}\n"


def _default_compare_prompt(*, bucket_seconds: int, content: str) -> str:
    """生成对比分析提示词"""
    return (
        "你是一位教学数据分析专家，擅长横向对比多个小组的讨论质量。\n"
        f"请基于下面按时间桶（每{bucket_seconds}秒）汇总的多组讨论记录，输出 Markdown 格式：\n\n"
        "## 一、各时间段主题对比\n"
        "每个时间桶的主要学习主题（1-3条），标注各组的讨论侧重点差异。\n\n"
        "## 二、问题链条对比\n"
        "各组的代表性问题链条（问题→追问→验证/结论），对比深度和完整度。\n\n"
        "## 三、讨论质量排名\n"
        "从讨论深度、参与度、问题解决率三个维度对各组排名，给出理由。\n\n"
        "## 四、共性薄弱知识点\n"
        "多个小组都暴露出的共性问题或知识盲点，这些是教师需要重点关注的。\n\n"
        "## 五、优秀讨论片段\n"
        "推荐 2-3 个值得全班分享的优秀讨论片段，说明其价值。\n\n"
        "## 六、教学建议\n"
        "基于以上对比分析，给教师 3 条具体的教学调整建议。\n\n"
        f"{content}\n"
    )


def _student_profile_prompt(
    name: str, session_date: str, class_name: str,
    discussion_lines: List[str], agent_lines: List[str],
) -> str:
    """生成学生画像分析提示词"""
    disc_text = "\n".join(discussion_lines) if discussion_lines else "（无发言记录）"
    agent_text = "\n".join(agent_lines) if agent_lines else "（无 AI 提问记录）"
    return (
        "你是一位专业的学生学习行为分析助手。\n"
        f"以下是学生「{name}」在 {session_date}（{class_name}）的学习数据。\n\n"
        f"【小组讨论发言】（{len(discussion_lines)} 条）\n{disc_text}\n\n"
        f"【AI 智能体提问记录】（{len(agent_lines)} 条）\n{agent_text}\n\n"
        "请输出 Markdown 格式的学生学习画像：\n\n"
        "## 一、学习参与度\n"
        "发言频率、主动性、是否积极回应他人、在小组中的角色（引导者/跟随者/质疑者/沉默者）。\n\n"
        "## 二、知识掌握情况\n"
        "从发言和 AI 提问中推断其对哪些知识点掌握较好、哪些较差，给出具体证据。\n\n"
        "## 三、思维特征\n"
        "提问方式分析（直接要答案 vs 尝试理解原理）、思维深度、是否有批判性思考。\n\n"
        "## 四、知识盲点\n"
        "在讨论中暴露的误解 + 向 AI 反复追问的知识点，这些是该学生最需要补强的。\n\n"
        "## 五、学习建议\n"
        "针对该学生的 3 条具体、可操作的学习建议。\n"
    )


def _cross_system_prompt(discussion_summary: str, agent_questions: str) -> str:
    """生成跨系统分析提示词"""
    return (
        "你是一位教学数据分析专家。以下是同一班级学生在同一时间段的两类学习数据。\n\n"
        f"【小组讨论记录摘要】\n{discussion_summary}\n\n"
        f"【AI 智能体提问记录】\n{agent_questions}\n\n"
        "请输出 Markdown 格式的跨系统关联分析：\n\n"
        "## 一、话题关联\n"
        "小组讨论的热点话题与 AI 提问的热门问题是否一致？哪些话题只在讨论中出现？哪些只在 AI 提问中出现？\n\n"
        "## 二、学习路径\n"
        "学生是先讨论再问 AI，还是先问 AI 再回到讨论？这反映了什么学习模式？\n\n"
        "## 三、共性知识盲点\n"
        "两个渠道都反复出现的问题/概念，说明是班级共性薄弱点，列出具体知识点。\n\n"
        "## 四、AI 依赖度分析\n"
        "哪些学生过度依赖 AI（讨论中沉默但频繁问 AI）？哪些学生善于利用两个渠道互补？\n\n"
        "## 五、教学建议\n"
        "基于以上分析，给教师 3 条具体的教学调整建议。\n"
    )