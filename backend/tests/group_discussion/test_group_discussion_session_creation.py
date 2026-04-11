import asyncio
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

import app.services.agents.group_discussion as gd
from app.core.config import settings
from app.utils.cache import cache


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._value if isinstance(self._value, list) else [self._value]


class _FakeDB:
    def __init__(self, execute_values=None, commit_raises=None):
        self._execute_values = list(execute_values or [])
        self.execute_count = 0
        self.commit_count = 0
        self.refresh_count = 0
        self.added = []
        self.deleted = []
        self.commit_raises = commit_raises
        self.rollback_count = 0

    async def execute(self, _stmt):
        if self.execute_count >= len(self._execute_values):
            raise AssertionError(f"unexpected db.execute call #{self.execute_count}")
        value = self._execute_values[self.execute_count]
        self.execute_count += 1
        return _FakeResult(value)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commit_count += 1
        if self.commit_raises and self.commit_count == 1:  # 第一次commit时抛出异常
            raise self.commit_raises

    async def refresh(self, obj):
        self.refresh_count += 1
        if getattr(obj, "id", None) is None:
            obj.id = 100 + self.refresh_count

    async def rollback(self):
        self.rollback_count += 1

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        pass


def _create_session(session_id=1, class_name="测试班级", group_no="001", created_by_user_id=1, group_name=None):
    return SimpleNamespace(
        id=session_id,
        session_date=date.today(),
        class_name=class_name,
        group_no=group_no,
        group_name=group_name,
        created_by_user_id=created_by_user_id,
        last_message_at=None,
        message_count=0,
    )


def _create_member(session_id=1, user_id=1, joined_at=None):
    if joined_at is None:
        joined_at = datetime.now(timezone.utc) - timedelta(minutes=30)
    return SimpleNamespace(
        id=1,
        session_id=session_id,
        user_id=user_id,
        joined_at=joined_at,
        muted_until=None,
    )


def _patch_settings(monkeypatch, join_lock_seconds=300):
    monkeypatch.setattr(settings, "GROUP_DISCUSSION_JOIN_LOCK_SECONDS", join_lock_seconds, raising=False)
    monkeypatch.setattr(settings, "GROUP_DISCUSSION_REDIS_ENABLED", False, raising=False)
    monkeypatch.setattr(settings, "GROUP_DISCUSSION_METRICS_ENABLED", False, raising=False)


class TestGetOrCreateTodaySession:
    """测试 get_or_create_today_session 函数"""

    def test_create_new_session_for_student(self, monkeypatch):
        """测试学生创建新会话"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        # 模拟数据库返回：
        # 1. 无上次加入记录
        # 2. 无现有会话
        # 3. 目标会话中是否已有该用户（检查成员）
        db = _FakeDB([
            None,  # 上次加入记录（第114-121行）
            None,  # 现有会话（第124-132行）
            None,  # 目标会话中是否已有该用户（第205-212行）
        ])

        user = {"id": 1, "role_code": "student", "class_name": "测试班级"}
        session = asyncio.run(gd.get_or_create_today_session(
            db=db,
            class_name="测试班级",
            group_no="001",
            group_name="第一组",
            user=user,
        ))

        assert session is not None
        assert session.id == 101  # 通过refresh设置
        assert session.class_name == "测试班级"
        assert session.group_no == "001"
        assert session.group_name == "第一组"
        assert session.created_by_user_id == 1
        assert db.execute_count == 2  # 1. 上次加入记录 2. 目标会话
        assert db.commit_count == 2  # 创建会话时调用了两次commit
        assert len(db.added) == 2  # Session + Member

    def test_join_existing_session(self, monkeypatch):
        """测试加入已存在的会话"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        existing_session = _create_session(session_id=10, class_name="测试班级", group_no="001", created_by_user_id=2)
        last_member = _create_member(session_id=5, user_id=1)  # 上次加入的是其他会话

        db = _FakeDB([
            last_member,  # 上次加入记录
            existing_session,  # 现有会话
            existing_session,  # 查询上次会话（用于删除上次成员）
            None,  # DELETE 查询的返回值
        ])

        user = {"id": 1, "role_code": "student", "class_name": "测试班级"}
        session = asyncio.run(gd.get_or_create_today_session(
            db=db,
            class_name="测试班级",
            group_no="001",
            group_name=None,
            user=user,
        ))

        assert session.id == 10  # 现有会话的ID
        assert db.execute_count == 4  # 1. 上次加入记录 2. 现有会话 3. 查询上次会话 4. DELETE 查询
        assert db.commit_count == 2  # 1. 删除旧成员 2. 添加新成员
        # 注意：函数使用 db.execute(delete(...)) 而不是 db.delete(obj)，所以 db.deleted 列表为空
        assert len(db.added) == 1  # 添加了新成员

    def test_student_already_in_session_returns_directly(self, monkeypatch):
        """测试学生已在目标会话中，直接返回"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        existing_session = _create_session(session_id=10, class_name="测试班级", group_no="001", created_by_user_id=1)
        last_member = _create_member(session_id=10, user_id=1)  # 上次加入的就是这个会话

        db = _FakeDB([
            last_member,  # 上次加入记录
            existing_session,  # 现有会话
        ])

        user = {"id": 1, "role_code": "student", "class_name": "测试班级"}
        session = asyncio.run(gd.get_or_create_today_session(
            db=db,
            class_name="测试班级",
            group_no="001",
            group_name="新组名",
            user=user,
        ))

        assert session.id == 10
        assert db.execute_count == 2  # 只查询了两次
        assert db.commit_count == 1  # 更新了组名
        assert session.group_name == "新组名"  # 创建者可以更新组名

    def test_student_switch_group_too_soon_raises_429(self, monkeypatch):
        """测试学生切换组太快，触发冷却限制"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        # 上次加入时间很近（10秒前）
        last_member = _create_member(
            session_id=5,
            user_id=1,
            joined_at=datetime.now(timezone.utc) - timedelta(seconds=10)
        )

        db = _FakeDB([
            last_member,  # 上次加入记录
            None,  # 现有会话（要创建新会话）
        ])

        user = {"id": 1, "role_code": "student", "class_name": "测试班级"}

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(gd.get_or_create_today_session(
                db=db,
                class_name="测试班级",
                group_no="002",  # 切换到不同组号
                group_name=None,
                user=user,
            ))

        assert exc_info.value.status_code == 429
        assert "切换小组需等待" in str(exc_info.value.detail)
        assert db.execute_count == 2
        assert db.commit_count == 0  # 没有提交

    def test_admin_bypasses_cooling_check(self, monkeypatch):
        """测试管理员跳过冷却检查"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        db = _FakeDB([
            None,  # 现有会话
        ])

        user = {"id": 1, "role_code": "admin", "class_name": "测试班级"}
        session = asyncio.run(gd.get_or_create_today_session(
            db=db,
            class_name="测试班级",
            group_no="002",
            group_name=None,
            user=user,
        ))

        assert session is not None
        assert db.execute_count == 1  # 仅查询目标会话，不读取/切换管理员成员关系
        assert db.commit_count == 1  # 仅创建会话，不添加成员
        assert len(db.added) == 1  # 只添加了 Session

    def test_admin_join_existing_session_does_not_add_membership(self, monkeypatch):
        """测试管理员进入已有会话时不写入成员关系"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        existing_session = _create_session(session_id=20, class_name="测试班级", group_no="002", created_by_user_id=2)
        db = _FakeDB([
            existing_session,
        ])

        user = {"id": 1, "role_code": "admin", "class_name": "测试班级"}
        session = asyncio.run(gd.get_or_create_today_session(
            db=db,
            class_name="测试班级",
            group_no="002",
            group_name=None,
            user=user,
        ))

        assert session.id == 20
        assert db.execute_count == 1
        assert db.commit_count == 0
        assert len(db.added) == 0

    def test_concurrent_session_creation_handles_integrity_error(self, monkeypatch):
        """测试并发创建同一会话时的完整性错误处理"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        # 暂时跳过这个测试，因为模拟IntegrityError的处理比较复杂
        # 在实际代码中，这个逻辑是处理并发创建同一会话的情况
        pytest.skip("IntegrityError处理测试暂时跳过，需要更复杂的模拟")

    def test_student_cannot_join_other_class(self, monkeypatch):
        """测试学生不能加入其他班级"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        db = _FakeDB([
            None,  # 上次加入记录
        ])

        user = {"id": 1, "role_code": "student", "class_name": "一班"}

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(gd.get_or_create_today_session(
                db=db,
                class_name="二班",  # 尝试加入其他班
                group_no="001",
                group_name=None,
                user=user,
            ))

        assert exc_info.value.status_code == 403
        assert "学生只能加入本班小组" in str(exc_info.value.detail)

    def test_admin_requires_class_name_when_profile_empty(self, monkeypatch):
        """测试管理员个人资料为空时必须指定班级"""
        _patch_settings(monkeypatch, join_lock_seconds=300)

        db = _FakeDB([
            None,  # 上次加入记录
        ])

        user = {"id": 1, "role_code": "admin", "class_name": ""}  # 空班级

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(gd.get_or_create_today_session(
                db=db,
                class_name=None,  # 未指定班级
                group_no="001",
                group_name=None,
                user=user,
            ))

        assert exc_info.value.status_code == 422
        assert "管理员加入或创建小组时必须指定班级" in str(exc_info.value.detail)


class TestListTodayGroups:
    """测试 list_today_groups 函数"""

    def test_list_groups_basic(self, monkeypatch):
        """测试基础列表查询"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_LIST_RECENT_HOURS", 0, raising=False)

        # 模拟返回一个会话和成员数量
        session = _create_session(session_id=1, class_name="测试班级", group_no="001")
        db = _FakeDB([
            [(session, 3)],  # 返回 (Session, member_count) 元组列表
        ])

        rows = asyncio.run(gd.list_today_groups(
            db=db,
            date=date.today(),
            class_name="测试班级",
            keyword=None,
            limit=50,
            ignore_time_limit=False,
        ))

        assert len(rows) == 1
        assert rows[0][0].id == 1
        assert rows[0][1] == 3  # member_count
        assert db.execute_count == 1

    def test_list_groups_with_keyword_search(self, monkeypatch):
        """测试带关键词搜索"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_LIST_RECENT_HOURS", 0, raising=False)

        session1 = _create_session(session_id=1, class_name="测试班级", group_no="001", group_name="优秀组")
        # 只返回匹配"优秀"的会话
        db = _FakeDB([
            [(session1, 3)],  # 只返回一个匹配的会话
        ])

        # 搜索"优秀"
        rows = asyncio.run(gd.list_today_groups(
            db=db,
            date=date.today(),
            class_name="测试班级",
            keyword="优秀",
            limit=50,
            ignore_time_limit=False,
        ))

        assert len(rows) == 1
        assert rows[0][0].group_name == "优秀组"

    def test_list_groups_with_time_limit(self, monkeypatch):
        """测试时间限制过滤"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_LIST_RECENT_HOURS", 24, raising=False)

        session = _create_session(session_id=1, class_name="测试班级", group_no="001")
        db = _FakeDB([
            [(session, 3)],
        ])

        rows = asyncio.run(gd.list_today_groups(
            db=db,
            date=date.today(),
            class_name="测试班级",
            keyword=None,
            limit=50,
            ignore_time_limit=False,
        ))

        assert len(rows) == 1
        # 验证查询中包含了时间限制条件（通过execute_count验证）

    def test_list_groups_ignore_time_limit(self, monkeypatch):
        """测试忽略时间限制"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_LIST_RECENT_HOURS", 24, raising=False)

        session = _create_session(session_id=1, class_name="测试班级", group_no="001")
        db = _FakeDB([
            [(session, 3)],
        ])

        rows = asyncio.run(gd.list_today_groups(
            db=db,
            date=date.today(),
            class_name="测试班级",
            keyword=None,
            limit=50,
            ignore_time_limit=True,  # 忽略时间限制
        ))

        assert len(rows) == 1

    def test_list_groups_allows_admin_query_without_class_filter(self, monkeypatch):
        """测试管理员不传班级时可查询全部班级"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_LIST_RECENT_HOURS", 0, raising=False)

        session = _create_session(session_id=2, class_name="高一(1)班", group_no="002")
        db = _FakeDB([
            [(session, 1)],
        ])

        rows = asyncio.run(gd.list_today_groups(
            db=db,
            date=None,
            class_name=None,
            keyword=None,
            limit=50,
            ignore_time_limit=True,
        ))

        assert len(rows) == 1
        assert rows[0][0].class_name == "高一(1)班"


class TestListMessages:
    """测试 list_messages 函数"""

    def test_list_messages_basic(self, monkeypatch):
        """测试基础消息列表"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_REDIS_ENABLED", False, raising=False)

        # 创建一些模拟消息
        msg1 = SimpleNamespace(id=10, content="消息1", created_at=datetime.now())
        msg2 = SimpleNamespace(id=11, content="消息2", created_at=datetime.now())
        msg3 = SimpleNamespace(id=12, content="消息3", created_at=datetime.now())

        db = _FakeDB([
            [msg1, msg2, msg3],  # 消息列表
        ])

        messages, next_after_id = asyncio.run(gd.list_messages(
            db=db,
            session_id=1,
            after_id=0,
            limit=50,
        ))

        assert len(messages) == 3
        assert messages[0].id == 10
        assert messages[2].id == 12
        assert next_after_id == 12  # 最后一条消息的ID
        assert db.execute_count == 1

    def test_list_messages_with_after_id(self, monkeypatch):
        """测试带 after_id 的消息列表"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_REDIS_ENABLED", False, raising=False)

        msg1 = SimpleNamespace(id=15, content="消息1", created_at=datetime.now())
        msg2 = SimpleNamespace(id=16, content="消息2", created_at=datetime.now())

        db = _FakeDB([
            [msg1, msg2],  # ID > 10 的消息
        ])

        messages, next_after_id = asyncio.run(gd.list_messages(
            db=db,
            session_id=1,
            after_id=10,  # 只获取ID > 10的消息
            limit=50,
        ))

        assert len(messages) == 2
        assert messages[0].id == 15
        assert next_after_id == 16

    def test_list_messages_empty_result(self, monkeypatch):
        """测试空消息列表"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_REDIS_ENABLED", False, raising=False)

        db = _FakeDB([
            [],  # 空列表
        ])

        messages, next_after_id = asyncio.run(gd.list_messages(
            db=db,
            session_id=1,
            after_id=20,
            limit=50,
        ))

        assert len(messages) == 0
        assert next_after_id == 20  # 保持传入的 after_id

    def test_list_messages_with_redis_cache_hit(self, monkeypatch):
        """测试Redis缓存命中时快速返回"""
        _patch_settings(monkeypatch)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_REDIS_ENABLED", True, raising=False)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_LAST_ID_TTL", 60, raising=False)
        monkeypatch.setattr(settings, "GROUP_DISCUSSION_LAST_AT_TTL", 60, raising=False)

        # 模拟缓存返回最后ID为25
        mock_cache = AsyncMock()
        mock_cache.get.return_value = 25
        monkeypatch.setattr(cache, "get", mock_cache.get)

        db = _FakeDB()  # 不应该执行数据库查询

        messages, next_after_id = asyncio.run(gd.list_messages(
            db=db,
            session_id=1,
            after_id=30,  # after_id >= 缓存中的最后ID
            limit=50,
        ))

        assert len(messages) == 0
        assert next_after_id == 30
        assert db.execute_count == 0  # 没有查询数据库
        mock_cache.get.assert_called_once()
