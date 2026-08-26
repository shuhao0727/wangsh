"""
用户批量导入端点（模板下载与批量导入）

拆分自 app/api/endpoints/management/users/users.py（原 913 行时代基线）：
导入解析与校验辅助逻辑在 import_service.py，本模块仅承载端点，
router 由 users.py include 组合，函数经 users.py 对外 re-export。
"""

from fastapi import APIRouter, Depends, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin, get_db

from . import import_service
from .schemas import UserImportResult

router = APIRouter()


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
