# 前端脚本说明

`frontend/scripts/` 只保留当前仍接入 npm 命令、CI 或生产烟测链路的脚本。

## 当前入口

- `copy-pyodide.js` - `predev` / `prebuild` 复制 Pyodide 资源
- `pythonlab-debug-smoke.mjs` - PythonLab 运行/调试 UI 专项烟测，当前覆盖普通运行本地 happy-path、`input()` 触发的远端普通运行、多断点继续到结束、循环断点重复命中、`pause -> continue`、`step over`、`step into + step out`、`reset -> restart`，以及接管/鉴权失效/短暂断线重连/会话丢失/建会话失败等异常场景；支持通过 `--scenario <id>` 定向重跑单个场景；执行前后会清理当前用户残留调试会话，避免触发 `429` 会话上限
- `prod-smoke-ui.mjs` - 生产烟测的浏览器 UI 步骤入口
- `ui-audit.mjs` - UI 审计主脚本
- `ui-audit-baseline.json` - UI 审计基线
- `ui-visual-routes.json` - UI 审计页面清单
- `ui-page-workflow.mjs` - 单页治理工作流
- `ui-migration-metrics.mjs` - UI 迁移指标统计
- `archive/README.md` - 已删除前端历史脚本索引

## 对应 npm 命令

```bash
npm run ui:audit
npm run ui:audit:ci
npm run ui:page:report
npm run ui:page:verify
npm run ui:migration:metrics
npm run pythonlab:smoke
```

## 维护规则

- 未接入 `package.json`、CI 或 `prod-smoke` 的一次性脚本不再保留。
- 截图采集、手工调试、临时验证脚本统一清理，不回流到本目录。
- PythonLab 调试控制区一旦涉及 `tooltip / hover / pointer / focus` 相关改动，不能只跑默认 Chromium smoke，必须补跑真实 Chrome channel 与 WebKit；原因见 [`../../docs/features/PYTHONLAB_DEBUG_CONTINUE_REGRESSION_2026-04-08.md`](../../docs/features/PYTHONLAB_DEBUG_CONTINUE_REGRESSION_2026-04-08.md)。
