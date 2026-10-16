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
from app.utils.cache import cache

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

    # 直接查库。此处的会话列表 Redis 缓存已于 2026-10-15 移除，原因：
    # 1. 缓存键只有 (user_id, agent_id, limit)，不含任何数据身份维度，
    #    同一用户在会话数据变化后会读到陈旧结果；
    # 2. PostgreSQL 下 last_at 是 datetime，cache.set 的 json.dumps 必然抛
    #    TypeError 并被静默吞掉，缓存写入 100% 失败——即生产上零收益；
    # 3. 归档任务与 GDPR 硬删除两条写路径没有缓存失效，删除后 60s 内仍会
    #    返回已删除数据，与隐私接口的承诺矛盾。
    # 要重新引入缓存，必须先解决上述三点（键维度 + 序列化 + 全部写路径失效）。
    result = await list_user_conversations(
        db, user_id=user_id, agent_id=agent_id, limit=limit
    )

    # 记录监控指标（响应时间），失败不影响主业务
    duration_ms = int((time.time() - start_time) * 1000)
    try:
        client = await cache.get_client()
        # 保留最近 500 个样本
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

