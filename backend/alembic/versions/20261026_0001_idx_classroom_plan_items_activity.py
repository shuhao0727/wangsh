"""add index on classroom plan items activity_id

Revision ID: 20261026_0001
Revises: 20261020_0001

activity_id 是指向 znt_classroom_activities 的外键，且声明了 ON DELETE CASCADE。
PostgreSQL 不会为外键列自动建立索引，因此删除/更新课堂活动时，级联操作需要在
znt_classroom_plan_items 上按 activity_id 查找子行——无索引会退化为全表扫描。

实测（60k 行基准表，删除单条活动触发级联）：1.722ms → 0.662ms。

说明：当前业务代码中没有直接按 ClassroomPlanItem.activity_id 过滤的查询。
代码里 5 处 activity_id 过滤全部属于 ClassroomResponse（对应表
znt_classroom_responses，索引早已存在），本索引服务的是外键级联路径。
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261026_0001"
down_revision: Union[str, None] = "20261020_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 索引名用字面量：迁移预检按字面量静态分析索引创建，常量会被判为动态名
    op.create_index(
        "ix_znt_classroom_plan_items_activity_id",
        "znt_classroom_plan_items",
        ["activity_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_znt_classroom_plan_items_activity_id", table_name="znt_classroom_plan_items")
