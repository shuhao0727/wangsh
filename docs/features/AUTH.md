# 认证与权限系统

## 概述

WangSh 使用统一登录系统，所有角色通过 **姓名 + 学号** 登录。系统包含 5 级角色层级：`super_admin` > `admin` > `teacher` > `student` > `guest`。

---

## 登录系统

### 登录方式

**统一登录**：所有角色（super_admin/admin/teacher/student）使用 **姓名 + 学号** 登录。

- **姓名** = `full_name`
- **学号** = `student_id`
- **向后兼容**：有 `hashed_password` 的账号也可用密码登录
- **Guest 模式**：未登录可浏览，右上角显示"访客模式"

### 登录页设计

- **布局**：分栏布局 + 4 个动画角色（Tech Cyan 配色）
- **交互**：角色眼睛跟随鼠标移动
- **跳转逻辑**：
  - `teacher` → 课堂互动
  - `admin` 或 `super_admin` → Dashboard
  - `student` → 首页

### API 端点

- **登录**：`POST /api/v1/auth/login`
  - 请求格式：`application/x-www-form-urlencoded`
  - 参数：`username`（姓名）、`password`（学号或密码）
- **登出**：`POST /api/v1/auth/logout`
- **刷新**：`POST /api/v1/auth/refresh`

---

## 角色权限系统

### 角色层级

```
super_admin (超级管理员)
    ↓
admin (管理员)
    ↓
teacher (教师)
    ↓
student (学生)
    ↓
guest (访客)
```

**详细权限矩阵**：见 [`frontend/src/styles/ROLES.md`](../../frontend/src/styles/ROLES.md)

---

## 前端权限检查

### 使用 useAuth Hook

```typescript
import useAuth from "@hooks/useAuth";

const auth = useAuth();

// 角色检查
auth.isSuperAdmin();  // 仅 super_admin
auth.isAdmin();       // admin OR super_admin
auth.isTeacher();     // 仅 teacher
auth.isStaff();       // teacher OR admin OR super_admin
auth.isStudent();     // 仅 student
```

### 路由保护

- **AdminGuard.tsx**：使用 `isStaff()` 做路由准入（教师也可进 `/admin/*`）
- **AdminLayout.tsx**：使用 `menuWhitelist` 按角色过滤侧边栏菜单
- **Login.tsx**：登录后按角色跳转

---

## 后端权限依赖

### 权限装饰器

```python
from app.core.deps import (
    require_super_admin,
    require_admin,
    require_staff,
    require_student
)

# 使用示例
@router.get("/admin-only")
async def admin_endpoint(user: dict = Depends(require_admin)):
    pass

@router.get("/staff-only")
async def staff_endpoint(user: dict = Depends(require_staff)):
    pass
```

### 权限级别说明

- `require_staff()` = teacher **OR** admin **OR** super_admin
- `require_admin()` = admin **OR** super_admin
- `require_super_admin()` = super_admin **only**

---

## 用户管理保护规则

### 管理员限制

管理员（`admin`）受以下限制保护：

1. **不能**修改或删除超级管理员（`super_admin`）
2. **不能**修改或删除其他管理员（`admin`）
3. **只能**将角色改为 `student` 或 `teacher`
4. 导入用户时**只能**导入 `student` 或 `teacher` 角色
5. 超级管理员默认不在用户列表中显示

### 超级管理员权限

超级管理员（`super_admin`）拥有完全权限，可以：

- 修改和删除所有角色用户（包括其他管理员）
- 创建和管理管理员账户
- 修改系统全局配置

---

## 修改角色系统

角色层级、权限矩阵和新增角色检查清单统一由
[ROLES.md](../../frontend/src/styles/ROLES.md) 维护，本文只说明认证流程和用户可见行为。

修改认证或权限时，至少同步检查后端权限依赖、认证服务、认证/用户端点，以及前端
`useAuth.ts`、`AdminGuard.tsx`、`AdminLayout.tsx` 和角色矩阵；不要在多个文档中复制
同一份文件清单。

---

## 相关文档

- [角色权限矩阵](../../frontend/src/styles/ROLES.md) — 详细权限列表
- [API 文档](../development/API.md) — 认证相关接口
- [AGENTS.md](../../AGENTS.md) — 开发规范
