"""
AI智能体服务
提供智能体的CRUD操作和测试功能
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload

from app.models.agents import AIAgent, ZntConversation
from app.models.core import User
from app.schemas.agents import (
    AIAgentCreate,
    AIAgentUpdate,
    AIAgentResponse,
    AgentTestRequest,
    AgentTestResponse,
    AgentStatisticsData,
)
from app.schemas.agents import COMMON_MODEL_PRESETS
from app.utils.agent_secrets import encrypt_api_key, try_decrypt_api_key, last4
from app.core.config import settings
from cachetools import TTLCache

# Agent Cache: key=agent_id, value=AIAgent, TTL=settings.AGENT_CACHE_TTL, maxsize=settings.AGENT_CACHE_MAXSIZE
_AGENT_CACHE = TTLCache(maxsize=settings.AGENT_CACHE_MAXSIZE, ttl=settings.AGENT_CACHE_TTL)


@dataclass
class _AgentProviderContext:
    api_endpoint: str
    flags: Dict[str, bool]
    is_dify: bool

async def create_agent(
    db: AsyncSession,
    agent_in: AIAgentCreate,
) -> AIAgent:
    """
    创建新的AI智能体
    """
    # 检查智能体名称是否已存在（未删除的）
    existing_agent = await db.execute(
        select(AIAgent).where(
            and_(
                AIAgent.name == agent_in.name,
                AIAgent.is_deleted == False
            )
        )
    )
    existing_agent = existing_agent.scalar_one_or_none()
    
    if existing_agent:
        raise ValueError(f"智能体名称 '{agent_in.name}' 已存在")
    
    # 创建新的智能体
    api_key_plain = (agent_in.api_key or "").strip() or None
    api_key_encrypted = encrypt_api_key(api_key_plain) if api_key_plain else None
    
    # 兼容性修复: Pydantic v2 AnyHttpUrl 对象需转换为字符串才能存入 asyncpg
    api_endpoint = str(agent_in.api_endpoint) if agent_in.api_endpoint else None

    db_agent = AIAgent(
        name=agent_in.name,
        agent_type=agent_in.agent_type,
        description=agent_in.description,
        model_name=agent_in.model_name,
        api_endpoint=api_endpoint,
        api_key=None,
        api_key_encrypted=api_key_encrypted,
        api_key_last4=last4(api_key_plain),
        has_api_key=bool(api_key_plain),
        is_active=agent_in.is_active,
    )
    
    db.add(db_agent)
    await db.commit()
    await db.refresh(db_agent)
    
    return db_agent


async def get_agent(
    db: AsyncSession,
    agent_id: int,
    include_deleted: bool = False,
    use_cache: bool = True,
) -> Optional[AIAgent]:
    """
    根据ID获取智能体 (带内存缓存)
    """
    # 仅针对未删除的智能体使用缓存
    if not include_deleted and use_cache:
        cached = _AGENT_CACHE.get(agent_id)
        if cached:
            return cached

    query = select(AIAgent).where(AIAgent.id == agent_id)
    
    if not include_deleted:
        query = query.where(AIAgent.is_deleted == False)
    
    result = await db.execute(query)
    agent = result.scalar_one_or_none()

    # 写入缓存
    if agent and not include_deleted:
        _AGENT_CACHE[agent_id] = agent
        
    return agent


def _resolved_agent_api_key(agent: AIAgent, *, is_openrouter: bool) -> Optional[str]:
    v = try_decrypt_api_key(getattr(agent, "api_key_encrypted", None))
    if v:
        return v
    legacy = (getattr(agent, "api_key", None) or "").strip()
    if legacy:
        return legacy
    if is_openrouter and settings.OPENROUTER_API_KEY:
        return settings.OPENROUTER_API_KEY
    return None


def _model_display_name(model_id: Optional[str]) -> Optional[str]:
    if not model_id:
        return model_id
    try:
        for models in COMMON_MODEL_PRESETS.values():
            for m in models:
                if m.id == model_id:
                    return m.name
    except Exception:
        pass
    name = model_id.replace("-", " ").replace("_", " ").title()
    name = name.replace("Gpt", "GPT").replace("Claude", "Claude").replace("Qwen", "Qwen").replace("Llama", "Llama").replace("Doubao", "Doubao")
    return name


def _build_dify_progress_log(user_query: str, model_id: Optional[str]) -> str:
    model_name = _model_display_name(model_id) or "未指定模型"
    steps = [
        ("接收用户消息", f"“{user_query[:60]}”"),
        ("意图识别", "分析意图、抽取关键实体"),
        ("选择工具", "检索资料、网页浏览、结构化知识库"),
        ("检索资料", "命中相关文档 5 条，摘要生成"),
        ("调用模型", f"使用 {model_name} 进行推理与生成"),
        ("生成草稿", "组织答案结构、引用来源"),
        ("反思改进", "一致性检查、补充细节、输出最终答案"),
    ]
    durations = [0.3, 0.5, 0.4, 0.8, 0.7, 0.6, 0.5]
    lines = []
    cumulative = 0.0
    for i, ((title, detail), d) in enumerate(zip(steps, durations), start=1):
        cumulative += d
        lines.append(f"步骤 {i}/{len(steps)} ▸ {title}（耗时 ~{d:.1f}s，累计 ~{cumulative:.1f}s）\n- {detail}")
    return "\n".join(lines)


def _build_provider_context(agent: AIAgent) -> _AgentProviderContext:
    from app.services.agents.providers import detect_flags

    api_endpoint = (agent.api_endpoint or "").strip()
    return _AgentProviderContext(
        api_endpoint=api_endpoint,
        flags=detect_flags(api_endpoint),
        is_dify=agent.agent_type == "dify",
    )


def _build_test_headers(agent: AIAgent, ctx: _AgentProviderContext) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    api_key = _resolved_agent_api_key(agent, is_openrouter=ctx.flags["is_openrouter"])
    if api_key:
        if ctx.is_dify:
            headers["Authorization"] = f"Bearer {api_key}"
        elif ctx.flags["is_anthropic"]:
            headers["x-api-key"] = api_key
        else:
            headers["Authorization"] = f"Bearer {api_key}"
    if ctx.flags["is_openrouter"]:
        headers["HTTP-Referer"] = "https://github.com/wangsh"
        headers["X-Title"] = "WangSh AI"
    return headers


def _resolve_provider_type(flags: Dict[str, bool]) -> str:
    if flags["is_deepseek"]:
        return "DeepSeek"
    if flags["is_openai"]:
        return "OpenAI"
    if flags["is_anthropic"]:
        return "Anthropic"
    if flags["is_openrouter"]:
        return "OpenRouter"
    if flags["is_siliconflow"]:
        return "SiliconFlow"
    if flags["is_volcengine"]:
        return "Volcengine"
    if flags["is_aliyun"]:
        return "Aliyun"
    return "AI服务"


def _resolve_test_endpoint(ctx: _AgentProviderContext) -> Optional[str]:
    from app.services.agents.providers import models_endpoint

    if ctx.is_dify:
        return "/v1/chat/completions"
    return models_endpoint(ctx.flags)


def _join_api_url(base: str, path: str) -> str:
    base_clean = (base or "").strip().rstrip("/")
    if base_clean.endswith("/chat/completions"):
        base_clean = base_clean[:-17]
    path_clean = path if path.startswith("/") else f"/{path}"
    if base_clean.endswith("/v1") and path_clean.startswith("/v1/"):
        path_clean = path_clean[len("/v1"):]
    if base_clean.endswith("/api/v1") and path_clean.startswith("/api/v1/"):
        path_clean = path_clean[len("/api/v1"):]
    if base_clean.endswith("/api/v3") and path_clean.startswith("/api/v3/"):
        path_clean = path_clean[len("/api/v3"):]
    return f"{base_clean}{path_clean}"


def _elapsed_ms(start_time: float, time_module) -> float:
    return (time_module.time() - start_time) * 1000


def _display_test_message(test_message: str) -> str:
    if len(test_message) > 50:
        return test_message[:50] + "..."
    return test_message


async def _perform_chat_test(
    client,
    agent: AIAgent,
    test_message: str,
    headers: Dict[str, str],
    ctx: _AgentProviderContext,
) -> str:
    from app.services.agents.providers import chat_completions_endpoint

    try:
        chat_payload = {
            "model": agent.model_name,
            "messages": [{"role": "user", "content": test_message}],
            "max_tokens": 10
        }
        chat_url = chat_completions_endpoint(ctx.api_endpoint, ctx.flags)
        chat_response = await client.post(
            chat_url,
            headers=headers,
            json=chat_payload,
            timeout=30.0
        )
        if chat_response.status_code == 200:
            return f"\n🧠 聊天测试: ✅ 成功 (使用模型: {_model_display_name(agent.model_name)})"
        return f"\n🧠 聊天测试: ⚠️ 模型调用失败 (状态码: {chat_response.status_code})"
    except Exception as chat_error:
        return f"\n🧠 聊天测试: ⚠️ 模型调用错误 ({str(chat_error)[:50]})"


async def _test_models_endpoint(
    client,
    agent: AIAgent,
    test_request: AgentTestRequest,
    headers: Dict[str, str],
    ctx: _AgentProviderContext,
    start_time: float,
    time_module,
) -> AgentTestResponse:
    response = await client.get(
        _join_api_url(ctx.api_endpoint, _resolve_test_endpoint(ctx) or ""),
        headers=headers
    )
    response_time = _elapsed_ms(start_time, time_module)
    if response.status_code == 200:
        data = response.json()
        models_count = len(data.get("data", []))
        chat_test_result = ""
        if agent.model_name and test_request.test_message:
            chat_test_result = await _perform_chat_test(
                client=client,
                agent=agent,
                test_message=test_request.test_message,
                headers=headers,
                ctx=ctx,
            )
        test_message_display = _display_test_message(test_request.test_message)
        provider_type = _resolve_provider_type(ctx.flags)
        return AgentTestResponse(
            success=True,
            message=f"✅ {provider_type} 智能体 '{agent.name}' 测试成功\n\n📋 类型: {agent.agent_type}\n🔗 端点: {ctx.api_endpoint}\n📊 发现模型: {models_count} 个{chat_test_result}\n💬 测试消息: {test_message_display}",
            response_time=response_time,
            timestamp=datetime.now(),
        )

    error_msg = f"❌ API连接测试失败\n\n📋 类型: {agent.agent_type}\n🔗 端点: {ctx.api_endpoint}\n🛑 状态码: {response.status_code}"
    if response.status_code == 401:
        error_msg += "\n🔒 错误原因: 认证失败 (API Key 无效或过期)"
    elif response.status_code == 403:
        error_msg += "\n🚫 错误原因: 拒绝访问 (权限不足)"
    elif response.status_code == 404:
        error_msg += "\n🔍 错误原因: 端点不存在 (请检查URL)"
    elif response.status_code == 429:
        error_msg += "\n⏳ 错误原因: 请求过多 (触发限流)"
    error_msg += f"\n📄 响应: {response.text[:500]}"
    return AgentTestResponse(
        success=False,
        message=error_msg,
        response_time=response_time,
        timestamp=datetime.now(),
    )


async def _test_basic_endpoint(
    client,
    agent: AIAgent,
    test_request: AgentTestRequest,
    headers: Dict[str, str],
    ctx: _AgentProviderContext,
    start_time: float,
    time_module,
) -> AgentTestResponse:
    try:
        response = await client.get(ctx.api_endpoint, headers=headers, timeout=30.0)
        response_time = _elapsed_ms(start_time, time_module)
        if response.status_code < 400:
            test_message_display = _display_test_message(test_request.test_message)
            return AgentTestResponse(
                success=True,
                message=f"✅ 智能体 '{agent.name}' 基本连接测试成功\n\n📋 类型: {agent.agent_type}\n🔗 端点: {ctx.api_endpoint}\n💬 测试消息: {test_message_display}",
                response_time=response_time,
                timestamp=datetime.now(),
            )
        return AgentTestResponse(
            success=False,
            message=f"❌ 基本连接测试失败\n\n📋 类型: {agent.agent_type}\n🔗 端点: {ctx.api_endpoint}\n🛑 状态码: {response.status_code}",
            response_time=response_time,
            timestamp=datetime.now(),
        )
    except Exception as conn_error:
        response_time = _elapsed_ms(start_time, time_module)
        return AgentTestResponse(
            success=False,
            message=f"❌ 连接测试异常\n\n📋 类型: {agent.agent_type}\n🔗 端点: {ctx.api_endpoint}\n🛑 错误: {str(conn_error)[:100]}",
            response_time=response_time,
            timestamp=datetime.now(),
        )


async def get_agents(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    agent_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    include_deleted: bool = False,
) -> List[AIAgent]:
    """
    获取智能体列表（支持搜索和过滤）
    """
    query = select(AIAgent)
    
    # 过滤已删除的智能体
    if not include_deleted:
        query = query.where(AIAgent.is_deleted == False)
    
    # 按类型过滤
    if agent_type:
        query = query.where(AIAgent.agent_type == agent_type)
    
    # 按状态过滤
    if is_active is not None:
        query = query.where(AIAgent.is_active == is_active)
    
    # 搜索功能
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                AIAgent.name.ilike(search_term),
                AIAgent.agent_type.ilike(search_term),
            )
        )
    
    # 分页和排序
    query = query.offset(skip).limit(limit).order_by(AIAgent.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_active_agents(
    db: AsyncSession,
) -> List[AIAgent]:
    """
    获取所有启用的智能体（用于前端选择）
    """
    query = select(AIAgent).where(
        and_(
            AIAgent.is_active == True,
            AIAgent.is_deleted == False
        )
    ).order_by(AIAgent.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


async def update_agent(
    db: AsyncSession,
    agent_id: int,
    agent_in: AIAgentUpdate,
) -> Optional[AIAgent]:
    """
    更新智能体信息
    """
    # 获取智能体
    agent = await get_agent(db, agent_id, use_cache=False)
    if not agent:
        return None
    
    # 检查名称是否重复（如果提供了新名称）
    if agent_in.name is not None and agent_in.name != agent.name:
        existing_agent = await db.execute(
            select(AIAgent).where(
                and_(
                    AIAgent.name == agent_in.name,
                    AIAgent.is_deleted == False,
                    AIAgent.id != agent_id
                )
            )
        )
        existing_agent = existing_agent.scalar_one_or_none()
        
        if existing_agent:
            raise ValueError(f"智能体名称 '{agent_in.name}' 已存在")
    
    update_data = agent_in.dict(exclude_unset=True)

    # 清除缓存
    if agent_id in _AGENT_CACHE:
        del _AGENT_CACHE[agent_id]

    # 兼容性修复: Pydantic v2 AnyHttpUrl 对象需转换为字符串
    if "api_endpoint" in update_data and update_data["api_endpoint"]:
        update_data["api_endpoint"] = str(update_data["api_endpoint"])

    clear_api_key = bool(update_data.pop("clear_api_key", False))
    api_key_plain = None
    if "api_key" in update_data:
        api_key_plain = (update_data.pop("api_key") or "").strip() or None

    for field, value in update_data.items():
        setattr(agent, field, value)

    if clear_api_key:
        agent.api_key = None
        agent.api_key_encrypted = None
        agent.api_key_last4 = None
        agent.has_api_key = False
    elif api_key_plain:
        agent.api_key = None
        agent.api_key_encrypted = encrypt_api_key(api_key_plain)
        agent.api_key_last4 = last4(api_key_plain)
        agent.has_api_key = True
    
    await db.commit()
    await db.refresh(agent)
    
    return agent


async def delete_agent(
    db: AsyncSession,
    agent_id: int,
    hard_delete: bool = False,
) -> bool:
    """
    删除智能体（默认软删除）
    """
    agent = await get_agent(db, agent_id, use_cache=False)
    if not agent:
        return False
    
    if hard_delete:
        # 硬删除
        await db.delete(agent)
    else:
        # 软删除
        agent.is_deleted = True
        agent.deleted_at = datetime.now()
    
    # 清除缓存
    if agent_id in _AGENT_CACHE:
        del _AGENT_CACHE[agent_id]

    await db.commit()
    return True


async def test_agent(
    db: AsyncSession,
    test_request: AgentTestRequest,
) -> AgentTestResponse:
    """
    测试智能体连接和功能
    
    注意：这是一个简化版的测试功能，实际实现需要根据智能体类型
    调用相应的API进行测试。目前返回模拟数据。
    """
    import time
    
    # 获取智能体
    agent = await get_agent(db, test_request.agent_id)
    if not agent:
        return AgentTestResponse(
            success=False,
            message=f"智能体ID {test_request.agent_id} 不存在",
            response_time=None,
            timestamp=datetime.now(),
        )
    
    # 检查智能体是否启用
    if not agent.is_active:
        return AgentTestResponse(
            success=False,
            message=f"智能体 '{agent.name}' 已停用",
            response_time=None,
            timestamp=datetime.now(),
        )
    
    # 检查必要的配置
    if not agent.api_endpoint:
        return AgentTestResponse(
            success=False,
            message=f"智能体 '{agent.name}' 未配置API端点",
            response_time=None,
            timestamp=datetime.now(),
        )
    
    start_time = time.time()
    
    try:
        import httpx
        ctx = _build_provider_context(agent)
        headers = _build_test_headers(agent, ctx)
        test_endpoint = _resolve_test_endpoint(ctx)

        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            if test_endpoint:
                if ctx.is_dify:
                    from app.services.agents.dify_test import run_dify_test
                    return await run_dify_test(ctx.api_endpoint, headers, test_request.test_message or "Hello", agent.model_name)
                return await _test_models_endpoint(
                    client=client,
                    agent=agent,
                    test_request=test_request,
                    headers=headers,
                    ctx=ctx,
                    start_time=start_time,
                    time_module=time,
                )
            return await _test_basic_endpoint(
                client=client,
                agent=agent,
                test_request=test_request,
                headers=headers,
                ctx=ctx,
                start_time=start_time,
                time_module=time,
            )
        
    except Exception as e:
        response_time = _elapsed_ms(start_time, time)
        return AgentTestResponse(
            success=False,
            message=f"❌ 智能体测试失败\n\n📋 类型: {agent.agent_type}\n🔗 端点: {agent.api_endpoint}\n🛑 错误: {str(e)[:200]}",
            response_time=response_time,
            timestamp=datetime.now(),
        )


async def get_agent_statistics(
    db: AsyncSession,
) -> AgentStatisticsData:
    """
    获取智能体统计数据
    """
    # 获取总数
    total_query = select(func.count()).select_from(AIAgent).where(AIAgent.is_deleted == False)
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0
    
    # 获取启用数量
    active_query = select(func.count()).select_from(AIAgent).where(
        and_(
            AIAgent.is_active == True,
            AIAgent.is_deleted == False
        )
    )
    active_result = await db.execute(active_query)
    active_count = active_result.scalar() or 0
    
    # 获取已删除数量
    deleted_query = select(func.count()).select_from(AIAgent).where(AIAgent.is_deleted == True)
    deleted_result = await db.execute(deleted_query)
    deleted_count = deleted_result.scalar() or 0
    
    # 按类型统计
    general_query = select(func.count()).select_from(AIAgent).where(
        and_(
            AIAgent.agent_type == "general",
            AIAgent.is_deleted == False
        )
    )
    general_result = await db.execute(general_query)
    general_count = general_result.scalar() or 0
    
    dify_query = select(func.count()).select_from(AIAgent).where(
        and_(
            AIAgent.agent_type == "dify",
            AIAgent.is_deleted == False
        )
    )
    dify_result = await db.execute(dify_query)
    dify_count = dify_result.scalar() or 0
    
    # 模拟API错误数（实际项目中应从日志或监控系统获取）
    api_errors = 0
    
    return AgentStatisticsData(
        total=total,
        generalCount=general_count,
        difyCount=dify_count,
        activeCount=active_count,
        total_agents=total,
        active_agents=active_count,
        deleted_agents=deleted_count,
        api_errors=api_errors,
    )


def _parse_usage_datetime(value: Optional[str], is_end: bool = False) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    if is_end:
        return parsed + timedelta(days=1)
    return parsed


def _build_usage_response_from_session(row: Dict[str, Any]) -> Dict[str, Any]:
    user_id = row.get("user_id")
    agent_id = row.get("agent_id")
    display_user_name = row.get("display_user_name")
    display_agent_name = row.get("display_agent_name")

    user = None
    if user_id:
        user = {
            "id": int(user_id),
            "student_id": row.get("student_id"),
            "name": row.get("full_name") or display_user_name,
            "grade": row.get("study_year"),
            "class_name": row.get("class_name"),
            "is_active": row.get("user_is_active"),
        }

    moxing = None
    if agent_id:
        moxing = {
            "id": int(agent_id),
            "agent_name": display_agent_name,
            "agent_type": row.get("agent_type"),
            "model_name": row.get("model_name"),
            "user_id": None,
            "status": row.get("agent_is_active"),
            "description": None,
        }

    return {
        "id": int(row.get("id") or 0),
        "user_id": int(user_id or 0),
        "moxing_id": int(agent_id or 0),
        "question": row.get("question") or "",
        "answer": row.get("answer") or "",
        "session_id": row.get("session_id"),
        "response_time_ms": row.get("response_time_ms"),
        "used_at": row.get("used_at"),
        "created_at": row.get("created_at"),
        "user": user,
        "moxing": moxing,
        "additional_data": None,
    }


async def create_agent_usage(
    db: AsyncSession,
    *,
    agent_id: int,
    user_id: Optional[int] = None,
    question: Optional[str] = None,
    answer: Optional[str] = None,
    session_id: Optional[str] = None,
    response_time_ms: Optional[int] = None,
    used_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    used_at_value = used_at or datetime.now()

    agent_result = await db.execute(select(AIAgent).where(AIAgent.id == agent_id))
    agent = agent_result.scalar_one_or_none()

    user = None
    if user_id is not None:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

    question_row = None
    answer_row = None

    if question:
        question_row = ZntConversation(
            user_id=user.id if user else None,
            user_name=user.full_name if user else None,
            agent_id=agent.id if agent else None,
            agent_name=agent.name if agent else None,
            session_id=session_id,
            message_type="question",
            content=question,
            response_time_ms=response_time_ms,
            created_at=used_at_value,
        )
        db.add(question_row)

    if answer is not None:
        answer_row = ZntConversation(
            user_id=user.id if user else None,
            user_name=user.full_name if user else None,
            agent_id=agent.id if agent else None,
            agent_name=agent.name if agent else None,
            session_id=session_id,
            message_type="answer",
            content=answer,
            response_time_ms=response_time_ms,
            created_at=used_at_value,
        )
        db.add(answer_row)

    await db.commit()
    if answer_row:
        await db.refresh(answer_row)
    elif question_row:
        await db.refresh(question_row)

    return {
        "id": (answer_row.id if answer_row else (question_row.id if question_row else 0)),
        "user_id": (user.id if user else 0),
        "moxing_id": (agent.id if agent else 0),
        "question": question or "",
        "answer": answer or "",
        "session_id": session_id,
        "response_time_ms": response_time_ms,
        "used_at": used_at_value,
        "created_at": used_at_value,
        "user": (
            {
                "id": user.id,
                "student_id": user.student_id,
                "name": user.full_name,
                "grade": user.study_year,
                "class_name": user.class_name,
                "is_active": user.is_active,
            }
            if user
            else None
        ),
        "moxing": (
            {
                "id": agent.id,
                "agent_name": agent.name,
                "agent_type": agent.agent_type,
                "model_name": agent.model_name,
                "user_id": None,
                "status": agent.is_active,
                "description": None,
            }
            if agent
            else None
        ),
        "additional_data": None,
    }


async def get_agent_usage_list(
    db: AsyncSession,
    *,
    keyword: Optional[str] = None,
    student_id: Optional[str] = None,
    student_name: Optional[str] = None,
    class_name: Optional[str] = None,
    grade: Optional[str] = None,
    agent_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    skip: Optional[int] = None,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    start_dt = _parse_usage_datetime(start_date)
    end_dt = _parse_usage_datetime(end_date, is_end=True)

    where: List[str] = ["1=1"]
    params: Dict[str, Any] = {}

    if keyword:
        params["keyword"] = f"%{keyword}%"
        where.append("(s.question ILIKE :keyword OR s.answer ILIKE :keyword)")
    if student_id:
        params["student_id"] = f"%{student_id}%"
        where.append("(u.student_id ILIKE :student_id)")
    if student_name:
        params["student_name"] = f"%{student_name}%"
        where.append("(u.full_name ILIKE :student_name OR s.display_user_name ILIKE :student_name)")
    if class_name:
        params["class_name"] = f"%{class_name}%"
        where.append("(u.class_name ILIKE :class_name)")
    if grade:
        params["grade"] = grade
        where.append("(u.study_year = :grade)")
    if agent_name:
        params["agent_name"] = f"%{agent_name}%"
        where.append("(a.name ILIKE :agent_name OR s.display_agent_name ILIKE :agent_name)")
    if start_dt:
        params["start_dt"] = start_dt
        where.append("(s.used_at >= :start_dt)")
    if end_dt:
        params["end_dt"] = end_dt
        where.append("(s.used_at < :end_dt)")

    effective_limit = limit or page_size
    effective_skip = skip if skip is not None else max(page - 1, 0) * effective_limit
    params["limit"] = effective_limit
    params["offset"] = effective_skip

    where_sql = " AND ".join(where)

    cte_sql = """
        WITH sessions AS (
            SELECT
                max(id) AS id,
                session_id,
                max(user_id) AS user_id,
                max(display_user_name) AS display_user_name,
                max(agent_id) AS agent_id,
                max(display_agent_name) AS display_agent_name,
                max(CASE WHEN message_type='question' THEN content END) AS question,
                max(CASE WHEN message_type='answer' THEN content END) AS answer,
                max(response_time_ms) AS response_time_ms,
                max(created_at) AS used_at,
                max(created_at) AS created_at
            FROM v_conversations_with_deleted
            WHERE session_id IS NOT NULL
            GROUP BY session_id
        )
    """

    total_sql = text(
        cte_sql
        + f"""
        SELECT count(*)
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql}
        """
    )
    total_result = await db.execute(total_sql, params)
    total = int(total_result.scalar() or 0)

    list_sql = text(
        cte_sql
        + f"""
        SELECT
            s.*,
            u.student_id,
            u.full_name,
            u.study_year,
            u.class_name,
            u.is_active AS user_is_active,
            a.agent_type,
            a.model_name,
            a.is_active AS agent_is_active
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql}
        ORDER BY s.used_at DESC
        OFFSET :offset
        LIMIT :limit
        """
    )
    result = await db.execute(list_sql, params)
    rows = result.mappings().all()
    items = [_build_usage_response_from_session(dict(r)) for r in rows]
    total_pages = (total + effective_limit - 1) // effective_limit if effective_limit else 1

    return {"items": items, "total": total, "page": page, "page_size": effective_limit, "total_pages": total_pages}


async def get_agent_usage_statistics(
    db: AsyncSession,
    *,
    keyword: Optional[str] = None,
    student_id: Optional[str] = None,
    student_name: Optional[str] = None,
    class_name: Optional[str] = None,
    grade: Optional[str] = None,
    agent_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, int]:
    start_dt = _parse_usage_datetime(start_date)
    end_dt = _parse_usage_datetime(end_date, is_end=True)

    where: List[str] = ["1=1"]
    params: Dict[str, Any] = {}

    if keyword:
        params["keyword"] = f"%{keyword}%"
        where.append("(s.question ILIKE :keyword OR s.answer ILIKE :keyword)")
    if student_id:
        params["student_id"] = f"%{student_id}%"
        where.append("(u.student_id ILIKE :student_id)")
    if student_name:
        params["student_name"] = f"%{student_name}%"
        where.append("(u.full_name ILIKE :student_name OR s.display_user_name ILIKE :student_name)")
    if class_name:
        params["class_name"] = f"%{class_name}%"
        where.append("(u.class_name ILIKE :class_name)")
    if grade:
        params["grade"] = grade
        where.append("(u.study_year = :grade)")
    if agent_name:
        params["agent_name"] = f"%{agent_name}%"
        where.append("(a.name ILIKE :agent_name OR s.display_agent_name ILIKE :agent_name)")
    if start_dt:
        params["start_dt"] = start_dt
        where.append("(s.used_at >= :start_dt)")
    if end_dt:
        params["end_dt"] = end_dt
        where.append("(s.used_at < :end_dt)")

    where_sql = " AND ".join(where)

    cte_sql = """
        WITH sessions AS (
            SELECT
                session_id,
                max(user_id) AS user_id,
                max(display_user_name) AS display_user_name,
                max(agent_id) AS agent_id,
                max(display_agent_name) AS display_agent_name,
                max(CASE WHEN message_type='question' THEN content END) AS question,
                max(CASE WHEN message_type='answer' THEN content END) AS answer,
                max(response_time_ms) AS response_time_ms,
                max(created_at) AS used_at
            FROM v_conversations_with_deleted
            WHERE session_id IS NOT NULL
            GROUP BY session_id
        )
    """

    total_sql = text(
        cte_sql
        + f"""
        SELECT count(*) AS total_usage
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql}
        """
    )
    total_usage = int((await db.execute(total_sql, params)).scalar() or 0)

    active_students_sql = text(
        cte_sql
        + f"""
        SELECT count(distinct s.user_id) AS active_students
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql} AND s.user_id IS NOT NULL
        """
    )
    active_students = int((await db.execute(active_students_sql, params)).scalar() or 0)

    active_agents_sql = text(
        cte_sql
        + f"""
        SELECT count(distinct s.agent_id) AS active_agents
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql} AND s.agent_id IS NOT NULL
        """
    )
    active_agents = int((await db.execute(active_agents_sql, params)).scalar() or 0)

    avg_sql = text(
        cte_sql
        + f"""
        SELECT avg(s.response_time_ms) AS avg_response_time
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql}
        """
    )
    avg_response_time = int((await db.execute(avg_sql, params)).scalar() or 0)

    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    time_params = {**params, "today_start": today_start, "week_start": week_start, "month_start": month_start}

    today_sql = text(
        cte_sql
        + f"""
        SELECT count(*) AS today_usage
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql} AND s.used_at >= :today_start
        """
    )
    week_sql = text(
        cte_sql
        + f"""
        SELECT count(*) AS week_usage
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql} AND s.used_at >= :week_start
        """
    )
    month_sql = text(
        cte_sql
        + f"""
        SELECT count(*) AS month_usage
        FROM sessions s
        LEFT JOIN sys_users u ON s.user_id = u.id
        LEFT JOIN znt_agents a ON s.agent_id = a.id
        WHERE {where_sql} AND s.used_at >= :month_start
        """
    )
    today_usage = int((await db.execute(today_sql, time_params)).scalar() or 0)
    week_usage = int((await db.execute(week_sql, time_params)).scalar() or 0)
    month_usage = int((await db.execute(month_sql, time_params)).scalar() or 0)

    return {
        "total_usage": total_usage,
        "active_students": active_students,
        "active_agents": active_agents,
        "avg_response_time": avg_response_time,
        "today_usage": today_usage,
        "week_usage": week_usage,
        "month_usage": month_usage,
    }


async def list_user_conversations(
    db: AsyncSession,
    *,
    user_id: int,
    agent_id: int,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    sql = text(
        """
        WITH sessions AS (
            SELECT
                session_id,
                max(created_at) AS last_at,
                max(display_user_name) AS display_user_name,
                max(display_agent_name) AS display_agent_name,
                sum(CASE WHEN message_type='question' THEN 1 ELSE 0 END) AS question_count,
                sum(CASE WHEN message_type='answer' THEN 1 ELSE 0 END) AS answer_count,
                max(CASE WHEN message_type='question' THEN content END) AS last_question,
                max(CASE WHEN message_type='answer' THEN content END) AS last_answer
            FROM v_conversations_with_deleted
            WHERE user_id = :user_id
              AND agent_id = :agent_id
              AND session_id IS NOT NULL
            GROUP BY session_id
        )
        SELECT *
        FROM sessions
        ORDER BY last_at DESC
        LIMIT :limit
        """
    )
    result = await db.execute(
        sql, {"user_id": user_id, "agent_id": agent_id, "limit": limit}
    )
    rows = result.mappings().all()
    items: List[Dict[str, Any]] = []
    for r in rows:
        last_question = (r.get("last_question") or "").strip()
        last_answer = (r.get("last_answer") or "").strip()
        preview = last_answer or last_question
        if len(preview) > 80:
            preview = preview[:80] + "…"
        items.append(
            {
                "session_id": r.get("session_id"),
                "agent_id": agent_id,
                "display_agent_name": r.get("display_agent_name"),
                "display_user_name": r.get("display_user_name"),
                "last_at": r.get("last_at"),
                "turns": int(r.get("question_count") or 0),
                "preview": preview,
            }
        )
    return items


async def get_conversation_messages(
    db: AsyncSession,
    *,
    user_id: int,
    session_id: str,
) -> List[Dict[str, Any]]:
    sql = text(
        """
        SELECT
            id,
            user_id,
            display_user_name,
            agent_id,
            display_agent_name,
            session_id,
            message_type,
            content,
            response_time_ms,
            created_at
        FROM v_conversations_with_deleted
        WHERE user_id = :user_id
          AND session_id = :session_id
        ORDER BY created_at ASC, id ASC
        """
    )
    result = await db.execute(sql, {"user_id": user_id, "session_id": session_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def get_conversation_messages_admin(
    db: AsyncSession,
    *,
    session_id: str,
) -> List[Dict[str, Any]]:
    sql = text(
        """
        SELECT
            id,
            user_id,
            display_user_name,
            agent_id,
            display_agent_name,
            session_id,
            message_type,
            content,
            response_time_ms,
            created_at
        FROM v_conversations_with_deleted
        WHERE session_id = :session_id
        ORDER BY created_at ASC, id ASC
        """
    )
    result = await db.execute(sql, {"session_id": session_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]


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

    if resolved_user_id is None and not class_name:
        return []

    if limit_sessions <= 0:
        limit_sessions = 5
    if limit_sessions > 20:
        limit_sessions = 20

    class_name_value = (class_name or "").strip() or None
    class_name_like = f"%{class_name_value}%" if class_name_value else None

    sessions_sql = text(
        """
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
        """
    )
    sessions_result = await db.execute(
        sessions_sql,
        {
            "agent_id": agent_id,
            "user_id": resolved_user_id,
            "class_name_like": class_name_like,
            "start_at": start_at,
            "end_at": end_at,
            "limit_sessions": limit_sessions,
        },
    )
    session_rows = sessions_result.mappings().all()
    session_ids = [r.get("session_id") for r in session_rows if r.get("session_id")]
    if not session_ids:
        return []

    messages_sql = text(
        """
        SELECT
            c.id,
            c.session_id,
            c.message_type,
            c.content,
            c.created_at
        FROM v_conversations_with_deleted c
        WHERE c.agent_id = :agent_id
          AND c.session_id = ANY(:session_ids)
          AND c.created_at >= :start_at
          AND c.created_at < :end_at
        ORDER BY c.session_id ASC, c.created_at ASC, c.id ASC
        """
    )
    messages_result = await db.execute(
        messages_sql,
        {
            "agent_id": agent_id,
            "session_ids": session_ids,
            "start_at": start_at,
            "end_at": end_at,
        },
    )
    msg_rows = messages_result.mappings().all()

    by_session: Dict[str, Dict[str, Any]] = {}
    for s in session_rows:
        sid = s.get("session_id")
        if not sid:
            continue
        by_session[sid] = {
            "session_id": sid,
            "last_at": s.get("last_at"),
            "turns": int(s.get("turns") or 0),
            "student_id": s.get("student_id"),
            "user_name": s.get("user_name"),
            "class_name": s.get("class_name"),
            "messages": [],
        }

    for m in msg_rows:
        sid = m.get("session_id")
        if sid not in by_session:
            continue
        by_session[sid]["messages"].append(
            {
                "id": int(m.get("id")),
                "message_type": m.get("message_type"),
                "content": m.get("content"),
                "created_at": m.get("created_at"),
            }
        )

    ordered = [by_session[sid] for sid in session_ids if sid in by_session]
    return ordered
