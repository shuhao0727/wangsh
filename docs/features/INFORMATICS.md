# 信息学竞赛笔记系统文档

> 最后更新：2026-03-26

## 概述

信息学竞赛笔记系统基于 Typst 排版引擎，支持在线编辑、PDF 渲染、GitHub 同步等功能。

### 核心功能

- **Typst 编辑器**：在线编辑 Typst 源码
- **PDF 渲染**：异步编译为 PDF
- **笔记分类**：树形分类管理
- **样式管理**：自定义 Typst 样式模板
- **GitHub 同步**：自动同步到 GitHub 仓库
- **资源管理**：上传图片、附件等资源

---

## 架构设计

### 数据模型

**核心表**：
- `znt_typst_notes` - Typst 笔记
- `znt_typst_categories` - 笔记分类
- `znt_typst_styles` - Typst 样式
- `znt_typst_assets` - 笔记资源
- `znt_github_sync_configs` - GitHub 同步配置
- `znt_github_sync_runs` - 同步记录

**笔记字段**：
- `title` - 笔记标题
- `content` - Typst 源码
- `category_id` - 分类 ID
- `style_key` - 样式键
- `is_published` - 是否公开
- `pdf_path` - PDF 文件路径
- `github_path` - GitHub 文件路径

---

## Typst 编辑器

### 编辑器功能

- **语法高亮**：Typst 语法高亮
- **实时预览**：编辑后实时渲染 PDF
- **快捷键**：支持常用编辑快捷键
- **资源插入**：快速插入图片、表格等

### 编译流程

1. 用户编辑 Typst 源码
2. 点击编译按钮
3. 后端创建 Celery 异步任务
4. typst-worker 执行编译
5. 编译完成后保存 PDF 文件
6. 返回 PDF 路径给前端

---

## PDF 渲染服务

### typst-worker

**服务配置**：
- 容器名：`wangsh-typst-worker`
- 队列：`typst`
- 并发数：2（可配置）

**编译参数**：
- 超时时间：30 秒
- 内存限制：512MB
- 字体目录：`/app/fonts`

### 异步编译

**同步编译**：`POST /informatics/typst-notes/{note_id}/compile`
- 适用于小文件
- 立即返回 PDF

**异步编译**：`POST /informatics/typst-notes/{note_id}/compile-async`
- 适用于大文件
- 返回任务 ID
- 轮询任务状态：`GET /informatics/typst-notes/compile-jobs/{job_id}`

---

## 笔记分类

### 树形结构

支持多级分类：
```
算法
├── 基础算法
│   ├── 排序
│   └── 搜索
└── 高级算法
    ├── 动态规划
    └── 图论
```

### 分类管理

- 创建分类
- 更新分类
- 删除分类（级联删除子分类）
- 移动分类

---

## 样式管理

### 样式模板

Typst 样式模板示例：
```typst
#let my_style(doc) = {
  set page(
    paper: "a4",
    margin: (x: 2cm, y: 2cm)
  )
  set text(
    font: "Source Han Serif SC",
    size: 12pt
  )
  doc
}
```

### 样式应用

笔记引用样式：
```typst
#import "/styles/my_style.typ": *
#show: my_style

= 标题
内容...
```

---

## GitHub 同步

### 同步配置

- `repo_owner` - 仓库所有者
- `repo_name` - 仓库名称
- `repo_branch` - 分支名称
- `github_token` - GitHub Token
- `sync_interval_hours` - 同步间隔（小时）
- `delete_mode` - 删除模式（delete、unpublish）

### 同步流程

1. 定时任务触发同步
2. 获取所有已发布笔记
3. 对比 GitHub 仓库文件
4. 上传新增/修改的笔记
5. 删除/取消发布已删除的笔记
6. 记录同步结果

### 删除模式

- **delete**：直接删除 GitHub 文件
- **unpublish**：取消发布，保留本地记录

---

## API 端点

详见 [API.md](../development/API.md) 第九章节：信息学笔记

### 核心端点

- `POST /informatics/typst-notes` - 创建笔记
- `PUT /informatics/typst-notes/{note_id}` - 更新笔记
- `POST /informatics/typst-notes/{note_id}/compile` - 编译 PDF
- `GET /informatics/typst-notes/{note_id}/export.pdf` - 导出 PDF
- `POST /informatics/sync/github/trigger` - 触发同步

---

## 前端实现

### 核心组件

**位置**：`/Users/wsh/wangsh/frontend/src/pages/Informatics/`

**主要文件**：
- `index.tsx` - 笔记列表
- `Reader.tsx` - 笔记阅读器
- `Editor.tsx` - Typst 编辑器
- `CategoryTree.tsx` - 分类树

### UI 优化

- 搜索栏全 Tailwind 化
- Tree 组件全 Tailwind 化
- Loading 全 Tailwind 化
- 网格卡片 + hover 效果

---

## 使用场景

### 场景 1：创建笔记

1. 选择分类
2. 输入标题
3. 编辑 Typst 源码
4. 编译预览 PDF
5. 保存笔记

### 场景 2：同步到 GitHub

1. 配置 GitHub 仓库信息
2. 设置同步间隔
3. 触发手动同步或等待定时同步
4. 查看同步记录

---

## 故障排查

### PDF 编译失败

1. 检查 typst-worker 服务是否运行
2. 检查 Typst 语法是否正确
3. 检查字体文件是否存在
4. 查看 worker 日志

### GitHub 同步失败

1. 检查 GitHub Token 是否有效
2. 检查仓库权限
3. 检查网络连接
4. 查看同步记录错误信息

---

## 相关文件

### 后端

- `/Users/wsh/wangsh/backend/app/api/endpoints/informatics/` - API 路由
- `/Users/wsh/wangsh/backend/app/models/informatics/` - 数据模型
- `/Users/wsh/wangsh/backend/app/tasks/typst.py` - Celery 任务

### 前端

- `/Users/wsh/wangsh/frontend/src/pages/Informatics/` - 页面组件

---

## 最佳实践

1. **编译前保存**：编译前先保存笔记，避免丢失
2. **资源路径**：使用相对路径引用资源
3. **样式复用**：使用样式模板，保持风格一致
4. **定期同步**：设置合理的同步间隔
5. **备份重要笔记**：定期导出 PDF 备份
