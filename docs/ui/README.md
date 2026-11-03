# 前端 UI 文档

> 状态：active
> Owner：frontend
> 最近复核：2026-10-31

本目录维护界面规范、页面清单和整理进度。本次只调整入口，不代表页面重新通过验收；
工程验证与用户确认分别记录在路线图。

## 文档

| 文件 | 描述 |
|------|------|
| [UI-PAGES.md](UI-PAGES.md) | 路由入口与重点浮层 |
| [ACCESSIBILITY_GUIDE.md](ACCESSIBILITY_GUIDE.md) | WCAG 2.1 AA 无障碍改进指南 |
| [DIALOG-AND-BREAKPOINT-GUIDE.md](DIALOG-AND-BREAKPOINT-GUIDE.md) | 对话框宽度档位与响应式断点规范 |
| [EMBEDDED_UI_STYLE_GUIDE.md](EMBEDDED_UI_STYLE_GUIDE.md) | 基于 XBK 的嵌入式页面整理规范 |
| [UI_REDESIGN_ROADMAP.md](UI_REDESIGN_ROADMAP.md) | 50 个页面族的整理顺序、状态和验收记录入口 |
| [ui-single-page-governance.md](ui-single-page-governance.md) | 样式护栏、单页体检和最终回归基线 |
| [颜色规范](../../frontend/src/styles/COLORS.md)、[角色矩阵](../../frontend/src/styles/ROLES.md) | 就近维护的配色与权限约定 |

## 前端架构概览

- **框架**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS + shadcn/ui（Radix UI 原语）
- **路由**：React Router v7，懒加载 + 布局层级
- **状态**：TanStack React Query（服务端）+ React Context（客户端）
- **代码位置**：`frontend/src/`

## 相关文档

- [功能文档](../README.md#功能合同) — 各功能模块前后端合同
- [部署指南](../operations/DEPLOY.md) — 含前端 Docker 构建
- [frontend/docs/TESTING_SETUP.md](../../frontend/docs/TESTING_SETUP.md) — 前端测试配置
