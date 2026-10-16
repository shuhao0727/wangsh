"""
GDPR 合规接口测试
测试数据导出和删除功能

隔离说明：
- 合成 SQLite（每例独立临时文件）+ ORM 建表，仅创建 znt_conversations /
  znt_group_discussion_messages / sys_audit_logs 三张表，不连接业务数据库。
- ASGI 内存 transport 驱动真实 privacy 路由；get_current_user / get_db
  由合成替身注入，不依赖真实 JWT 或外部服务。
"""

import pytest
from fastapi import FastAPI, HTTPException, Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.endpoints.management.users import privacy as privacy_api
from app.core.deps import get_current_user, get_db
from app.db.database import Base
from app.models.agents.ai_agent import ZntConversation
from app.models.agents.group_discussion import GroupDiscussionMessage
from app.models.core.audit_log import AuditLog

SYNTHETIC_TOKEN = "synthetic-gdpr-token"

_TABLES = [
    ZntConversation.__table__,
    GroupDiscussionMessage.__table__,
    AuditLog.__table__,
]


@pytest.fixture
def test_user() -> dict:
    """合成当前用户信息。"""
    return {
        "id": 4242,
        "username": "gdpr_user",
        "full_name": "GDPR 测试用户",
        "student_id": "S-2026-4242",
        "email": "gdpr@example.com",
        "role_code": "student",
        "class_name": "测试班",
        "study_year": 2026,
        "is_active": True,
    }


@pytest.fixture
def auth_headers() -> dict:
    return {"Authorization": f"Bearer {SYNTHETIC_TOKEN}"}


@pytest.fixture
async def engine(tmp_path):
    """合成 SQLite 引擎，仅创建 GDPR 相关三张表。"""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'gdpr_isolated.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(sync_conn, tables=_TABLES)
        )
    yield engine
    await engine.dispose()


@pytest.fixture
async def db(engine) -> AsyncSession:
    """测试侧 ORM 会话（与请求会话共享同一数据库文件）。"""
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
async def client(engine, test_user) -> AsyncClient:
    """ASGI 内存 client，注入合成身份与数据库依赖。"""
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def synthetic_db():
        async with factory() as session:
            yield session

    async def synthetic_current_user(request: Request) -> dict:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="未提供认证令牌")
        return test_user

    app = FastAPI()
    app.include_router(privacy_api.router, prefix="/api/users/privacy")
    app.dependency_overrides[get_db] = synthetic_db
    app.dependency_overrides[get_current_user] = synthetic_current_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://gdpr-isolated",
    ) as c:
        yield c


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
    response = await client.request(
        "DELETE",
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "WRONG"},
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
    response = await client.request(
        "DELETE",
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "DELETE MY DATA"},
    )
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "deleted_at" in data
    assert "deleted_items" in data

    # 验证数据已删除
    result = await db.execute(
        select(ZntConversation).where(ZntConversation.user_id == test_user["id"])
    )
    conversations = list(result.scalars())
    assert len(conversations) == 0


@pytest.mark.asyncio
async def test_delete_user_data_idempotent(client: AsyncClient, auth_headers: dict):
    """测试删除数据的幂等性（多次删除应该成功）"""
    # 第一次删除
    response1 = await client.request(
        "DELETE",
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "DELETE MY DATA"},
    )
    assert response1.status_code == 200

    # 第二次删除（数据已经没有了，但应该成功）
    response2 = await client.request(
        "DELETE",
        "/api/users/privacy/me/data",
        headers=auth_headers,
        json={"confirmation": "DELETE MY DATA"},
    )
    assert response2.status_code == 200


@pytest.mark.asyncio
async def test_export_includes_discussion_messages(
    client: AsyncClient, auth_headers: dict, test_user: dict, db: AsyncSession
):
    """测试导出包含小组讨论消息"""
    # 创建讨论消息
    # 注意：BigInteger 主键在 SQLite 下不自增，需显式给 id；
    # 模型列名为 user_display_name（无 user_name / message_type）。
    message = GroupDiscussionMessage(
        id=1,
        session_id=1,
        user_id=test_user["id"],
        user_display_name=test_user["full_name"],
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
