from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_user, require_admin
from app.schemas.agents import ConversationSummary, ConversationMessage
from app.services.agents import (
    list_user_conversations,
    get_conversation_messages,
    get_conversation_messages_admin,
)

router = APIRouter()


@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    agent_id: Optional[int] = Query(None, description="智能体ID过滤"),
    limit: int = Query(20, ge=1, le=100, description="每页会话数"),
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(current_user["id"])
    return await list_user_conversations(db, user_id=user_id, agent_id=agent_id, limit=limit)


@router.get("/conversations/{session_id}", response_model=List[ConversationMessage])
async def get_conversation(
    session_id: str,
    current_user: Dict[str, Any] = Depends(require_user),
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

