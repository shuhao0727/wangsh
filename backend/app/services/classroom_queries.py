"""课堂活动行级读取与加锁。

从 ``classroom.py`` 抽出：这三个函数只负责「按 id 取一行，取不到就报错」，
以及教师维度的串行化锁。它们被启动/结束/重启/提交等多个业务函数复用，
单独成文件后 classroom.py 只留业务编排。

行锁语义保持不变：
- ``for_update`` 用于改状态前占据该行；
- ``read=True`` 是 PostgreSQL 的 FOR SHARE，用于只读但需阻塞写入的场景；
- ``populate_existing`` 强制刷新已缓存对象，避免拿到加锁前快照。
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity
from app.models.core.user import User


async def get_activity(db: AsyncSession, activity_id: int) -> ClassroomActivity:
    activity = (await db.execute(
        select(ClassroomActivity).where(ClassroomActivity.id == activity_id)
    )).scalar_one_or_none()
    if not activity:
        raise ValueError("活动不存在")
    return activity


async def get_activity_for_update(
    db: AsyncSession,
    activity_id: int,
    *,
    read: bool = False,
) -> ClassroomActivity:
    activity = (
        await db.execute(
            select(ClassroomActivity)
            .where(ClassroomActivity.id == activity_id)
            .with_for_update(read=read)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not activity:
        raise ValueError("活动不存在")
    return activity


async def lock_activity_owner(db: AsyncSession, user_id: int) -> None:
    """同一教师的活动启动/重启必须串行，保证最多一个 active 活动。"""
    result = await db.execute(
        select(User.id).where(User.id == user_id).with_for_update()
    )
    if result.scalar_one_or_none() is None:
        raise ValueError("活动创建者不存在")
