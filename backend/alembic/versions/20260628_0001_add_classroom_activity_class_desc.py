"""add class_name and description to znt_classroom_activities

为课堂互动活动表新增两列，解决学生端班级隔离缺失问题：
- class_name: 班级名称，用于学生端按班级过滤活动（nullable 兼容旧数据）
- description: 活动描述，教师可附加说明文本

同时为 class_name 建立索引，加速学生端按班级查询活跃活动。

Revises: 20260624_0001_add_it_game_tables
Create Date: 2026-06-28T00:01:00+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260628_0001_add_classroom_activity_class_desc"
down_revision: Union[str, None] = "20260624_0001_add_it_game_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 先阻断旧后端继续写入，再检查 active 活动，消除检查与 DDL 之间的竞态。
    op.execute(
        "LOCK TABLE znt_classroom_activities IN SHARE ROW EXCLUSIVE MODE"
    )

    # 部署时不允许跨版本保留进行中的课堂活动，避免新增班级字段后
    # 旧 active 活动以空班级静默消失。
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM znt_classroom_activities
                WHERE status = 'active'
            ) THEN
                RAISE EXCEPTION
                    'classroom migration blocked: end all active classroom activities before upgrade';
            END IF;
        END
        $$;
        """
    )

    # 1) 新增 class_name 列（nullable 兼容历史草稿/已结束活动）
    op.add_column(
        "znt_classroom_activities",
        sa.Column(
            "class_name",
            sa.String(length=50),
            nullable=True,
            comment="班级名称",
        ),
    )
    # 统一历史班级格式，使普通 B-tree 索引可用于精确匹配查询。
    op.execute(
        """
        UPDATE znt_classroom_activities
        SET class_name = NULLIF(BTRIM(class_name), '')
        WHERE class_name IS NOT NULL
        """
    )
    # 2) 新增 description 列
    op.add_column(
        "znt_classroom_activities",
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="活动描述",
        ),
    )
    # 3) 为 class_name 建索引，加速学生端按班级过滤活跃活动
    op.create_index(
        "ix_znt_classroom_activities_class_name",
        "znt_classroom_activities",
        ["class_name"],
    )


def downgrade() -> None:
    # 逆序回滚：先删索引，再删列
    op.drop_index(
        "ix_znt_classroom_activities_class_name",
        table_name="znt_classroom_activities",
    )
    op.drop_column("znt_classroom_activities", "description")
    op.drop_column("znt_classroom_activities", "class_name")
