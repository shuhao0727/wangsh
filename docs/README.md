# 项目文档索引

## 核心文档

- [README.md](../README.md) - 项目概览和快速开始
- [RELEASE_NOTES.md](RELEASE_NOTES.md) - 版本发布说明
- [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md) - 文档维护规范

## 部署运维 (`deploy/`)

- [DEPLOY.md](deploy/DEPLOY.md) - 完整部署指南（开发/生产环境）
- [CICD.md](deploy/CICD.md) - CI/CD 配置说明
- [database-migration-fix.md](deploy/database-migration-fix.md) - 数据库迁移修复方案
- [migration_analysis.md](deploy/migration_analysis.md) - 历史迁移链分析

## 功能模块 (`features/`)

- [AI_AGENTS.md](features/AI_AGENTS.md) - AI 智能体系统（多平台、SSE 流式、分组讨论）
- [CLASSROOM.md](features/CLASSROOM.md) - 课堂互动系统（活动、计划、AI 分析）
- [INFORMATICS.md](features/INFORMATICS.md) - 信息学笔记系统（Typst 编辑、PDF 渲染）
- [PYTHONLAB.md](features/PYTHONLAB.md) - Python 在线实验室（Docker 沙箱、DAP 调试）
- [AUTO_REFRESH.md](features/AUTO_REFRESH.md) - SSE 实时推送机制

### 评估系统 (`features/assessment/`)

- [ASSESSMENT_DESIGN.md](features/assessment/ASSESSMENT_DESIGN.md) - 系统设计总览
- [ASSESSMENT_DATABASE.md](features/assessment/ASSESSMENT_DATABASE.md) - 数据库设计（7张表）
- [ASSESSMENT_API.md](features/assessment/ASSESSMENT_API.md) - API 接口设计
- [ASSESSMENT_FRONTEND.md](features/assessment/ASSESSMENT_FRONTEND.md) - 前端实现
- [ASSESSMENT_FILES.md](features/assessment/ASSESSMENT_FILES.md) - 文件清单
- [ASSESSMENT_PROMPTS.md](features/assessment/ASSESSMENT_PROMPTS.md) - AI 提示词设计

## 开发指南 (`development/`)

- [API.md](development/API.md) - API 接口文档
- [CLAUDE_GUIDE.md](development/CLAUDE_GUIDE.md) - Claude AI 协作指南
- [CLAUDE_MEMORY.md](development/CLAUDE_MEMORY.md) - 项目知识快照

## 测试文档

- [../backend/tests/README.md](../backend/tests/README.md) - 后端测试说明

## 最近更新

### 2026-03-31
- ✅ v1.5.3 发布：代码质量提升 + 认证修复 + 架构优化
- ✅ pub/sub 提取到独立模块 `app/core/pubsub.py`
- ✅ main.py lifespan 拆分到 `app/core/startup.py`
- ✅ 访客 401 修复，文章搜索改用公开 API
- ✅ 课堂计划 12 个新测试用例
- ✅ 全量文档更新与整理

### 2026-03-25
- ✅ 数据库迁移系统修复
- ✅ 课堂互动填空题显示修复
- ✅ AI分析进度显示和字数限制
