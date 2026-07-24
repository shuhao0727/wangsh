"""
初级画像服务测试
覆盖：generate_basic_profile、get_basic_profile
"""
import asyncio
import json
import os
import re
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.database import Base
from app.models import User
from app.models.agents import AIAgent, GroupDiscussionSession
from app.models.assessment import AssessmentConfig, AssessmentSession, StudentProfile
from app.schemas.assessment.profile import ProfileGenerateRequest
from app.services.assessment.basic_profile_service import (
    generate_basic_profile,
    get_basic_profile,
)
from app.services.assessment.profile_service import generate_profile


_TEST_DATABASE_NAME_RE = re.compile(r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])")


def _assessment_integration_database_url() -> str:
    explicit_url = os.environ.get("TEST_DATABASE_URL", "").strip()
    database_url = explicit_url or str(settings.DATABASE_URL or "")
    if not database_url:
        pytest.skip("Assessment PostgreSQL integration test has no database URL")

    parsed = make_url(database_url)
    database_name = (parsed.database or "").lower()
    if not parsed.drivername.startswith("postgresql"):
        pytest.skip("Assessment SQL isolation regression requires PostgreSQL")
    if not _TEST_DATABASE_NAME_RE.search(database_name):
        message = (
            "Assessment SQL isolation regression requires a database name containing "
            "'test', 'testing', or 'ci'"
        )
        if explicit_url:
            pytest.fail(message)
        pytest.skip(f"{message}; set TEST_DATABASE_URL to a dedicated test database")

    host = (parsed.host or "").lower()
    if not explicit_url and host not in {"127.0.0.1", "localhost", "::1"}:
        pytest.skip(
            "Non-local Assessment integration databases require explicit TEST_DATABASE_URL"
        )
    return database_url


def _make_question(knowledge_point="变量", correct_answer="A"):
    return SimpleNamespace(
        id=1, knowledge_point=knowledge_point,
        content="题目", correct_answer=correct_answer,
    )


def _make_answer(ai_score=8, max_score=10, is_correct=True,
                 question=None, question_id=1, student_answer="A"):
    return SimpleNamespace(
        id=1, ai_score=ai_score, max_score=max_score,
        is_correct=is_correct, question=question or _make_question(),
        question_id=question_id, student_answer=student_answer,
    )


def _make_session(id=1, user_id=100, config_id=1, earned_score=80,
                  total_score=100, answers=None, user=None):
    return SimpleNamespace(
        id=id, user_id=user_id, config_id=config_id,
        earned_score=earned_score, total_score=total_score,
        answers=answers or [], user=user,
    )


def _make_config(agent_id=1, subject="信息技术", title="测试检测"):
    return SimpleNamespace(
        id=1, agent_id=agent_id, subject=subject, title=title,
    )


class MockScalarResult:
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values or []

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._values

    def one_or_none(self):
        return self._value


def _make_db(execute_side_effects=None):
    db = AsyncMock()
    if execute_side_effects:
        db.execute.side_effect = execute_side_effects
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


# ─── get_basic_profile ───


def test_get_basic_profile_found():
    profile = SimpleNamespace(id=1, session_id=10)
    db = _make_db([MockScalarResult(profile)])
    result = asyncio.run(get_basic_profile(db, session_id=10))
    assert result.id == 1


def test_get_basic_profile_not_found():
    db = _make_db([MockScalarResult(None)])
    result = asyncio.run(get_basic_profile(db, session_id=999))
    assert result is None


# ─── generate_basic_profile ───


def test_generate_basic_profile_already_exists():
    """已存在画像时直接返回"""
    existing = SimpleNamespace(id=5, session_id=1)
    db = _make_db([MockScalarResult(existing)])

    session = _make_session()
    config = _make_config()
    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is existing  # 直接返回已存在的画像


@patch("app.services.agents.chat_blocking.run_agent_chat_blocking")
def test_generate_basic_profile_creates_new(mock_ai):
    """正常生成新画像"""
    mock_ai.return_value = "你在变量方面掌握不错，循环需要加强。"

    q1 = _make_question(knowledge_point="变量")
    q2 = _make_question(knowledge_point="循环")
    a1 = _make_answer(ai_score=10, max_score=10, is_correct=True, question=q1)
    a2 = _make_answer(ai_score=3, max_score=10, is_correct=False, question=q2)

    session = _make_session(answers=[a1, a2], earned_score=13, total_score=20)
    config = _make_config(agent_id=1)

    db = _make_db([
        MockScalarResult(None),  # no existing profile
        MockScalarResult("张三"),  # user full_name query
    ])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None
    assert db.add.called
    assert db.flush.called
    assert mock_ai.called

    # 验证 AI 被调用时 prompt 包含关键信息
    call_args = mock_ai.call_args
    prompt = call_args[1].get("message", "") or call_args[0][2] if len(call_args[0]) > 2 else ""
    # prompt 应包含学科和得分信息


@patch("app.services.agents.chat_blocking.run_agent_chat_blocking")
def test_generate_basic_profile_ai_failure(mock_ai):
    """AI 调用失败时仍然创建画像"""
    mock_ai.side_effect = Exception("AI 服务不可用")

    session = _make_session(answers=[], earned_score=0, total_score=100)
    config = _make_config(agent_id=1)

    db = _make_db([
        MockScalarResult(None),          # no existing profile
        MockScalarResult(values=[]),     # load answers (empty)
        MockScalarResult("同学"),        # user full_name query
    ])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None
    assert db.add.called


def test_generate_basic_profile_no_agent():
    """未配置 agent_id 时不调用 AI"""
    session = _make_session(answers=[], earned_score=0, total_score=100)
    config = _make_config(agent_id=None)

    db = _make_db([
        MockScalarResult(None),          # no existing profile
        MockScalarResult(values=[]),     # load answers (empty)
        MockScalarResult("同学"),        # user full_name query
    ])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None
    assert db.add.called


def test_generate_basic_profile_knowledge_aggregation():
    """验证知识点聚合逻辑"""
    q1 = _make_question(knowledge_point="变量")
    q2 = _make_question(knowledge_point="变量")
    q3 = _make_question(knowledge_point="循环")
    a1 = _make_answer(ai_score=10, max_score=10, is_correct=True, question=q1)
    a2 = _make_answer(ai_score=5, max_score=10, is_correct=False, question=q2)
    a3 = _make_answer(ai_score=0, max_score=10, is_correct=False, question=q3)

    session = _make_session(answers=[a1, a2, a3], earned_score=15, total_score=30)
    config = _make_config(agent_id=None)

    db = _make_db([MockScalarResult(None), MockScalarResult("同学")])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None

    # 检查 add 被调用时传入的 profile 对象
    added_obj = db.add.call_args[0][0]
    kp_scores = json.loads(added_obj.knowledge_scores)
    assert kp_scores["变量"]["earned"] == 15  # 10 + 5
    assert kp_scores["变量"]["total"] == 20   # 10 + 10
    assert kp_scores["循环"]["earned"] == 0
    assert kp_scores["循环"]["total"] == 10

    wrong = json.loads(added_obj.wrong_points)
    assert "变量" in wrong
    assert "循环" in wrong

    # 注：_collect_class_data 是内部实现，不再直接测试
    # 其逻辑通过 generate_class_profile 等公共 API 间接验证


@patch(
    "app.services.agents.chat_blocking.run_agent_chat_blocking",
    new_callable=AsyncMock,
)
def test_generate_class_profile_isolates_students_by_class(mock_ai):
    """公共入口必须让真实 SQL 查询隔离目标班级的 graded sessions。"""
    mock_ai.return_value = """班级画像
```json
{"dimensions": {"知识掌握": 80}}
```"""

    async def run():
        database_url = _assessment_integration_database_url()
        schema = f"test_assessment_profile_{uuid4().hex}"
        admin_engine = create_async_engine(database_url)
        async with admin_engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))

        engine = create_async_engine(
            database_url,
            connect_args={
                "server_settings": {
                    "search_path": f"{schema},public",
                }
            },
        )
        Session = async_sessionmaker(engine, expire_on_commit=False)

        try:
            async with engine.begin() as connection:
                await connection.run_sync(
                    lambda sync_connection: Base.metadata.create_all(
                        sync_connection,
                        tables=[
                            User.__table__,
                            AIAgent.__table__,
                            AssessmentConfig.__table__,
                            AssessmentSession.__table__,
                            GroupDiscussionSession.__table__,
                            StudentProfile.__table__,
                        ],
                        checkfirst=False,
                    )
                )

            async with Session() as db:
                teacher = User(
                    full_name="画像教师",
                    role_code="teacher",
                    is_active=True,
                    is_deleted=False,
                )
                in_class_a = User(
                    full_name="班内学生甲",
                    student_id=f"in-a-{uuid4().hex}",
                    class_name="高一(1)班",
                    role_code="student",
                    is_active=True,
                    is_deleted=False,
                )
                in_class_b = User(
                    full_name="班内学生乙",
                    student_id=f"in-b-{uuid4().hex}",
                    class_name="高一(1)班",
                    role_code="student",
                    is_active=True,
                    is_deleted=False,
                )
                outside_student = User(
                    full_name="班外学生",
                    student_id=f"out-{uuid4().hex}",
                    class_name="高一(2)班",
                    role_code="student",
                    is_active=True,
                    is_deleted=False,
                )
                same_class_teacher = User(
                    full_name="同班教师",
                    class_name="高一(1)班",
                    role_code="teacher",
                    is_active=True,
                    is_deleted=False,
                )
                deleted_student = User(
                    full_name="已删除学生",
                    student_id=f"deleted-{uuid4().hex}",
                    class_name="高一(1)班",
                    role_code="student",
                    is_active=False,
                    is_deleted=True,
                )
                agent = AIAgent(
                    name="画像回归测试智能体",
                    agent_type="custom",
                    is_active=True,
                    is_deleted=False,
                )
                db.add_all(
                    [
                        teacher,
                        in_class_a,
                        in_class_b,
                        outside_student,
                        same_class_teacher,
                        deleted_student,
                        agent,
                    ]
                )
                await db.flush()

                config = AssessmentConfig(
                    title="Python 基础",
                    total_score=100,
                    agent_id=agent.id,
                    enabled=True,
                    created_by_user_id=teacher.id,
                )
                db.add(config)
                await db.flush()

                db.add_all(
                    [
                        AssessmentSession(
                            config_id=config.id,
                            user_id=in_class_a.id,
                            status="graded",
                            total_score=100,
                            earned_score=90,
                        ),
                        AssessmentSession(
                            config_id=config.id,
                            user_id=in_class_b.id,
                            status="graded",
                            total_score=100,
                            earned_score=70,
                        ),
                        AssessmentSession(
                            config_id=config.id,
                            user_id=outside_student.id,
                            status="graded",
                            total_score=100,
                            earned_score=1,
                        ),
                        AssessmentSession(
                            config_id=config.id,
                            user_id=deleted_student.id,
                            status="graded",
                            total_score=100,
                            earned_score=2,
                        ),
                        AssessmentSession(
                            config_id=config.id,
                            user_id=in_class_a.id,
                            status="submitted",
                            total_score=100,
                            earned_score=100,
                        ),
                    ]
                )
                await db.commit()

                request = ProfileGenerateRequest(
                    profile_type="class",
                    target_id="高一(1)班",
                    config_id=config.id,
                    agent_id=agent.id,
                )
                profile = await generate_profile(db, request, user_id=teacher.id)

                assert profile.id is not None
                assert profile.profile_type == "class"
                assert profile.target_id == "高一(1)班"
        finally:
            await engine.dispose()
            async with admin_engine.begin() as connection:
                await connection.execute(
                    text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
                )
            await admin_engine.dispose()

    asyncio.run(run())

    prompt = mock_ai.await_args.kwargs["message"]
    assert "【班级】高一(1)班（共 2 人）" in prompt
    assert "平均分：80.0/100" in prompt
    assert "最高分：90，最低分：70" in prompt
    assert "通过率（≥60%）：2/2 (100%)" in prompt
    assert "班外学生" not in prompt
    assert "平均分：40.8/100" not in prompt
