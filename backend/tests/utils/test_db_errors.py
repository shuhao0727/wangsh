"""
数据库错误处理工具测试
"""

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.utils.db_errors import handle_db_commit

Base = declarative_base()


class TestModel(Base):
    __tablename__ = "test_model"
    id = Column(Integer, primary_key=True)
    unique_field = Column(String(50), unique=True, nullable=False)


@pytest.fixture
async def db_session():
    """创建测试数据库会话"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.mark.anyio
async def test_handle_db_commit_success(db_session):
    """测试成功的数据库提交"""
    obj = TestModel(id=1, unique_field="test1")
    db_session.add(obj)

    async with handle_db_commit(db_session):
        await db_session.commit()

    # 验证对象已保存
    await db_session.refresh(obj)
    assert obj.id == 1


@pytest.mark.anyio
async def test_handle_db_commit_integrity_error(db_session):
    """测试 IntegrityError 处理"""
    obj1 = TestModel(id=1, unique_field="duplicate")
    db_session.add(obj1)
    await db_session.commit()

    obj2 = TestModel(id=2, unique_field="duplicate")
    db_session.add(obj2)

    with pytest.raises(HTTPException) as exc_info:
        async with handle_db_commit(db_session, integrity_error_detail="重复了"):
            await db_session.commit()

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "重复了"


@pytest.mark.anyio
async def test_handle_db_commit_custom_status_code(db_session):
    """测试自定义状态码"""
    obj1 = TestModel(id=1, unique_field="dup")
    db_session.add(obj1)
    await db_session.commit()

    obj2 = TestModel(id=2, unique_field="dup")
    db_session.add(obj2)

    with pytest.raises(HTTPException) as exc_info:
        async with handle_db_commit(
            db_session,
            integrity_error_detail="冲突",
            integrity_error_status=400
        ):
            await db_session.commit()

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "冲突"


@pytest.mark.anyio
async def test_handle_db_commit_accepts_error_detail_kwarg(db_session, monkeypatch):
    """回归：error_detail 必须是合法关键字参数。

    历史缺陷：chapters.py 以 handle_db_commit(db, error_detail="保存章节失败")
    调用，而本函数只接受 integrity_error_detail，导致保存/删除章节必然抛
    TypeError → HTTP 500。此用例锁定该参数契约。
    """
    from app.utils import errors as errors_module

    monkeypatch.setattr(errors_module.settings, "DEBUG", False, raising=False)

    def boom():
        raise SQLAlchemyError("SELECT * FROM secret_table")

    with pytest.raises(HTTPException) as exc_info:
        async with handle_db_commit(db_session, error_detail="保存章节失败"):
            boom()

    assert exc_info.value.status_code == 500
    # 生产模式必须脱敏：只保留业务前缀，不泄露 SQL 细节
    assert exc_info.value.detail == "保存章节失败"
    assert "secret_table" not in exc_info.value.detail


@pytest.mark.anyio
async def test_handle_db_commit_error_detail_default(db_session, monkeypatch):
    """省略 error_detail 时退化为通用文案，且仍然脱敏。"""
    from app.utils import errors as errors_module

    monkeypatch.setattr(errors_module.settings, "DEBUG", False, raising=False)

    def boom():
        raise SQLAlchemyError("SELECT * FROM secret_table")

    with pytest.raises(HTTPException) as exc_info:
        async with handle_db_commit(db_session):
            boom()

    assert exc_info.value.status_code == 500
    assert "secret_table" not in exc_info.value.detail


@pytest.mark.anyio
async def test_handle_db_commit_rolls_back_and_reuses_session(db_session):
    db_session.add(TestModel(id=1, unique_field="duplicate"))
    await db_session.commit()
    db_session.add(TestModel(id=2, unique_field="duplicate"))

    with pytest.raises(HTTPException) as exc_info:
        async with handle_db_commit(db_session):
            await db_session.commit()

    assert exc_info.value.status_code == 409
    assert not db_session.in_transaction()
    db_session.add(TestModel(id=3, unique_field="retry"))
    await db_session.commit()
    assert (await db_session.get(TestModel, 2)) is None
    assert (await db_session.get(TestModel, 3)).unique_field == "retry"


@pytest.mark.anyio
async def test_handle_db_commit_rolls_back_and_preserves_business_exception(db_session):
    failure = ValueError("synthetic-business-failure")
    with pytest.raises(ValueError) as exc_info:
        async with handle_db_commit(db_session):
            db_session.add(TestModel(id=4, unique_field="must-not-persist"))
            await db_session.flush()
            raise failure

    assert exc_info.value is failure
    assert not db_session.in_transaction()
    assert (await db_session.get(TestModel, 4)) is None


@pytest.mark.anyio
async def test_handle_db_commit_does_not_implicitly_commit(db_session):
    async with handle_db_commit(db_session):
        db_session.add(TestModel(id=5, unique_field="caller-owned-transaction"))
        await db_session.flush()

    assert db_session.in_transaction()
    await db_session.rollback()
    assert (await db_session.get(TestModel, 5)) is None
