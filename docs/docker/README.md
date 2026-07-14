# Docker 文档中心

`docs/docker/` 现在承接项目里和 Docker 生产部署、运维协作、测试治理、前端专项整理、阶段计划归档有关的通用 Markdown 文档。

这里的目标只有两个：

- 让通用说明文件集中，不再散落在仓库根层
- 不去打扰模块就近说明，例如 `backend/tests/README.md`、`backend/docker/pythonlab-sandbox/README.md`、`scripts/xbk/README.md`

## 当前结构

- [RELEASE_NOTES.md](RELEASE_NOTES.md) - 发布记录与运维变更
- [deploy/DEPLOY.md](deploy/DEPLOY.md) - Docker 开发/生产部署指南
- [deploy/CICD.md](deploy/CICD.md) - 镜像、工作流与 CI/CD 说明
- [plans/README.md](plans/README.md) - 计划与分析索引
- [testing/README.md](testing/README.md) - 测试与验证入口
- [frontend/README.md](frontend/README.md) - 前端 UI 文档索引
- [archive/README.md](archive/README.md) - 归档文档

## 前端

`docs/docker/frontend/` 存放前端专项的 UI 审计、页面清单和视觉规范，重点是界面治理，不替代 [`docs/`](../README.md) 中的正式功能文档。

### 当前保留文档

- [frontend/UI-PAGES.md](frontend/UI-PAGES.md) - 前端核心页面与重点浮层清单
- [frontend/ACCESSIBILITY_GUIDE.md](frontend/ACCESSIBILITY_GUIDE.md) - 无障碍访问改进指南
- [plans/ui-single-page-governance.md](plans/ui-single-page-governance.md) - UI 样式、单页治理、体检模板和回归基线

### 归档报告

历史 UI 审计与修复报告已合并至 [archive/README.md](archive/README.md)。

### 前端策略

- 入口层只保留可持续复用的页面清单、无障碍指南和 UI 治理入口。
- 带明确时间戳、且已标记"问题全部修复"的 UI 审计报告统一转入 `archive/`，
  并更新 `archive/README.md`；需要建立专题子目录时再同步创建索引。
- 保留：页面清单、视觉规范、长期治理规则。
- 归档：一次性审计、修复快照、最终复盘报告。

## 计划文档

`docs/docker/plans/` 保留当前计划、治理基线、复用模板和仍承担稳定参考作用的文档。

### 当前入口文档

- [plans/README.md](plans/README.md) - 当前计划、reference、redirect 的完整索引
- [../features/PYTHONLAB.md](../features/PYTHONLAB.md#能力边界) - PythonLab 能力矩阵与删除/拆分边界
- [plans/ui-single-page-governance.md](plans/ui-single-page-governance.md) - UI 治理与回归唯一参考
- [plans/2026-07-11-project-health-and-improvement-report.md](plans/2026-07-11-project-health-and-improvement-report.md) - 2026-07-13 项目健康快照
- [plans/2026-07-11-project-governance-30-60-90-execution-plan.md](plans/2026-07-11-project-governance-30-60-90-execution-plan.md) - 30/60/90 天详细任务、验证和退出标准
- [plans/2026-07-12-project-consolidation-and-release-plan.md](plans/2026-07-12-project-consolidation-and-release-plan.md) - 当前整理、提交、PR 和发布收口计划
- [plans/2026-07-11-change-batch-manifest.md](plans/2026-07-11-change-batch-manifest.md) - 当前工作区变更批次和提交边界

### 已归档计划

归档总览请查看 [archive/README.md](archive/README.md)。

### 计划策略

- 当前入口层只保留仍要执行的计划、治理基线、回归台账、复用模板和稳定参考文档。
- 已完成、明显带时间戳、且长期结论已沉淀到 owner 文档的分析报告统一转入
  `archive/`，并更新 `archive/README.md`。

## 测试

`docs/docker/testing/` 用来集中放和测试治理、测试目录说明、清理策略、烟测入口有关的文档。

### 当前入口

- [testing/README.md](testing/README.md) - 测试策略和 owner 导航
- [testing/TEST_STATUS.md](testing/TEST_STATUS.md) - 当前测试事实、证据和待执行门禁
- [testing/test-script-cleanup-inventory.md](testing/test-script-cleanup-inventory.md) - 历史路径 redirect
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
