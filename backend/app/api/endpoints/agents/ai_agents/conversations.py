from typing import Optional, List, Dict, Any

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
    user_id = int(current_user["id"])

    # 构造缓存键（包含所有查询参数）
    cache_key = compact_cache_key_generator(
        "conversations:user",
        user_id,
        agent_id or 0,
        limit
    )

    # 尝试从缓存读取
    try:
        cached = await cache.get(cache_key)
        if cached is not None:
            logger.debug(f"会话列表缓存命中: user_id={user_id}, agent_id={agent_id}, limit={limit}")
            return cached
    except Exception as e:
        logger.warning(f"Redis 缓存读取失败，降级到数据库查询: {e}")

    # 缓存未命中，查询数据库
    result = await list_user_conversations(db, user_id=user_id, agent_id=agent_id, limit=limit)

    # 写入缓存（TTL 60 秒）
    try:
        await cache.set(cache_key, result, expire_seconds=60)
        logger.debug(f"会话列表已缓存: user_id={user_id}, agent_id={agent_id}, limit={limit}")
    except Exception as e:
        logger.warning(f"Redis 缓存写入失败: {e}")

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

