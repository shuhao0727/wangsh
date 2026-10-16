# 前端 UI 文档

> 状态：active
> Owner：frontend
> 最近复核：2026-07-18

本目录存放前端 UI 相关的治理文档、页面清单和无障碍指南。

## 文档

| 文件 | 描述 |
|------|------|
| [UI-PAGES.md](UI-PAGES.md) | 核心页面和重点浮层清单 |
| [ACCESSIBILITY_GUIDE.md](ACCESSIBILITY_GUIDE.md) | WCAG 2.1 AA 无障碍改进指南 |
| [DIALOG-AND-BREAKPOINT-GUIDE.md](DIALOG-AND-BREAKPOINT-GUIDE.md) | 对话框宽度档位与响应式断点规范 |
| [../plans/ui-single-page-governance.md](../plans/ui-single-page-governance.md) | 样式护栏、单页体检和最终回归基线 |

## 前端架构概览

- **框架**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS + shadcn/ui（Radix UI 原语）
- **路由**：React Router v7，懒加载 + 布局层级
- **状态**：TanStack React Query（服务端）+ React Context（客户端）
- **代码位置**：`frontend/src/`


### 内容运行时启动与失败恢复

可选 KaTeX/auto-render、highlight.js、Mermaid、D3/Markmap 以分组 async 脚本
加载；组间独立、组内仅前置成功后继续。应用入口先发起加载，不等待 CDN 才
挂载 React；保留固定 SRI 和 anonymous CORS，HTML 的可选 CSS 以 preload
加载后转 stylesheet。消费者需兼容先挂载后就绪，并读取当前 flag、监听事件。

`__mermaidReady` / `ws:mermaid-ready` 表示 Mermaid 脚本加载；错误为
`__mermaidLoadFailed` / `ws:mermaid-error`。`__markmapReady` 与
`ws:markmap-ready` **仅指 view/lib 核心**，不承诺可选 toolbar 成功；
D3/view/lib 失败发布 `__markmapLoadFailed` / `ws:markmap-error`，toolbar
失败不撤销已可用核心。KaTeX auto-render 用 `__katexAutoRenderReady`。

这是单次启动合同，不提供自动重试或加载超时；同模块重复启动不追加脚本，
失败时页面重载重新发起，网络一直 pending 仍可能需要重载。KaTeX/highlight
尚无独立失败事件；不得把 load callback 或模拟派发当成渲染 API、真实 CDN、
完整工具栏或富文本消费方已经成功。局测、CDN完整性与可见渲染验收分别记录。

BookReader 的 Mermaid 消费方在挂载时尝试就绪实例，并监听 `ws:mermaid-ready`；
每个代码代次只尝试一次，卸载移除监听，旧代次迟到 SVG 不覆盖新内容。
组件管理的节点带 `data-processed`，避免全局自动扫描再次把 SVG 当图表源码。渲染拒绝
保留原代码；此兼容层不引入自动重试，也不等于后续完整复合富文本修复已交付。

## 相关文档

- [../../features/](../../features/) — 各功能模块前后端设计文档
- [../deploy/DEPLOY.md](../deploy/DEPLOY.md) — 部署（含前端 Docker 构建）
- [frontend/docs/TESTING_SETUP.md](../../../frontend/docs/TESTING_SETUP.md) — 前端测试配置
