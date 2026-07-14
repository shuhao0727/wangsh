# 前端 UI 文档

> 状态：active
> Owner：frontend
> 最近复核：2026-07-13

本目录存放前端 UI 相关的治理文档、页面清单和无障碍指南。

## 文档

| 文件 | 描述 |
|------|------|
| [UI-PAGES.md](UI-PAGES.md) | 核心页面和重点浮层清单 |
| [ACCESSIBILITY_GUIDE.md](ACCESSIBILITY_GUIDE.md) | WCAG 2.1 AA 无障碍改进指南 |
| [../plans/ui-single-page-governance.md](../plans/ui-single-page-governance.md) | 样式护栏、单页体检和最终回归基线 |

`ui-style-guardrails.md` 仅保留旧路径 redirect。

## 前端架构概览

- **框架**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS + shadcn/ui（Radix UI 原语）
- **路由**：React Router v7，懒加载 + 布局层级
- **状态**：TanStack React Query（服务端）+ React Context（客户端）
- **代码位置**：`frontend/src/`

## 相关文档

- [../../features/](../../features/) — 各功能模块前后端设计文档
- [../deploy/DEPLOY.md](../deploy/DEPLOY.md) — 部署（含前端 Docker 构建）
- [frontend/docs/TESTING_SETUP.md](../../../frontend/docs/TESTING_SETUP.md) — 前端测试配置
