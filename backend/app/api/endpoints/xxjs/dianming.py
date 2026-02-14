from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, delete, func, update
from pydantic import BaseModel

from app.core import deps
from app.models.xxjs.dianming import XxjsDianming

router = APIRouter()

# --- Pydantic Models ---
class DianmingClass(BaseModel):
    year: str
    class_name: str
    count: int

class DianmingStudentBase(BaseModel):
    year: str
    class_name: str
    student_name: str
    student_no: Optional[str] = None

class DianmingStudentCreate(DianmingStudentBase):
    pass

class DianmingStudent(DianmingStudentBase):
    id: int
    created_at: Any
    class Config:
        from_attributes = True

class DianmingImportRequest(BaseModel):
    year: str
    class_name: str
    names_text: str  # 纯文本，换行分隔

# --- API Endpoints ---

@router.get("/classes", response_model=List[DianmingClass])
async def list_classes(
    db: AsyncSession = Depends(deps.get_db),
    # current_user: User = Depends(deps.get_current_active_user), # 暂时开放或仅需登录
) -> Any:
    """获取所有班级列表（聚合视图）"""
    stmt = (
        select(XxjsDianming.year, XxjsDianming.class_name, func.count(XxjsDianming.id).label("count"))
        .group_by(XxjsDianming.year, XxjsDianming.class_name)
        .order_by(XxjsDianming.year.desc(), XxjsDianming.class_name.asc())
    )
    rows = (await db.execute(stmt)).all()
    return [{"year": r[0], "class_name": r[1], "count": r[2]} for r in rows]

@router.get("/students", response_model=List[DianmingStudent])
async def list_students(
    year: str,
    class_name: str,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """获取指定班级的学生名单"""
    stmt = select(XxjsDianming).where(
        XxjsDianming.year == year,
        XxjsDianming.class_name == class_name
    ).order_by(XxjsDianming.student_no.asc(), XxjsDianming.id.asc())
    rows = (await db.execute(stmt)).scalars().all()
    return rows

@router.post("/import", response_model=List[DianmingStudent])
async def import_students(
    data: DianmingImportRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """批量导入学生（追加模式，忽略重复）"""
    # 如果是完全覆盖，可以先删除该班级
    # 但考虑到“导入”可能是追加，这里我们做成追加模式
    # 如果要覆盖，前端可以先调 delete，再调 import
    
    # 1. 解析名单
    names = [n.strip() for n in data.names_text.split('\n') if n.strip()]
    if not names:
        return []
    
    # 2. 批量插入
    for name in names:
        # 简单去重
        exists_stmt = select(XxjsDianming).where(
            XxjsDianming.year == data.year,
            XxjsDianming.class_name == data.class_name,
            XxjsDianming.student_name == name
        )
        exists = (await db.execute(exists_stmt)).scalar_one_or_none()
        if not exists:
            obj = XxjsDianming(
                year=data.year,
                class_name=data.class_name,
                student_name=name,
                student_no=None 
            )
            db.add(obj)
    
    await db.commit()
    # 重新查询返回
    return await list_students(year=data.year, class_name=data.class_name, db=db)

@router.delete("/class")
async def delete_class(
    year: str,
    class_name: str,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """删除整个班级"""
    stmt = delete(XxjsDianming).where(
        XxjsDianming.year == year,
        XxjsDianming.class_name == class_name
    )
    await db.execute(stmt)
    await db.commit()
    return {"success": True}

@router.put("/class/students")
async def update_class_students(
    data: DianmingImportRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """更新班级学生名单（覆盖模式：先删除后导入）"""
    # 1. 删除原有学生
    stmt = delete(XxjsDianming).where(
        XxjsDianming.year == data.year,
        XxjsDianming.class_name == data.class_name
    )
    await db.execute(stmt)
    
    # 2. 导入新名单
    names = [n.strip() for n in data.names_text.split('\n') if n.strip()]
    if names:
        for name in names:
            obj = XxjsDianming(
                year=data.year,
                class_name=data.class_name,
                student_name=name,
                student_no=None
            )
            db.add(obj)
            
    await db.commit()
    return await list_students(year=data.year, class_name=data.class_name, db=db)
