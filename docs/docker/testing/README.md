# 测试与验证

> 状态：active
> Owner：testing
> 最近复核：2026-07-18

本目录存放测试策略、冒烟测试清单和测试脚本管理文档。

## 文档

| 文件 | 描述 |
|------|------|
| [TEST_STATUS.md](TEST_STATUS.md) | 当前唯一测试状态、功能矩阵、证据和重跑入口 |

## 测试体系概览

WangSh 项目采用多层次测试策略：

### 后端测试
- **单元测试**：`backend/tests/` — pytest + pytest-asyncio
- **当前基线**：见 [TEST_STATUS.md](TEST_STATUS.md)，本页不重复维护测试数字
- **冒烟测试**：`backend/scripts/smoke_*.py` — 覆盖所有功能模块
- **长时巡检**：`backend/scripts/soak_*.py` — PythonLab Phase C 等
- 详见 [backend/tests/README.md](../../../backend/tests/README.md) 和 [backend/scripts/README.md](../../../backend/scripts/README.md)

### 前端测试
- **单元/组件测试**：Vitest + React Testing Library
- **E2E 测试**：Playwright
- **当前结果**：见 [TEST_STATUS.md](TEST_STATUS.md)，本页不复制动态基线
- 详见 [frontend/docs/TESTING_SETUP.md](../../../frontend/docs/TESTING_SETUP.md)

### 生产冒烟
- **全量冒烟**：`scripts/prod-smoke/run.py` — 按模块顺序执行
- **证据安全**：步骤日志、Compose 服务日志、子脚本 JSON 报告和 Phase C 每轮日志
  落盘前会统一脱敏；子进程使用环境白名单，结果目录/文件使用私有权限
- 详见 [scripts/README.md](../../../scripts/README.md)

### CI 门禁
- **通用质量**：`ci-quality.yml` — pytest + 前端 type-check/lint/build
- **文档质量**：`markdown-quality.yml` — 相对链接、锚点、生命周期、归档索引、
  章节数量和动态文档统计
- **PythonLab 定时专项**：owner-concurrency + phasec-gate，验证已部署环境
- **PythonLab PR 门禁**：`pythonlab-pr-runtime.yml` 启动当前 PR 的全栈运行时，
  执行 Chromium 真实 pointer-click smoke 和 owner/Phase C 探针
- 详见 [../deploy/CICD.md](../deploy/CICD.md)

## 相关文档

- [../deploy/CICD.md](../deploy/CICD.md) — CI/CD 工作流
- [../deploy/DEPLOY.md](../deploy/DEPLOY.md) — 部署指南
