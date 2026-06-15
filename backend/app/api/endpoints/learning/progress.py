"""
学习板块 - 学习进度 CRUD

为 ML / AI / 智能体三个学习板块提供进度追踪 API。
"""

import json
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.schemas.user_info import UserInfo
from app.schemas.learning.progress import LearningProgressUpdate
from app.models.learning.progress import LearningProgress

router = APIRouter()


def _validate_module_key(module_key: str) -> None:
    if module_key not in ("ml", "ai", "agents"):
        raise HTTPException(status_code=400, detail="无效的模块标识，仅支持: ml, ai, agents")


def _safe_json_loads(value: str | None) -> Any:
    if not value:
        return None
    try:
        loaded = json.loads(value)
    except json.JSONDecodeError:
        return None
    return loaded


def _progress_payload(progress: LearningProgress) -> Dict[str, Any]:
    data = _safe_json_loads(progress.progress_data)
    if data is None:
        completed_stages = _safe_json_loads(progress.completed_stages)
        data = {
            "current_stage": progress.current_stage,
            "completed_stages": completed_stages,
            "notes": progress.notes,
        }
    return {
        "id": progress.id,
        "user_id": progress.user_id,
        "module_key": progress.module_key,
        "data": data,
        "created_at": progress.created_at,
        "updated_at": progress.updated_at,
    }


@router.get("/learning/progress")
async def list_learning_progress(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """获取当前用户所有模块的学习进度列表"""
    user_id = int(current_user.get("id"))
    stmt = select(LearningProgress).where(
        LearningProgress.user_id == user_id
    ).order_by(LearningProgress.module_key)
    result = await db.execute(stmt)
    return [_progress_payload(progress) for progress in result.scalars().all()]


@router.get("/learning/progress/{module_key}")
async def get_learning_progress(
    module_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """获取当前用户指定模块的学习进度"""
    _validate_module_key(module_key)

    user_id = int(current_user.get("id"))
    stmt = select(LearningProgress).where(
        LearningProgress.user_id == user_id,
        LearningProgress.module_key == module_key,
    )
    result = await db.execute(stmt)
    progress = result.scalar_one_or_none()
    if not progress:
        raise HTTPException(status_code=404, detail="未找到该模块的学习进度")
    return _progress_payload(progress)


@router.put("/learning/progress/{module_key}")
async def upsert_learning_progress(
    module_key: str,
    data: LearningProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """创建或更新学习进度（upsert）"""
    _validate_module_key(module_key)

    user_id = int(current_user.get("id"))

    # 查询现有记录（使用 FOR UPDATE 行锁防止并发竞态）
    stmt = select(LearningProgress).where(
        LearningProgress.user_id == user_id,
        LearningProgress.module_key == module_key,
    ).with_for_update()
    result = await db.execute(stmt)
    progress = result.scalar_one_or_none()

    progress_dict = data.to_progress_dict()

    if progress:
        # 更新
        progress.progress_data = json.dumps(progress_dict, ensure_ascii=False)
        if data.current_stage is not None:
            progress.current_stage = data.current_stage
        if data.completed_stages is not None:
            progress.completed_stages = json.dumps(data.completed_stages, ensure_ascii=False)
        if data.notes is not None:
            progress.notes = data.notes
    else:
        # 创建
        progress = LearningProgress(
            user_id=user_id,
            module_key=module_key,
            current_stage=data.current_stage,
            completed_stages=(json.dumps(data.completed_stages, ensure_ascii=False) if data.completed_stages is not None else None),
            progress_data=json.dumps(progress_dict, ensure_ascii=False),
            notes=data.notes,
        )
        try:
            db.add(progress)
            await db.flush()
        except IntegrityError:
            await db.rollback()
            # 竞态条件：另一个请求已创建记录，改为更新
            stmt = select(LearningProgress).where(
                LearningProgress.user_id == user_id,
                LearningProgress.module_key == module_key,
            ).with_for_update()
            result = await db.execute(stmt)
            progress = result.scalar_one()
            # 应用更新
            progress.progress_data = json.dumps(data, ensure_ascii=False)
            progress.current_stage = data.get("current_stage")
            if "completed_stages" in data:
                progress.completed_stages = json.dumps(data.get("completed_stages"), ensure_ascii=False)
            progress.notes = data.get("notes") if isinstance(data.get("notes"), str) else progress.notes

    await db.commit()
    await db.refresh(progress)
    return _progress_payload(progress)


@router.post("/learning/progress/{module_key}")
async def create_learning_progress(
    module_key: str,
    data: LearningProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """兼容前端保存按钮的 POST 调用，行为与 PUT upsert 一致。"""
    return await upsert_learning_progress(module_key, data, db, current_user)


@router.delete("/learning/progress/{module_key}")
async def delete_learning_progress(
    module_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Dict[str, Any]:
    """删除学习进度"""
    _validate_module_key(module_key)

    user_id = int(current_user.get("id"))
    stmt = select(LearningProgress).where(
        LearningProgress.user_id == user_id,
        LearningProgress.module_key == module_key,
    )
    result = await db.execute(stmt)
    progress = result.scalar_one_or_none()
    if not progress:
        raise HTTPException(status_code=404, detail="未找到该模块的学习进度")

    await db.delete(progress)
    await db.commit()
    return {"ok": True, "message": f"模块 '{module_key}' 的学习进度已删除"}
