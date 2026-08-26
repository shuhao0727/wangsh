"""
用户管理辅助端点（统计 / 批量删除）

拆分自 app/api/endpoints/management/users/users.py（原 913 行时代基线）：
本模块承载非单用户 CRUD 的辅助端点（统计、批量删除），
router 由 users.py include 组合，函数经 users.py 对外 re-export。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin, get_db
from app.utils.errors import safe_error_detail
from app.models import User
from app.core.pubsub import publish

from .policy import (
    ADMIN_MANAGEABLE_ROLES,
    assert_users_deletable as _assert_users_deletable,
    is_plain_admin as _is_plain_admin,
)
from .schemas import BatchDeleteRequest, UserStatsResponse

router = APIRouter()


@router.get("/stats", response_model=UserStatsResponse)
async def get_user_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """获取用户统计数据（总数、激活数、角色分布）"""
    conditions = [User.is_deleted == False]
    if _is_plain_admin(current_user):
        conditions.append(User.role_code.in_(ADMIN_MANAGEABLE_ROLES))

    base = select(func.count(User.id)).where(*conditions)
    total_query = select(func.count(User.id)).where(*conditions)
    total = (await db.execute(total_query)).scalar() or 0
    active = (await db.execute(
        base.where(User.is_active == True)
    )).scalar() or 0
    inactive = (await db.execute(
        base.where(User.is_active == False)
    )).scalar() or 0

    role_query = (
        select(User.role_code, func.count(User.id))
        .where(*conditions)
        .group_by(User.role_code)
    )
    role_rows = (await db.execute(role_query)).all()
    by_role = {row.role_code: row.count for row in role_rows if row.role_code}

    return UserStatsResponse(total=total, active=active, inactive=inactive, by_role=by_role)


@router.post("/batch-delete")
async def batch_delete_users(
    request: BatchDeleteRequest,
    current_user = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    批量删除用户（软删除，需要管理员权限）
    """
    try:
        normalized_ids = list(dict.fromkeys(request.user_ids))
        if not normalized_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请选择要删除的用户",
            )

        # 获取符合条件的用户 - 使用SQLAlchemy正确的语法
        query = select(User).where(
            User.id.in_(normalized_ids),
            User.is_deleted == False
        ).with_for_update()
        result = await db.execute(query)
        users = result.scalars().all()

        found_ids = {user.id for user in users}
        missing_ids = [user_id for user_id in normalized_ids if user_id not in found_ids]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"以下用户不存在或已删除: {missing_ids}",
            )

        _assert_users_deletable(current_user, list(users))
        
        # 批量软删除
        deleted_ids = []
        for user in users:
            # 类型忽略：Pylance不理解SQLAlchemy的动态类型转换
            user.is_deleted = True  # type: ignore
            deleted_ids.append(user.id)
        
        await db.commit()

        await publish("admin_global", {"type": "user_changed", "action": "batch_delete"})

        return {
            "success": True,
            "message": f"成功删除 {len(deleted_ids)} 个用户",
            "deleted_ids": deleted_ids
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("批量删除用户失败", e)
        )
