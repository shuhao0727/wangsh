# 项目整理审计记录

> 记录日期：2026-04-08
> 目标：把“可以立即清理的内容”和“需要专门验证后再删除的历史兼容层”分开，避免再次把真实线上问题和无关噪声混在一起。

## 已确认并已处理的问题

### 1. 生产静态资源回退导致模块脚本 MIME 错误

- 现象：
  - 浏览器报错 `Failed to load module script`
  - 资源 URL 指向 `/assets/*.js`，但服务端返回了 `text/html`
- 根因：
  - Caddy 把缺失的构建产物错误回退到了 `index.html`
- 已处理：
  - `frontend/caddy/Caddyfile.prod`
  - `gateway/Caddyfile`
  - 现在 `/assets/*`、`/static/*`、`/pyodide/*` 缺失时返回 `404`，不再伪装成 HTML 模块脚本

### 2. PythonLab Continue 卡死

- 根因已单独记录：
  - `docs/features/PYTHONLAB_DEBUG_CONTINUE_REGRESSION_2026-04-08.md`
- 结论：
  - 问题属于前端调试按钮 hover/tooltip 交互兼容性，不是后端 DAP 死循环

### 3. PythonLab 双引擎能力分叉导致的伪调试状态

- 现象：
  - `launchPlan` 已经规定“有断点就走 DAP”，但前端仍可能把 `Pyodide` 普通运行展示成“可继续 / 可暂停 / 可监视 / 可求值”
  - UI 和 unified runner 会继续向 `Pyodide` 下发调试语义，制造误导性的 paused / continue 入口
- 根因：
  - 运行策略已经迁移到 DAP 优先，但 capability map、控制矩阵、launch control、unified runner 仍保留“Pyodide 也能调试”的历史语义
- 已处理：
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/adapters/debugCapabilityMap.ts`
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useUnifiedRunner.ts`
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts`
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/workers/pyodideRunner.worker.ts`
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/core/debugLaunchControl.ts`
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/DebugTab.tsx`
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/launchPlan.ts`
- 规则：
  - `Pyodide` 只承接普通运行
  - 断点调试语义只允许走 DAP
  - `Pyodide` 下只保留“断点可设置、点击调试会切到 DAP”的提示，不再暴露伪调试按钮
  - `Pyodide` worker 内部仅保留 plain-run 与 `input()` 终端桥接，不再维护暂停、单步、求值、watch 等旧调试分支

### 4. 本地开发脚本退出后前后端一起消失

- 现象：
  - `./start-dev.sh` 显示启动成功，但命令退出后 `8000/6608` 很快失活
  - `celery.log` 出现 `SIGHUP not supported`
- 根因：
  - 本地模式使用 `nohup ... & disown` 依赖父 shell 脱离，在当前 macOS 环境里不稳定
  - `uvicorn --reload`、`vite`、`celery` 仍会被父进程退出路径影响
- 已处理：
  - `start-dev.sh` 改为通过 Python `subprocess.Popen(..., start_new_session=True)` 启动本地后端、Celery、前端
  - 同时补齐 local 模式下 Redis / DB / Celery 相关环境变量导出
- 验证：
  - `./start-dev.sh` 退出后，`http://localhost:8000/health` 与 `http://localhost:6608` 仍可访问
  - 完整通过 `frontend/scripts/pythonlab-debug-smoke.mjs` 的 16 个场景

## 不是项目 Bug 的噪声

- 浏览器扩展 `Obsidian Clipper` 注入的 `content.js` 报错：
  - `Failed to execute 'getRangeAt' on 'Selection': 0 is not a valid index`
- 这类报错来自浏览器扩展内容脚本，不属于仓库代码
- 排查线上问题时不要把这类日志当成项目回归

## 可以立即删除的本地生成物

以下内容属于构建/测试/运行时产物，可以本地清理，不应该作为功能代码提交：

- `backend/.pytest_cache`
- `backend/__pycache__`
- `backend/venv`
- `frontend/build`
- `frontend/node_modules`
- `frontend/test-results`
- `frontend/public/pyodide`
- `data`
- `output`
- `.playwright-cli`

## 本次顺手收掉的低风险清理

- 删除无仓库内消费者的开发快照钩子：
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`
  - 删除 `window.__pythonlabRunnerSnapshot`
- 统一部署与文档口径：
  - 前端 lockfile 版本统一到 `1.5.5`
  - PythonLab 文档内存基线统一到 `128MB`
  - 部署文档版本统一到 `1.5.5`
  - `docker-compose.yml` 中占位 `pythonlab-sandbox` 服务内存说明统一到 `128M`

## 已完成的兼容层收口

### `/api/v1/debug` 兼容层

- 已在本轮清理中删除：
  - `/api/v1/debug/*` 路由注册
  - `backend/app/api/endpoints/debug/` 兼容包装层
  - `backend/app/api/pythonlab/compat.py`
  - `backend/app/api/pythonlab/compat_routes.py`
  - `/api/v2/pythonlab/compat/deprecated_usage`
  - system overview / metrics 中的 deprecated alias 观测项
- 当前仓库内 PythonLab 对外入口只保留 `/api/v2/pythonlab/*`

## 下一批建议

如果要继续做“大清理”，正确顺序应该是：

1. 清理剩余只服务于历史阶段的文档或实验脚本
2. 继续监控真实浏览器日志里的非阻断告警，例如重复 key / 非功能性噪声
3. 视需要把 PythonLab 的 smoke 拆进 CI，避免回归再次靠人工发现

## 当前结论

- 现在最值得优先保留的，是稳定性修复和错误边界知识
- 现在最值得优先清理的，是无消费者的开发钩子、版本漂移和误导性文档
- `/api/v1/debug` 兼容层已经下线，后续如果还有调用方报错，应直接迁移到 `/api/v2/pythonlab/*`
