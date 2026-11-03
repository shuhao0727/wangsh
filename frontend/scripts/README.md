# 前端脚本说明

本目录维护 npm、CI、烟测脚本及其配置。命令均从 `frontend/` 运行；
历史清理见[归档索引](../../docs/archive/README.md)，实测结果见 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。

## 当前入口

- `copy-pyodide.js` - `predev` / `prebuild` 复制 Pyodide；跳过条件见下方完整性合同
- `bundle-budget.mjs` - `build:check` / `ui:migration:gate` 包体与最终产物门禁；读取 Vite `build/.vite/manifest.json`，递归扫描 `build/assets/`，将独立 Worker JS 和复制到 `build/pyodide/` 的生产运行时纳入总量，并确认 Mindmap 本地运行时缺失、favicon 与 KaTeX/Monaco 正式字体存在
- `token-check.mjs` - `token:check:ci` CSS token 完整性门禁；检查 `src/` 中所有 `var(--ws-*)` 引用是否在 `src/styles/index.css` 定义
- `auth-replaced-login-smoke.mjs` - 同账号二次登录提示烟测；正文提示可见才判 `PASS`，不只检查 storage/detail
- `pythonlab-debug-smoke.mjs` - PythonLab 运行/调试 UI 专项烟测；`--browser chromium` 为默认，`--browser chrome` 使用真实 Chrome channel，`--browser webkit` 验证 WebKit。CI两场景严格等待已停止、精确输出与会话清零，断点核对目标行标记；场景stdout仅输出id/status/stage及固定错误码，不发布原始错误/页面/变量内容
- `pythonlab-smoke-contracts.mjs` / `.test.mjs` - 烟测断点、完成条件和安全摘要合同，由 `test:scripts` 执行；原始JSON报告/截图仍含详细诊断，仅限授权合成环境受控保留
- `prod-smoke-ui.mjs` - 浏览器 UI 烟测；页面加载但预期控件缺失记为 `WARN`
- `ui-audit.mjs` - UI 审计主脚本
- `ui-audit-baseline.json` - UI 审计基线
- `ui-visual-routes.json` - UI 审计页面清单
- `ui-page-workflow.mjs` - 单页治理工作流
- `ui-migration-metrics.mjs` - UI 迁移指标统计
- `prod-smoke-ui-lib.mjs` - `prod-smoke-ui.mjs` 的动作分类、404 判定和状态汇总纯函数；由 `test:scripts` 覆盖
- `bundle-budget-lib.mjs` - 包体预算的 manifest 解析、chunk 汇总与产物校验纯函数；由 `test:scripts` 覆盖

## 对应 npm 命令

```bash
npm run ui:audit
npm run ui:audit:ci
npm run ui:page:report -- --route /ai-agents
npm run ui:page:verify -- --route /ai-agents
npm run ui:migration:metrics
npm run build:check
npm run pythonlab:smoke
npm run token:check:ci
npm run test:scripts
```

专项用例均已纳入 `vitest.config.ts` 默认收集，也可单独选择：

```bash
npm test -- src/hooks/useAppMeta.metadata.test.tsx
npm test -- src/layouts/AdminLayout.mobile.test.tsx src/pages/Admin/Dashboard/index.permissions.test.tsx
```

前者验证构建版本、环境标签及无网络请求；后者验证交互状态与按身份取数。
组件测试不替代真实浏览器侧栏层级、指针命中、标签裁切及网关权限验收。smoke 按授权连接专用环境，不凭命令名默认连接生产。

## 生成产物与配置文件

- `ui-audit-baseline.json` 是 UI 审计基线文件，属于受控生成产物；只有在确认 UI 变化符合预期后才更新基线。刷新时必须先审计当前 `HEAD`，新基线不得高于修复前快照，不能用抬高阈值掩盖本轮新增命中。
- `ui-visual-routes.json` 是 UI 审计路由清单；新增、删除或重命名页面后必须同步更新。
- Vite 生产构建必须生成 `build/.vite/manifest.json`；包体预算从 `isEntry` 沿静态 `imports` 计算 Entry，从 `dynamicImports` 沿动态分支计算 Deferred，同一 chunk 同时被静态和动态引用时按 Entry 计，Worker 始终独立按 Deferred 计。
- Monaco 及其 React 包装器由构建器跟随 PythonLab 动态入口自然分包，避免手工
  `monaco-vendor` 吸收共享 helper 后反向进入首屏；`echarts-vendor` 只包含 ECharts
  核心包，`echarts-for-react` 与 `zrender` 跟随按需页面分包。
- 包体预算会单独报告 Entry、Deferred 和 Worker JS；Pyodide 静态运行时按
  Deferred 计入总量。manifest 缺失、`build/assets/` 没有 JS、移动 Worker/Pyodide
  输出目录、漏扫子目录或超过现有阈值都会使门禁失败，不得通过提高阈值绕过失败。
- `copy-pyodide.js` 从 `node_modules/pyodide/package.json` 读取版本，并在目标目录写入
  `.wangsh-pyodide-version`。版本不匹配、marker 缺失或任一核心文件缺失/为空时，
  先复制到 `public/pyodide.tmp-<pid>`，完整校验后再替换正式目录；替换时先将旧运行时
  原子改名为进程级备份，激活新目录失败会恢复旧运行时，成功后才删除备份。
- Vite 开发服务器仍可读取本机 `public/mindmap-demo`，但生产构建完成后会删除
  `build/mindmap-demo`；正式 KaTeX 字体和 `favicon.svg` 不受该目录级规则影响。
- `test:scripts` 使用 Node test runner 执行 `scripts/*.test.mjs`，新增脚本测试后会自动纳入，
  包括 bundle budget、Pyodide 版本/完整性、Docker 构建上下文、生产 UI smoke 分类与
  token checker。静态资产合同只允许 Git 跟踪明确审核的
  `frontend/public/favicon.svg`；新增字体、图片、SVG、WASM 或 source map 必须先说明
  运行用途、大小和构建来源，再更新白名单。
- token checker 对带 fallback 的 `var(--ws-token, fallback)` 同样要求 token 已定义，禁止用 fallback 掩盖设计系统缺口。
- 单页治理报告默认生成到 `../test-results/ui-page-reports/`，作为可重建验证产物，
  不进入正式文档或历史归档。

## AI伙伴独立源码入口（未发布）

此标题保留已有引用；实际发布状态以 [发布记录](../../docs/operations/RELEASE_NOTES.md) 为准。

| 命令 | 职责 |
|---|---|
| `npm run type-check` | 类型检查同时覆盖主站与 `ai-partner/` 独立源码 |
| `npm run build` | 先构建主站，再独立构建 AI伙伴至 `build/games/ai-partner/` |
| `npm run build:ai-partner` | 使用 `vite.ai-partner.config.ts` 独立构建 AI伙伴 |
| `npm run dev:ai-partner` | 独立源码开发入口 |
| `npm run test:ai-partner` | AI伙伴专项测试入口 |

页面 URL 为 `/games/ai-partner/index.html`。旧 `public/games/ai-partner/` 的 `index.html`
与两份打包 JS/CSS 已移除；`favicon.svg` 保留原位及静态白名单。独立 Vite 的 `publicDir`
复用该目录，将 favicon 复制到 `build/games/ai-partner/`，不另迁到 `ai-partner/public/`。
功能边界见
[AI 智能体 owner](../../docs/features/AI_AGENTS.md#ai伙伴临时共享榜单未发布)。

## 维护规则

- 依赖只在第一方源码、构建配置或维护脚本直接使用时声明为直接依赖。清理前核对
  动态加载、Worker 和锁文件依赖链，再用 npm 同步 `package.json` 与
  `package-lock.json`；不要顺带升级无关依赖。
- 分块规则应跟随实际构建依赖。`remark-parse` 由 `react-markdown` 和 `remark-gfm`
  传递引入，继续归入 `markdown-vendor`，无需重复声明直接依赖；Typst 采用后端编译
  与 PDF 预览，不保留未接入的浏览器 Typst WASM 分块。
- 一次性截图、调试和探针放临时目录；移除旧脚本前核对调用、用途和证据保留需要，不按未接入 npm/CI 单独判定可删。
- PythonLab 涉及 `tooltip / hover / pointer / focus` 或调试切换时，验证真实 Chrome channel 与 WebKit 的点击、多断点连续 Continue，不以 JS click 或默认 Chromium 代替。

## 前端静态独立入口合同（Caddy 目录条目）

`caddy-directory-entry.test.mjs` 由 `npm run test:scripts` 默认收集，检查独立
AI Partner 的裸路径 `/games/ai-partner`、目录 `/games/ai-partner/` 和显式 HTML
入口都命中它自己的 index：`try_files {path} {path}/index.html =404`，缺失资源
仍为 404，不回退主站 SPA。它也约束 `/assets/*` 等静态资源不回退 index.html，
以及主站 SPA 兜底规则仍然保留。

历史线索：`51cf5c0` 的修复曾在 `9f84619` 回滚。当前合同同时保留 CSP 的
`cdn.jsdelivr.net` 内容运行时来源；历史提交不能代替当前候选配置验证。

**静态源码合同不替代实际 Caddy HTTP 验证**：200/404、`Cache-Control` 与
`Content-Type` 必须在获准的隔离容器中用同一候选配置逐条请求核对，记录配置身份与结果。
