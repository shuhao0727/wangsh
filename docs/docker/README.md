# Docker 文档中心

`docs/docker/` 现在承接项目里和 Docker 生产部署、运维协作、测试治理、前端专项整理、阶段计划归档有关的通用 Markdown 文档。

这里的目标只有两个：

- 让通用说明文件集中，不再散落在仓库根层
- 不去打扰模块就近说明，例如 `backend/tests/README.md`、`backend/docker/pythonlab-sandbox/README.md`、`scripts/xbk/README.md`

## 当前结构

- [RELEASE_NOTES.md](RELEASE_NOTES.md) - 发布记录与运维变更
- [deploy/DEPLOY.md](deploy/DEPLOY.md) - Docker 开发/生产部署指南
- [deploy/CICD.md](deploy/CICD.md) - 镜像、工作流与 CI/CD 说明
- [../ARCHIVE_SUMMARY.md](../ARCHIVE_SUMMARY.md) - 历史归档摘要

## 前端

`docs/docker/frontend/` 存放前端专项的 UI 审计、页面清单和视觉规范，重点是界面治理，不替代 [`docs/`](../README.md) 中的正式功能文档。

### 当前保留文档

- [frontend/UI-PAGES.md](frontend/UI-PAGES.md) - 前端可见页面清单
- [frontend/ui-style-guardrails.md](frontend/ui-style-guardrails.md) - UI 风格护栏和视觉约束
- [frontend/ACCESSIBILITY_GUIDE.md](frontend/ACCESSIBILITY_GUIDE.md) - 无障碍访问改进指南

### 归档报告

历史 UI 审计与修复报告已合并至 [../ARCHIVE_SUMMARY.md](../ARCHIVE_SUMMARY.md)。

### 前端策略

- 入口层只保留可持续复用的页面清单和样式规则。
- 带明确时间戳、且已标记"问题全部修复"的 UI 审计报告统一转入 `archive/frontend-ui/`。
- 保留：页面清单、视觉规范、长期治理规则。
- 归档：一次性审计、修复快照、最终复盘报告。

## 计划文档

`docs/docker/plans/` 只保留当前仍在推进的计划、治理基线和复用模板。

### 当前活跃文档

- [plans/pythonlab-capability-inventory.md](plans/pythonlab-capability-inventory.md) - PythonLab 能力盘点与删除前核对清单
- [plans/sse-redis-pubsub-migration.md](plans/sse-redis-pubsub-migration.md) - SSE pub/sub 从进程内迁移到 Redis 的方案
- [plans/2026-05-03-learning-platform-improvement.md](plans/2026-05-03-learning-platform-improvement.md) - ML/AI/Agents 学习平台改进实施计划
- [plans/2026-05-03-it-technology-markdown-book-system.md](plans/2026-05-03-it-technology-markdown-book-system.md) - IT Technology Markdown Book 系统实施计划
- [plans/2026-05-03-learning-platform-improvement-design.md](plans/2026-05-03-learning-platform-improvement-design.md) - 学习平台设计说明
- [plans/ui-single-page-governance.md](plans/ui-single-page-governance.md) - 单页治理基线
- [plans/ui-page-health-template.md](plans/ui-page-health-template.md) - 单页体检模板
- [plans/ui-final-regression-checklist.md](plans/ui-final-regression-checklist.md) - UI 回归检查清单

### 已归档计划

归档总览请查看 [../ARCHIVE_SUMMARY.md](../ARCHIVE_SUMMARY.md)。

### 计划策略

- 当前入口层只保留"仍要继续执行"的计划、治理基线、回归台账和复用模板。
- 已完成、明显带时间戳、或内容已经被后续改动覆盖的分析报告统一转入 `archive/plans/`。

## 测试

`docs/docker/testing/` 用来集中放和测试治理、测试目录说明、清理策略、烟测入口有关的文档。

### 当前入口

- [testing/test-script-cleanup-inventory.md](testing/test-script-cleanup-inventory.md) - 测试脚本保留/归档/删除清单
- [../DOCUMENTATION_RULES.md](../DOCUMENTATION_RULES.md) - 文档维护规范

### 就近测试说明

- [../../backend/tests/README.md](../../backend/tests/README.md) - 后端 pytest 目录说明与常用命令
- [../../backend/scripts/README.md](../../backend/scripts/README.md) - 后端 smoke/soak 脚本说明
- [../../scripts/README.md](../../scripts/README.md) - 根层运维、生产烟测与 XBK 脚本入口
- [../../frontend/scripts/README.md](../../frontend/scripts/README.md) - 前端 UI 审计、页面治理和 UI smoke 脚本入口
- [../../scripts/xbk/README.md](../../scripts/xbk/README.md) - XBK 独立重建与回归说明

### 目录约定

- `backend/tests/`：后端 pytest 用例本体
- `backend/scripts/`：后端 smoke/soak/专项验证脚本
- `scripts/prod-smoke/`：生产环境全链路烟测编排入口
- `frontend/scripts/`：前端 UI 审计、迁移统计、页面治理、UI smoke
- `docs/docker/testing/`：测试治理文档与清理台账

### 测试整理原则

- 不把后端 pytest 用例从 `backend/tests/` 挪走。
- 模块专用说明优先就近放在模块目录。
- 测试治理、清理策略、跨模块测试索引统一收敛到这里。

## 归档规则

- 当前仍需执行、维护、复用的说明：放在 `deploy/`、`testing/`、`frontend/`、`plans/`
- 已完成、仅保留追溯价值的历史说明：放在 `archive/`
- 模块专用说明：继续就近放在模块目录，不强行搬迁
