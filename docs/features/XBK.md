# XBK 校本课选课系统

> 最后更新：2026-07-07

## 概述

XBK（校本课）模块是一个完整的校本课程选课管理系统。支持学生名单维护、课程目录管理、选课结果录入与分析，并提供 Excel 批量导入/导出功能。通过 Feature Flag 控制前台公开访问，非公开状态下仅管理员可操作。

### 核心功能

- **学生管理**：学生名单的增删改查，支持按年份、学期、年级、班级筛选
- **课程管理**：校本课程目录维护，含课程代码、任课教师、限额、上课地点
- **选课管理**：学生选课记录录入与编辑，LEFT JOIN 方式确保全部学生可见
- **数据分析**：汇总统计、课程分布、班级分布、未选课/空选课学生查询
- **Excel 导入/导出**：模板下载、预览导入、PostgreSQL upsert 执行导入、三种导出格式
- **软删除**：全部数据使用 `is_deleted` 标记实现软删除
- **Feature Flag 公开控制**：通过 `xbk_public_enabled` 开关控制前台可见性

---

## 架构设计

### 数据模型

**核心表**（均使用软删除 `is_deleted`）：

- `xbk_students` (XbkStudent) -- 学生名单
- `xbk_courses` (XbkCourse) -- 课程目录
- `xbk_selections` (XbkSelection) -- 选课记录

**XbkStudent 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `year` | Integer | 年份（如 2026） |
| `term` | String(20) | 学期（上学期/下学期） |
| `grade` | String(20) | 年级（高一/高二） |
| `class_name` | String(50) | 班级名称 |
| `student_no` | String(50) | 学号 |
| `name` | String(50) | 姓名 |
| `gender` | String(10) | 性别 |
| `is_deleted` | Boolean | 软删除标记 |

唯一约束：`(year, term, student_no)`

**XbkCourse 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `year` | Integer | 年份 |
| `term` | String(20) | 学期 |
| `grade` | String(20) | 适用年级 |
| `course_code` | String(50) | 课程代码（如 12） |
| `course_name` | String(200) | 课程名称 |
| `teacher` | String(100) | 任课教师 |
| `quota` | Integer | 限报人数，默认 0 |
| `location` | String(200) | 上课地点 |
| `is_deleted` | Boolean | 软删除标记 |

唯一约束：`(year, term, course_code)`

**XbkSelection 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `year` | Integer | 年份 |
| `term` | String(20) | 学期 |
| `grade` | String(20) | 年级 |
| `student_no` | String(50) | 学号 |
| `name` | String(50) | 姓名快照 |
| `course_code` | String(50) | 课程代码 |
| `is_deleted` | Boolean | 软删除标记 |

唯一约束：`(year, term, student_no, course_code)`

### 虚拟行处理

选课管理（selections）和选课结果（course-results）端点使用 LEFT JOIN 确保所有学生都出现在结果中：

- **有选课记录的学生**：正常显示选课信息，支持 PUT/DELETE 操作
- **无选课记录的学生**：构造 `id=0` 的虚拟行，`course_code` 显示为 "休学或其他"
- **有选课记录但 course_code 为空的学生**：显示为 "未有选择" 或 "未选"

仅 `id > 0` 的真实记录支持编辑和删除操作。

### 权限控制

- **公开模式**（Feature Flag `xbk_public_enabled` 为 true）：所有用户可查看数据，管理员可编辑
- **非公开模式**：仅 `admin` / `super_admin` 角色可访问
- 修改操作（增删改、导入导出）始终需要管理员权限

---

## API 端点

### 学生管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xbk/data/students` | 学生列表，支持 `year`/`term`/`grade`/`class_name`/`search_text` 筛选 + 分页 |
| `POST` | `/xbk/data/students` | 新增学生（若已存在软删除记录则恢复） |
| `PUT` | `/xbk/data/students/{id}` | 编辑学生信息 |
| `DELETE` | `/xbk/data/students/{id}` | 软删除学生 |

### 课程管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xbk/data/courses` | 课程列表，支持筛选 + 分页。课程代码按数字排序（非数字排最后） |
| `POST` | `/xbk/data/courses` | 新增课程，`quota` 不可为负数（若已存在软删除记录则恢复） |
| `PUT` | `/xbk/data/courses/{id}` | 编辑课程信息 |
| `DELETE` | `/xbk/data/courses/{id}` | 软删除课程 |

### 选课管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xbk/data/selections` | 选课列表（LEFT JOIN 学生表，含虚拟未选行） |
| `GET` | `/xbk/data/course-results` | 选课结果（三表 JOIN：学生 + 选课 + 课程，含完整课程信息） |
| `POST` | `/xbk/data/selections` | 新增选课记录（校验学生和课程存在） |
| `PUT` | `/xbk/data/selections/{id}` | 编辑选课记录 |
| `DELETE` | `/xbk/data/selections/{id}` | 软删除选课记录 |

### 数据分析

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xbk/analysis/summary` | 汇总统计：学生数、课程数、已选人数、未选人数、休学人数 |
| `GET` | `/xbk/analysis/course-stats` | 课程分布统计：每门课的选课人数、限额、班级允许总人数 |
| `GET` | `/xbk/analysis/class-stats` | 班级分布统计：每班学生数 |
| `GET` | `/xbk/analysis/students-with-empty-selection` | 查询选课记录为空（course_code=""）的学生 |
| `GET` | `/xbk/analysis/students-without-selection` | 查询完全没有选课记录的学生 |

### 批量操作

| 方法 | 路径 | 说明 |
|------|------|------|
| `DELETE` | `/xbk/data` | 批量删除，`scope` 可选 `all`/`students`/`courses`/`selections`，必须指定 `year` + `term` |
| `GET` | `/xbk/data/meta` | 获取筛选选项：可用年份、学期、班级列表 |

### 公开配置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xbk/public-config` | 查询 XBK 公开访问开关状态 |
| `PUT` | `/xbk/public-config` | 设置 XBK 公开访问开关（需管理员） |

### 导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xbk/import/template` | 下载导入模板（`scope` 可选 `students`/`courses`/`selections`） |
| `POST` | `/xbk/import/preview` | 预览导入：上传文件，返回列名、预览数据、错误行 |
| `POST` | `/xbk/import` | 执行导入：PostgreSQL `ON CONFLICT DO UPDATE` upsert |
| `GET` | `/xbk/export` | 导出当前表格数据（支持 `scope`/`format` 参数） |
| `GET` | `/xbk/export/{export_type}` | 多表汇总导出，`export_type` 可选 `course-selection`/`distribution`/`teacher-distribution` |

**总计：约 24 个端点**，按功能拆分为 8 个路由文件。

---

## Excel 导入导出

### 导入流程

1. **模板下载**：按 scope 下载对应模板（含中英文列名别名，如 `年份`/`year`）
2. **预览导入**：上传 Excel 文件，服务端逐行验证，返回 `valid_rows`/`invalid_rows`、列名、`preview` 数据和 `errors` 详情
3. **执行导入**：
   - Students：`ON CONFLICT (year, term, student_no) DO UPDATE`
   - Courses：`ON CONFLICT (year, term, course_code) DO UPDATE`
   - Selections：`ON CONFLICT (year, term, student_no, course_code) DO UPDATE`
   - 支持 `skip_invalid` 参数跳过无效行

### 导出格式

- **course-selection**（学生选课表）：三表 JOIN 完整数据，支持按 `yearStart`/`yearEnd` 跨年份导出
- **distribution**（各班分发表）：按班级分布的选课统计
- **teacher-distribution**（教师分发表）：按教师分布的选课统计

使用 pandas + openpyxl 生成，含格式化（表头样式、自动筛选、列宽自适应、冻结窗格）。

---

## 前端页面

### 管理后台

- `/admin/xbk` -- XBK 管理主页面（AdminLayout）

**6 个 Tab 页签**：

| Tab | 标识 | 功能 |
|-----|------|------|
| 选课结果 | `course_results` | 三表联合视图，展示学生-课程-教师完整信息 |
| 学生管理 | `students` | 学生名单 CRUD |
| 课程管理 | `courses` | 课程目录 CRUD |
| 选课管理 | `selections` | 选课记录 CRUD，含虚拟行 |
| 未选课学生 | `unselected` | 查询无选课记录的学生 |
| 休学/其他 | `suspended` | 查询选课记录为空的学生 |

### 公开页面

- `/xbk` -- 公开选课查看页面（BasicLayout，需 Feature Flag 开启）

### 核心组件

**位置**：`/Users/wsh/wangsh/frontend/src/pages/Xbk/`

| 文件 | 说明 |
|------|------|
| `index.tsx` | 主页面，Tab 切换、筛选栏、数据表格、工具栏 |
| `types.ts` | TypeScript 类型定义 |
| `className.ts` | 班级名称格式化工具（如 "高一(1)班"） |
| `components/XbkEditModal.tsx` | 新增/编辑弹窗（学生、课程、选课通用） |
| `components/XbkImportModal.tsx` | Excel 导入弹窗（预览 + 执行） |
| `components/XbkExportModal.tsx` | Excel 导出弹窗（格式选择） |
| `components/XbkDeleteModal.tsx` | 批量删除弹窗 |
| `components/XbkAnalysisModal.tsx` | 数据分析弹窗（汇总 + 图表） |
| `hooks/useXbkFilters.ts` | 筛选状态管理 Hook |
| `hooks/useXbkPagination.ts` | 分页状态管理 Hook |

**服务层**：
- `/Users/wsh/wangsh/frontend/src/services/xbk/data.ts` -- 数据 CRUD API 封装
- `/Users/wsh/wangsh/frontend/src/services/xbk/publicConfig.ts` -- 公开配置 API

---

## 使用场景

### 场景 1：新学期选课准备

1. 管理员在管理后台切换到目标年份和学期
2. 导入学生名单（下载模板 -> 填写 -> 预览 -> 执行导入）
3. 导入课程目录（同上流程）
4. 设置 XBK 公开开关（可选，控制学生端是否可见）

### 场景 2：录入选课结果

1. 管理员在「选课管理」Tab 中逐条新增学生选课记录
2. 或通过 Excel 批量导入选课结果
3. 在「选课结果」Tab 中查看完整的学生-课程-教师映射

### 场景 3：分析选课数据

1. 打开数据分析弹窗，查看汇总统计（总人数、已选、未选、休学）
2. 查看课程分布：每门课的选课人数 vs 限额 vs 允许总人数
3. 查看班级分布：各班学生人数统计
4. 导出 Excel 报表（选课表 / 班级分发表 / 教师分发表）

### 场景 4：数据清理

1. 使用批量删除功能，按 scope（all/students/courses/selections）清理指定年份学期的数据
2. 单条删除仅做软删除（`is_deleted=True`），数据可恢复

---

## 相关文件

### 后端

- `backend/app/api/endpoints/xbk/__init__.py` -- 路由注册
- `backend/app/api/endpoints/xbk/_common.py` -- 共享依赖（权限校验、通用过滤）
- `backend/app/api/endpoints/xbk/students.py` -- 学生 CRUD
- `backend/app/api/endpoints/xbk/courses.py` -- 课程 CRUD
- `backend/app/api/endpoints/xbk/selections.py` -- 选课 CRUD + 选课结果查询
- `backend/app/api/endpoints/xbk/analysis.py` -- 数据分析端点
- `backend/app/api/endpoints/xbk/bulk_ops.py` -- 批量删除 + 元数据
- `backend/app/api/endpoints/xbk/public_config.py` -- 公开配置端点
- `backend/app/api/endpoints/xbk/import_export.py` -- 导入导出端点
- `backend/app/api/endpoints/xbk/exports.py` -- 多表汇总导出端点
- `backend/app/models/xbk/` -- 数据模型
- `backend/app/schemas/xbk/` -- Pydantic schemas
- `backend/app/services/xbk/` -- 业务逻辑服务
- `backend/app/services/xbk/exports/` -- Excel 导出构建器

### 前端

- `frontend/src/pages/Xbk/index.tsx` -- 管理主页
- `frontend/src/pages/Xbk/types.ts` -- 类型定义
- `frontend/src/pages/Xbk/components/` -- UI 组件
- `frontend/src/pages/Xbk/hooks/` -- 自定义 Hooks
- `frontend/src/services/xbk/data.ts` -- API 服务
- `frontend/src/services/xbk/publicConfig.ts` -- 公开配置 API

### 测试

- `backend/tests/xbk/test_xbk_students.py`
- `backend/tests/xbk/test_xbk_courses.py`
- `backend/tests/xbk/test_xbk_selections.py`
- `backend/tests/xbk/test_xbk_structure.py`
- `backend/tests/xbk/test_xbk_import_export_rules.py`
- `backend/tests/test_xbk_performance.py`

---

## 最佳实践

1. **先导学生再导课程**：选课导入依赖学生和课程已存在，先确保基础数据完整
2. **使用模板导入**：下载模板后填写，避免列名不匹配导致的导入错误
3. **预览后再执行**：导入前先预览，确认数据无误后再执行正式导入
4. **定期数据清理**：利用批量删除功能清理过期数据，注意必须指定年份和学期
5. **公开开关谨慎使用**：确认数据准备完毕后再开启 Feature Flag，避免学生看到不完整数据
6. **关注休学学生**：选课分析中 `suspended_count` 和 `unselected_count` 含义不同，休学学生（无任何选课记录）需要单独关注

---

## 相关文档

- [API 参考](../development/API.md)
