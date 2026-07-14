# 项目文档索引

`docs/` 只放稳定、长期维护的说明文档。部署运维、测试治理、阶段计划、前端专项和历史归档类 Markdown 统一收拢到 [`docs/docker/`](docker/README.md)。

## 快速导航

- [../README.md](../README.md) - 项目入口和本地开发说明
- [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md) - 文档维护、owner、生命周期和自动整理规则
- [ENGINEERING_GOVERNANCE.md](ENGINEERING_GOVERNANCE.md) - 文件规模、模块边界、质量门禁、迁移和发布条例
- [docker/README.md](docker/README.md) - Docker 文档中心（部署、测试、计划、前端专项、归档）

## 核心文档

- [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md) - 文档治理唯一权威入口
- [ENGINEERING_GOVERNANCE.md](ENGINEERING_GOVERNANCE.md) - 工程治理和稳定发布规则
- [DATABASE_PERFORMANCE_GUIDE.md](DATABASE_PERFORMANCE_GUIDE.md) - 数据库性能分析与优化指南（整合版）
- [docker/RELEASE_NOTES.md](docker/RELEASE_NOTES.md) - 发布与运维记录
- [development/API.md](development/API.md) - API 接口文档
- [docker/deploy/DEPLOY.md](docker/deploy/DEPLOY.md) - 完整部署指南（开发/生产环境）
- [docker/deploy/CICD.md](docker/deploy/CICD.md) - CI/CD 配置说明

## Docker 文档中心 (`docker/`)

- [docker/README.md](docker/README.md) - Docker 文档总入口
- [docker/deploy/DEPLOY.md](docker/deploy/DEPLOY.md) - 部署、启动与环境变量说明
- [docker/deploy/CICD.md](docker/deploy/CICD.md) - 工作流、镜像与 CI 门禁说明
- [docker/README.md#测试](docker/README.md#测试) - 测试与验证入口
- [docker/README.md#前端](docker/README.md#前端) - 前端专项文档入口
- [docker/frontend/ACCESSIBILITY_GUIDE.md](docker/frontend/ACCESSIBILITY_GUIDE.md) - 无障碍改进指南
- [docker/README.md#计划文档](docker/README.md#计划文档) - 当前计划与治理入口
- [docker/archive/README.md](docker/archive/README.md) - 历史文档归档索引

### 当前计划与治理 (`docker/plans/`)

- [docker/plans/README.md](docker/plans/README.md) - 当前计划、reference、redirect 的完整索引
- [docker/plans/2026-07-11-project-health-and-improvement-report.md](docker/plans/2026-07-11-project-health-and-improvement-report.md) - 2026-07-13 项目健康快照与风险判断
- [docker/plans/2026-07-11-project-governance-30-60-90-execution-plan.md](docker/plans/2026-07-11-project-governance-30-60-90-execution-plan.md) - 30/60/90 天详细执行计划与验收标准
- [docker/plans/2026-07-12-project-consolidation-and-release-plan.md](docker/plans/2026-07-12-project-consolidation-and-release-plan.md) - 当前整理、提交和发布收口计划
- [docker/plans/2026-07-11-change-batch-manifest.md](docker/plans/2026-07-11-change-batch-manifest.md) - 当前工作区变更批次和提交边界

> 已归档计划详见 [docker/archive/README.md](docker/archive/README.md)

## 功能模块 (`features/`)

- [features/AI_AGENTS.md](features/AI_AGENTS.md) - AI 智能体系统（多平台、SSE 流式、分组讨论）
- [features/CLASSROOM.md](features/CLASSROOM.md) - 课堂互动系统（活动、计划、AI 分析）
- [features/INFORMATICS.md](features/INFORMATICS.md) - 信息学笔记系统（Typst 编辑、PDF 渲染）
- [features/PYTHONLAB.md](features/PYTHONLAB.md) - Python 在线实验室（Docker 沙箱、DAP 调试）
- [features/AUTO_REFRESH.md](features/AUTO_REFRESH.md) - SSE 实时推送机制
- [features/IT_GAMES.md](features/IT_GAMES.md) - IT 游戏资源库（上传/下载/安全校验）
- [features/LEARNING.md](features/LEARNING.md) - 学习平台（章节/内容/思维导图/进度）
- [features/ML_BOOK.md](features/ML_BOOK.md) - ML/AI/Agents 学习书籍系统
- [features/DIANMING.md](features/DIANMING.md) - XXJS 点名系统
- [features/XBK.md](features/XBK.md) - 校本课选课系统
- [features/ARTICLES.md](features/ARTICLES.md) - 文章管理系统

### 评估系统 (`features/assessment/`)

- [features/assessment/ASSESSMENT_DESIGN.md](features/assessment/ASSESSMENT_DESIGN.md) - 系统设计总览
- [features/assessment/ASSESSMENT_DATABASE.md](features/assessment/ASSESSMENT_DATABASE.md) - 数据库设计（7 张表）
- [features/assessment/ASSESSMENT_API.md](features/assessment/ASSESSMENT_API.md) - API 接口设计
- [features/assessment/ASSESSMENT_FRONTEND.md](features/assessment/ASSESSMENT_FRONTEND.md) - 前端实现
- [features/assessment/ASSESSMENT_FILES.md](features/assessment/ASSESSMENT_FILES.md) - 文件清单
- [features/assessment/ASSESSMENT_PROMPTS.md](features/assessment/ASSESSMENT_PROMPTS.md) - AI 提示词设计
- [features/assessment/hot_agent.md](features/assessment/hot_agent.md) - 热点问题教学诊断智能体指令
- [features/assessment/chain_agent.md](features/assessment/chain_agent.md) - 学生问题链认知诊断智能体指令

## 开发协作 (`development/`)

- [development/API.md](development/API.md) - API 接口文档

## 脚本与测试文档 (`scripts/`)

### 脚本文档中心
- [scripts/ARCHIVE_INDEX.md](scripts/ARCHIVE_INDEX.md) - 脚本归档索引（历史脚本清理记录）

### 就近说明文档
- [../backend/tests/README.md](../backend/tests/README.md) - 后端测试说明
- [../backend/scripts/README.md](../backend/scripts/README.md) - 后端 smoke/soak 脚本说明
- [../scripts/README.md](../scripts/README.md) - 根层运维与生产烟测脚本说明
- [../frontend/scripts/README.md](../frontend/scripts/README.md) - 前端脚本说明
- [../scripts/xbk/README.md](../scripts/xbk/README.md) - XBK 脚本使用说明

## 整理约定

- 稳定文档放 `docs/`
- 部署运维、测试治理、规划、迁移、审计、治理台账和前端专项文档统一放 `docs/docker/`
- 模块专用说明优先就近放在模块目录，例如 `backend/tests/README.md`
- 文档归属、生命周期、redirect/archive/delete 条件遵守 [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md)
