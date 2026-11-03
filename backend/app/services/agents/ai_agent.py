"""
AI智能体服务
提供智能体的CRUD操作和测试功能
"""

from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.models.agents import AIAgent
from app.schemas.agents import (
    AIAgentCreate,
    AIAgentUpdate,
    AgentTestRequest,
    AgentTestResponse,
    AgentStatisticsData,
)
from app.utils.agent_secrets import encrypt_api_key, last4
from app.core.config import settings
from cachetools import TTLCache
from loguru import logger

# Agent Cache: key=agent_id, value=AIAgent, TTL=settings.AGENT_CACHE_TTL, maxsize=settings.AGENT_CACHE_MAXSIZE
_AGENT_CACHE = TTLCache(maxsize=settings.AGENT_CACHE_MAXSIZE, ttl=settings.AGENT_CACHE_TTL)


def _log_endpoint_warning() -> None:
    """固定、不携带配置或异常信息；日志 sink 故障也不阻断软保存。"""
    try:
        logger.warning(
            "[agent-endpoint] api_endpoint 未通过安全校验；"
            "保存已继续，如非本地/内网部署请核对配置。"
        )
    except Exception:
        pass


def warn_if_endpoint_unsafe(api_endpoint: Optional[str], *, agent_name: str = "") -> None:
    """同步调用方兼容入口；保存路径使用异步版，agent_name 仅保留参数兼容。

    内网 dify/自建模型是正常用法，因此只做软校验，不改变保存结果。
    校验与日志的一般异常不外抛；取消等 BaseException 仍由调用方处理。
    """
    if not api_endpoint:
        return
    try:
        from app.services.agents.endpoint_security import _assert_safe_endpoint

        _assert_safe_endpoint(
            str(api_endpoint),
            allow_local_ollama=True,
            allow_trusted_internal=True,
        )
    except Exception:
        _log_endpoint_warning()


async def warn_if_endpoint_unsafe_async(api_endpoint: Optional[str], *, agent_name: str = "") -> None:
    """异步软校验：复用非阻塞 DNS 防护，保留软保存与取消传播语义。"""
    if not api_endpoint:
        return
    try:
        from app.services.agents.endpoint_security import _assert_safe_endpoint_async

        await _assert_safe_endpoint_async(
            str(api_endpoint),
            allow_local_ollama=True,
            allow_trusted_internal=True,
        )
    except Exception:
        _log_endpoint_warning()


async def _warn_updated_endpoint(agent: AIAgent, update_data: Dict) -> None:
    """仅在本次更新了 api_endpoint 时做一次软校验（拆分以保持 update_agent 复杂度）。"""
    if "api_endpoint" in update_data:
        await warn_if_endpoint_unsafe_async(agent.api_endpoint)


from app.services.agents.agent_testing import (
    AgentProviderContext as _AgentProviderContext,
    build_provider_context as _build_provider_context,
    build_test_headers as _build_test_headers,
    display_test_message as _display_test_message,
    elapsed_ms as _elapsed_ms,
    join_api_url as _join_api_url,
    model_display_name as _model_display_name,
    resolve_provider_type as _resolve_provider_type,
    resolve_test_endpoint as _resolve_test_endpoint,
    test_basic_endpoint as _test_basic_endpoint,
    test_models_endpoint as _test_models_endpoint,
)

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
    
    await warn_if_endpoint_unsafe_async(api_endpoint)
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

    缓存注意事项（踩过的坑）：
    这里曾经直接把 ORM 实例放进 TTLCache。ORM 实例绑定在**创建它的那个
    session** 上，而 `get_db` 是请求级的——session 关闭后实例变成 detached；
    一旦该实例被 expire（例如同 session 内 commit/rollback 过，或对象被
    回收后 SQLAlchemy 需要重新加载属性），再读任何字段都会抛
    `DetachedInstanceError: Instance <AIAgent> is not bound to a Session`。

    生产实测症状：`POST /api/v1/ai-agents/stream` 3 次里 2 次 503
    「读取智能体配置失败」，堆栈落在 `build_messages` 读 `system_prompt`。

    现在缓存只存**普通属性字典**，命中时用它构造一个新的游离实例返回。
    返回值仍是 AIAgent 类型，调用方的字段访问全部不变，但不再与任何
    session 绑定，也就不可能 detached。
    """
    # 仅针对未删除的智能体使用缓存
    if not include_deleted and use_cache:
        cached = _AGENT_CACHE.get(agent_id)
        if cached:
            # 用快照重建游离实例：字段齐全、不绑定 session
            return AIAgent(**cached)

    query = select(AIAgent).where(AIAgent.id == agent_id)

    if not include_deleted:
        query = query.where(AIAgent.is_deleted == False)

    result = await db.execute(query)
    agent = result.scalar_one_or_none()

    # 写入缓存：只存列数据（用 SQLAlchemy 的 inspector 取已加载的列），
    # 不存 ORM 实例本身，避免把 session 生命周期带进进程级缓存。
    if agent and not include_deleted:
        from sqlalchemy import inspect as sa_inspect

        state = sa_inspect(agent)
        snapshot = {
            attr.key: getattr(agent, attr.key)
            for attr in state.mapper.column_attrs
        }
        _AGENT_CACHE[agent_id] = snapshot

    return agent



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

    await _warn_updated_endpoint(agent, update_data)

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

        # 测试连接同样会真实出站，按与对话路径相同的白名单规则硬校验。
        from app.services.agents.endpoint_security import assert_agent_outbound_endpoint

        if test_endpoint:
            await assert_agent_outbound_endpoint(str(test_endpoint))
        else:
            await assert_agent_outbound_endpoint(str(ctx.api_endpoint))

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

