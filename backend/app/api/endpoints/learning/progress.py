"""
学习板块 - 学习进度 CRUD

为 ML / AI / 智能体三个学习板块提供进度追踪 API。
"""

import json
import hashlib
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.schemas.user_info import UserInfo
from app.schemas.learning.progress import LearningProgressUpdate
from app.models.learning.progress import LearningProgress
from app.utils.db_helpers import get_or_404

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


def _stored_progress_dict(progress: LearningProgress) -> Dict[str, Any]:
    """读取新旧两种存储格式，保证旧字段不会因部分写入而丢失。"""
    data = _safe_json_loads(progress.progress_data)
    if progress.progress_data is not None and not isinstance(data, dict):
        raise HTTPException(status_code=409, detail={
            "code": "LEARNING_PROGRESS_INVALID_STORED_DATA",
            "message": "已保存的学习进度格式异常，请联系管理员；未覆盖原始记录",
        })
    if isinstance(data, dict):
        result = dict(data)
        legacy = {
            "current_stage": progress.current_stage,
            "completed_stages": _safe_json_loads(progress.completed_stages),
            "notes": progress.notes,
        }
        for key, value in legacy.items():
            if key not in result and value is not None:
                result[key] = value
        return result

    completed_stages = _safe_json_loads(progress.completed_stages)
    return {
        "current_stage": progress.current_stage,
        "completed_stages": completed_stages,
        "notes": progress.notes,
    }


def _progress_version(progress: LearningProgress) -> str:
    """生成不依赖新数据库列的内容版本 token。"""
    value = {
        "id": progress.id,
        "current_stage": progress.current_stage,
        "completed_stages": progress.completed_stages,
        "progress_data": progress.progress_data,
        "notes": progress.notes,
    }
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _merge_progress_values(existing: Any, incoming: Any) -> Any:
    """递归合并非空对象；空对象、null、数组和标量显式替换。"""
    if incoming == {}:
        return {}
    if isinstance(existing, dict) and isinstance(incoming, dict):
        merged = dict(existing)
        for key, value in incoming.items():
            merged[key] = _merge_progress_values(merged[key], value) if key in merged else value
        return merged
    return incoming


def _apply_progress_values(
    progress: LearningProgress,
    incoming: Dict[str, Any],
    *,
    replace: bool,
) -> None:
    existing = _stored_progress_dict(progress) if progress.progress_data or progress.id else {}
    next_data = dict(incoming) if replace else dict(existing)
    if not replace:
        for key, value in incoming.items():
            next_data[key] = _merge_progress_values(existing.get(key), value)
    try:
        LearningProgressUpdate.model_validate(next_data)
    except ValidationError:
        raise HTTPException(status_code=422, detail="合并后的学习进度无效或超过 50KB")
    progress.progress_data = json.dumps(next_data, ensure_ascii=False)

    # 旧列仍被旧读取方使用，必须与合并后的 canonical data 同步。
    for key in ("current_stage", "completed_stages", "notes"):
        if replace or key in next_data:
            value = next_data.get(key)
            if key == "completed_stages":
                progress.completed_stages = (
                    json.dumps(value, ensure_ascii=False) if value is not None else None
                )
            else:
                setattr(progress, key, value)


def _assert_expected_version(progress: LearningProgress, data: LearningProgressUpdate) -> None:
    # 显式 version=null 表示 GET 确认不存在；省略仅供 legacy POST/PUT。
    if "version" in data.model_fields_set and data.version != _progress_version(progress):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "LEARNING_PROGRESS_VERSION_CONFLICT",
                "message": "学习进度已在其他标签页更新，请重新读取后再保存",
                "version": _progress_version(progress),
            },
        )


def _progress_payload(progress: LearningProgress) -> Dict[str, Any]:
    data = _stored_progress_dict(progress)
    return {
        "id": progress.id,
        "user_id": progress.user_id,
        "module_key": progress.module_key,
        "data": data,
        "version": _progress_version(progress),
        "created_at": progress.created_at,
        "updated_at": progress.updated_at,
    }


def _default_progress_payload(user_id: int, module_key: str) -> Dict[str, Any]:
    return {
        "id": None,
        "user_id": user_id,
        "module_key": module_key,
        "data": {
            "current_stage": None,
            "completed_stages": None,
            "notes": None,
        },
        "version": None,
        "created_at": None,
        "updated_at": None,
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
        return _default_progress_payload(user_id, module_key)
    return _progress_payload(progress)


@router.put("/learning/progress/{module_key}")
async def upsert_learning_progress(
    module_key: str,
    data: LearningProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """PUT：全量替换当前模块的 canonical progress data。"""
    return await _write_learning_progress(module_key, data, db, current_user, replace=True)


async def _write_learning_progress(
    module_key: str,
    data: LearningProgressUpdate,
    db: AsyncSession,
    current_user: UserInfo,
    *,
    replace: bool,
) -> Any:
    """在行锁内执行 PUT/PATCH，并对带版本请求启用乐观并发检查。"""
    _validate_module_key(module_key)

    user_id = int(current_user.get("id"))

    # 查询现有记录（使用 FOR UPDATE 行锁防止并发竞态）
    stmt = select(LearningProgress).where(
        LearningProgress.user_id == user_id,
        LearningProgress.module_key == module_key,
    ).with_for_update().execution_options(populate_existing=True)
    result = await db.execute(stmt)
    progress = result.scalar_one_or_none()

    progress_dict = data.to_progress_dict()

    if progress:
        _assert_expected_version(progress, data)
        _apply_progress_values(progress, progress_dict, replace=replace)
    else:
        if data.version is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "LEARNING_PROGRESS_VERSION_CONFLICT",
                    "message": "学习进度记录已不存在，请重新读取",
                    "version": None,
                },
            )
        # 创建
        progress = LearningProgress(
            user_id=user_id,
            module_key=module_key,
            current_stage=None,
            completed_stages=None,
            progress_data=None,
            notes=None,
        )
        _apply_progress_values(progress, progress_dict, replace=replace)
        try:
            db.add(progress)
            await db.flush()
        except IntegrityError:
            await db.rollback()
            # 竞态条件：另一个请求已创建记录，改为更新
            stmt = select(LearningProgress).where(
                LearningProgress.user_id == user_id,
                LearningProgress.module_key == module_key,
            ).with_for_update().execution_options(populate_existing=True)
            result = await db.execute(stmt)
            progress = result.scalar_one()
            _assert_expected_version(progress, data)
            _apply_progress_values(progress, progress_dict, replace=replace)

    # 在行锁仍持有时取响应快照，避免 commit 后 refresh 读到其他 writer 的版本。
    await db.flush()
    # flush 后 server default/onupdate 时间戳可能过期；显式 async 加载，
    # 避免序列化响应时隐式 IO 触发 MissingGreenlet。commit 前仍持有行锁。
    await db.refresh(progress, attribute_names=["created_at", "updated_at"])
    payload = _progress_payload(progress)
    await db.commit()
    return payload


@router.patch("/learning/progress/{module_key}")
async def patch_learning_progress(
    module_key: str,
    data: LearningProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """PATCH：递归合并本次提供的字段，未提供字段保持不变。"""
    if "version" not in data.model_fields_set:
        raise HTTPException(status_code=428, detail="PATCH 必须携带 GET 返回的 version；无记录时为 null")
    return await _write_learning_progress(module_key, data, db, current_user, replace=False)


@router.post("/learning/progress/{module_key}")
async def create_learning_progress(
    module_key: str,
    data: LearningProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """兼容旧客户端；POST 使用 PATCH 语义，避免部分 payload 覆盖整条记录。"""
    return await _write_learning_progress(module_key, data, db, current_user, replace=False)


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
    progress = await get_or_404(db, stmt, detail="未找到该模块的学习进度")

    await db.delete(progress)
    await db.commit()
    return {"ok": True, "message": f"模块 '{module_key}' 的学习进度已删除"}
