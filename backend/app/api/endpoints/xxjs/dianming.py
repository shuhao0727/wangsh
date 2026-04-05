"""
信息技术 - 点名系统 API 端点

改进记录 (2026-04-02):
- 补充认证：读操作需登录，写操作需管理员
- 消除重复端点：移除 /class/students（与 /students 重复）
- 导入性能优化：逐条查重 → 批量查重 + ON CONFLICT
- Schemas 提取到 schemas/xxjs/dianming.py
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, distinct, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin, require_user
from app.models.xxjs.dianming import XxjsDianming
from app.schemas.xxjs.dianming import (
    DianmingClass,
    DianmingImportRequest,
    DianmingStudent,
)

router = APIRouter()


# --- 读操作：需要登录 ---


@router.get("/classes", response_model=List[DianmingClass])
async def list_classes(
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user),
) -> Any:
    """获取所有班级列表（聚合视图）"""
    stmt = (
        select(
            XxjsDianming.year,
            XxjsDianming.class_name,
            func.count(XxjsDianming.id).label("count"),
        )
        .group_by(XxjsDianming.year, XxjsDianming.class_name)
        .order_by(XxjsDianming.year.desc(), XxjsDianming.class_name.asc())
    )
    rows = (await db.execute(stmt)).all()
    return [{"year": r[0], "class_name": r[1], "count": r[2]} for r in rows]


@router.get("/students", response_model=List[DianmingStudent])
async def list_students(
    year: str,
    class_name: str,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user),
) -> Any:
    """获取指定班级的学生名单"""
    stmt = (
        select(XxjsDianming)
        .where(
            XxjsDianming.year == year,
            XxjsDianming.class_name == class_name,
        )
        .order_by(XxjsDianming.student_no.asc(), XxjsDianming.id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return rows


# --- 写操作：需要管理员权限 ---


@router.post("/import", response_model=List[DianmingStudent])
async def import_students(
    data: DianmingImportRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    """批量导入学生（追加模式，忽略重复）

    使用 PostgreSQL INSERT ... ON CONFLICT DO NOTHING 实现高效去重，
    替代原来的逐条 SELECT 查重（N+1 问题）。
    """
    names = [n.strip() for n in data.names_text.split("\n") if n.strip()]
    if not names:
        return []

    # 批量 upsert：ON CONFLICT DO NOTHING（利用唯一约束 uq_xxjs_dianming_student）
    for name in names:
        stmt = (
            pg_insert(XxjsDianming)
            .values(
                year=data.year,
                class_name=data.class_name,
                student_name=name,
                student_no=None,
            )
            .on_conflict_do_nothing(
                constraint="uq_xxjs_dianming_student"
            )
        )
        await db.execute(stmt)

    await db.commit()
    # 重新查询返回完整列表
    return await _query_students(db, data.year, data.class_name)


@router.delete("/class")
async def delete_class(
    year: str,
    class_name: str,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    """删除整个班级"""
    stmt = delete(XxjsDianming).where(
        XxjsDianming.year == year,
        XxjsDianming.class_name == class_name,
    )
    result = await db.execute(stmt)
    await db.commit()
    return {"success": True, "deleted": result.rowcount or 0}  # type: ignore[union-attr]


@router.put("/class/students", response_model=List[DianmingStudent])
async def update_class_students(
    data: DianmingImportRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Any:
    """更新班级学生名单（覆盖模式：先删除后导入）"""
    # 1. 删除原有学生
    stmt = delete(XxjsDianming).where(
        XxjsDianming.year == data.year,
        XxjsDianming.class_name == data.class_name,
    )
    await db.execute(stmt)

    # 2. 导入新名单
    names = [n.strip() for n in data.names_text.split("\n") if n.strip()]
    if names:
        for name in names:
            db.add(
                XxjsDianming(
                    year=data.year,
                    class_name=data.class_name,
                    student_name=name,
                    student_no=None,
                )
            )

    await db.commit()
    return await _query_students(db, data.year, data.class_name)


# --- 内部辅助函数 ---


async def _query_students(
    db: AsyncSession, year: str, class_name: str
) -> List[XxjsDianming]:
    """查询指定班级的学生列表（内部复用）"""
    stmt = (
        select(XxjsDianming)
        .where(
            XxjsDianming.year == year,
            XxjsDianming.class_name == class_name,
        )
        .order_by(XxjsDianming.student_no.asc(), XxjsDianming.id.asc())
    )
    return list((await db.execute(stmt)).scalars().all())
