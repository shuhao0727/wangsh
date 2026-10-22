# XXJS 点名系统

> 最后更新：2026-10-20（源码/路由核对；未发布候选记录原文保留）

## 第一批未发布候选：对象级读取授权（2026-09-14）

- 点名名单以 `(year, class_name)` 作为读取对象。`admin` 和 `super_admin` 保留全局治理
  读取；学生只可读取认证身份中 `study_year + class_name` 对应的本班名单。
- 学生请求跨班、跨学年，或认证身份缺少可核验的学年/班级映射时，在名单查询前返回
  `403`；班级聚合列表也只返回本人的授权范围。授权结果不缓存。
- **教师点名授权的数据源和关系模型尚未建立。** 当前不能把 `teacher` 角色本身当作全校
  名单权限，因此教师读取点名班级列表或名单会安全拒绝并返回 `403`。后续必须先建立
  明确、可撤销的教师—班级授权关系，再开放相应读取。
- 未知角色同样拒绝。该实现是未发布候选，尚未完成真实认证链和专用 PostgreSQL 验证。
- 代码现状（2026-10-20 复核）：`resolve_dianming_read_scope` 已按上述规则实现，两个读端点
  `GET /classes`、`GET /students` 均先经过该裁决；`backend/tests/xxjs/test_dianming_object_access.py`
  已存在，但本轮未运行测试。

> 状态更新（2026-10-20）：该授权代码随提交 `ce3f2b2` 入库，并已包含在
> `shuhao-Virtual-Machine` 当前运行的 `2.1.2` 生产镜像中（提交为 `296ba42` 的祖先，见
> [发布记录](../docker/RELEASE_NOTES.md)、[TEST_STATUS](../docker/testing/TEST_STATUS.md)）。
> 教师授权数据源仍未建立，教师读取保持 `403` 的结论不变；“未发布候选”措辞作为历史记录保留。

## 概述

信息技术课程专用学生点名系统。按年份和班级管理学生花名册，支持批量导入、去重、整班替换等操作，提供简洁的前端管理界面。

### 核心功能

- **按届别管理**：以年份（届别）+ 班级名称为维度组织学生名单
- **批量导入**：粘贴换行分隔的姓名列表，一键导入
- **高效去重**：利用 PostgreSQL `INSERT ... ON CONFLICT DO NOTHING` 在数据库层面去重
- **整班操作**：支持删除整个班级或覆盖替换班级学生名单
- **前端搜索**：按年份或班级名称关键字过滤

---

## 架构设计

### 数据模型

**核心表**：
- `xxjs_dianming` (XxjsDianming) — 点名系统学生名单表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `year` | String(32) | 年份/届别，带索引 |
| `class_name` | String(64) | 班级名称，带索引 |
| `student_name` | String(64) | 学生姓名 |
| `student_no` | String(64) | 学号，可空，带索引 |
| `created_at` | DateTime(timezone=True) | 创建时间（`server_default=now()`） |
| `updated_at` | DateTime(timezone=True) | 更新时间（`server_default=now()`，`onupdate` 自动更新） |

**唯一约束**：`(year, class_name, student_name)` 通过 `uq_xxjs_dianming_student` 约束保证同一班级内不重复（`backend/app/models/xxjs/dianming.py:7-10`）。`student_no` 可空且**不参与**唯一约束。

---

## API 端点

所有端点在 `/xxjs/dianming` 路由前缀下注册（应用挂载后完整前缀为
`/api/v1/xxjs/dianming`，`backend/app/api/__init__.py` 与 `backend/main.py`）。读操作需登录认证，写操作需管理员权限。

### 读操作（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xxjs/dianming/classes` | 获取班级列表（聚合视图，含各班级学生数 `count`），按年份降序、班级名称升序排列；非管理员只返回本人授权范围 |
| `GET` | `/xxjs/dianming/students` | 获取指定班级学生名单，query 参数 `year` + `class_name`，按 `student_no`、`id` 升序 |

`GET /students` 在查询前先做对象级授权（`authorize_dianming_class_read`），跨班/跨学年
返回 `403`；`GET /classes` 用 `resolve_dianming_read_scope` 过滤（`backend/app/api/endpoints/xxjs/dianming.py:37-80`）。

### 写操作（需管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/xxjs/dianming/import` | 批量导入（追加模式），`names_text` 换行分隔姓名，`ON CONFLICT (year, class_name, student_name) DO NOTHING` 去重，返回该班当前名单 |
| `DELETE` | `/xxjs/dianming/class` | 删除整个班级，query 参数 `year` + `class_name`，返回 `{"success": true, "deleted": 条数}` |
| `PUT` | `/xxjs/dianming/class/students` | 覆盖替换班级学生名单（先删后插），请求体同 import，返回该班当前名单 |

### 请求/响应 Schema

**DianmingImportRequest**：
```json
{
  "year": "2024级",
  "class_name": "软件工程1班",
  "names_text": "张三\n李四\n王五"
}
```

**DianmingStudent 响应**（schema 仅声明 `id`、`created_at` 及基础字段，不含 `updated_at`）：
```json
{
  "id": 1,
  "year": "2024级",
  "class_name": "软件工程1班",
  "student_name": "张三",
  "student_no": null,
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

## 导入性能优化

**问题**（2026-04 修复前）：导入时对每个姓名执行一次 `SELECT` 查重，产生 N+1 查询问题，大名单导入时性能瓶颈严重。

**修复**（2026-04）：将逐行查重逻辑替换为单条 PostgreSQL `INSERT INTO ... VALUES (...), (...), ... ON CONFLICT (year, class_name, student_name) DO NOTHING` 语句。所有姓名的插入和去重由数据库在一次操作中完成，消除 N+1 问题，大幅提升大批量导入性能。

注意：`PUT /class/students` 覆盖模式仍使用逐条 `db.add`，因为该端点需先清空再插入（与唯一约束冲突的 ON CONFLICT 不适用），但会在后续优化中评估批量插入方案。

补充（2026-10-20 核对）：
- `POST /import` 使用 `pg_insert(...).on_conflict_do_nothing(constraint="uq_xxjs_dianming_student")`，
  冲突目标是指名唯一约束 `uq_xxjs_dianming_student`，而不是裸 `ON CONFLICT` 子句。
- `PUT /class/students` 的“删除 + 逐条 `db.add` + 单次 `commit`”在同一事务内完成，失败时
  `rollback`，因此覆盖失败不会留下“已清空但未写入”的中间状态。
- `DianmingImportRequest` 只有 `year` / `class_name` / `names_text` 三个字段；`import` 与
  `PUT /class/students` 写入时都把 `student_no` 置为 `None`，当前没有经 API 录入学号的路径。

---

## 前端页面

点名系统管理员页面集成在 IT Technology 管理后台中（`/admin/it-technology` 应用目录里的
“随机点名”卡片，进入后为 `dianming-manager` 视图，而非独立标签页；
`frontend/src/pages/Admin/ITTechnology/index.tsx`）。

**核心组件**：
- `frontend/src/pages/Admin/ITTechnology/DianmingManager.tsx` — 管理员管理页面，含班级列表表格、搜索过滤、新建/编辑/删除弹窗
- `frontend/src/services/xxjs/dianming.ts` — 前端 API 客户端封装

**交互流程**：
1. **新建班级**：填写年份 + 班级名称，粘贴换行分隔的学生名单，提交 `POST /import`
2. **编辑班级**：点击编辑按钮，异步拉取现有学生名单填入 textarea，修改后提交 `PUT /class/students`（覆盖模式）
3. **删除班级**：确认对话框后调用 `DELETE /class`
4. **搜索过滤**：前端内存过滤，按年份或班级名称关键字搜索

**UI 规范**：使用 shadcn/ui 组件（Dialog、Form、Input、Textarea、Button），搭配 AdminTablePanel 和 DataTablePagination 实现分页表格布局。

---

## 点名播放器

前端还提供了点名播放器组件 `frontend/src/pages/ITTechnology/RollCallPlayer.tsx`，由
`frontend/src/pages/ITTechnology/index.tsx` 在“随机点名”入口内以 `rollcall-selector →
rollcall-player` 视图切换渲染（无独立路由），用于上课时随机抽取学生，详情参考教学技术页面。

---

## 相关文档

- [API 参考](../development/API.md) — 第十一章：点名系统（/xxjs）

## 相关文件

### 后端

- `backend/app/api/endpoints/xxjs/dianming.py` — API 端点
- `backend/app/models/xxjs/dianming.py` — 数据模型
- `backend/app/schemas/xxjs/dianming.py` — Pydantic Schema
- `backend/tests/xxjs/test_dianming.py` — 单元测试
- `backend/tests/xxjs/test_dianming_object_access.py` — 对象级读取授权回归
- `backend/alembic/versions/1655cf329617_add_xxjs_dianming.py` — 数据库迁移

### 前端

- `frontend/src/pages/Admin/ITTechnology/DianmingManager.tsx` — 管理员管理页面
- `frontend/src/pages/ITTechnology/RollCallPlayer.tsx` — 课堂点名播放器
- `frontend/src/services/xxjs/dianming.ts` — API 客户端
