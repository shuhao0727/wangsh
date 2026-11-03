# WangSh 角色权限边界规范

## 5 角色层级

角色为 `super_admin`、`admin`、`teacher`、`student` 和历史 `guest`。
角色不是自动继承关系；实际权限由接口守卫、对象归属和账号状态共同决定。
例如 `require_student()` 仅允许学生，管理员不能代替学生访问。

| 权限分组 | 允许角色 |
|---|---|
| `isSuperAdmin()` / `require_super_admin()` | `super_admin` |
| `isAdmin()` / `require_admin()` | `admin`、`super_admin` |
| `isStaff()` / `require_staff()` | `teacher`、`admin`、`super_admin` |
| `isStudent()` / `require_student()` | `student` |

访客浏览只适用于公开页面；AI 智能体拒绝匿名和历史 `guest` 角色。认证与账号生命周期见
[AUTH.md](../../../docs/features/AUTH.md)。

## 完整权限矩阵

### 用户管理

| 操作 | super_admin | admin | teacher |
|------|:--:|:--:|:--:|
| 查看用户列表 | ✅ | ✅ | ❌ |
| 创建用户 | ✅ | ✅（仅 student/teacher） | ❌ |
| 编辑用户 | ✅ | ✅（仅自己+学生/教师） | ❌ |
| 删除用户 | ✅ | ✅（仅 student/teacher） | ❌ |
| 批量删除用户 | ✅ | ✅（目标缺失或任一高权限目标会整批拒绝） | ❌ |
| 导入学生/教师 | ✅ | ✅（不可导入或更新管理员） | ❌ |
| 修改角色 | ✅ | ✅（仅限 student/teacher） | ❌ |

停用、删除、恢复及降权遵守持久会话撤销与最后一名活跃超级管理员保护，
`super_admin` 也不能绕过这些约束。

### 侧边栏菜单可见性

| 菜单项 | super_admin | admin | teacher |
|--------|:--:|:--:|:--:|
| 状态概览 | ✅ | ✅ | ✅ |
| AI智能体管理 | ✅ | ✅ | ❌ |
| 用户管理 | ✅ | ✅ | ❌ |
| 智能体数据 | ✅ | ✅ | ❌ |
| 小组讨论 | ✅ | ✅ | ✅ |
| 自适应测评管理 | ✅ | ✅ | ❌ |
| 课堂互动 | ✅ | ✅ | ✅ |
| 课堂计划 | ✅ | ✅ | ✅ |
| 信息学竞赛 | ✅ | ✅ | ✅ |
| 信息技术（教师直达 KNN 采集） | ✅ | ✅ | ✅（仅 KNN） |
| 个人程序 | ✅ | ❌ | ❌ |
| 文章管理 | ✅ | ❌ | ❌ |
| 系统设置 | ✅ | ❌ | ❌ |

### 关键区分

教师的信息技术菜单指向 `/admin/it-technology?view=knn`，保留已选择的 `batch` 参数。
仅此视图允许教师访问；无 `view=knn` 的应用目录和 ML 等编辑器继续要求管理员权限，
应用开关管理继续仅允许 `super_admin`。学生不可进入 KNN 管理视图，填写页免登录。
KNN 管理员可管理全部批次，教师只能管理本人创建的批次；菜单可见不替代后端归属检查。

### 前端权限

| 文件 | 作用 |
|------|------|
| `hooks/useAuth.ts` | `isSuperAdmin()`, `isAdmin()`, `isTeacher()`, `isStaff()`, `isStudent()` |
| `components/Auth/AdminGuard.tsx` | 路由守卫：`isStaff()` 准入 `/admin/*` |
| `components/Auth/ITTechnologyGuard.tsx` | IT 根路由按视图区分：`view=knn` 为教职工（`STAFF_ROLES`），其余为管理员（`IT_TECHNOLOGY_MANAGEMENT_ROLES`） |
| `components/Auth/roleAccess.ts`、`layouts/AdminLayout.tsx` | 角色分组、侧边栏白名单和教师 KNN 入口 |
| `components/Auth/UserMenu.tsx` | 右上角角色标签 + 后端管理入口 |
| `pages/Auth/Login.tsx` | 默认进入 `/home`，安全站内 redirect 与后台准入见 AUTH |

### 后端权限

| 文件 | 作用 |
|------|------|
| `core/deps.py` | `require_super_admin()`, `require_admin()`, `require_staff()`, `require_student()` |
| `services/auth.py` | 统一认证：`authenticate_user()` 以姓名、学号或用户名定位用户，凭据匹配学号或历史密码 |
| `api/endpoints/management/users/users.py` | 按上方用户管理矩阵校验，允许 admin 修改自己的资料；批量删除锁行并原子拒绝缺失或越权目标 |
| `api/endpoints/auth/auth.py` | 登录端点：JWT 签发 |

### 添加新角色 checklist

1. 明确允许的操作、对象归属和禁止的操作；检查用户模型、schema、账号治理及是否需要迁移。
2. 在 `backend/app/core/deps.py` 与对应端点落实权限；核对认证服务，不靠角色名称推断继承。
3. 同步 `useAuth.ts`、`components/Auth/roleAccess.ts`、路由守卫和 `AdminLayout.tsx`。
4. 更新 `UserMenu.tsx`、`pages/Admin/Users/data.ts` 与 `columns.tsx` 的标签和选项。
5. 补正反向权限用例并更新本文；仅隐藏菜单不算完成。
