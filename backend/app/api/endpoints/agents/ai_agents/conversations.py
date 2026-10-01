from typing import Optional, List, Dict, Any
import time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.deps import get_db, require_registered_user, require_admin
from app.schemas.agents import ConversationSummary, ConversationMessage
from app.services.agents import (
    list_user_conversations,
    get_conversation_messages,
    get_conversation_messages_admin,
)
from app.utils.cache import cache, compact_cache_key_generator

router = APIRouter()


@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    agent_id: Optional[int] = Query(None, description="智能体ID过滤；省略时返回本人全部智能体会话"),
    limit: int = Query(20, ge=1, le=100, description="每页会话数"),
    current_user: Dict[str, Any] = Depends(require_registered_user),
    db: AsyncSession = Depends(get_db),
):
    start_time = time.time()
    user_id = int(current_user["id"])

    # 构造缓存键（包含所有查询参数）
    cache_key = compact_cache_key_generator(
        "conversations:user",
        user_id,
        agent_id or 0,
        limit
    )

    # 尝试从缓存读取
    cache_hit = False
    try:
        cached = await cache.get(cache_key)
        if cached is not None:
            cache_hit = True
            logger.debug(f"会话列表缓存命中: user_id={user_id}, agent_id={agent_id}, limit={limit}")
            result = cached
        else:
            # 缓存未命中，查询数据库
            result = await list_user_conversations(db, user_id=user_id, agent_id=agent_id, limit=limit)

            # 写入缓存（TTL 60 秒）
            try:
                await cache.set(cache_key, result, expire_seconds=60)
                logger.debug(f"会话列表已缓存: user_id={user_id}, agent_id={agent_id}, limit={limit}")
            except Exception as e:
                logger.warning(f"Redis 缓存写入失败: {e}")
    except Exception as e:
        logger.warning(f"Redis 缓存读取失败，降级到数据库查询: {e}")
        result = await list_user_conversations(db, user_id=user_id, agent_id=agent_id, limit=limit)

    # 记录监控指标
    duration_ms = int((time.time() - start_time) * 1000)
    try:
        client = await cache.get_client()
        # 记录缓存命中/未命中
        if cache_hit:
            await client.incr("ai_agents:conversations:cache_hit")
        else:
            await client.incr("ai_agents:conversations:cache_miss")

        # 记录响应时间（保留最近 500 个样本）
        await client.lpush("ai_agents:conversations:dur_ms", duration_ms)
        await client.ltrim("ai_agents:conversations:dur_ms", 0, 499)
    except Exception:
        pass  # 监控指标失败不影响主业务

    return result


@router.get("/conversations/{session_id}", response_model=List[ConversationMessage])
async def get_conversation(
    session_id: str,
    current_user: Dict[str, Any] = Depends(require_registered_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(current_user["id"])
    return await get_conversation_messages(db, user_id=user_id, session_id=session_id)


@router.get("/admin/conversations/{session_id}", response_model=List[ConversationMessage])
async def get_conversation_admin(
    session_id: str,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await get_conversation_messages_admin(db, session_id=session_id)

