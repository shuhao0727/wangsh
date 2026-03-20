"""
三维融合画像服务 - 聚合测评+讨论+AI对话数据，调用AI生成画像
"""

import json
import re
from typing import Optional, List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from loguru import logger

from app.models.assessment import (
    AssessmentConfig,
    AssessmentSession,
    AssessmentAnswer,
    AssessmentBasicProfile,
)
from app.models.assessment.profile import StudentProfile
from app.models.agents.group_discussion import (
    GroupDiscussionSession,
    GroupDiscussionMessage,
    GroupDiscussionMember,
)
from app.models import User
from app.schemas.assessment.profile import ProfileGenerateRequest, ProfileBatchGenerateRequest


# ─── 数据聚合 ───


async def _collect_assessment_data(
    db: AsyncSession, user_id: int, config_id: Optional[int]
) -> str:
    """收集学生的测评数据，返回文本摘要"""
    if not config_id:
        return "无测评数据"

    result = await db.execute(
        select(AssessmentSession)
        .where(and_(
            AssessmentSession.user_id == user_id,
            AssessmentSession.config_id == config_id,
            AssessmentSession.status == "graded",
        ))
        .order_by(AssessmentSession.submitted_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if not session:
        return "该学生未参加此测评"

    # 加载初级画像
    bp_result = await db.execute(
        select(AssessmentBasicProfile)
        .where(AssessmentBasicProfile.session_id == session.id)
    )
    bp = bp_result.scalar_one_or_none()

    # 加载配置标题
    cfg_result = await db.execute(
        select(AssessmentConfig.title)
        .where(AssessmentConfig.id == config_id)
    )
    cfg_row = cfg_result.one_or_none()

    lines = [
        f"- 测评：{cfg_row.title if cfg_row else '未知'}",
        f"- 得分：{session.earned_score}/{session.total_score}",
    ]

    if bp:
        kp_scores = json.loads(bp.knowledge_scores) if bp.knowledge_scores else {}
        wrong = json.loads(bp.wrong_points) if bp.wrong_points else []
        kp_lines = [f"  - {k}: {v['earned']}/{v['total']}分" for k, v in kp_scores.items()]
        lines.append("- 各知识点得分：\n" + "\n".join(kp_lines) if kp_lines else "- 各知识点得分：无")
        lines.append(f"- 错题知识点：{'、'.join(wrong) if wrong else '无'}")

    duration = ""
    if session.started_at and session.submitted_at:
        mins = int((session.submitted_at - session.started_at).total_seconds() / 60)
        duration = f"{mins}分钟"
    lines.append(f"- 答题用时：{duration or '未知'}")

    return "\n".join(lines)


async def _collect_discussion_data(
    db: AsyncSession, user_id: int, discussion_session_id: Optional[int]
) -> str:
    """收集学生在小组讨论中的发言数据"""
    if not discussion_session_id:
        return "无讨论数据"

    # 查讨论会话信息
    sess_result = await db.execute(
        select(GroupDiscussionSession)
        .where(GroupDiscussionSession.id == discussion_session_id)
    )
    disc_session = sess_result.scalar_one_or_none()
    if not disc_session:
        return "讨论会话不存在"

    # 查该学生的发言
    msg_result = await db.execute(
        select(GroupDiscussionMessage)
        .where(and_(
            GroupDiscussionMessage.session_id == discussion_session_id,
            GroupDiscussionMessage.user_id == user_id,
        ))
        .order_by(GroupDiscussionMessage.created_at.asc())
        .limit(30)
    )
    messages = list(msg_result.scalars().all())

    topic = disc_session.group_name or "未命名讨论"
    lines = [
        f"- 讨论主题：{topic}",
        f"- 发言 {len(messages)} 条",
        "- 讨论内容摘要：",
    ]
    for m in messages:
        content = (m.content or "")[:100]
        lines.append(f"  {m.user_display_name}: {content}")

    return "\n".join(lines)


async def _collect_agent_data(
    db: AsyncSession, user_id: int, agent_ids: Optional[List[int]]
) -> str:
    """收集学生与AI智能体的对话数据"""
    if not agent_ids:
        return "无AI对话数据"

    from app.services.agents.agent_conversations import (
        list_user_conversations,
        get_conversation_messages,
    )

    all_lines = []
    agent_names = []

    for aid in agent_ids:
        try:
            sessions = await list_user_conversations(db, user_id=user_id, agent_id=aid, limit=3)
        except Exception:
            continue

        if not sessions:
            continue

        agent_name = sessions[0].get("display_agent_name", f"智能体{aid}")
        agent_names.append(agent_name)
        total_turns = sum(s.get("turns", 0) for s in sessions)

        for s in sessions[:2]:
            sid = s.get("session_id")
            if not sid:
                continue
            try:
                msgs = await get_conversation_messages(db, user_id=user_id, session_id=sid)
            except Exception:
                continue
            for msg in msgs[-20:]:
                role = "学生" if msg.get("message_type") == "question" else "AI"
                content = (msg.get("content") or "")[:80]
                all_lines.append(f"  {role}: {content}")

    if not agent_names:
        return "无AI对话数据"

    header = [
        f"- 使用的智能体：{'、'.join(agent_names)}",
        f"- 提问 {sum(1 for l in all_lines if l.strip().startswith('学生:'))} 条",
        "- 对话内容摘要：",
    ]
    return "\n".join(header + all_lines[:40])


async def _collect_group_data(
    db: AsyncSession, discussion_session_id: int, config_id: Optional[int]
) -> dict:
    """收集小组画像所需的聚合数据"""
    # 查讨论会话和成员
    sess_result = await db.execute(
        select(GroupDiscussionSession)
        .where(GroupDiscussionSession.id == discussion_session_id)
    )
    disc_session = sess_result.scalar_one_or_none()
    if not disc_session:
        return {"topic": "未知", "members": [], "assessment": "无", "discussion": "无", "agent": "无"}

    members_result = await db.execute(
        select(GroupDiscussionMember)
        .where(GroupDiscussionMember.session_id == discussion_session_id)
    )
    members = list(members_result.scalars().all())
    member_user_ids = [m.user_id for m in members]

    # 成员姓名
    names_result = await db.execute(
        select(User.id, User.full_name).where(User.id.in_(member_user_ids))
    )
    name_map = {r.id: r.full_name for r in names_result.all()}
    member_names = [name_map.get(uid, f"用户{uid}") for uid in member_user_ids]

    # 成员测评数据
    assessment_lines = []
    if config_id:
        for uid in member_user_ids:
            data = await _collect_assessment_data(db, uid, config_id)
            assessment_lines.append(f"【{name_map.get(uid, str(uid))}】\n{data}")

    # 讨论消息统计
    msg_result = await db.execute(
        select(GroupDiscussionMessage)
        .where(GroupDiscussionMessage.session_id == discussion_session_id)
        .order_by(GroupDiscussionMessage.created_at.asc())
        .limit(50)
    )
    all_msgs = list(msg_result.scalars().all())

    msg_counts = {}
    for m in all_msgs:
        name = m.user_display_name or str(m.user_id)
        msg_counts[name] = msg_counts.get(name, 0) + 1

    disc_lines = [f"  {m.user_display_name}: {(m.content or '')[:80]}" for m in all_msgs[:30]]

    return {
        "topic": disc_session.group_name or "未命名讨论",
        "members": member_names,
        "member_user_ids": member_user_ids,
        "assessment": "\n".join(assessment_lines) if assessment_lines else "无测评数据",
        "total_messages": len(all_msgs),
        "msg_counts": msg_counts,
        "discussion_summary": "\n".join(disc_lines),
    }


async def _collect_class_data(
    db: AsyncSession, class_name: str, config_id: Optional[int]
) -> str:
    """收集班级群体画像所需的统计数据"""
    # 查该班级学生
    students_result = await db.execute(
        select(User.id, User.full_name)
        .where(and_(User.class_name == class_name, User.role_code == "student", User.is_deleted.is_(False)))
    )
    students = students_result.all()
    if not students:
        return f"班级 {class_name} 无学生数据"

    student_count = len(students)
    lines = [f"【班级】{class_name}（共 {student_count} 人）"]

    if config_id:
        # 测评统计
        cfg_result = await db.execute(
            select(AssessmentConfig.title, AssessmentConfig.total_score)
            .where(AssessmentConfig.id == config_id)
        )
        cfg = cfg_result.one_or_none()

        sess_result = await db.execute(
            select(AssessmentSession)
            .where(and_(
                AssessmentSession.config_id == config_id,
                AssessmentSession.status == "graded",
            ))
        )
        sessions = list(sess_result.scalars().all())

        if sessions and cfg:
            scores = [s.earned_score or 0 for s in sessions]
            avg = sum(scores) / len(scores) if scores else 0
            pass_count = sum(1 for s in scores if s >= cfg.total_score * 0.6)
            lines.append(f"【测评】{cfg.title}")
            lines.append(f"- 平均分：{avg:.1f}/{cfg.total_score}")
            lines.append(f"- 最高分：{max(scores)}，最低分：{min(scores)}")
            lines.append(f"- 通过率（≥60%）：{pass_count}/{len(scores)} ({pass_count*100//len(scores)}%)")

    return "\n".join(lines)


# ─── 结果解析 ───


def _parse_result(raw: str) -> tuple:
    """从 AI 输出中分离 Markdown 文本和 JSON 评分"""
    match = re.search(r'```json\s*(\{.*?\})\s*```', raw, re.DOTALL)
    if match:
        try:
            scores = json.loads(match.group(1))
            text = raw[:match.start()].strip()
            return text, scores
        except json.JSONDecodeError:
            pass
    return raw.strip(), {}


# ─── Prompt 构建 ───


def _build_individual_prompt(
    name: str, assessment_data: str, discussion_data: str, agent_data: str
) -> str:
    return f"""你是一位专业的教学分析助手。请根据以下三方面数据，生成学生「{name}」的多维学习画像。

先用一句话给出总体结论，再分章节简要分析。

【一、课堂自主检测数据】
{assessment_data}

【二、小组讨论数据】
{discussion_data}

【三、AI 智能体对话数据】
{agent_data}

请输出 Markdown 格式的学习画像，包含以下章节：

## 一、知识掌握（基于测评）
分析各知识点的掌握程度，指出强项和弱项。

## 二、协作能力（基于讨论）
分析在小组讨论中的参与度、贡献质量、互动模式。

## 三、自主学习（基于 AI 对话）
分析使用 AI 智能体的方式：提问质量、学习主动性、是否有深度追问。

## 四、思维特征
综合三方数据，分析该学生的思维模式（记忆型/理解型/应用型/创造型）。

## 五、知识盲点（三方数据交叉验证）
找出在测评中失分、讨论中未涉及、AI 对话中反复提问的知识点。

## 六、个性化学习建议（3 条）
针对性的、可操作的学习建议。

每个章节 30-50 字，总计不超过 300 字。

最后，请另起一行输出一个 JSON 块（用 ```json 包裹），对该学生进行多维度评分（0-100分）：
```json
{{"dimensions": {{"知识掌握": 85, "协作能力": 70, "自主学习": 60, "思维特征": 75, "知识盲点修复": 50}}}}
```"""


def _build_group_prompt(group_data: dict) -> str:
    return f"""你是一位专业的教学分析助手。请根据以下数据，生成小组学习画像。

【小组信息】
- 讨论主题：{group_data['topic']}
- 成员：{'、'.join(group_data['members'])}（共 {len(group_data['members'])} 人）

【一、小组成员测评数据】
{group_data['assessment']}

【二、小组讨论数据】
- 总发言 {group_data['total_messages']} 条
- 各成员发言数：{json.dumps(group_data['msg_counts'], ensure_ascii=False)}
- 讨论内容摘要：
{group_data['discussion_summary']}

请输出 Markdown 格式的小组画像：

## 一、整体水平
小组平均分、最高/最低分、整体知识掌握情况。

## 二、成员互补性
分析成员间的知识互补关系。

## 三、协作模式
讨论中的互动模式：是否有主导者、是否均衡参与。

## 四、薄弱环节
小组共同的知识盲点。

## 五、小组提升建议（3 条）

每个章节 50-80 字，总计不超过 500 字。

最后，请另起一行输出一个 JSON 块（用 ```json 包裹），对该小组进行多维度评分（0-100分）：
```json
{{"dimensions": {{"整体水平": 70, "成员互补性": 65, "协作模式": 60, "知识覆盖": 75, "讨论质量": 55}}}}
```"""


def _build_class_prompt(class_data: str) -> str:
    return f"""你是一位专业的教学分析助手。请根据以下全班数据，生成群体学习画像。

{class_data}

请输出 Markdown 格式的群体画像：

## 一、知识点掌握分布
哪些知识点全班掌握较好，哪些普遍薄弱。

## 二、共性问题
测评失分集中的知识点。

## 三、学习模式分析
全班的学习模式特征。

## 四、分层教学建议
- 优秀层（≥85分）：拓展建议
- 中等层（60-84分）：巩固建议
- 待提升层（<60分）：补救建议

## 五、教学调整建议（3 条）
针对教师的教学策略调整建议。

每个章节 60-100 字，总计不超过 600 字。

最后，请另起一行输出一个 JSON 块（用 ```json 包裹），对该班级进行多维度评分（0-100分）：
```json
{{"dimensions": {{"知识掌握": 70, "共性问题": 55, "学习模式": 60, "分层教学": 65, "教学效果": 58}}}}
```"""


# ─── 核心生成 + CRUD ───

async def generate_profile(
    db: AsyncSession,
    request: ProfileGenerateRequest,
    user_id: int,
) -> StudentProfile:
    """生成三维融合画像（个人/小组/群体）"""
    from app.services.agents.chat_blocking import run_agent_chat_blocking

    data_sources = []

    if request.profile_type == "individual":
        # 查学生姓名
        name_result = await db.execute(
            select(User.full_name).where(User.id == int(request.target_id))
        )
        name = name_result.scalar_one_or_none() or "同学"

        assessment = await _collect_assessment_data(db, int(request.target_id), request.config_id)
        discussion = await _collect_discussion_data(db, int(request.target_id), request.discussion_session_id)
        agent = await _collect_agent_data(db, int(request.target_id), request.agent_ids)

        if request.config_id:
            data_sources.append("assessment")
        if request.discussion_session_id:
            data_sources.append("discussion")
        if request.agent_ids:
            data_sources.append("agent_chat")

        prompt = _build_individual_prompt(name, assessment, discussion, agent)

    elif request.profile_type == "group":
        if not request.discussion_session_id:
            raise ValueError("小组画像需要指定讨论会话")
        group_data = await _collect_group_data(db, request.discussion_session_id, request.config_id)
        data_sources = ["discussion"]
        if request.config_id:
            data_sources.append("assessment")
        prompt = _build_group_prompt(group_data)

    elif request.profile_type == "class":
        class_data = await _collect_class_data(db, request.target_id, request.config_id)
        data_sources = ["assessment"]
        prompt = _build_class_prompt(class_data)

    else:
        raise ValueError(f"不支持的画像类型: {request.profile_type}")

    # 调用 AI 生成
    try:
        # 清除智能体缓存，避免跨事务使用已过期的对象
        from app.services.agents.ai_agent import _AGENT_CACHE
        _AGENT_CACHE.pop(request.agent_id, None)
        result_text = await run_agent_chat_blocking(
            db, agent_id=request.agent_id, message=prompt
        )
    except Exception as e:
        logger.error(f"三维画像 AI 生成失败: {e}")
        await db.rollback()
        result_text = "AI 画像生成失败，请稍后重试。"

    # 解析 AI 输出：分离 Markdown 文本和 JSON 评分
    result_text, scores = _parse_result(result_text)

    profile = StudentProfile(
        profile_type=request.profile_type,
        target_id=request.target_id,
        config_id=request.config_id,
        discussion_session_id=request.discussion_session_id,
        agent_ids=json.dumps(request.agent_ids or [], ensure_ascii=False),
        agent_id=request.agent_id,
        data_sources=json.dumps(data_sources, ensure_ascii=False),
        result_text=result_text,
        scores=json.dumps(scores, ensure_ascii=False),
        created_by_user_id=user_id,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def batch_generate_profiles(
    db: AsyncSession,
    request: ProfileBatchGenerateRequest,
    user_id: int,
) -> List[int]:
    """批量生成个人画像，返回生成的画像 ID 列表"""
    profile_ids = []
    for uid in request.user_ids:
        try:
            req = ProfileGenerateRequest(
                profile_type="individual",
                target_id=str(uid),
                config_id=request.config_id,
                discussion_session_id=request.discussion_session_id,
                agent_ids=request.agent_ids,
                agent_id=request.agent_id,
            )
            profile = await generate_profile(db, req, user_id)
            profile_ids.append(profile.id)
        except Exception as e:
            logger.error(f"批量生成画像失败 user_id={uid}: {e}")
    return profile_ids


async def get_profiles(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    profile_type: Optional[str] = None,
    target_id: Optional[str] = None,
) -> Tuple[List[StudentProfile], int]:
    """分页查询画像列表"""
    query = select(StudentProfile).options(
        selectinload(StudentProfile.config),
        selectinload(StudentProfile.creator),
    )
    count_query = select(func.count(StudentProfile.id))

    if profile_type:
        query = query.where(StudentProfile.profile_type == profile_type)
        count_query = count_query.where(StudentProfile.profile_type == profile_type)
    if target_id:
        query = query.where(StudentProfile.target_id == target_id)
        count_query = count_query.where(StudentProfile.target_id == target_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(StudentProfile.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_profile(db: AsyncSession, profile_id: int) -> Optional[StudentProfile]:
    """获取单个画像详情"""
    result = await db.execute(
        select(StudentProfile)
        .options(
            selectinload(StudentProfile.config),
            selectinload(StudentProfile.creator),
        )
        .where(StudentProfile.id == profile_id)
    )
    return result.scalar_one_or_none()


async def delete_profile(db: AsyncSession, profile_id: int) -> bool:
    """删除画像"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return False
    await db.delete(profile)
    await db.commit()
    return True


async def get_my_profiles(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[StudentProfile], int]:
    """学生查看自己的画像"""
    target = str(user_id)
    query = select(StudentProfile).options(
        selectinload(StudentProfile.config),
    ).where(and_(
        StudentProfile.target_id == target,
        StudentProfile.profile_type == "individual",
    ))
    count_query = select(func.count(StudentProfile.id)).where(and_(
        StudentProfile.target_id == target,
        StudentProfile.profile_type == "individual",
    ))

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(StudentProfile.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total
