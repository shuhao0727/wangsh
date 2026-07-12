"""
用户管理 API 端点
与 sys_users 表交互，提供用户数据的 CRUD 操作
普通管理员仅管理学生和教师，超级管理员可管理全部角色
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.deps import require_admin, get_db
from app.utils.errors import safe_error_detail
from app.models import User
from app.core.pubsub import publish

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
    assert_users_mutable as _assert_users_mutable,
    is_plain_admin as _is_plain_admin,
)
from .schemas import (
    BatchDeleteRequest,
    ImportUserResponse,
    UserCreate,
    UserImportResult,
    UserListResponse,
    UserResponse,
    UserStatsResponse,
    UserUpdate,
)

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
        _assert_role_assignment_allowed(current_user, target_role)

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

        # 发布事件
        await publish("admin_global", {"type": "user_changed", "action": "create", "id": new_user.id})

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
        # 获取现有用户 - 使用SQLAlchemy正确的语法
        query = select(User).where(
            User.id == user_id,
            User.is_deleted == False
        ).with_for_update()
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 普通管理员不能修改超级管理员和其他管理员（允许修改自己）
        is_current_admin = _is_plain_admin(current_user)
        if is_current_admin and user.role_code in ("super_admin", "admin") and user.id != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改该用户信息"
            )

        # 普通管理员只能将角色改为 student 或 teacher
        if is_current_admin:
            if user_data.role_code:
                _assert_role_assignment_allowed(current_user, user_data.role_code)

        # 检查唯一性约束（排除当前用户）
        existing_checks = []
        
        # 检查值是否为None，而不是SQLAlchemy对象
        # 类型忽略：Pylance不理解这是Python值而不是SQLAlchemy对象
        if user_data.username is not None and user_data.username != user.username:
            existing_checks.append(User.username == user_data.username)
        
        if user_data.student_id is not None and user_data.student_id != user.student_id:
            existing_checks.append(User.student_id == user_data.student_id)
        
        # 类型忽略：Pylance不理解这个条件检查
        if existing_checks:  # type: ignore
            check_query = select(User).where(
                or_(*existing_checks),
                User.id != user_id
            )
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
        
        # 更新用户信息
        # 类型忽略：Pylance不理解SQLAlchemy的动态类型转换
        if user_data.student_id is not None:
            user.student_id = user_data.student_id  # type: ignore
        
        if user_data.username is not None:
            user.username = user_data.username  # type: ignore
        
        if user_data.full_name is not None:
            user.full_name = user_data.full_name  # type: ignore
        
        if user_data.class_name is not None:
            user.class_name = user_data.class_name  # type: ignore
        
        if user_data.study_year is not None:
            user.study_year = user_data.study_year  # type: ignore
        
        if user_data.role_code is not None:
            user.role_code = user_data.role_code  # type: ignore
        
        if user_data.is_active is not None:
            user.is_active = user_data.is_active  # type: ignore

        await db.commit()
        await db.refresh(user)

        # 发布事件
        await publish("admin_global", {"type": "user_changed", "action": "update", "id": user_id})

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
        # 获取现有用户 - 使用SQLAlchemy正确的语法
        query = select(User).where(
            User.id == user_id,
            User.is_deleted == False
        ).with_for_update()
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 普通管理员不能删除管理员或超级管理员
        _assert_users_deletable(
            current_user,
            [user],
            detail="无权删除该用户",
        )

        # 软删除：标记为已删除
        # 类型忽略：Pylance不理解SQLAlchemy的动态类型转换
        user.is_deleted = True  # type: ignore
        await db.commit()

        # 发布事件
        await publish("admin_global", {"type": "user_changed", "action": "delete", "id": user_id})

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


@router.get("/import/template")
async def download_user_import_template(
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    current_user = Depends(require_admin),
) -> StreamingResponse:
    """
    下载用户导入模板，支持 xlsx / csv。
    """
    return import_service.build_user_import_template(format)


@router.post("/import", response_model=UserImportResult)
async def import_users(
    file: UploadFile,
    current_user = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> UserImportResult:
    """
    批量导入用户（CSV / XLSX 格式，需要管理员权限）
    导入规则：
    - 普通 admin 只能导入 student（学生）或 teacher（教师），不能创建或更新 admin / super_admin。
    - 高权限角色行不会自动降级；该行会失败，并在 UserImportResult.errors 中逐行返回。
    - super_admin 可导入全部角色。
    模板角色列仍使用统一格式，本轮不按当前角色动态生成模板。
    """
    return await import_service.import_users(file, current_user, db)
