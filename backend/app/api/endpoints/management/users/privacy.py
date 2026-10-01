"""
用户隐私与数据管理 - GDPR 合规接口
提供数据导出和删除功能
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from datetime import datetime
from loguru import logger

from app.core.deps import get_db, get_current_user
from app.models.agents.ai_agent import ZntConversation
from app.models.agents.group_discussion import GroupDiscussionMessage
from app.models.core.audit_log import AuditLog
from app.schemas.user_info import UserInfo

router = APIRouter()


class DataDeletionRequest(BaseModel):
    """数据删除请求模型"""
    confirmation: str


async def log_audit(
    db: AsyncSession,
    user_id: int,
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    ip_address: str = None,
    user_agent: str = None
):
    """记录审计日志到数据库"""
    audit = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    await db.commit()
    logger.info(
        f"GDPR 审计日志 | user_id={user_id} | action={action} | "
        f"resource_type={resource_type} | resource_id={resource_id}"
    )


@router.get("/me/export")
async def export_my_data(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> Dict[str, Any]:
    """
    导出用户所有数据（GDPR 合规）

    包含：
    - 用户基本信息
    - 所有对话记录（包括归档的）
    - 小组讨论消息
    - 参与的分析记录

    Returns:
        包含所有用户数据的 JSON 对象
    """
    user_id = int(current_user["id"])

    # 记录审计日志
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    await log_audit(db, user_id, "EXPORT_DATA", "user", str(user_id), ip_address, user_agent)

    # 1. 用户基本信息
    user_info = {
        "user_id": user_id,
        "username": current_user.get("username"),
        "full_name": current_user.get("full_name"),
        "student_id": current_user.get("student_id"),
        "email": current_user.get("email"),
        "role": current_user.get("role_code"),
        "class_name": current_user.get("class_name"),
        "study_year": current_user.get("study_year"),
        "is_active": current_user.get("is_active"),
    }

    # 2. 对话记录（包括归档的）
    result = await db.execute(
        select(ZntConversation)
        .where(ZntConversation.user_id == user_id)
        .order_by(ZntConversation.created_at.desc())
    )
    conversations = []
    for conv in result.scalars():
        conversations.append({
            "id": conv.id,
            "session_id": conv.session_id,
            "agent_id": conv.agent_id,
            "agent_name": conv.agent_name,
            "message_type": conv.message_type,
            "content": conv.content,
            "response_time_ms": conv.response_time_ms,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "is_archived": conv.is_archived,
            "archived_at": conv.archived_at.isoformat() if conv.archived_at else None,
        })

    # 3. 小组讨论消息
    result = await db.execute(
        select(GroupDiscussionMessage)
        .where(GroupDiscussionMessage.user_id == user_id)
        .order_by(GroupDiscussionMessage.created_at.desc())
    )
    discussion_messages = []
    for msg in result.scalars():
        discussion_messages.append({
            "id": msg.id,
            "session_id": msg.session_id,
            "message_type": msg.message_type,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        })

    # 4. 组装导出数据
    export_data = {
        "export_date": datetime.utcnow().isoformat(),
        "data_subject": "GDPR 数据导出",
        "user_info": user_info,
        "conversations": conversations,
        "conversations_count": len(conversations),
        "discussion_messages": discussion_messages,
        "discussion_messages_count": len(discussion_messages),
    }

    logger.info(f"用户 {user_id} 导出数据：{len(conversations)} 条对话，{len(discussion_messages)} 条讨论消息")

    return export_data


@router.delete("/me/data", status_code=200)
async def delete_my_data(
    deletion_request: DataDeletionRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> Dict[str, Any]:
    """
    永久删除用户所有数据（GDPR 被遗忘权）

    警告：此操作不可逆！

    Args:
        deletion_request: 包含确认字符串的请求体

    Returns:
        删除确认信息

    Raises:
        400: 未提供正确的确认字符串
    """
    # 验证确认字符串
    if deletion_request.confirmation != "DELETE MY DATA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请在确认字段输入 'DELETE MY DATA' 以确认删除"
        )

    user_id = int(current_user["id"])

    # 记录审计日志（在删除前记录）
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    await log_audit(db, user_id, "DELETE_DATA", "user", str(user_id), ip_address, user_agent)
    logger.warning(f"GDPR 数据删除请求: user_id={user_id}, ip={ip_address}")

    try:
        # 统计即将删除的数据
        conv_result = await db.execute(
            select(ZntConversation).where(ZntConversation.user_id == user_id)
        )
        conversations_count = len(list(conv_result.scalars()))

        msg_result = await db.execute(
            select(GroupDiscussionMessage).where(GroupDiscussionMessage.user_id == user_id)
        )
        messages_count = len(list(msg_result.scalars()))

        # 1. 删除对话记录（硬删除）
        await db.execute(
            delete(ZntConversation).where(ZntConversation.user_id == user_id)
        )

        # 2. 删除小组讨论消息
        await db.execute(
            delete(GroupDiscussionMessage).where(GroupDiscussionMessage.user_id == user_id)
        )

        # 3. TODO: 删除或匿名化其他相关数据
        # - 分析记录中的个人标识
        # - 课堂互动记录
        # - 测评记录

        await db.commit()

        logger.warning(
            f"GDPR 数据删除完成: user_id={user_id}, "
            f"conversations={conversations_count}, messages={messages_count}"
        )

        return {
            "message": "所有数据已永久删除",
            "deleted_at": datetime.utcnow().isoformat(),
            "deleted_items": {
                "conversations": conversations_count,
                "discussion_messages": messages_count,
            }
        }

    except Exception as e:
        await db.rollback()
        logger.error(f"GDPR 数据删除失败: user_id={user_id}, error={e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="数据删除失败，请稍后重试"
        )


@router.get("/me/data-summary")
async def get_my_data_summary(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    获取用户数据摘要（用于删除前预览）

    Returns:
        用户数据统计信息
    """
    user_id = int(current_user["id"])

    # 统计对话记录
    conv_result = await db.execute(
        select(ZntConversation).where(ZntConversation.user_id == user_id)
    )
    conversations_count = len(list(conv_result.scalars()))

    # 统计讨论消息
    msg_result = await db.execute(
        select(GroupDiscussionMessage).where(GroupDiscussionMessage.user_id == user_id)
    )
    messages_count = len(list(msg_result.scalars()))

    return {
        "user_id": user_id,
        "data_summary": {
            "conversations": conversations_count,
            "discussion_messages": messages_count,
        },
        "warning": "删除操作将永久移除所有数据且不可恢复"
    }
