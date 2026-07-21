# 前端脚本说明

> 详细文档请参考：`docs/scripts/ARCHIVE_INDEX.md`

`frontend/scripts/` 只保留当前仍接入 npm 命令、CI 或生产烟测链路的脚本。

## 当前入口

- `copy-pyodide.js` - `predev` / `prebuild` 复制 Pyodide 资源；仅在目标目录包含
  当前依赖版本 marker 和全部非空核心文件时跳过
- `bundle-budget.mjs` - `build:check` / `ui:migration:gate` 包体预算门禁；读取 Vite `build/.vite/manifest.json`，递归扫描 `build/assets/`，并将独立 Worker JS 和复制到 `build/pyodide/` 的生产运行时纳入总量
- `token-check.mjs` - `token:check:ci` CSS token 完整性门禁；检查 `src/` 中所有 `var(--ws-*)` 引用是否在 `src/styles/index.css` 定义
- `auth-replaced-login-smoke.mjs` - 同账号二次登录踢下线提示专项生产烟测
- `pythonlab-debug-smoke.mjs` - PythonLab 运行/调试 UI 专项烟测
- `prod-smoke-ui.mjs` - 生产烟测的浏览器 UI 步骤入口；页面加载成功但预期操作控件
  缺失时记录为 `WARN`，不会误记为 `PASS`
- `ui-audit.mjs` - UI 审计主脚本
- `ui-audit-baseline.json` - UI 审计基线
- `ui-visual-routes.json` - UI 审计页面清单
- `ui-page-workflow.mjs` - 单页治理工作流
- `ui-migration-metrics.mjs` - UI 迁移指标统计

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

## 生成产物与配置文件

- `ui-audit-baseline.json` 是 UI 审计基线文件，属于受控生成产物；只有在确认 UI 变化符合预期后才更新基线。刷新时必须先审计当前 `HEAD`，新基线不得高于修复前快照，不能用抬高阈值掩盖本轮新增命中。
- `ui-visual-routes.json` 是 UI 审计路由清单；新增、删除或重命名页面后必须同步更新。
- Vite 生产构建必须生成 `build/.vite/manifest.json`；包体预算从 `isEntry` 沿静态 `imports` 计算 Entry，从 `dynamicImports` 沿动态分支计算 Deferred，同一 chunk 同时被静态和动态引用时按 Entry 计，Worker 始终独立按 Deferred 计。
- Monaco 及其 React 包装器由 Rollup 跟随 PythonLab 动态入口自然分包，避免手工
  `monaco-vendor` 吸收共享 helper 后反向进入首屏；`echarts-vendor` 只包含 ECharts
  核心包，`echarts-for-react` 与 `zrender` 跟随按需页面分包。
- 包体预算会单独报告 Entry、Deferred 和 Worker JS；Pyodide 静态运行时按
  Deferred 计入总量。manifest 缺失、`build/assets/` 没有 JS、移动 Worker/Pyodide
  输出目录、漏扫子目录或超过现有阈值都会使门禁失败，不得通过提高阈值绕过失败。
- `copy-pyodide.js` 从 `node_modules/pyodide/package.json` 读取版本，并在目标目录写入
  `.wangsh-pyodide-version`。版本不匹配、marker 缺失或任一核心文件缺失/为空时，
  先复制到 `public/pyodide.tmp-<pid>`，完整校验后再替换正式目录；替换时先将旧运行时
  原子改名为进程级备份，激活新目录失败会恢复旧运行时，成功后才删除备份。
- `test:scripts` 使用 Node test runner 执行 `scripts/*.test.mjs`，新增脚本测试后会自动纳入，
  包括 bundle budget、Pyodide 版本/完整性、Docker 构建上下文、生产 UI smoke 分类与
  token checker。
- token checker 对带 fallback 的 `var(--ws-token, fallback)` 同样要求 token 已定义，禁止用 fallback 掩盖设计系统缺口。
- 单页治理报告默认生成到 `../test-results/ui-page-reports/`，作为可重建验证产物，
  不进入正式文档或历史归档。

## 维护规则

- 未接入 `package.json`、CI 或 `prod-smoke` 的一次性脚本不再保留。
- 截图采集、手工调试、临时验证脚本统一清理，不回流到本目录。
- PythonLab 调试控制区一旦涉及 `tooltip / hover / pointer / focus` 相关改动，必须补跑真实 Chrome channel 与 WebKit。
