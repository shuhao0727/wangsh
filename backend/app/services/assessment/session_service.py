"""
测评会话服务 - 学生答题流程 + 管理端统计
"""

import json
import random
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, update, delete
from sqlalchemy.orm import selectinload

from loguru import logger

from app.models.assessment import (
    AssessmentConfig,
    AssessmentQuestion,
    AssessmentSession,
    AssessmentAnswer,
    AssessmentBasicProfile,
    StudentProfile,
)


# ─── AI 实时出题 ───


async def _ai_generate_realtime_question(
    db: AsyncSession,
    config: AssessmentConfig,
    knowledge_point: str,
    question_type: str,
    score: int,
    prompt_hint: str = "",
    history: list[str] | None = None,
) -> dict:
    """AI 实时生成一道知识点题目，返回题目快照 dict"""
    from app.services.agents.chat_blocking import run_agent_chat_blocking

    if not config.agent_id:
        raise ValueError("未配置出题智能体")

    history_text = ""
    if history:
        history_text = "\n已出过的题目（请勿重复）：\n" + "\n".join(f"- {h}" for h in history[-5:])

    type_desc = {"choice": "选择题（4个选项A/B/C/D）", "fill": "填空题"}.get(question_type, "选择题（4个选项A/B/C/D）")

    prompt = f"""你是一位出题教师。请出一道{type_desc}，考察知识点「{knowledge_point}」。
{f"考察要求：{prompt_hint}" if prompt_hint else ""}
{history_text}

请只输出 JSON 格式：
{{"content": "题目内容", "options": {{"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"}}, "correct_answer": "正确选项字母", "explanation": "答案解析"}}
如果是填空题，options 设为 null，correct_answer 为正确答案文本。"""

    from app.services.agents.ai_agent import _AGENT_CACHE
    _AGENT_CACHE.pop(config.agent_id, None)

    raw = await run_agent_chat_blocking(db, agent_id=config.agent_id, message=prompt)
    return _parse_question_json(raw, knowledge_point, question_type, score)


def _parse_question_json(raw_text: str, knowledge_point: str, question_type: str, score: int) -> dict:
    """解析 AI 返回的题目 JSON"""
    import re as _re

    text = raw_text.strip()
    # 尝试从 markdown 代码块提取
    match = _re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, _re.DOTALL)
    if match:
        text = match.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end > start:
            text = text[start:end + 1]

    try:
        data = json.loads(text)
        options = data.get("options")
        if isinstance(options, dict):
            options = json.dumps(options, ensure_ascii=False)
        elif isinstance(options, list):
            options = json.dumps(dict(zip("ABCD", options)), ensure_ascii=False)
        return {
            "content": str(data.get("content", "")),
            "options": options,
            "correct_answer": str(data.get("correct_answer", "")),
            "explanation": str(data.get("explanation", "")),
            "knowledge_point": knowledge_point,
            "question_type": question_type,
            "score": score,
        }
    except (json.JSONDecodeError, ValueError):
        logger.warning(f"无法解析 AI 出题 JSON: {raw_text[:200]}")
        # 返回一个兜底题目
        return {
            "content": f"关于「{knowledge_point}」的练习题（AI生成失败，请跳过）",
            "options": json.dumps({"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"}),
            "correct_answer": "A",
            "explanation": "",
            "knowledge_point": knowledge_point,
            "question_type": question_type,
            "score": score,
        }


# ─── 学生端 ───


async def get_available_configs(db: AsyncSession, user_id: int) -> list[dict]:
    """获取学生可用的测评列表（enabled=True + 在开放时段内），附带该学生的答题状态"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    configs_result = await db.execute(
        select(AssessmentConfig)
        .where(AssessmentConfig.enabled == True)  # noqa: E712
        .order_by(AssessmentConfig.created_at.desc())
    )
    configs = list(configs_result.scalars().all())

    # 过滤时间窗口
    visible_configs = []
    for c in configs:
        if c.available_start and now < c.available_start:
            continue
        if c.available_end and now > c.available_end:
            continue
        visible_configs.append(c)

    # 批量查询该学生在这些配置下的 session
    config_ids = [c.id for c in visible_configs]
    sessions_result = await db.execute(
        select(AssessmentSession)
        .where(
            and_(
                AssessmentSession.user_id == user_id,
                AssessmentSession.config_id.in_(config_ids) if config_ids else False,
            )
        )
    ) if config_ids else None
    sessions = list(sessions_result.scalars().all()) if sessions_result else []
    # 每个 config 取最相关的 session：优先 in_progress，否则取最新的 graded；跳过 archived
    session_map: dict[int, AssessmentSession] = {}
    for s in sessions:
        if s.status == "archived":
            continue
        existing = session_map.get(s.config_id)
        if existing is None:
            session_map[s.config_id] = s
        elif s.status == "in_progress":
            session_map[s.config_id] = s
        elif existing.status != "in_progress" and (s.started_at or s.id) > (existing.started_at or existing.id):
            session_map[s.config_id] = s

    items = []
    for c in visible_configs:
        s = session_map.get(c.id)
        items.append({
            "id": c.id,
            "title": c.title,
            "total_score": c.total_score,
            "time_limit_minutes": c.time_limit_minutes,
            "available_end": c.available_end.isoformat() if c.available_end else None,
            "session_status": s.status if s else None,
            "session_id": s.id if s else None,
            "earned_score": s.earned_score if s else None,
        })
    return items


async def start_session(
    db: AsyncSession, config_id: int, user_id: int
) -> dict:
    """开始检测：校验 → 检查已有会话 → 抽题 → 创建 session + answers"""
    # 1. 校验配置
    config_result = await db.execute(
        select(AssessmentConfig).where(AssessmentConfig.id == config_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise ValueError("测评配置不存在")
    if not config.enabled:
        raise ValueError("该测评尚未开放")

    # 2. 检查已有 in_progress 会话（幂等，加锁防并发）
    existing_result = await db.execute(
        select(AssessmentSession).where(
            and_(
                AssessmentSession.config_id == config_id,
                AssessmentSession.user_id == user_id,
                AssessmentSession.status == "in_progress",
            )
        ).with_for_update(skip_locked=True)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        answer_count = await db.execute(
            select(func.count(AssessmentAnswer.id))
            .where(AssessmentAnswer.session_id == existing.id)
        )
        total_q = answer_count.scalar() or 0
        return {
            "session_id": existing.id,
            "config_title": config.title,
            "total_questions": total_q,
            "total_score": existing.total_score,
            "time_limit_minutes": config.time_limit_minutes,
            "started_at": existing.started_at,
        }

    # 3. 抽固定题 + 生成自适应题首轮
    drawn_questions = await _draw_questions(db, config)
    adaptive_questions = await _load_adaptive_questions(db, config)

    if not drawn_questions and not adaptive_questions:
        raise ValueError("题库为空，请先添加题目或知识点配置")

    actual_total = sum(q.score for q in drawn_questions) + sum(q.score for q in adaptive_questions)

    # 4. 创建 session
    now = datetime.now(timezone.utc)
    session = AssessmentSession(
        config_id=config_id,
        user_id=user_id,
        status="in_progress",
        started_at=now,
        total_score=actual_total,
    )
    db.add(session)
    await db.flush()

    # 5. 创建固定题 answer 记录
    for q in drawn_questions:
        db.add(AssessmentAnswer(
            session_id=session.id,
            question_id=q.id,
            question_type=q.question_type,
            max_score=q.score,
            knowledge_point=q.knowledge_point,
        ))

    # 6. 为每个自适应知识点生成首轮题目
    for aq in adaptive_questions:
        ac = {}
        if aq.adaptive_config:
            try: ac = json.loads(aq.adaptive_config)
            except Exception: pass
        try:
            snapshot = await _ai_generate_realtime_question(
                db, config, aq.knowledge_point or "未知",
                aq.question_type, aq.score,
                prompt_hint=ac.get("prompt_hint", ""),
            )
            db.add(AssessmentAnswer(
                session_id=session.id,
                question_id=aq.id,
                question_snapshot=json.dumps(snapshot, ensure_ascii=False),
                question_type=snapshot.get("question_type", aq.question_type),
                max_score=aq.score,
                knowledge_point=aq.knowledge_point,
                is_adaptive=True,
                attempt_seq=1,
            ))
        except Exception as e:
            logger.error(f"自适应首轮出题失败 kp={aq.knowledge_point}: {e}")
            await db.rollback()
            # 创建一个占位 answer
            db.add(AssessmentAnswer(
                session_id=session.id,
                question_id=aq.id,
                question_type=aq.question_type,
                max_score=aq.score,
                knowledge_point=aq.knowledge_point,
                is_adaptive=True,
                attempt_seq=1,
            ))

    await db.commit()
    await db.refresh(session)

    return {
        "session_id": session.id,
        "config_title": config.title,
        "total_questions": len(drawn_questions),
        "total_score": actual_total,
        "time_limit_minutes": config.time_limit_minutes,
        "started_at": session.started_at,
    }


async def _draw_questions(
    db: AsyncSession, config: AssessmentConfig
) -> list[AssessmentQuestion]:
    """从题库按题型配置随机抽取固定题（mode=fixed）"""
    question_config = {}
    if config.question_config:
        try:
            question_config = json.loads(config.question_config)
        except json.JSONDecodeError:
            pass

    drawn: list[AssessmentQuestion] = []

    for qtype, cfg in question_config.items():
        if isinstance(cfg, dict):
            count = cfg.get("count", 0)
        else:
            count = int(cfg) if cfg else 0
        if count <= 0:
            continue

        result = await db.execute(
            select(AssessmentQuestion).where(
                and_(
                    AssessmentQuestion.config_id == config.id,
                    AssessmentQuestion.question_type == qtype,
                    AssessmentQuestion.mode == "fixed",
                )
            )
        )
        pool = list(result.scalars().all())
        if not pool:
            continue

        sampled = random.sample(pool, min(count, len(pool)))
        drawn.extend(sampled)

    # 如果没有按题型配置抽到题，取全部固定题
    if not drawn:
        result = await db.execute(
            select(AssessmentQuestion)
            .where(and_(
                AssessmentQuestion.config_id == config.id,
                AssessmentQuestion.mode == "fixed",
            ))
        )
        drawn = list(result.scalars().all())

    return drawn


async def _load_adaptive_questions(
    db: AsyncSession, config: AssessmentConfig
) -> list[AssessmentQuestion]:
    """加载该配置下所有自适应知识点题（mode=adaptive）"""
    result = await db.execute(
        select(AssessmentQuestion).where(
            and_(
                AssessmentQuestion.config_id == config.id,
                AssessmentQuestion.mode == "adaptive",
            )
        )
    )
    return list(result.scalars().all())


# ─── 答题与提交 ───


async def get_session_questions(
    db: AsyncSession, session_id: int, user_id: int
) -> list[dict]:
    """获取本次检测的题目列表（不含正确答案）"""
    session = await _load_session(db, session_id, user_id)

    answers_result = await db.execute(
        select(AssessmentAnswer)
        .options(selectinload(AssessmentAnswer.question))
        .where(AssessmentAnswer.session_id == session.id)
        .order_by(AssessmentAnswer.id)
    )
    answers = list(answers_result.scalars().all())

    items = []
    for a in answers:
        q = a.question
        # 自适应题用 snapshot，固定题用 question 关联
        if a.question_snapshot:
            try:
                snap = json.loads(a.question_snapshot)
            except Exception:
                snap = {}
            items.append({
                "answer_id": a.id,
                "question_type": a.question_type,
                "content": snap.get("content", ""),
                "options": snap.get("options"),
                "score": a.max_score,
                "student_answer": a.student_answer,
                "is_answered": a.student_answer is not None,
                "is_adaptive": True,
                "knowledge_point": a.knowledge_point,
                "attempt_seq": a.attempt_seq or 1,
            })
        else:
            items.append({
                "answer_id": a.id,
                "question_type": a.question_type,
                "content": q.content if q else "",
                "options": q.options if q else None,
                "score": a.max_score,
                "student_answer": a.student_answer,
                "is_answered": a.student_answer is not None,
                "is_adaptive": False,
                "knowledge_point": a.knowledge_point or (q.knowledge_point if q else None),
                "attempt_seq": a.attempt_seq or 1,
            })
    return items


async def submit_answer(
    db: AsyncSession,
    session_id: int,
    user_id: int,
    answer_id: int,
    student_answer: str,
) -> dict:
    """提交单题答案 — 支持固定题和自适应题"""
    session = await _load_session(db, session_id, user_id)
    if session.status != "in_progress":
        raise ValueError("该检测已提交，无法继续答题")

    # 加载 answer
    answer_result = await db.execute(
        select(AssessmentAnswer)
        .options(selectinload(AssessmentAnswer.question))
        .where(
            and_(
                AssessmentAnswer.id == answer_id,
                AssessmentAnswer.session_id == session_id,
            )
        )
    )
    answer = answer_result.scalar_one_or_none()
    if not answer:
        raise ValueError("答题记录不存在")
    # 防重复提交：已答过的题不能再提交
    if answer.student_answer is not None:
        raise ValueError("该题已提交过答案，不可重复提交")

    q = answer.question
    now = datetime.now(timezone.utc)
    answer.student_answer = student_answer
    answer.answered_at = now

    # 获取正确答案（从 snapshot 或 question）
    correct_answer = ""
    explanation = ""
    if answer.question_snapshot:
        try:
            snap = json.loads(answer.question_snapshot)
            correct_answer = snap.get("correct_answer", "")
            explanation = snap.get("explanation", "")
        except Exception:
            pass
    elif q:
        correct_answer = q.correct_answer or ""
        explanation = q.explanation or ""

    result = {
        "answer_id": answer.id,
        "question_type": answer.question_type,
        "is_correct": None,
        "correct_answer": None,
        "explanation": None,
        "earned_score": None,
        "max_score": answer.max_score,
        "ai_feedback": None,
        "next_question": None,
        "mastery_status": None,
    }

    # 评分
    if answer.question_type == "choice":
        given = student_answer.strip().upper()
        correct = correct_answer.strip().upper()
        is_correct = correct == given
        answer.is_correct = is_correct
        answer.ai_score = answer.max_score if is_correct else 0
        result.update({
            "is_correct": is_correct,
            "correct_answer": correct_answer,
            "explanation": explanation,
            "earned_score": answer.ai_score,
        })
    elif answer.question_type == "fill":
        # 简单比对或 AI 评分
        config = (await db.execute(
            select(AssessmentConfig).where(AssessmentConfig.id == session.config_id)
        )).scalar_one()
        if q:
            try:
                grading = await _ai_grade_answer(db, config, q, student_answer, answer.max_score)
                answer.ai_score = grading["score"]
                answer.is_correct = grading["is_correct"]
                answer.ai_feedback = grading["feedback"]
                result.update({
                    "is_correct": grading["is_correct"],
                    "earned_score": grading["score"],
                    "ai_feedback": grading["feedback"],
                    "correct_answer": correct_answer,
                })
            except Exception as e:
                logger.error(f"AI 评分失败 answer_id={answer_id}: {e}")
                # 简单文本比对兜底
                is_correct = student_answer.strip().lower() == correct_answer.strip().lower()
                answer.is_correct = is_correct
                answer.ai_score = answer.max_score if is_correct else 0
                result.update({"is_correct": is_correct, "earned_score": answer.ai_score, "correct_answer": correct_answer})
        else:
            # snapshot 模式，简单比对
            is_correct = student_answer.strip().lower() == correct_answer.strip().lower()
            answer.is_correct = is_correct
            answer.ai_score = answer.max_score if is_correct else 0
            result.update({"is_correct": is_correct, "earned_score": answer.ai_score, "correct_answer": correct_answer, "explanation": explanation})
    else:
        # short_answer: 仅保存
        pass

    # ─── 自适应追加逻辑 ───
    if answer.is_adaptive and answer.knowledge_point:
        kp = answer.knowledge_point
        config = (await db.execute(
            select(AssessmentConfig).where(AssessmentConfig.id == session.config_id)
        )).scalar_one()

        # 加载该知识点的自适应配置
        aq_result = await db.execute(
            select(AssessmentQuestion).where(
                and_(
                    AssessmentQuestion.config_id == session.config_id,
                    AssessmentQuestion.mode == "adaptive",
                    AssessmentQuestion.knowledge_point == kp,
                )
            )
        )
        aq = aq_result.scalar_one_or_none()
        ac = {}
        if aq and aq.adaptive_config:
            try: ac = json.loads(aq.adaptive_config)
            except Exception: pass
        mastery_streak = ac.get("mastery_streak", 2)
        max_attempts = ac.get("max_attempts", 5)

        # 统计该知识点的尝试情况
        kp_answers_result = await db.execute(
            select(AssessmentAnswer).options(selectinload(AssessmentAnswer.question)).where(
                and_(
                    AssessmentAnswer.session_id == session_id,
                    AssessmentAnswer.knowledge_point == kp,
                    AssessmentAnswer.student_answer.isnot(None),
                )
            ).order_by(AssessmentAnswer.attempt_seq.asc())
        )
        kp_answers = list(kp_answers_result.scalars().all())

        # 计算连续答对次数（从最后往前数）
        consecutive_correct = 0
        for a in reversed(kp_answers):
            if a.is_correct:
                consecutive_correct += 1
            else:
                break

        total_attempts = len(kp_answers)

        if consecutive_correct >= mastery_streak:
            result["mastery_status"] = "mastered"
        elif not answer.is_correct and total_attempts < max_attempts:
            # 答错且未达上限 → AI 追加新题
            result["mastery_status"] = "practicing"
            try:
                history = []
                for a in kp_answers:
                    if a.question_snapshot:
                        try:
                            s = json.loads(a.question_snapshot)
                            history.append(s.get("content", ""))
                        except Exception:
                            pass
                    elif a.question and a.question.content:
                        history.append(a.question.content)

                snapshot = await _ai_generate_realtime_question(
                    db, config, kp, answer.question_type, answer.max_score,
                    prompt_hint=ac.get("prompt_hint", ""),
                    history=history,
                )
                new_answer = AssessmentAnswer(
                    session_id=session_id,
                    question_id=aq.id if aq else None,
                    question_snapshot=json.dumps(snapshot, ensure_ascii=False),
                    question_type=snapshot.get("question_type", answer.question_type),
                    max_score=answer.max_score,
                    knowledge_point=kp,
                    is_adaptive=True,
                    attempt_seq=total_attempts + 1,
                )
                db.add(new_answer)
                await db.flush()
                result["next_question"] = {
                    "answer_id": new_answer.id,
                    "question_type": new_answer.question_type,
                    "content": snapshot.get("content", ""),
                    "options": snapshot.get("options"),
                    "score": new_answer.max_score,
                    "is_adaptive": True,
                    "knowledge_point": kp,
                    "attempt_seq": new_answer.attempt_seq,
                }
            except Exception as e:
                logger.error(f"自适应追加出题失败 kp={kp}: {e}")
                result["mastery_status"] = "error"
        elif total_attempts >= max_attempts:
            result["mastery_status"] = "max_attempts_reached"
        else:
            result["mastery_status"] = "practicing"

    await db.commit()
    return result


async def _generate_basic_profile_bg(session_id: int, config_id: int):
    """后台生成初级画像，不阻塞主流程。"""
    try:
        from app.db.database import AsyncSessionLocal
        from app.services.assessment.basic_profile_service import generate_basic_profile

        async with AsyncSessionLocal() as db:
            session_result = await db.execute(
                select(AssessmentSession)
                .options(selectinload(AssessmentSession.answers).selectinload(AssessmentAnswer.question))
                .where(AssessmentSession.id == session_id)
            )
            session = session_result.scalar_one_or_none()
            if not session:
                logger.error(f"初级画像后台生成失败: session_id={session_id} 不存在")
                return

            config_result = await db.execute(
                select(AssessmentConfig).where(AssessmentConfig.id == config_id)
            )
            config = config_result.scalar_one_or_none()
            if not config:
                logger.error(f"初级画像后台生成失败: config_id={config_id} 不存在")
                return

            await generate_basic_profile(db, session, config)
            await db.commit()
            logger.info(f"初级画像后台生成完成: session_id={session_id}")
    except Exception as e:
        logger.error(f"初级画像后台生成失败: session_id={session_id}, error={e}")


async def _generate_advanced_profile_bg(config_id: int, user_id: int, agent_id: int):
    """后台生成三维画像，不阻塞主流程。已有画像则跳过。"""
    try:
        from app.db.database import AsyncSessionLocal
        from app.services.assessment.profile_service import generate_profile
        from app.schemas.assessment.profile import ProfileGenerateRequest
        from app.models.assessment import StudentProfile

        async with AsyncSessionLocal() as db:
            # 检查是否已有该学生+测评的三维画像，有则跳过
            existing = await db.execute(
                select(StudentProfile.id).where(
                    StudentProfile.profile_type == "individual",
                    StudentProfile.target_id == str(user_id),
                    StudentProfile.config_id == config_id,
                ).limit(1)
            )
            if existing.scalar_one_or_none() is not None:
                logger.info(f"三维画像已存在，跳过自动生成: user_id={user_id}, config_id={config_id}")
                return

            req = ProfileGenerateRequest(
                profile_type="individual",
                target_id=str(user_id),
                config_id=config_id,
                agent_id=agent_id,
            )
            await generate_profile(db, req, user_id=user_id)
            logger.info(f"三维画像自动生成完成: user_id={user_id}, config_id={config_id}")
    except Exception as e:
        logger.error(f"三维画像自动生成失败: user_id={user_id}, config_id={config_id}, error={e}")


async def submit_session(
    db: AsyncSession, session_id: int, user_id: int
) -> dict:
    """提交整卷：AI 评分简答题 → 计算总分 → 生成初级画像"""
    session = await _load_session(db, session_id, user_id, load_answers=True)
    if session.status != "in_progress":
        raise ValueError("该检测已提交")

    # 加载 config
    config_result = await db.execute(
        select(AssessmentConfig).where(AssessmentConfig.id == session.config_id)
    )
    config = config_result.scalar_one()

    # AI 评分未评分的简答题
    for answer in session.answers:
        if answer.student_answer is None:
            answer.ai_score = 0
            answer.is_correct = False
            answer.ai_feedback = "未作答"
            continue

        if answer.question_type == "short_answer" and answer.ai_score is None:
            q = answer.question
            if not q:
                q_result = await db.execute(
                    select(AssessmentQuestion)
                    .where(AssessmentQuestion.id == answer.question_id)
                )
                q = q_result.scalar_one_or_none()
            if q:
                try:
                    grading = await _ai_grade_answer(
                        db, config, q, answer.student_answer, answer.max_score
                    )
                    answer.ai_score = grading["score"]
                    answer.is_correct = grading["is_correct"]
                    answer.ai_feedback = grading["feedback"]
                except Exception as e:
                    logger.error(f"简答题 AI 评分失败 answer_id={answer.id}: {e}")
                    answer.ai_score = 0
                    answer.ai_feedback = "AI 评分失败"

        # 确保所有题目都有 ai_score
        if answer.ai_score is None:
            answer.ai_score = 0

    # 计算总分（自适应题只算首次成绩）
    deduped = _first_attempt_per_kp(session.answers)
    earned = sum(a.ai_score or 0 for a in deduped)
    total = sum(a.max_score for a in deduped)
    now = datetime.now(timezone.utc)
    session.earned_score = earned
    session.total_score = total
    session.status = "graded"
    session.submitted_at = now

    await db.flush()

    await db.commit()

    # 返回画像生成参数，由调用方决定如何触发后台任务
    bg_basic_params = {
        "session_id": session.id,
        "config_id": session.config_id,
    }
    bg_profile_params = None
    if config.agent_id:
        bg_profile_params = {
            "config_id": session.config_id,
            "user_id": session.user_id,
            "agent_id": config.agent_id,
        }

    return {
        "session_id": session.id,
        "status": session.status,
        "earned_score": earned,
        "total_score": total,
        "basic_profile_id": None,
        "summary": None,
        "_bg_basic_params": bg_basic_params,
        "_bg_profile_params": bg_profile_params,
    }


async def get_session_result(
    db: AsyncSession, session_id: int, user_id: int
) -> dict:
    """获取检测结果（含每题详情）"""
    session = await _load_session(db, session_id, user_id, load_answers=True)

    config_result = await db.execute(
        select(AssessmentConfig).where(AssessmentConfig.id == session.config_id)
    )
    config = config_result.scalar_one()

    # 查询 basic_profile
    bp_result = await db.execute(
        select(AssessmentBasicProfile)
        .where(AssessmentBasicProfile.session_id == session_id)
    )
    bp = bp_result.scalar_one_or_none()

    answers_detail = []
    for a in session.answers:
        q = a.question
        if not q and a.question_id:
            q_r = await db.execute(
                select(AssessmentQuestion).where(AssessmentQuestion.id == a.question_id)
            )
            q = q_r.scalar_one_or_none()

        answers_detail.append({
            "id": a.id,
            "question_type": a.question_type,
            "content": q.content if q else "",
            "options": q.options if q else None,
            "student_answer": a.student_answer,
            "correct_answer": q.correct_answer if q else "",
            "is_correct": a.is_correct,
            "earned_score": a.ai_score,
            "max_score": a.max_score,
            "ai_feedback": a.ai_feedback,
            "explanation": q.explanation if q else None,
        })

    return {
        "session_id": session.id,
        "config_id": config.id,
        "config_title": config.title,
        "status": session.status,
        "earned_score": session.earned_score,
        "total_score": session.total_score,
        "started_at": session.started_at,
        "submitted_at": session.submitted_at,
        "answers": answers_detail,
        "basic_profile_id": bp.id if bp else None,
    }


# ─── 管理端 ───


async def allow_retest(db: AsyncSession, session_id: int) -> dict:
    """管理员允许学生重新测试：直接删除旧 session（级联删除答题记录和初级画像），同时删除三维画像"""
    result = await db.execute(
        select(AssessmentSession).where(AssessmentSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("答题记录不存在")
    if session.status not in ("graded", "submitted"):
        raise ValueError("只能对已提交/已评分的记录允许重测")

    user_id = session.user_id
    config_id = session.config_id

    # 删除该学生在此测评下的三维画像
    await db.execute(
        delete(StudentProfile).where(
            StudentProfile.profile_type == "individual",
            StudentProfile.target_id == str(user_id),
            StudentProfile.config_id == config_id,
        )
    )
    # 删除 session（answers + basic_profile 级联删除）
    await db.delete(session)
    await db.commit()
    return {"session_id": session_id, "status": "deleted", "message": "已删除旧记录，学生可重新测试"}


async def batch_allow_retest(
    db: AsyncSession,
    config_id: int,
    session_ids: list[int] | None = None,
    class_name: str | None = None,
) -> dict:
    """批量允许重测：直接删除旧 session 及关联数据"""
    from app.models.core.user import User

    conditions = [
        AssessmentSession.config_id == config_id,
        AssessmentSession.status.in_(["graded", "submitted"]),
    ]

    if session_ids:
        conditions.append(AssessmentSession.id.in_(session_ids))
    elif class_name:
        user_q = select(User.id).where(User.class_name == class_name)
        user_result = await db.execute(user_q)
        user_ids = [r[0] for r in user_result.all()]
        if not user_ids:
            return {"deleted_count": 0, "message": "该班级没有可重测的记录"}
        conditions.append(AssessmentSession.user_id.in_(user_ids))
    else:
        raise ValueError("需要提供 session_ids 或 class_name")

    # 先查出要删除的 session，收集 user_ids 用于删除三维画像
    q = select(AssessmentSession.id, AssessmentSession.user_id).where(and_(*conditions))
    rows = (await db.execute(q)).all()
    if not rows:
        return {"deleted_count": 0, "message": "没有可重测的记录"}

    del_session_ids = [r[0] for r in rows]
    del_user_ids = list({r[1] for r in rows})

    # 删除三维画像
    await db.execute(
        delete(StudentProfile).where(
            StudentProfile.profile_type == "individual",
            StudentProfile.target_id.in_([str(uid) for uid in del_user_ids]),
            StudentProfile.config_id == config_id,
        )
    )
    # 删除 sessions（级联删除 answers + basic_profile）
    await db.execute(
        delete(AssessmentSession).where(AssessmentSession.id.in_(del_session_ids))
    )
    await db.commit()
    count = len(del_session_ids)
    return {"deleted_count": count, "message": f"已删除 {count} 条记录，学生可重新测试"}


async def get_config_sessions(
    db: AsyncSession,
    config_id: int,
    skip: int = 0,
    limit: int | None = 20,
    class_name: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[dict], int]:
    """管理端：获取某配置下的学生答题列表"""
    from app.models.core.user import User

    need_join = bool(class_name or search)
    base = select(AssessmentSession).where(AssessmentSession.config_id == config_id)
    count_base = select(func.count(AssessmentSession.id)).where(
        AssessmentSession.config_id == config_id
    )

    if need_join:
        base = base.join(User, AssessmentSession.user_id == User.id)
        count_base = count_base.join(User, AssessmentSession.user_id == User.id)

    if class_name:
        base = base.where(User.class_name == class_name)
        count_base = count_base.where(User.class_name == class_name)

    if search:
        like_pat = f"%{search}%"
        base = base.where(
            or_(User.full_name.ilike(like_pat), User.username.ilike(like_pat))
        )
        count_base = count_base.where(
            or_(User.full_name.ilike(like_pat), User.username.ilike(like_pat))
        )

    if status:
        base = base.where(AssessmentSession.status == status)
        count_base = count_base.where(AssessmentSession.status == status)

    total_result = await db.execute(count_base)
    total = total_result.scalar() or 0

    query = (
        base.options(selectinload(AssessmentSession.user))
        .order_by(AssessmentSession.created_at.desc())
    )
    if limit is not None:
        query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    sessions = list(result.scalars().all())

    items = []
    for s in sessions:
        user_name = None
        user_class = None
        if s.user:
            user_name = getattr(s.user, "full_name", None) or getattr(s.user, "username", None)
            user_class = getattr(s.user, "class_name", None)
        items.append({
            "id": s.id,
            "user_id": s.user_id,
            "user_name": user_name,
            "class_name": user_class,
            "status": s.status,
            "earned_score": s.earned_score,
            "total_score": s.total_score,
            "started_at": s.started_at,
            "submitted_at": s.submitted_at,
            "created_at": s.created_at,
        })

    return items, total


async def get_config_statistics(
    db: AsyncSession, config_id: int, class_name: str | None = None
) -> dict:
    """管理端：聚合统计"""
    from app.models.core.user import User

    config_result = await db.execute(
        select(AssessmentConfig).where(AssessmentConfig.id == config_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise ValueError("测评配置不存在")

    # 查询所有已评分的 session
    graded = select(AssessmentSession).where(
        and_(
            AssessmentSession.config_id == config_id,
            AssessmentSession.status == "graded",
        )
    )
    all_q = select(func.count(AssessmentSession.id)).where(
        AssessmentSession.config_id == config_id
    )
    if class_name:
        graded = graded.join(User, AssessmentSession.user_id == User.id).where(User.class_name == class_name)
        all_q = all_q.join(User, AssessmentSession.user_id == User.id).where(User.class_name == class_name)

    graded_result = await db.execute(graded)
    sessions = list(graded_result.scalars().all())

    total_students = len(sessions)
    all_count_result = await db.execute(all_q)
    all_count = all_count_result.scalar() or 0

    if total_students == 0:
        return {
            "config_id": config_id,
            "config_title": config.title,
            "total_students": all_count,
            "submitted_count": 0,
            "avg_score": None,
            "max_score": None,
            "min_score": None,
            "pass_rate": None,
            "knowledge_rates": None,
        }

    scores = [s.earned_score or 0 for s in sessions]
    avg_score = round(sum(scores) / len(scores), 1)
    max_score = max(scores)
    min_score = min(scores)
    pass_threshold = config.total_score * 0.6
    pass_count = sum(1 for s in scores if s >= pass_threshold)
    pass_rate = round(pass_count / total_students, 3)

    # 知识点掌握率
    session_ids = [s.id for s in sessions]
    knowledge_rates = await _calc_knowledge_rates(db, config_id, session_ids=session_ids)

    return {
        "config_id": config_id,
        "config_title": config.title,
        "total_students": all_count,
        "submitted_count": total_students,
        "avg_score": avg_score,
        "max_score": max_score,
        "min_score": min_score,
        "pass_rate": pass_rate,
        "knowledge_rates": knowledge_rates,
    }


def _first_attempt_per_kp(answers) -> list:
    """自适应计分：同一知识点只保留首次尝试（attempt_seq==1 或 is_adaptive==False），
    后续自适应题仅作练习不计入总分。无知识点的题目直接保留。"""
    sorted_answers = sorted(
        answers,
        key=lambda a: (
            getattr(a, "session_id", 0) or 0,
            getattr(a, "knowledge_point", "") or "",
            getattr(a, "attempt_seq", 1) or 1,
            getattr(a, "id", 0) or 0,
        ),
    )
    seen_kp: set[tuple[int, str]] = set()
    result = []
    for a in sorted_answers:
        kp = getattr(a, "knowledge_point", None)
        if not kp:
            result.append(a)
            continue
        # 自适应追加题（attempt_seq > 1）跳过，不计分
        if getattr(a, "is_adaptive", False) and getattr(a, "attempt_seq", 1) > 1:
            continue
        skey = (getattr(a, "session_id", 0) or 0, kp)
        if skey in seen_kp:
            continue
        seen_kp.add(skey)
        result.append(a)
    return result


async def _calc_knowledge_rates(
    db: AsyncSession, config_id: int, session_ids: list[int] | None = None
) -> dict:
    """计算各知识点平均得分率（返回百分比 0-100）"""
    if session_ids is not None:
        if not session_ids:
            return {}
        answers_result = await db.execute(
            select(AssessmentAnswer)
            .options(selectinload(AssessmentAnswer.question))
            .where(AssessmentAnswer.session_id.in_(session_ids))
        )
    else:
        session_ids_q = (
            select(AssessmentSession.id)
            .where(
                and_(
                    AssessmentSession.config_id == config_id,
                    AssessmentSession.status == "graded",
                )
            )
        )
        answers_result = await db.execute(
            select(AssessmentAnswer)
            .options(selectinload(AssessmentAnswer.question))
            .where(AssessmentAnswer.session_id.in_(session_ids_q))
        )
    answers = list(answers_result.scalars().all())

    # 自适应题只算首次成绩
    answers = _first_attempt_per_kp(answers)

    kp_data: dict[str, dict] = {}
    for a in answers:
        kp = a.question.knowledge_point if a.question else None
        if not kp:
            continue
        if kp not in kp_data:
            kp_data[kp] = {"earned": 0, "total": 0}
        kp_data[kp]["earned"] += a.ai_score or 0
        kp_data[kp]["total"] += a.max_score

    rates = {}
    for kp, d in kp_data.items():
        if d["total"] > 0:
            rates[kp] = round(d["earned"] / d["total"] * 100, 1)
    return rates


# ─── 内部工具函数 ───


async def _load_session(
    db: AsyncSession,
    session_id: int,
    user_id: int,
    load_answers: bool = False,
) -> AssessmentSession:
    """加载 session 并校验归属"""
    query = select(AssessmentSession).where(AssessmentSession.id == session_id)
    if load_answers:
        query = query.options(
            selectinload(AssessmentSession.answers)
            .selectinload(AssessmentAnswer.question)
        )
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("检测会话不存在")
    if session.user_id != user_id:
        raise ValueError("无权访问此检测会话")
    return session


async def _ai_grade_answer(
    db: AsyncSession,
    config: AssessmentConfig,
    question: AssessmentQuestion,
    student_answer: str,
    max_score: int,
) -> dict:
    """调用 AI 评分单道填空/简答题"""
    from app.services.agents.chat_blocking import run_agent_chat_blocking

    prompt = f"""你是一位严谨的阅卷教师。

【题目】
{question.content}

【参考答案】
{question.correct_answer}

【学生答案】
{student_answer}

【满分】{max_score} 分

请评分并给出反馈，只输出 JSON 格式：
{{"score": 得分（0 到 {max_score} 之间的整数）, "is_correct": 是否完全正确（boolean）, "feedback": "评语（50字以内，指出对错和改进方向）"}}"""

    if not config.agent_id:
        return {"score": 0, "is_correct": False, "feedback": "未配置评分智能体"}

    raw = await run_agent_chat_blocking(
        db, agent_id=config.agent_id, message=prompt
    )
    return _parse_grading_json(raw, max_score)


def _parse_grading_json(raw_text: str, max_score: int) -> dict:
    """解析 AI 评分返回的 JSON"""
    import re

    text = raw_text.strip()

    # 尝试提取 JSON 对象
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    try:
        data = json.loads(text)
        score = int(data.get("score", 0))
        score = max(0, min(score, max_score))
        return {
            "score": score,
            "is_correct": bool(data.get("is_correct", False)),
            "feedback": str(data.get("feedback", "")),
        }
    except (json.JSONDecodeError, ValueError, TypeError):
        pass

    # 尝试从 markdown 代码块提取
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            score = max(0, min(int(data.get("score", 0)), max_score))
            return {
                "score": score,
                "is_correct": bool(data.get("is_correct", False)),
                "feedback": str(data.get("feedback", "")),
            }
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    logger.warning(f"无法解析 AI 评分 JSON: {raw_text[:200]}")
    return {"score": 0, "is_correct": False, "feedback": "AI 评分解析失败"}
