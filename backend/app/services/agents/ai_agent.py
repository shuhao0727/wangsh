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
        system_prompt=getattr(agent_in, "system_prompt", None),
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
    
    try:
        update_data = agent_in.model_dump(exclude_unset=True)
    except AttributeError:
        update_data = agent_in.dict(exclude_unset=True)

    # 清除缓存
    if agent_id in _AGENT_CACHE:
        del _AGENT_CACHE[agent_id]

    # 兼容性修复: Pydantic v2 AnyHttpUrl 对象需转换为字符串
    if "api_endpoint" in update_data and update_data["api_endpoint"] is not None:
        update_data["api_endpoint"] = str(update_data["api_endpoint"])

    # model_name 如果是列表（前端 tags 模式），取第一个值
    if "model_name" in update_data:
        v = update_data["model_name"]
        if isinstance(v, list):
            update_data["model_name"] = v[0] if v else None
        elif isinstance(v, str) and not v.strip():
            update_data["model_name"] = None

    clear_api_key = bool(update_data.pop("clear_api_key", False))
    api_key_plain = None
    if "api_key" in update_data:
        api_key_plain = (update_data.pop("api_key") or "").strip() or None

    for field, value in update_data.items():
        setattr(agent, field, value)

    if clear_api_key and not api_key_plain:
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
    """获取智能体统计数据 — 单条聚合查询"""
    query = select(
        func.count().label("total_all"),
        func.count().filter(AIAgent.is_deleted == False).label("total"),
        func.count().filter(and_(AIAgent.is_active == True, AIAgent.is_deleted == False)).label("active"),
        func.count().filter(AIAgent.is_deleted == True).label("deleted"),
        func.count().filter(and_(AIAgent.agent_type == "general", AIAgent.is_deleted == False)).label("general"),
        func.count().filter(and_(AIAgent.agent_type == "dify", AIAgent.is_deleted == False)).label("dify"),
    ).select_from(AIAgent)

    row = (await db.execute(query)).one()

    return AgentStatisticsData(
        total=row.total,
        generalCount=row.general,
        difyCount=row.dify,
        activeCount=row.active,
        total_agents=row.total,
        active_agents=row.active,
        deleted_agents=row.deleted,
        api_errors=0,
    )

