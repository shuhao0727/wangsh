"""
测试数据库辅助工具
"""

import pytest
from fastapi import HTTPException
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.utils.db_helpers import get_or_404, get_or_none

Base = declarative_base()


class TestHelperModel(Base):
    """测试用模型"""
    __tablename__ = "test_db_helpers_model"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


@pytest.fixture
async def async_db():
    """创建异步测试数据库"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def setup_test_data(async_db: AsyncSession):
    """创建测试数据"""
    obj = TestHelperModel(id=999, name="test_object")
    async_db.add(obj)
    await async_db.commit()

    yield obj

    await async_db.delete(obj)
    await async_db.commit()


@pytest.mark.anyio
async def test_get_or_404_found(async_db: AsyncSession, setup_test_data):
    """测试 get_or_404 找到对象"""
    stmt = select(TestHelperModel).where(TestHelperModel.id == 999)
    obj = await get_or_404(async_db, stmt)

    assert obj is not None
    assert obj.id == 999
    assert obj.name == "test_object"


@pytest.mark.anyio
async def test_get_or_404_not_found_default(async_db: AsyncSession, setup_test_data):
    """测试 get_or_404 找不到对象 - 默认错误信息"""
    stmt = select(TestHelperModel).where(TestHelperModel.id == 9999)

    with pytest.raises(HTTPException) as exc_info:
        await get_or_404(async_db, stmt)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "资源不存在"


@pytest.mark.anyio
async def test_get_or_404_not_found_custom(async_db: AsyncSession, setup_test_data):
    """测试 get_or_404 找不到对象 - 自定义错误信息"""
    stmt = select(TestHelperModel).where(TestHelperModel.id == 9999)

    with pytest.raises(HTTPException) as exc_info:
        await get_or_404(async_db, stmt, detail="测试对象不存在")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "测试对象不存在"


@pytest.mark.anyio
async def test_get_or_404_custom_status_code(async_db: AsyncSession, setup_test_data):
    """测试 get_or_404 自定义状态码"""
    stmt = select(TestHelperModel).where(TestHelperModel.id == 9999)

    with pytest.raises(HTTPException) as exc_info:
        await get_or_404(async_db, stmt, detail="对象已被删除", status_code=410)

    assert exc_info.value.status_code == 410
    assert exc_info.value.detail == "对象已被删除"


@pytest.mark.anyio
async def test_get_or_none_found(async_db: AsyncSession, setup_test_data):
    """测试 get_or_none 找到对象"""
    stmt = select(TestHelperModel).where(TestHelperModel.id == 999)
    obj = await get_or_none(async_db, stmt)

    assert obj is not None
    assert obj.id == 999
    assert obj.name == "test_object"


@pytest.mark.anyio
async def test_get_or_none_not_found(async_db: AsyncSession, setup_test_data):
    """测试 get_or_none 找不到对象返回 None"""
    stmt = select(TestHelperModel).where(TestHelperModel.id == 9999)
    obj = await get_or_none(async_db, stmt)

    assert obj is None
