"""
测试智能体会话查询的安全性
验证学生无法访问其他学生的会话（横向越权防护）

使用与 test_conversation_list_isolated.py 相同的隔离测试模式
"""
import asyncio

from tests.ai_agents.test_conversation_list_isolated import conversation_client


def run(coro):
    return asyncio.run(coro)


def test_student_cannot_access_other_student_conversation():
    """
    测试学生无法通过枚举 session_id 访问其他学生的对话记录
    这是核心的横向越权防护测试
    """
    async def scenario():
        # 准备两个学生的会话数据
        student_a_rows = [
            (100, 11, 7, "student-a-session", "question", "学生A的问题", "2026-09-10 10:00:00"),
            (101, 11, 7, "student-a-session", "answer", "给学生A的回答", "2026-09-10 10:00:01"),
        ]
        student_b_rows = [
            (200, 99, 7, "student-b-session", "question", "学生B的问题", "2026-09-10 11:00:00"),
            (201, 99, 7, "student-b-session", "answer", "给学生B的回答", "2026-09-10 11:00:01"),
        ]

        extra_rows = student_a_rows + student_b_rows

        # 测试学生 A (user_id=11)
        async with conversation_client(user_id=11, extra_rows=extra_rows) as (client, _):
            # 学生 A 访问自己的会话 - 应该成功
            own_response = await client.get("/ai-agents/conversations/student-a-session")
            assert own_response.status_code == 200
            own_messages = own_response.json()
            assert len(own_messages) == 2, "学生 A 应该能看到自己的 2 条消息"
            assert all(m["user_id"] == 11 for m in own_messages), "所有消息应属于学生 A"

            # 学生 A 尝试访问学生 B 的会话 - 应该返回空列表（横向越权防护）
            foreign_response = await client.get("/ai-agents/conversations/student-b-session")
            assert foreign_response.status_code == 200
            foreign_messages = foreign_response.json()
            assert len(foreign_messages) == 0, "学生 A 不应该能访问学生 B 的会话，应返回空列表"

        # 测试学生 B (user_id=99)
        async with conversation_client(user_id=99, extra_rows=extra_rows) as (client, _):
            # 学生 B 访问自己的会话 - 应该成功
            own_response = await client.get("/ai-agents/conversations/student-b-session")
            assert own_response.status_code == 200
            own_messages = own_response.json()
            assert len(own_messages) == 2, "学生 B 应该能看到自己的 2 条消息"
            assert all(m["user_id"] == 99 for m in own_messages), "所有消息应属于学生 B"

            # 学生 B 尝试访问学生 A 的会话 - 应该返回空列表
            foreign_response = await client.get("/ai-agents/conversations/student-a-session")
            assert foreign_response.status_code == 200
            foreign_messages = foreign_response.json()
            assert len(foreign_messages) == 0, "学生 B 不应该能访问学生 A 的会话，应返回空列表"

    run(scenario())


def test_list_conversations_only_shows_own_sessions():
    """
    测试会话列表查询的隔离性
    确保学生只能看到自己的会话列表
    """
    async def scenario():
        extra_rows = [
            # 学生 A (user_id=11) 的会话
            (100, 11, 7, "session-a-1", "question", "学生A问题1", "2026-09-10 10:00:00"),
            (101, 11, 7, "session-a-2", "question", "学生A问题2", "2026-09-10 10:01:00"),
            # 学生 B (user_id=99) 的会话
            (200, 99, 7, "session-b-1", "question", "学生B问题1", "2026-09-10 11:00:00"),
        ]

        # 学生 A 应该只看到自己的 2 个会话
        async with conversation_client(user_id=11, extra_rows=extra_rows) as (client, _):
            response = await client.get("/ai-agents/conversations")
            assert response.status_code == 200
            conversations = response.json()
            # 包括 extra_rows 中学生 A 的 2 个会话 + 原始 fixture 中的 5 个会话
            student_a_sessions = [c for c in conversations if c["session_id"].startswith("session-a-")]
            assert len(student_a_sessions) == 2
            assert all(c["session_id"] in ["session-a-1", "session-a-2"] for c in student_a_sessions)
            # 不应该看到学生 B 的会话
            assert not any(c["session_id"].startswith("session-b-") for c in conversations)

        # 学生 B 应该只看到自己的 1 个会话
        async with conversation_client(user_id=99, extra_rows=extra_rows) as (client, _):
            response = await client.get("/ai-agents/conversations")
            assert response.status_code == 200
            conversations = response.json()
            # 包括 extra_rows 中学生 B 的 1 个会话 + 原始 fixture 中学生 99 的 1 个会话（"foreign"）
            student_b_new_sessions = [c for c in conversations if c["session_id"].startswith("session-b-")]
            assert len(student_b_new_sessions) == 1
            assert student_b_new_sessions[0]["session_id"] == "session-b-1"
            # 不应该看到学生 A 的会话
            assert not any(c["session_id"].startswith("session-a-") for c in conversations)

    run(scenario())
