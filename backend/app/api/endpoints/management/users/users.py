"""
用户管理 API 端点
与 sys_users 表交互，提供用户数据的 CRUD 操作
普通管理员仅管理学生和教师，超级管理员可管理全部角色

拆分自原单文件 users.py（913 行时代基线 → 本文件 <501 行）：
- users_import.py：导入模板下载与批量导入端点
- users_helpers.py：统计与批量删除辅助端点
- import_service.py / policy.py / schemas.py：既有辅助与校验模块
本文件保留 router 组合与对外 re-export，外部导入路径
（users.router、users.create_user、users.UserCreate 等）不变。
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.deps import require_admin, get_db
from app.utils.errors import safe_error_detail
from app.models import User
from app.core.pubsub import publish
from app.services.user_governance import (
    assert_last_active_super_admin,
    lock_account_governance,
    revoke_if_account_removed,
)

from . import import_service
from .import_service import (
    USER_IMPORT_HEADERS,
    USER_IMPORT_REQUIRED_FIELDS,
    USER_IMPORT_TEMPLATE_ROWS,
    normalize_cell_value as _normalize_cell_value,
    parse_csv_rows as _parse_csv_rows,
    parse_import_rows as _parse_import_rows,
    parse_xlsx_rows as _parse_xlsx_rows,
)
from .policy import (
    ADMIN_MANAGEABLE_ROLES,
    PRIVILEGED_ROLES,
    assert_role_assignment_allowed as _assert_role_assignment_allowed,
    assert_users_deletable as _assert_users_deletable,
    is_plain_admin as _is_plain_admin,
)
from .schemas import (
    BatchDeleteRequest,
    ImportUserResponse,
    UserCreate,
    UserImportResult,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from .users_import import (
    router as users_import_router,
    download_user_import_template,
    import_users,
)
from .users_helpers import (
    router as users_helpers_router,
    get_user_stats,
    batch_delete_users,
)

logger = logging.getLogger(__name__)


async def _publish_user_change_after_commit(payload: dict) -> None:
    """Do not turn a committed account mutation into a false failure."""
    try:
        await publish("admin_global", payload)
    except Exception:
        logger.exception("用户治理已提交，但变更通知发布失败")


router = APIRouter()
router.include_router(users_import_router)
router.include_router(users_helpers_router)


@router.get("/", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(20, ge=1, le=100, description="每页记录数"),
    search: Optional[str] = Query(None, description="搜索关键词（学号、姓名、班级）"),
    role_code: Optional[str] = Query(None, description="角色代码过滤"),
    is_active: Optional[bool] = Query(None, description="是否激活状态过滤"),
    current_user = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> UserListResponse:
    """
    获取用户列表（需要管理员权限）
    支持分页、搜索和过滤
    默认排除超级管理员（安全考虑），管理员/教师/学生可见
    """
    try:
        if _is_plain_admin(current_user) and role_code in PRIVILEGED_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权查看管理员或超级管理员",
            )

        # 构建查询条件
        conditions = []
        # 使用SQLAlchemy正确的语法
        conditions.append(User.is_deleted == False)
        
        # 默认排除超级管理员（安全考虑），管理员/教师/学生可见
        if _is_plain_admin(current_user):
            conditions.append(User.role_code.in_(ADMIN_MANAGEABLE_ROLES))
        elif not role_code:
            conditions.append(User.role_code.notin_(['super_admin']))
        
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    User.student_id.ilike(search_term),
                    User.full_name.ilike(search_term),
                    User.class_name.ilike(search_term),
                    User.username.ilike(search_term)
                )
            )
        
        if role_code:
            conditions.append(User.role_code == role_code)
        
        if is_active is not None:
            conditions.append(User.is_active == is_active)
        
        # 获取总数
        count_query = select(func.count()).select_from(User)
        if conditions:
            count_query = count_query.where(*conditions)
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()
        
        # 获取分页数据
        query = select(User)
        if conditions:
            query = query.where(*conditions)
        query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        users = result.scalars().all()
        
        # 转换为响应格式
        user_list = []
        for user in users:
            # 使用 Pydantic 的 model_validate 方法，正确处理 SQLAlchemy 对象
            user_response = UserResponse.model_validate(user)
            user_list.append(user_response)
        
        return UserListResponse(
            users=user_list,
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + limit < total
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取用户列表失败", e)
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    获取用户详情（需要管理员权限）
    """
    try:
        # 使用SQLAlchemy正确的语法
        query = select(User).where(
            User.id == user_id,
            User.is_deleted == False
        )
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        if (
            _is_plain_admin(current_user)
            and user.role_code in PRIVILEGED_ROLES
            and user.id != current_user.get("id")
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权查看该用户信息",
            )
        
        # 使用 Pydantic 的 model_validate 方法
        return UserResponse.model_validate(user)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取用户详情失败", e)
        )


@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    创建新用户（需要管理员权限）
    """
    try:
        target_role = user_data.role_code or "student"
        actor, _ = await lock_account_governance(
            db, actor_id=current_user.get("id"), target_ids=[]
        )
        _assert_role_assignment_allowed(actor, target_role)

        # 检查唯一性约束 - 检查值是否为None，而不是SQLAlchemy对象
        existing_checks = []
        
        if user_data.username is not None:
            existing_checks.append(User.username == user_data.username)
        
        if user_data.student_id is not None:
            existing_checks.append(User.student_id == user_data.student_id)
        
        # 类型忽略：Pylance不理解这个条件检查
        if existing_checks:  # type: ignore
            check_query = select(User).where(or_(*existing_checks))
            check_result = await db.execute(check_query)
            existing_user = check_result.scalar_one_or_none()
            
            if existing_user:
                if existing_user.username == user_data.username:  # type: ignore[union-attr]
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="用户名已存在"
                    )
                if existing_user.student_id == user_data.student_id:  # type: ignore[union-attr]
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="学号已存在"
                    )
        
        # 创建新用户
        hashed_password = None
        if user_data.password:
            from app.services.auth import get_password_hash
            hashed_password = get_password_hash(user_data.password)

        new_user = User(
            student_id=user_data.student_id,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            class_name=user_data.class_name,
            study_year=user_data.study_year,
            role_code=target_role,
            is_active=user_data.is_active if user_data.is_active is not None else True
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        # 发布事件；提交后的通知失败不能伪装成账号创建失败。
        await _publish_user_change_after_commit(
            {"type": "user_changed", "action": "create", "id": new_user.id}
        )

        # 使用 Pydantic 的 model_validate 方法
        return UserResponse.model_validate(new_user)
        
    except HTTPException:
        raise
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户数据不符合数据库约束"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("创建用户失败", e)
        )


async def _assert_update_unique_fields(
    db: AsyncSession, user: User, user_id: int, user_data: UserUpdate
) -> None:
    checks = []
    if user_data.username is not None and user_data.username != user.username:
        checks.append(User.username == user_data.username)
    if user_data.student_id is not None and user_data.student_id != user.student_id:
        checks.append(User.student_id == user_data.student_id)
    if not checks:
        return

    existing_user = (
        await db.execute(select(User).where(or_(*checks), User.id != user_id))
    ).scalar_one_or_none()
    if existing_user and existing_user.username == user_data.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")
    if existing_user and existing_user.student_id == user_data.student_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="学号已存在")


def _apply_user_update(user: User, user_data: UserUpdate) -> None:
    for field in (
        "student_id",
        "username",
        "full_name",
        "class_name",
        "study_year",
        "role_code",
        "is_active",
    ):
        value = getattr(user_data, field)
        if value is not None:
            setattr(user, field, value)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    更新用户信息（需要管理员权限）
    """
    try:
        actor, locked_users = await lock_account_governance(
            db, actor_id=current_user.get("id"), target_ids=[user_id]
        )
        user = locked_users.get(user_id)
        if not user or user.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 普通管理员不能修改超级管理员和其他管理员（允许修改自己）
        is_current_admin = _is_plain_admin(actor)
        if is_current_admin and user.role_code in ("super_admin", "admin") and user.id != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改该用户信息"
            )

        # 普通管理员只能将角色改为 student 或 teacher
        if is_current_admin:
            if user_data.role_code:
                _assert_role_assignment_allowed(actor, user_data.role_code)

        await _assert_update_unique_fields(db, user, user_id, user_data)

        final_role = user_data.role_code if user_data.role_code is not None else user.role_code
        final_active = user_data.is_active if user_data.is_active is not None else bool(user.is_active)
        await assert_last_active_super_admin(
            db, {user.id: (final_role, final_active, bool(user.is_deleted))}
        )
        await revoke_if_account_removed(
            db, user, final_is_active=final_active, final_is_deleted=bool(user.is_deleted)
        )

        _apply_user_update(user, user_data)

        await db.commit()
        await db.refresh(user)

        # 发布事件
        await _publish_user_change_after_commit(
            {"type": "user_changed", "action": "update", "id": user_id}
        )

        # 使用 Pydantic 的 model_validate 方法
        return UserResponse.model_validate(user)
        
    except HTTPException:
        raise
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户数据不符合数据库约束"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("更新用户失败", e)
        )


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    删除用户（软删除，需要管理员权限）
    """
    try:
        actor, locked_users = await lock_account_governance(
            db, actor_id=current_user.get("id"), target_ids=[user_id]
        )
        user = locked_users.get(user_id)
        if not user or user.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 普通管理员不能删除管理员或超级管理员
        _assert_users_deletable(
            actor,
            [user],
            detail="无权删除该用户",
        )
        await assert_last_active_super_admin(
            db, {user.id: (user.role_code, bool(user.is_active), True)}
        )
        await revoke_if_account_removed(
            db, user, final_is_active=bool(user.is_active), final_is_deleted=True
        )

        # 软删除：标记为已删除
        # 类型忽略：Pylance不理解SQLAlchemy的动态类型转换
        user.is_deleted = True  # type: ignore
        await db.commit()

        # 发布事件
        await _publish_user_change_after_commit(
            {"type": "user_changed", "action": "delete", "id": user_id}
        )

        return {
            "success": True,
            "message": "用户删除成功",
            "user_id": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("删除用户失败", e)
        )
