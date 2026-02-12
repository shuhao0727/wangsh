## 项目概述

WangSh是一个现代化的全栈Web平台，集成了AI智能体、信息学竞赛、信息技术、个人程序和文章管理等功能。项目采用前后端分离架构，支持本地开发与Docker部署灵活切换。

## 技术栈分析

### 前端技术
- **框架**: React 19 + TypeScript
- **UI库**: Ant Design 6.x
- **构建工具**: Create React App + CRACO（支持路径别名）
- **路由**: React Router v7
- **HTTP客户端**: Axios
- **状态管理**: 基于React Hooks的自定义状态管理

### 后端技术
- **框架**: Python FastAPI 0.128
- **数据库**: PostgreSQL + SQLAlchemy ORM + Alembic迁移
- **缓存**: Redis
- **异步任务**: Celery
- **认证**: JWT (python-jose) + 密码哈希 (Argon2)
- **配置管理**: Pydantic Settings

### 基础设施
- **容器化**: Docker + Docker Compose
- **反向代理**: Caddy（开发环境统一入口）
- **数据库**: PostgreSQL 15 + Redis 7
- **部署环境**: 支持development/docker/production三种模式

## 项目架构

### 目录结构
```
wangsh/
├── frontend/          # React前端应用
├── backend/           # FastAPI后端服务
├── caddy/             # Caddy反向代理配置
├── data/              # 持久化数据（PostgreSQL, Redis, 上传文件）
└── docker-compose.dev.yml  # 开发环境Docker编排
```

### 核心功能模块
1. **用户系统** - 统一用户表(sys_users)，支持超级管理员、管理员、学生、访客角色
2. **权限系统** - 基于角色权限映射(sys_role_permissions)的精细权限控制
3. **文章管理** - 博客文章和分类管理(wz_articles, wz_categories)
4. **AI智能体** - AI对话和配置管理(znt_agents, znt_conversations)
5. **内容分类** - 信息学竞赛、信息技术、个人程序等专题模块

### 路由架构
- **用户界面**: `/home`, `/ai-agents`, `/informatics`, `/it-technology`, `/personal-programs`, `/articles`
- **管理界面**: `/admin/dashboard`, `/admin/users`, `/admin/ai-agents`, `/admin/agent-data`, `/admin/articles`等
- **API端点**: `/api/v1/*` 通过Caddy反向代理到后端

## 开发配置特点

### 灵活的开发模式
1. **本地开发模式** - 前后端本地运行 + Docker基础设施（极致热重载体验）
2. **Docker开发模式** - 完整容器化环境（环境一致性）
3. **生产部署模式** - 优化后的生产环境配置

### 配置管理
- 环境变量驱动，支持`.env`、`.env.frontend`多级配置
- Pydantic Settings提供类型安全的配置访问
- Caddy原生环境变量语法支持

### 路径别名系统
- 使用CRACO统一管理TypeScript路径别名
- `@components`、`@services`、`@pages`等统一导入路径
- 保持TypeScript编译器和Webpack配置一致性

## 数据库设计

### 核心表（v3.0）
1. `sys_users` - 统一用户表（支持软删除）
2. `sys_permissions` - 权限定义表
3. `sys_role_permissions` - 角色权限映射表
4. `wz_articles` - 文章表
5. `wz_categories` - 文章分类表
6. `znt_agents` - AI智能体配置表
7. `znt_conversations` - 对话记录表

### 数据保护机制
- 软删除支持（`is_deleted`字段）
- 外键级联约束（`ON DELETE SET NULL`）
- 唯一索引约束防止数据重复

## 下一步建议

基于对项目的全面了解，我可以：

1. **代码审查与优化** - 检查现有代码质量，提出改进建议
2. **功能扩展** - 根据需求添加新功能模块
3. **性能优化** - 分析并优化应用性能
4. **文档完善** - 补充API文档或使用说明
5. **部署协助** - 帮助配置生产环境部署

请告诉我您希望我接下来做什么具体工作。