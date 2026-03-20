"""
题目管理服务 - CRUD + AI 出题
"""

import json
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from loguru import logger

from app.models.assessment import AssessmentConfig, AssessmentQuestion
from app.schemas.assessment import QuestionCreate, QuestionUpdate


async def create_question(
    db: AsyncSession,
    question_in: QuestionCreate,
) -> AssessmentQuestion:
    """手动创建题目"""
    db_question = AssessmentQuestion(
        config_id=question_in.config_id,
        question_type=question_in.question_type,
        content=question_in.content,
        options=question_in.options,
        correct_answer=question_in.correct_answer,
        score=question_in.score,
        difficulty=question_in.difficulty,
        knowledge_point=question_in.knowledge_point,
        explanation=question_in.explanation,
        source=question_in.source,
        mode=question_in.mode,
        adaptive_config=question_in.adaptive_config,
    )
    db.add(db_question)
    await db.commit()
    await db.refresh(db_question)
    return db_question


async def get_questions(
    db: AsyncSession,
    config_id: int,
    skip: int = 0,
    limit: int = 50,
    question_type: Optional[str] = None,
    difficulty: Optional[str] = None,
) -> tuple[List[AssessmentQuestion], int]:
    """获取题目列表（分页）"""
    query = select(AssessmentQuestion).where(AssessmentQuestion.config_id == config_id)
    count_query = select(func.count(AssessmentQuestion.id)).where(AssessmentQuestion.config_id == config_id)

    if question_type:
        query = query.where(AssessmentQuestion.question_type == question_type)
        count_query = count_query.where(AssessmentQuestion.question_type == question_type)
    if difficulty:
        query = query.where(AssessmentQuestion.difficulty == difficulty)
        count_query = count_query.where(AssessmentQuestion.difficulty == difficulty)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(AssessmentQuestion.id).offset(skip).limit(limit)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_question(db: AsyncSession, question_id: int) -> Optional[AssessmentQuestion]:
    """获取单道题目"""
    result = await db.execute(
        select(AssessmentQuestion).where(AssessmentQuestion.id == question_id)
    )
    return result.scalar_one_or_none()


async def update_question(
    db: AsyncSession,
    question_id: int,
    question_in: QuestionUpdate,
) -> Optional[AssessmentQuestion]:
    """更新题目"""
    db_question = await get_question(db, question_id)
    if not db_question:
        return None

    update_data = question_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_question, key, value)

    await db.commit()
    await db.refresh(db_question)
    return db_question


async def delete_question(db: AsyncSession, question_id: int) -> bool:
    """删除题目"""
    db_question = await get_question(db, question_id)
    if not db_question:
        return False

    await db.delete(db_question)
    await db.commit()
    return True


def _build_generate_prompt(config: AssessmentConfig, count: int = None, question_type: str = None, difficulty: str = None, knowledge_points: list = None) -> str:
    """构建 AI 出题 prompt"""
    type_map = {"choice": "选择题", "fill": "填空题", "short_answer": "简答题"}

    # 如果传了具体参数，优先使用
    if count and question_type:
        name = type_map.get(question_type, question_type)
        extra = "，4 个选项，1 个正确答案" if question_type == "choice" else ""
        type_text = f"- {name} {count} 道（每道 10 分{extra}）"
    elif count:
        # 只指定数量，混合出题
        type_text = f"- 共 {count} 道题，题型自由搭配（选择题、填空题、简答题）"
    else:
        # 使用 question_config 或默认
        question_config = {}
        if config.question_config:
            try:
                question_config = json.loads(config.question_config)
            except json.JSONDecodeError:
                pass
        type_lines = []
        for qtype, cfg in question_config.items():
            if isinstance(cfg, dict):
                c = cfg.get("count", 0)
                score = cfg.get("score", 10)
            else:
                c = cfg
                score = 10
            if c > 0:
                name = type_map.get(qtype, qtype)
                extra = "，4 个选项，1 个正确答案" if qtype == "choice" else ""
                type_lines.append(f"- {name} {c} 道（每道 {score} 分{extra}）")
        type_text = "\n".join(type_lines) if type_lines else "- 选择题 5 道（每道 10 分）\n- 填空题 3 道（每道 10 分）\n- 简答题 2 道（每道 10 分）"

    # 难度
    diff_map = {"easy": "简单", "medium": "中等", "hard": "困难"}
    if difficulty:
        diff_text = f"全部为{diff_map.get(difficulty, difficulty)}难度"
    else:
        diff_text = "简单 40% / 中等 40% / 困难 20%"

    # 知识点
    if knowledge_points:
        kp_text = "、".join(knowledge_points)
    else:
        kp_text = config.knowledge_points or "[]"

    teacher_prompt = config.ai_prompt or "无"

    prompt = f"""你是一位专业的出题教师，请根据以下教学目标和知识点出题。

【教学目标】
{config.teaching_objectives or "无"}

【知识点】
{kp_text}

【题型要求】
{type_text}

【难度分布】
{diff_text}

【教师补充要求】
{teacher_prompt}

请严格输出 JSON 数组格式，每道题包含以下字段：
- type: "choice" | "fill" | "short_answer"
- content: 题目内容
- options: 选项数组（仅选择题），如 ["A. xxx", "B. xxx", "C. xxx", "D. xxx"]
- correct_answer: 正确答案（选择题为 "A"/"B"/"C"/"D"，填空题为文本，简答题为参考答案）
- score: 分值
- difficulty: "easy" | "medium" | "hard"
- knowledge_point: 对应知识点
- explanation: 答案解析

只输出 JSON 数组，不要输出其他内容。"""

    return prompt


def _parse_questions_json(raw_text: str) -> List[dict]:
    """解析 AI 返回的题目 JSON"""
    import re

    logger.debug(f"AI 原始返回 (前500字): {raw_text[:500]}")

    # 1. 尝试从 ```json ... ``` 代码块提取
    match = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", raw_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                return data
        except json.JSONDecodeError:
            pass

    # 2. 找所有顶层 JSON 数组，取第一个包含 dict 的
    for m in re.finditer(r'\[', raw_text):
        start = m.start()
        # 找到匹配的 ]
        depth = 0
        for i in range(start, len(raw_text)):
            if raw_text[i] == '[':
                depth += 1
            elif raw_text[i] == ']':
                depth -= 1
                if depth == 0:
                    candidate = raw_text[start:i + 1]
                    try:
                        data = json.loads(candidate)
                        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                            return data
                    except json.JSONDecodeError:
                        pass
                    break

    # 3. 最后兜底：直接尝试整段解析
    text = raw_text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    raise ValueError(f"无法解析 AI 返回的题目 JSON: {raw_text[:300]}")


async def generate_questions(
    db: AsyncSession,
    config_id: int,
    count: int = None,
    question_type: str = None,
    difficulty: str = None,
    knowledge_points: list = None,
) -> List[AssessmentQuestion]:
    """AI 批量生成题目"""
    from app.services.assessment.config_service import get_config
    from app.services.agents.chat_blocking import run_agent_chat_blocking

    config = await get_config(db, config_id)
    if not config:
        raise ValueError("测评配置不存在")
    if not config.agent_id:
        raise ValueError("未配置出题智能体，请先在测评编辑页选择智能体")

    prompt = _build_generate_prompt(config, count=count, question_type=question_type, difficulty=difficulty, knowledge_points=knowledge_points)
    logger.info(f"AI 出题: config_id={config_id}, agent_id={config.agent_id}")

    # 调用 AI 生成题目
    raw_response = await run_agent_chat_blocking(
        db,
        agent_id=config.agent_id,
        message=prompt,
    )

    # 解析 JSON
    questions_data = _parse_questions_json(raw_response)
    logger.info(f"AI 生成了 {len(questions_data)} 道题目")

    # 存入数据库
    created = []
    for q in questions_data:
        if not isinstance(q, dict):
            logger.warning(f"跳过非字典格式的题目数据: {q}")
            continue
        if "content" not in q and "question" in q:
            q["content"] = q["question"]
        if not q.get("content"):
            continue

        qtype = q.get("type", q.get("question_type", "choice"))
        options = q.get("options")
        if isinstance(options, dict):
            options = json.dumps(options, ensure_ascii=False)
        elif isinstance(options, list):
            options = json.dumps(options, ensure_ascii=False)

        db_question = AssessmentQuestion(
            config_id=config_id,
            question_type=qtype,
            content=q.get("content", ""),
            options=options,
            correct_answer=q.get("correct_answer", ""),
            score=q.get("score", 10),
            difficulty=q.get("difficulty", "medium"),
            knowledge_point=q.get("knowledge_point"),
            explanation=q.get("explanation"),
            source="ai_generated",
        )
        db.add(db_question)
        created.append(db_question)

    await db.commit()
    for q in created:
        await db.refresh(q)

    return created
