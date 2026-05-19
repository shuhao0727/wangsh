"""
智能体分析服务
提供热门问题分析和学生对话链分析功能
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, AsyncGenerator

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.core import User

logger = logging.getLogger(__name__)

# 中文停用词表（精简版）
_STOP_WORDS = set(
    "的 了 是 吗 呢 吧 啊 呀 么 有 在 也 不 都 就 和 与 或 但 而 还 又 很 太 更 最 要 会 能 可以 应该 "
    "必须 需要 让 把 被 对 从 到 向 以 用 为 因为 所以 虽然 如果 但是 然而 因此 这个 那个 这些 那些 "
    "什么 怎么 怎样 为什么 哪 哪里 谁 多少 几 第一 第二 一个 一种 这个 那个 方面 "
    "请 请问 帮我 一下 一下吗 能否 可以吗 如何 怎么样".split()
)


def _segment_keywords(text: str, top_n: int = 50) -> List[Dict[str, Any]]:
    """使用 jieba 分词提取关键词"""
    try:
        import jieba
    except ImportError:
        return []

    words = jieba.lcut(text)
    freq: Dict[str, int] = {}
    for w in words:
        w = w.strip()
        if len(w) < 2 or w in _STOP_WORDS:
            continue
        freq[w] = freq.get(w, 0) + 1

    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [{"word": w, "count": c} for w, c in sorted_words[:top_n]]


async def _call_llm_analysis(
    agent_type: str, api_endpoint: str, api_key: str, task_sheet: str, questions_text: str, agent_model: str = ""
) -> Dict[str, Any]:
    """调用 LLM 做任务单对比分析（支持 Dify / OpenAI 兼容 / DeepSeek 等）"""
    if not api_key or not questions_text.strip():
        return {}
    try:
        prompt = (
            "你是一位教学分析专家。教师给学生布置了任务单，学生与 AI 进行了对话。"
            "你的任务是发现任务单设计中的盲区——学生自发提出的、任务单没有预料到的问题方向。\n\n"
            "【教师任务单】\n" + task_sheet + "\n\n"
            "【学生在课堂中向 AI 提出的问题（括号内为出现次数）】\n" + questions_text + "\n\n"
            "分析步骤：\n"
            "1. 提取任务单覆盖的核心知识点（精确匹配，不泛化）\n"
            "2. 将学生提问按主题聚类\n"
            "3. 判断每个主题是否直接对应任务单的知识点\n"
            "4. 用 Bloom 认知分类法标注每个问题的认知层级\n\n"
            "Bloom 认知层级说明：\n"
            "- 记忆：回忆事实、术语、基本概念（如\"for循环语法是什么\"）\n"
            "- 理解：解释、归纳、举例（如\"为什么用for而不是while\"）\n"
            "- 应用：使用知识解决新问题（如\"帮我用for循环写一个计算器\"）\n"
            "- 分析：拆解、对比、区别（如\"for和while性能哪个好\"）\n"
            "- 评价：判断、评估方案（如\"递归和循环哪个更好\"）\n"
            "- 创造：设计、构建新东西（如\"能嵌套列表推导式生成二维数组吗\"）\n\n"
            "⚠️ 归类标准（严格）：\n"
            "→「covered」仅当该主题与任务单某个知识点的措辞/意图**高度一致**时使用\n"
            "→「uncovered」用于以下情况：\n"
            "  a) 任务单完全没提到的全新主题\n"
            "  b) 任务单只提了基础用法，但学生追问了进阶/变体/替代方案\n"
            "  c) 学生的问题引入了任务单没有的概念、函数或技术\n\n"
            "例如：如果任务单是\"写 for 循环\"，学生问\"列表推导式怎么做\"→ uncovered\n"
            "例如：如果任务单是\"定义函数\"，学生问\"递归和循环哪个更好\"→ uncovered\n"
            "⚠️ 注意：错误调试（NameError、怎么调试代码）这类问题属于「学生遇到了任务单没预料的困难」→ 必须归入 uncovered\n\n"
            "只输出 JSON：\n"
            '{"covered":[{"topic":"主题","questions":["典型问题"],"count":次数}],'
            '"uncovered":[{"topic":"主题","questions":["代表问题1","代表问题2"],"count":次数}],'
            '"bloom":{"记忆":0,"理解":0,"应用":0,"分析":0,"评价":0,"创造":0}}'
            "\n其中 count 为该主题下所有问题的总出现次数，bloom 为各认知层级的提问总数"
        )

        if agent_type == "dify":
            # Dify blocking mode
            base = api_endpoint.rstrip("/")
            url = f"{base}/v1/chat-messages" if "/v1" not in base else f"{base}/chat-messages"
            payload = {"query": prompt, "user": "task_analysis", "response_mode": "blocking", "inputs": {}}
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    body = resp.json()
                    answer = body.get("answer", "")
                else:
                    logger.error(f"Dify LLM failed: {resp.status_code}")
                    return {}
        else:
            # OpenAI-compatible (DeepSeek, OpenAI, etc.)
            base = api_endpoint.rstrip("/")
            if "/v1" in base:
                url = f"{base}/chat/completions"
            else:
                url = f"{base}/v1/chat/completions"
            payload = {"model": agent_model or "deepseek-chat", "messages": [{"role": "user", "content": prompt}], "stream": False}
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    body = resp.json()
                    answer = body.get("choices", [{}])[0].get("message", {}).get("content", "")
                else:
                    logger.error(f"LLM failed: {resp.status_code} {resp.text[:200]}")
                    return {}

        json_start = answer.find("{")
        json_end = answer.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(answer[json_start:json_end])
        return {"covered": [], "uncovered": [], "raw": answer}
    except Exception as e:
        logger.error(f"LLM analysis error: {e}", exc_info=True)
        return {}


async def stream_task_sheet_analysis(
    db: AsyncSession,
    *,
    agent_id: int,
    task_sheet: str,
    start_at: datetime,
    end_at: datetime,
    class_name: Optional[str] = None,
    api_endpoint: str = "",
    api_key: str = "",
    agent_type: str = "",
    agent_model: str = "",
) -> AsyncGenerator[Dict[str, Any], None]:
    now = datetime.now(timezone.utc)
    effective_end = end_at or now
    effective_start = start_at or (effective_end - timedelta(hours=1))

    yield {"event": "analysis_started", "message": "开始任务分析", "progress": 0}
    yield {"event": "step_started", "step_id": "questions", "message": "正在提取学生提问数据", "progress": 8}

    question_sql = text(
        """
        SELECT c.content, u.full_name, u.student_id, c.created_at
        FROM v_conversations_with_deleted c
        JOIN sys_users u ON u.id = c.user_id
        WHERE c.agent_id = :agent_id
          AND c.message_type = 'question'
          AND c.created_at >= :start_at
          AND c.created_at < :end_at
          AND c.content IS NOT NULL
          AND trim(c.content) != ''
          AND (CAST(:class_name AS TEXT) IS NULL OR u.class_name = CAST(:class_name AS TEXT))
        ORDER BY c.created_at ASC
        """
    )
    rows = (await db.execute(
        question_sql,
        {
            "agent_id": agent_id,
            "start_at": effective_start,
            "end_at": effective_end,
            "class_name": class_name,
        },
    )).mappings().all()
    all_questions_raw = [r.get("content", "") for r in rows]
    yield {
        "event": "partial_result",
        "step_id": "questions",
        "message": f"已提取 {len(all_questions_raw)} 条学生提问",
        "progress": 25,
        "result": {"question_count": len(all_questions_raw)},
    }
    yield {"event": "step_finished", "step_id": "questions", "message": "学生提问提取完成", "progress": 30}

    if not all_questions_raw:
        result = {"word_cloud": [], "covered": [], "uncovered": [], "bloom": {}}
        yield {
            "event": "analysis_finished",
            "message": "没有找到符合条件的学生提问",
            "progress": 100,
            "result": result,
        }
        return

    yield {"event": "step_started", "step_id": "word_cloud", "message": "正在生成词云", "progress": 35}
    combined = "\n".join(all_questions_raw)
    word_cloud = _segment_keywords(combined)
    yield {
        "event": "partial_result",
        "step_id": "word_cloud",
        "message": f"已生成 {len(word_cloud)} 个关键词",
        "progress": 50,
        "result": {"word_cloud": word_cloud[:20]},
    }
    yield {"event": "step_finished", "step_id": "word_cloud", "message": "词云生成完成", "progress": 55}

    yield {"event": "step_started", "step_id": "llm", "message": "AI 正在对比分析任务单", "progress": 62}
    freq: Dict[str, int] = {}
    for q in all_questions_raw:
        q = q.strip()
        if not q:
            continue
        normalized = q.lower().rstrip("？?。.")
        freq[normalized] = freq.get(normalized, 0) + 1

    sorted_qs = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:300]
    questions_text = "\n".join(f"{q}（{c}次）" for q, c in sorted_qs)
    comparison = await _call_llm_analysis(
        agent_type, api_endpoint, api_key, task_sheet, questions_text, agent_model
    )
    yield {
        "event": "partial_result",
        "step_id": "llm",
        "message": "AI 对比分析完成",
        "progress": 85,
        "result": {
            "covered": comparison.get("covered", []),
            "uncovered": comparison.get("uncovered", []),
        },
    }
    yield {"event": "step_finished", "step_id": "llm", "message": "任务单对比完成", "progress": 90}

    result = {
        "word_cloud": word_cloud,
        "covered": comparison.get("covered", []),
        "uncovered": comparison.get("uncovered", []),
    }
    yield {
        "event": "analysis_finished",
        "message": "任务分析完成",
        "progress": 100,
        "result": result,
    }


async def analyze_task_sheet(
    db: AsyncSession,
    *,
    agent_id: int,
    task_sheet: str,
    start_at: datetime,
    end_at: datetime,
    class_name: Optional[str] = None,
    api_endpoint: str = "",
    api_key: str = "",
    agent_type: str = "",
    agent_model: str = "",
) -> Dict[str, Any]:
    """分析任务单：提取关键词 + 对比学生提问"""
    now = datetime.now(timezone.utc)
    effective_end = end_at or now
    effective_start = start_at or (effective_end - timedelta(hours=1))

    # Query all questions in range
    question_sql = text(
        """
        SELECT c.content, u.full_name, u.student_id, c.created_at
        FROM v_conversations_with_deleted c
        JOIN sys_users u ON u.id = c.user_id
        WHERE c.agent_id = :agent_id
          AND c.message_type = 'question'
          AND c.created_at >= :start_at
          AND c.created_at < :end_at
          AND c.content IS NOT NULL
          AND trim(c.content) != ''
          AND (CAST(:class_name AS TEXT) IS NULL OR u.class_name = CAST(:class_name AS TEXT))
        ORDER BY c.created_at ASC
        """
    )
    rows = (await db.execute(
        question_sql,
        {
            "agent_id": agent_id,
            "start_at": effective_start,
            "end_at": effective_end,
            "class_name": class_name,
        },
    )).mappings().all()

    all_questions_raw = [r.get("content", "") for r in rows]

    if not all_questions_raw:
        return {"word_cloud": [], "covered": [], "uncovered": []}

    # 1. jieba word cloud
    combined = "\n".join(all_questions_raw)
    word_cloud = _segment_keywords(combined)

    # 2. Deduplicate + frequency sort for LLM input
    freq: Dict[str, int] = {}
    for q in all_questions_raw:
        q = q.strip()
        if not q:
            continue
        # Normalize: lowercase, trim
        normalized = q.lower().rstrip("？?。.")
        freq[normalized] = freq.get(normalized, 0) + 1

    # Sort by frequency, format with count
    sorted_qs = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:300]
    questions_text = "\n".join(f"{q}（{c}次）" for q, c in sorted_qs)

    # 3. LLM comparison
    comparison = await _call_llm_analysis(
        agent_type, api_endpoint, api_key, task_sheet, questions_text, agent_model
    )

    return {
        "word_cloud": word_cloud,
        "covered": comparison.get("covered", []),
        "uncovered": comparison.get("uncovered", []),
        "bloom": comparison.get("bloom", {}),
    }


async def analyze_hot_questions(
    db: AsyncSession,
    *,
    agent_id: int,
    start_at: datetime,
    end_at: datetime,
    bucket_seconds: int = 60,
    top_n: int = 10,
) -> List[Dict[str, Any]]:
    if bucket_seconds <= 0:
        bucket_seconds = 60
    if top_n <= 0:
        top_n = 10
    if top_n > 50:
        top_n = 50

    bucket_sql = text(
        """
        WITH q AS (
            SELECT
                user_id,
                content,
                created_at,
                to_timestamp(floor(extract(epoch from created_at) / :bucket_seconds) * :bucket_seconds) AS bucket_start
            FROM v_conversations_with_deleted
            WHERE agent_id = :agent_id
              AND message_type = 'question'
              AND created_at >= :start_at
              AND created_at < :end_at
        ),
        bucket_stats AS (
            SELECT
                bucket_start,
                count(*) AS question_count,
                count(distinct user_id) AS unique_students
            FROM q
            GROUP BY bucket_start
        ),
        question_rank AS (
            SELECT
                bucket_start,
                content AS question,
                count(*) AS cnt,
                row_number() OVER (PARTITION BY bucket_start ORDER BY count(*) DESC, max(created_at) DESC) AS rn
            FROM q
            GROUP BY bucket_start, content
        )
        SELECT
            bs.bucket_start,
            bs.question_count,
            bs.unique_students,
            qr.question,
            qr.cnt,
            qr.rn
        FROM bucket_stats bs
        LEFT JOIN question_rank qr
          ON bs.bucket_start = qr.bucket_start
         AND qr.rn <= :top_n
        ORDER BY bs.bucket_start ASC, qr.rn ASC
        """
    )
    result = await db.execute(
        bucket_sql,
        {
            "agent_id": agent_id,
            "start_at": start_at,
            "end_at": end_at,
            "bucket_seconds": bucket_seconds,
            "top_n": top_n,
        },
    )
    rows = result.mappings().all()

    buckets: Dict[Any, Dict[str, Any]] = {}
    for r in rows:
        bucket_start = r.get("bucket_start")
        if bucket_start not in buckets:
            buckets[bucket_start] = {
                "bucket_start": bucket_start,
                "question_count": int(r.get("question_count") or 0),
                "unique_students": int(r.get("unique_students") or 0),
                "top_questions": [],
            }
        question = r.get("question")
        cnt = r.get("cnt")
        rn = r.get("rn")
        if question and cnt is not None and rn is not None:
            buckets[bucket_start]["top_questions"].append(
                {"question": question, "count": int(cnt)}
            )

    return list(buckets.values())


async def analyze_student_chains(
    db: AsyncSession,
    *,
    agent_id: int,
    user_id: Optional[int] = None,
    student_id: Optional[str] = None,
    class_name: Optional[str] = None,
    start_at: datetime,
    end_at: datetime,
    limit_sessions: int = 5,
) -> List[Dict[str, Any]]:
    resolved_user_id: Optional[int] = user_id
    if resolved_user_id is None and student_id:
        user_result = await db.execute(select(User).where(User.student_id == student_id))
        user = user_result.scalar_one_or_none()
        resolved_user_id = int(user.id) if user else None

    if resolved_user_id is None and student_id is None and not class_name:
        pass  # allow querying all chains when no filter specified

    if limit_sessions <= 0:
        limit_sessions = 5
    if limit_sessions > 20:
        limit_sessions = 20

    class_name_value = (class_name or "").strip() or None
    class_name_like = f"%{class_name_value}%" if class_name_value else None

    sessions_sql = text(
        """
        WITH top_sessions AS (
            SELECT
                c.session_id,
                max(c.created_at) AS last_at,
                sum(CASE WHEN c.message_type = 'question' THEN 1 ELSE 0 END) AS turns,
                max(u.student_id) AS student_id,
                max(u.full_name) AS user_name,
                max(u.class_name) AS class_name
            FROM v_conversations_with_deleted c
            JOIN sys_users u ON u.id = c.user_id
            WHERE c.agent_id = :agent_id
              AND (CAST(:user_id AS INTEGER) IS NULL OR c.user_id = CAST(:user_id AS INTEGER))
              AND (CAST(:class_name_like AS TEXT) IS NULL OR u.class_name ILIKE CAST(:class_name_like AS TEXT))
              AND c.session_id IS NOT NULL
              AND c.created_at >= :start_at
              AND c.created_at < :end_at
            GROUP BY c.session_id
            ORDER BY last_at DESC
            LIMIT :limit_sessions
        )
        SELECT
            ts.session_id,
            ts.last_at,
            ts.turns,
            ts.student_id,
            ts.user_name,
            ts.class_name,
            c.id AS msg_id,
            c.message_type AS msg_type,
            c.content AS msg_content,
            c.created_at AS msg_created_at
        FROM top_sessions ts
        JOIN v_conversations_with_deleted c
          ON c.session_id = ts.session_id
         AND c.agent_id = :agent_id
         AND c.created_at >= :start_at
         AND c.created_at < :end_at
        ORDER BY ts.last_at DESC, ts.session_id, c.created_at ASC, c.id ASC
        """
    )
    all_rows = (await db.execute(
        sessions_sql,
        {
            "agent_id": agent_id,
            "user_id": resolved_user_id,
            "class_name_like": class_name_like,
            "start_at": start_at,
            "end_at": end_at,
            "limit_sessions": limit_sessions,
        },
    )).mappings().all()

    by_session: Dict[str, Dict[str, Any]] = {}
    session_order: List[str] = []
    for r in all_rows:
        sid = r.get("session_id")
        if not sid:
            continue
        if sid not in by_session:
            session_order.append(sid)
            by_session[sid] = {
                "session_id": sid,
                "last_at": r.get("last_at"),
                "turns": int(r.get("turns") or 0),
                "student_id": r.get("student_id"),
                "user_name": r.get("user_name"),
                "class_name": r.get("class_name"),
                "messages": [],
            }
        msg_id = r.get("msg_id")
        if msg_id is not None:
            by_session[sid]["messages"].append(
                {
                    "id": int(msg_id),
                    "message_type": r.get("msg_type"),
                    "content": r.get("msg_content"),
                    "created_at": r.get("msg_created_at"),
                }
            )

    return [by_session[sid] for sid in session_order]
