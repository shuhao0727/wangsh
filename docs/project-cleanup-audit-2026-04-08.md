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

1. 继续收敛 PythonLab 运行/调试双引擎状态模型
2. 统一 DAP 与 Pyodide 的能力边界
3. 继续做真实浏览器回归，特别是多断点继续到结束
4. 清理剩余只服务于历史阶段的文档或实验脚本

## 当前结论

- 现在最值得优先保留的，是稳定性修复和错误边界知识
- 现在最值得优先清理的，是无消费者的开发钩子、版本漂移和误导性文档
- `/api/v1/debug` 兼容层已经下线，后续如果还有调用方报错，应直接迁移到 `/api/v2/pythonlab/*`
