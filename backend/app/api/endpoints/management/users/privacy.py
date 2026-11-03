"""
用户隐私与数据管理 - GDPR 合规接口
提供数据导出和删除功能
"""

from typing import Dict, Any
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from pydantic import BaseModel
from datetime import datetime, timezone
from loguru import logger

from app.core.deps import get_db, get_current_user
from app.models.agents.ai_agent import ZntConversation
from app.models.agents.group_discussion import GroupDiscussionMessage
from app.models.core.audit_log import AuditLog
from app.models.core.user_consent import UserConsent
from app.schemas.user_info import UserInfo

router = APIRouter()

# 这两个接口只覆盖本人 AI 对话与小组讨论消息；其余业务域和备份不在范围内。
DATA_SCOPE = {
    "conversations": True,
    "discussion_messages": True,
    "account": False,
    "classroom": False,
    "learning": False,
    "assessment": False,
    "analysis": False,
    "backups": False,
}


class DataDeletionRequest(BaseModel):
    """数据删除请求模型"""
    confirmation: str


CONSENT_TYPES = ("AI_USAGE", "DATA_ANALYSIS")


class ConsentUpdate(BaseModel):
    """用户对某一类数据处理的同意状态。"""
    consented: bool


def _consent_type(value: str) -> str:
    if value not in CONSENT_TYPES:
        raise HTTPException(status_code=400, detail="不支持的同意类型")
    return value


def _consent_payload(consent_type: str, row: UserConsent | None) -> Dict[str, Any]:
    return {
        "consent_type": consent_type,
        "consented": bool(row.consented) if row is not None else None,
        "consented_at": row.consented_at.isoformat() if row and row.consented_at else None,
        "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
    }


async def _latest_consent(db: AsyncSession, user_id: int, consent_type: str) -> UserConsent | None:
    result = await db.execute(
        select(UserConsent)
        .where(UserConsent.user_id == user_id, UserConsent.consent_type == consent_type)
        .order_by(UserConsent.updated_at.desc(), UserConsent.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _set_consent_state(
    db: AsyncSession,
    user_id: int,
    consent_type: str,
    consented: bool,
    ip_address: str | None,
    user_agent: str | None,
) -> Dict[str, Any]:
    consent_type = _consent_type(consent_type)
    row = await _latest_consent(db, user_id, consent_type)
    now = datetime.now(timezone.utc)
    if row is None:
        row = UserConsent(
            user_id=user_id,
            consent_type=consent_type,
            consented=consented,
            consented_at=now,
            ip_address=ip_address,
            updated_at=now,
        )
        db.add(row)
    else:
        row.consented = consented
        row.consented_at = now
        row.ip_address = ip_address
        row.updated_at = now
    _audit_record(
        db, user_id,
        "CONSENT_GRANTED" if consented else "CONSENT_WITHDRAWN",
        "user_consent", consent_type, ip_address, user_agent,
    )
    await db.commit()
    await db.refresh(row)
    return _consent_payload(consent_type, row)


@router.get("/me/consents")
async def get_my_consents(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """返回允许自助管理的同意类型及当前状态；没有记录时为 null。"""
    user_id = int(current_user["id"])
    data = [
        _consent_payload(consent_type, await _latest_consent(db, user_id, consent_type))
        for consent_type in CONSENT_TYPES
    ]
    return {"success": True, "data": data}


@router.put("/me/consents/{consent_type}")
async def update_my_consent(
    consent_type: str,
    update: ConsentUpdate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> Dict[str, Any]:
    """写入同意或拒绝；同一用户/类型保留最新状态并记录审计。"""
    user_id = int(current_user["id"])
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    data = await _set_consent_state(
        db, user_id, consent_type, update.consented, ip_address, user_agent
    )
    return {"success": True, "data": data}


@router.delete("/me/consents/{consent_type}")
async def withdraw_my_consent(
    consent_type: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> Dict[str, Any]:
    """撤回同意（写入 consented=false），保留历史记录。"""
    user_id = int(current_user["id"])
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    data = await _set_consent_state(
        db, user_id, consent_type, False, ip_address, user_agent
    )
    return {"success": True, "data": data}


def _audit_record(
    db: AsyncSession,
    user_id: int,
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    ip_address: str = None,
    user_agent: str = None,
) -> None:
    db.add(AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
    ))


async def log_audit(
    db: AsyncSession,
    user_id: int,
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    ip_address: str = None,
    user_agent: str = None
):
    """记录并提交审计日志（请求/完成/失败事件各自独立提交）。"""
    _audit_record(db, user_id, action, resource_type, resource_id, ip_address, user_agent)
    await db.commit()
    logger.info(
        f"GDPR 审计日志 | user_id={user_id} | action={action} | "
        f"resource_type={resource_type} | resource_id={resource_id}"
    )


async def _log_failure(db: AsyncSession, user_id: int, action: str, operation_id: str,
                       ip_address: str = None, user_agent: str = None) -> None:
    """失败审计尽力写入；审计故障不能覆盖原始异常。"""
    try:
        await log_audit(
            db, user_id, action, "privacy_operation", operation_id,
            ip_address, user_agent,
        )
    except Exception as audit_error:
        logger.error(f"GDPR 失败审计写入失败: user_id={user_id}, error={audit_error}")


@router.get("/me/export")
async def export_my_data(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> Dict[str, Any]:
    """导出本人 AI 对话与小组讨论消息；明确标注不是全项目数据副本。"""
    user_id = int(current_user["id"])
    operation_id = uuid4().hex
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    await log_audit(
        db, user_id, "EXPORT_DATA_REQUESTED", "privacy_operation", operation_id,
        ip_address, user_agent,
    )

    try:
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

        result = await db.execute(
            select(ZntConversation)
            .where(ZntConversation.user_id == user_id)
            .order_by(ZntConversation.created_at.desc(), ZntConversation.id.desc())
        )
        conversations = [
            {
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
            }
            for conv in result.scalars()
        ]

        result = await db.execute(
            select(GroupDiscussionMessage)
            .where(GroupDiscussionMessage.user_id == user_id)
            .order_by(GroupDiscussionMessage.created_at.desc(), GroupDiscussionMessage.id.desc())
        )
        discussion_messages = [
            {
                "id": msg.id,
                "session_id": msg.session_id,
                "message_type": getattr(msg, "message_type", None),
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            }
            for msg in result.scalars()
        ]

        export_data = {
            "export_date": datetime.utcnow().isoformat(),
            "data_subject": "GDPR 数据导出（仅本人 AI 对话与小组讨论消息）",
            "operation_id": operation_id,
            "data_scope": DATA_SCOPE,
            "user_info": user_info,
            "conversations": conversations,
            "conversations_count": len(conversations),
            "discussion_messages": discussion_messages,
            "discussion_messages_count": len(discussion_messages),
        }
        await log_audit(
            db, user_id, "EXPORT_DATA_COMPLETED", "privacy_operation", operation_id,
            ip_address, user_agent,
        )
        logger.info(
            f"用户 {user_id} 导出数据：{len(conversations)} 条对话，"
            f"{len(discussion_messages)} 条讨论消息"
        )
        return export_data
    except Exception:
        await _log_failure(db, user_id, "EXPORT_DATA_FAILED", operation_id, ip_address, user_agent)
        raise


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
    operation_id = uuid4().hex
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    await log_audit(
        db, user_id, "DELETE_DATA_REQUESTED", "privacy_operation", operation_id,
        ip_address, user_agent,
    )
    logger.warning(f"GDPR 数据删除请求: user_id={user_id}, ip={ip_address}")

    try:
        # 删除与完成审计同事务提交；rowcount 是实际删除条数。
        conv_result = await db.execute(
            delete(ZntConversation).where(ZntConversation.user_id == user_id)
        )
        conversations_count = int(getattr(conv_result, "rowcount", 0) or 0)

        msg_result = await db.execute(
            delete(GroupDiscussionMessage).where(GroupDiscussionMessage.user_id == user_id)
        )
        messages_count = int(getattr(msg_result, "rowcount", 0) or 0)

        _audit_record(
            db, user_id, "DELETE_DATA_COMPLETED", "privacy_operation", operation_id,
            ip_address, user_agent,
        )
        await db.commit()

        logger.warning(
            f"GDPR 数据删除完成: user_id={user_id}, "
            f"conversations={conversations_count}, messages={messages_count}"
        )

        return {
            "message": "已删除本人 AI 对话与小组讨论消息；账号、课堂互动、学习进度、测评、分析结果及备份未包含。",
            "operation_id": operation_id,
            "data_scope": DATA_SCOPE,
            "deleted_at": datetime.utcnow().isoformat(),
            "deleted_items": {
                "conversations": conversations_count,
                "discussion_messages": messages_count,
            }
        }

    except Exception as e:
        await db.rollback()
        await _log_failure(
            db, user_id, "DELETE_DATA_FAILED", operation_id, ip_address, user_agent
        )
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

    conversations_count = int(await db.scalar(
        select(func.count()).select_from(ZntConversation).where(ZntConversation.user_id == user_id)
    ) or 0)
    messages_count = int(await db.scalar(
        select(func.count()).select_from(GroupDiscussionMessage).where(GroupDiscussionMessage.user_id == user_id)
    ) or 0)

    return {
        "user_id": user_id,
        "data_summary": {
            "conversations": conversations_count,
            "discussion_messages": messages_count,
        },
        "data_scope": DATA_SCOPE,
        "warning": "仅删除本人 AI 对话与小组讨论消息；账号、课堂互动、学习进度、测评、分析结果及备份不受影响。"
    }
