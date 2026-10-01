"""
GDPR 合规接口测试
测试数据导出和删除功能
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agents.ai_agent import ZntConversation
from app.models.agents.group_discussion import GroupDiscussionMessage


@pytest.mark.asyncio
async def test_export_user_data_unauthorized(client: AsyncClient):
    """测试未授权用户导出数据"""
    response = await client.get("/api/users/privacy/me/export")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_export_user_data(client: AsyncClient, auth_headers: dict, test_user: dict, db: AsyncSession):
    """测试数据导出"""
    # 创建一些测试数据
    conversation = ZntConversation(
        user_id=test_user["id"],
        user_name=test_user["full_name"],
        agent_id=1,
        agent_name="测试智能体",
        session_id="test-session-123",
        message_type="user",
        content="测试消息内容",
    )
    db.add(conversation)
    await db.commit()

    # 导出数据
    response = await client.get("/api/users/privacy/me/export", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert "user_info" in data
    assert "conversations" in data
    assert "export_date" in data
    assert data["user_info"]["user_id"] == test_user["id"]
    assert data["conversations_count"] >= 1


@pytest.mark.asyncio
async def test_get_data_summary(client: AsyncClient, auth_headers: dict, test_user: dict, db: AsyncSession):
    """测试数据摘要"""
    response = await client.get("/api/users/privacy/me/data-summary", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert "user_id" in data
    assert "data_summary" in data
    assert "warning" in data
    assert data["user_id"] == test_user["id"]


@pytest.mark.asyncio
async def test_delete_user_data_without_confirmation(client: AsyncClient, auth_headers: dict):
    """测试删除数据（无确认）"""
    response = await client.delete(
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "WRONG"}
    )
    assert response.status_code == 400
    assert "DELETE MY DATA" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_user_data_with_confirmation(
    client: AsyncClient, auth_headers: dict, test_user: dict, db: AsyncSession
):
    """测试删除数据（有确认）"""
    # 创建测试数据
    conversation = ZntConversation(
        user_id=test_user["id"],
        user_name=test_user["full_name"],
        agent_id=1,
        agent_name="测试智能体",
        session_id="test-session-456",
        message_type="user",
        content="将被删除的消息",
    )
    db.add(conversation)
    await db.commit()

    # 删除数据
    response = await client.delete(
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "DELETE MY DATA"}
    )
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "deleted_at" in data
    assert "deleted_items" in data

    # 验证数据已删除
    from sqlalchemy import select
    result = await db.execute(
        select(ZntConversation).where(ZntConversation.user_id == test_user["id"])
    )
    conversations = list(result.scalars())
    assert len(conversations) == 0


@pytest.mark.asyncio
async def test_delete_user_data_idempotent(client: AsyncClient, auth_headers: dict):
    """测试删除数据的幂等性（多次删除应该成功）"""
    # 第一次删除
    response1 = await client.delete(
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "DELETE MY DATA"}
    )
    assert response1.status_code == 200

    # 第二次删除（数据已经没有了，但应该成功）
    response2 = await client.delete(
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "DELETE MY DATA"}
    )
    assert response2.status_code == 200


@pytest.mark.asyncio
async def test_export_includes_discussion_messages(
    client: AsyncClient, auth_headers: dict, test_user: dict, db: AsyncSession
):
    """测试导出包含小组讨论消息"""
    # 创建讨论消息
    message = GroupDiscussionMessage(
        session_id="discussion-session-123",
        user_id=test_user["id"],
        user_name=test_user["full_name"],
        message_type="student",
        content="讨论消息内容",
    )
    db.add(message)
    await db.commit()

    # 导出数据
    response = await client.get("/api/users/privacy/me/export", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert "discussion_messages" in data
    assert data["discussion_messages_count"] >= 1
    assert any(msg["content"] == "讨论消息内容" for msg in data["discussion_messages"])
