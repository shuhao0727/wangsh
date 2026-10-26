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
- [docker/frontend/EMBEDDED_UI_STYLE_GUIDE.md](docker/frontend/EMBEDDED_UI_STYLE_GUIDE.md) - 基于 XBK 的嵌入式页面整理规范
- [docker/frontend/UI_REDESIGN_ROADMAP.md](docker/frontend/UI_REDESIGN_ROADMAP.md) - 50 个页面族的整理路线图
- [docker/README.md#计划文档](docker/README.md#计划文档) - 当前计划与治理入口
- [docker/archive/README.md](docker/archive/README.md) - 历史文档归档索引

### 当前计划与治理 (`docker/plans/`)

- [docker/plans/README.md](docker/plans/README.md) - 当前计划与稳定 reference 索引
- [docker/plans/project-consolidation.md](docker/plans/project-consolidation.md) - 当前项目整理计划、历史审计复核和未解决台账

> 2026-09-15 文件整理、旧 2.0 标签清理和 2.1 发布闭环的历史执行计划已移入 [docker/archive/README.md](docker/archive/README.md)。
> 已完成的阶段报告、批次摘要和发布历史已压缩为一份归档摘要，详见
> [docker/archive/README.md](docker/archive/README.md)。

## 功能模块 (`features/`)

- [features/AUTH.md](features/AUTH.md) - 认证与权限系统（登录、角色层级、权限控制）
- [features/AI_AGENTS.md](features/AI_AGENTS.md) - AI 智能体系统（多平台、SSE 流式、分组讨论）
- [features/CLASSROOM.md](features/CLASSROOM.md) - 课堂互动系统（活动、计划、AI 分析）
- [features/INFORMATICS.md](features/INFORMATICS.md) - 信息学笔记系统（Typst 编辑、PDF 渲染）
- [features/PYTHONLAB.md](features/PYTHONLAB.md) - Python 在线实验室（Docker 沙箱、DAP 调试）
- [features/AUTO_REFRESH.md](features/AUTO_REFRESH.md) - SSE 实时推送机制
- [features/IT_GAMES.md](features/IT_GAMES.md) - IT 游戏资源库（上传/下载/安全校验）
- [features/KNN_SURVEY.md](features/KNN_SURVEY.md) - KNN 运动习惯采集（匿名填写、批次管理、重填与课堂数据冻结）
- [features/LEARNING.md](features/LEARNING.md) - 学习平台（章节/内容/思维导图/进度）
- [features/ML_BOOK.md](features/ML_BOOK.md) - ML/AI/Agents 学习书籍系统
- [features/DIANMING.md](features/DIANMING.md) - XXJS 点名系统
- [features/XBK.md](features/XBK.md) - 校本课选课系统
- [features/ARTICLES.md](features/ARTICLES.md) - 文章管理系统
- [features/ASSESSMENT.md](features/ASSESSMENT.md) - 自主检测系统（测评、画像、API、DB、前端和 prompt 总 owner）
- [features/DATA_ARCHIVING.md](features/DATA_ARCHIVING.md) - 对话归档与数据生命周期管理

### 评估系统 Prompt Owner (`features/assessment/`)

- [features/assessment/hot_agent.md](features/assessment/hot_agent.md) - 热点问题归类智能体指令
- [features/assessment/chain_agent.md](features/assessment/chain_agent.md) - 学生问题链认知诊断智能体指令

## 安全、隐私与数据管理 (`security/`, `compliance/`)

- [security/XSS_PROTECTION.md](security/XSS_PROTECTION.md) - 富文本、Markdown 与用户输入的 XSS 防护边界
- [compliance/GDPR.md](compliance/GDPR.md) - 隐私数据接口、审计记录和当前实现边界；不作为整体法规合规认证

## 开发协作 (`development/`)

- [development/API.md](development/API.md) - API 接口文档

## 运维监控 (`operations/`)

- [operations/MONITORING_QUICKSTART.md](operations/MONITORING_QUICKSTART.md) - AI 智能体监控快速开始
- [operations/MONITORING.md](operations/MONITORING.md) - AI 智能体监控与告警完整指南

## 脚本与测试文档 (`scripts/`)

### 脚本文档中心
- [scripts/ARCHIVE_INDEX.md](scripts/ARCHIVE_INDEX.md) - 脚本归档索引（历史脚本清理记录）

### 就近说明文档
所有模块专用说明文档（测试、脚本、工具）都在其对应模块目录下，统一由 `docs/README.md` 索引：

- [../backend/tests/README.md](../backend/tests/README.md) - 后端测试说明
- [../backend/scripts/README.md](../backend/scripts/README.md) - 后端 smoke/soak 脚本说明
- [../scripts/README.md](../scripts/README.md) - 根层运维与生产烟测脚本说明
- [../frontend/scripts/README.md](../frontend/scripts/README.md) - 前端脚本说明
- [../scripts/xbk/README.md](../scripts/xbk/README.md) - XBK 脚本使用说明

## 当前审查

- [当前项目整理台账](docker/plans/project-consolidation.md) — 已授权批次、历史发现的复核方式、未解决事项与退出证据。
- [历史审查索引](docker/archive/README.md) — 保留旧报告、反证和当时的验证范围；历史完成标记不代表当前版本重新通过。
- [当前测试状态](docker/testing/TEST_STATUS.md) — 本轮实际执行的检查、证据与未覆盖场景。

## 整理约定

- 稳定文档放 `docs/`
- 部署运维、测试治理、规划、迁移、审计、治理台账和前端专项文档统一放 `docs/docker/`
- 模块专用说明优先就近放在模块目录，例如 `backend/tests/README.md`
- 文档归属、生命周期、redirect/archive/delete 条件遵守 [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md)
