"""点名名单的对象级访问裁决。

点名对象由 ``(year, class_name)`` 唯一定位。这里仅接受认证链路提供的
权威身份字段；在教师班级授权关系尚未落库前，教师默认拒绝，避免把角色
本身误当成全校名单读取权限。
"""

from dataclasses import dataclass
from typing import Mapping, Any

from fastapi import HTTPException, status


_ADMIN_ROLES = frozenset({"admin", "super_admin"})


@dataclass(frozen=True)
class DianmingReadScope:
    """一次请求可读取的点名对象范围；``None`` 表示管理员全局范围。"""

    year: str | None
    class_name: str | None

    @property
    def is_global(self) -> bool:
        return self.year is None and self.class_name is None


def _required_identity_value(user: Mapping[str, Any], key: str) -> str:
    value = user.get(key)
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="尚未建立可核验的点名班级关系",
        )
    return value.strip()


def resolve_dianming_read_scope(user: Mapping[str, Any]) -> DianmingReadScope:
    """从当前、已核验的用户身份解析点名读取范围。

    - admin/super_admin：保留既有全局治理读取能力；
    - student：必须同时具有权威 ``study_year`` 与 ``class_name``；
    - teacher：当前模型没有独立的任课/授权班级关系，安全默认拒绝；
    - 其他或未知角色：拒绝。

    本函数不缓存结果，因此认证记录中的关系被撤销后，下一次请求会立即
    根据新的身份字段拒绝。
    """

    role = str(user.get("role_code") or "").strip()
    if role in _ADMIN_ROLES:
        return DianmingReadScope(year=None, class_name=None)

    if role == "student":
        return DianmingReadScope(
            year=_required_identity_value(user, "study_year"),
            class_name=_required_identity_value(user, "class_name"),
        )

    if role == "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="尚未配置教师的点名班级授权",
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="无权访问点名名单",
    )


def authorize_dianming_class_read(
    user: Mapping[str, Any], *, year: str, class_name: str
) -> DianmingReadScope:
    """校验用户是否可读取指定 ``(year, class_name)`` 点名对象。"""

    scope = resolve_dianming_read_scope(user)
    if scope.is_global:
        return scope

    requested_year = year.strip()
    requested_class = class_name.strip()
    if requested_year != scope.year or requested_class != scope.class_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问其他班级的点名名单",
        )
    return scope
