# XXJS 点名系统

> 最后更新：2026-07-07

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
| `created_at` | DateTime | 创建时间（服务端默认值） |
| `updated_at` | DateTime | 更新时间（自动更新） |

**唯一约束**：`(year, class_name, student_name)` 通过 `uq_xxjs_dianming_student` 约束保证同一班级内不重复。

---

## API 端点

所有端点在 `/xxjs/dianming` 路由前缀下注册。读操作需登录认证，写操作需管理员权限。

### 读操作（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/xxjs/dianming/classes` | 获取班级列表（聚合视图，含各班级学生数），按年份降序、班级名称升序排列 |
| `GET` | `/xxjs/dianming/students` | 获取指定班级学生名单，query 参数 `year` + `class_name` |

### 写操作（需管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/xxjs/dianming/import` | 批量导入（追加模式），`names_text` 换行分隔姓名，`ON CONFLICT DO NOTHING` 去重 |
| `DELETE` | `/xxjs/dianming/class` | 删除整个班级，query 参数 `year` + `class_name`，返回删除条数 |
| `PUT` | `/xxjs/dianming/class/students` | 覆盖替换班级学生名单（先删后插），请求体同 import |

### 请求/响应 Schema

**DianmingImportRequest**：
```json
{
  "year": "2024级",
  "class_name": "软件工程1班",
  "names_text": "张三\n李四\n王五"
}
```

**DianmingStudent 响应**：
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

---

## 前端页面

点名系统管理员页面集成在 IT Technology 管理后台中（`/admin/it-technology` 下的"点名管理"标签页）。

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

前端还提供了点名播放器页面 `frontend/src/pages/ITTechnology/RollCallPlayer.tsx`，用于上课时随机抽取学生，详情参考教学技术页面。

---

## 相关文档

- [API 参考](../development/API.md) — 第十一章：信息技术（/xxjs）

## 相关文件

### 后端

- `backend/app/api/endpoints/xxjs/dianming.py` — API 端点
- `backend/app/models/xxjs/dianming.py` — 数据模型
- `backend/app/schemas/xxjs/dianming.py` — Pydantic Schema
- `backend/tests/xxjs/test_dianming.py` — 单元测试
- `backend/alembic/versions/1655cf329617_add_xxjs_dianming.py` — 数据库迁移

### 前端

- `frontend/src/pages/Admin/ITTechnology/DianmingManager.tsx` — 管理员管理页面
- `frontend/src/pages/ITTechnology/RollCallPlayer.tsx` — 课堂点名播放器
- `frontend/src/services/xxjs/dianming.ts` — API 客户端
