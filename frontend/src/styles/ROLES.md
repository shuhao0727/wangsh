# WangSh 角色权限边界规范

## 5 角色层级

```
super_admin（超级管理员）
  └── admin（管理员）
        └── teacher（教师）
              └── student（学生）
                    └── guest（访客）
```

上级自动拥有下级全部权限。代码中：
- `isStaff()` = teacher OR admin OR super_admin
- `isAdmin()` = admin OR super_admin
- `isSuperAdmin()` = super_admin only

## 完整权限矩阵

### 用户管理

| 操作 | super_admin | admin | teacher |
|------|:--:|:--:|:--:|
| 查看用户列表 | ✅ | ✅ | ❌ |
| 创建用户 | ✅ | ❌ | ❌ |
| 编辑用户 | ✅ | ✅（仅自己+学生/教师） | ❌ |
| 删除用户 | ✅ | ❌（不可删管理员/超管） | ❌ |
| 导入学生/教师 | ✅ | ✅（不可导入管理员） | ❌ |
| 修改角色 | ✅ | ✅（仅限 student/teacher） | ❌ |

### 侧边栏菜单可见性

| 菜单项 | super_admin | admin | teacher |
|--------|:--:|:--:|:--:|
| 状态概览 | ✅ | ✅ | ✅ |
| AI智能体管理 | ✅ | ✅ | ❌ |
| 用户管理 | ✅ | ✅ | ❌ |
| 智能体数据 | ✅ | ✅ | ❌ |
| 小组讨论 | ✅ | ✅ | ❌ |
| 自适应测评 | ✅ | ✅ | ✅ |
| 课堂互动 | ✅ | ✅ | ✅ |
| 课堂计划 | ✅ | ✅ | ✅ |
| 信息学竞赛 | ✅ | ❌ | ✅ |
| 信息技术 | ✅ | ❌ | ✅ |
| 个人程序 | ✅ | ❌ | ❌ |
| 文章管理 | ✅ | ❌ | ❌ |
| 系统设置 | ✅ | ❌ | ❌ |

### 关键区分

| 能力 | 管理员 | 教师 |
|------|:--:|:--:|
| 管用户 | ✅ | ❌ |
| 管AI智能体 | ✅ | ❌ |
| 管数据 | ✅ | ❌ |
| 课堂互动 | ✅ | ✅ |
| 课堂计划 | ✅ | ✅ |
| 自适应测评 | ✅ | ✅ |
| 学科内容（信息学/IT） | ❌ | ✅ |

### 前端权限

| 文件 | 作用 |
|------|------|
| `hooks/useAuth.ts` | `isSuperAdmin()`, `isAdmin()`, `isTeacher()`, `isStaff()`, `isStudent()` |
| `components/Auth/AdminGuard.tsx` | 路由守卫：`isStaff()` 准入 `/admin/*` |
| `layouts/AdminLayout.tsx` | 侧边栏白名单：`menuWhitelist` 按角色过滤 |
| `components/Auth/UserMenu.tsx` | 右上角角色标签 + 后端管理入口 |
| `pages/Auth/Login.tsx` | 登录成功后按角色跳转 |

### 后端权限

| 文件 | 作用 |
|------|------|
| `core/deps.py` | `require_super_admin()`, `require_admin()`, `require_staff()`, `require_student()` |
| `services/auth.py` | 统一认证：`authenticate_user()` 支持姓名+学号 |
| `api/endpoints/management/users/users.py` | 管理员保护：不可修改/删除超管和管理员 |
| `api/endpoints/auth/auth.py` | 登录端点：JWT 签发 |

### 添加新角色 checklist

1. `backend/app/models/core/user.py` — comment 更新
2. `backend/app/core/deps.py` — 新增 require_xxx()（如需要）
3. `backend/app/services/auth.py` — role_code 加入查询条件
4. `frontend/src/hooks/useAuth.ts` — isXxx() + 导出
5. `frontend/src/layouts/AdminLayout.tsx` — menuWhitelist + ROLE_LABELS
6. `frontend/src/components/Auth/UserMenu.tsx` — getRoleText() + getAvatarColor()
7. `frontend/src/pages/Admin/Users/data.ts` — roleOptions
8. `frontend/src/pages/Admin/Users/columns.tsx` — variantMap + labels
9. 本文档更新
