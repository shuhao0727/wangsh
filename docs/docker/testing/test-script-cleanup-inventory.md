# 测试脚本清理清单

本清单用于约束“测试脚本清理”只做低风险动作，先识别引用关系，再决定保留、归档、删除。

当前索引入口：[`README.md`](README.md)

适用范围：

- `backend/scripts/`
- `scripts/`
- `frontend/scripts/`
- `test-results/prod-smoke/`

本轮原则：

- 不改业务功能文件。
- 不删除仍被 CI、`npm scripts`、README、`scripts/prod-smoke/run.py` 直接引用的脚本。
- 先删可重建产物，再处理老旧脚本。

## 必须保留

### 1. 当前生产烟测主链路

- `scripts/prod-smoke/run.sh`
  - 原因：生产烟测统一入口。
  - 引用：人工执行入口；内部调用 `scripts/prod-smoke/run.py`。
  - 风险：删除或移动会直接导致生产烟测不可执行。
- `scripts/prod-smoke/run.py`
  - 原因：生产环境 API/UI/worker 测试编排器。
  - 引用：`scripts/prod-smoke/run.sh`。
  - 风险：删除或移动会直接破坏生产测试主流程。

### 2. 被 `prod-smoke` 编排器直接调用的后端脚本

- `backend/scripts/smoke_openapi_sweep.py`
- `backend/scripts/smoke_feature_suite.py`
- `backend/scripts/smoke_assessment_flow.py`
- `backend/scripts/smoke_xxjs_dianming.py`
- `backend/scripts/smoke_full_deploy.py`
- `backend/scripts/smoke_group_discussion.py`
- `backend/scripts/smoke_typst_pipeline.py`
- `backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`
- `backend/scripts/smoke_pythonlab_dap_step_watch_soak.py`
- `backend/scripts/smoke_pythonlab_print_visibility_probe.py`
  - 原因：当前生产烟测矩阵的真实执行脚本。
  - 引用：`scripts/prod-smoke/run.py`。
  - 风险：删除或移动会让对应模块测试缺失或整轮中断。

### 3. 仍被 CI / README 明确引用的 PythonLab 脚本

- `backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`
- `backend/scripts/smoke_pythonlab_print_visibility_probe.py`
- `backend/scripts/soak_pythonlab_phasec.py`
  - 原因：除 `prod-smoke` 外，还承担 PythonLab 专项验证。
  - 引用：
    - `README.md`
    - `.github/workflows/pythonlab-owner-concurrency.yml`
    - `.github/workflows/pythonlab-phasec-gate.yml`
    - `.github/workflows/pr-pythonlab-owner-gate.yml`
    - `.github/workflows/pr-pythonlab-phasec-gate.yml`
    - `docs/features/PYTHONLAB.md`
    - `docs/docker/deploy/CICD.md`
  - 风险：删除会破坏专项门禁与项目说明。

### 4. 前端 UI 审计链路

- `frontend/scripts/ui-audit.mjs`
- `frontend/scripts/ui-audit-baseline.json`
- `frontend/scripts/ui-visual-routes.json`
  - 原因：前端 UI 审计命令的核心实现和基线数据。
  - 引用：
    - `frontend/package.json`
    - `.github/workflows/ci-quality.yml`
  - 风险：删除会直接打断 `npm run ui:audit:ci`。
- `frontend/scripts/ui-migration-metrics.mjs`
  - 原因：仍保留在 npm 脚本和治理文档中。
  - 引用：
    - `frontend/package.json`
    - `docs/docker/plans/ui-upgrade-plan.md`
  - 风险：删除会破坏现有治理命令。
- `frontend/scripts/ui-page-workflow.mjs`
  - 原因：仍保留在 npm 脚本中，属于人工治理工具。
  - 引用：`frontend/package.json`
  - 风险：删除会让 `ui:page:report` / `ui:page:verify` 失效。
- `frontend/scripts/prod-smoke-ui.mjs`
  - 原因：生产烟测 UI 步骤入口。
  - 引用：`scripts/prod-smoke/run.py`
  - 风险：删除会导致 UI 烟测缺失。

### 5. XBK 本地重建与回归工具

- `scripts/xbk/run_all.py`
- `scripts/xbk/seed.py`
- `scripts/xbk/import_samples.py`
- `scripts/xbk/smoke.py`
- `scripts/xbk/common.py`
- `scripts/xbk/dataset.py`
- `scripts/xbk/README.md`
  - 原因：XBK 已经形成独立的重建、导入、冒烟链路。
  - 引用：`scripts/xbk/run_all.py` 内部调用；人工测试入口。
  - 风险：删除会破坏 XBK 当前真实数据验证流程。

## 已删除

以下文件当前未发现 CI、README、`prod-smoke`、`npm scripts` 的直接引用，已经完成观察期并在本轮物理删除。

- `backend/scripts/e2e_assessment.py`
  - 原因：固定账号、固定接口的早期端到端脚本，和当前 `smoke_assessment_flow.py` 职责重叠。
  - 删除位置：`backend/scripts/archive/e2e_assessment.py`
  - 风险：低，但可能有个人临时使用习惯。
- `backend/scripts/e2e_assessment_phase3.py`
  - 原因：依赖直连数据库和历史画像流程，明显是阶段性验证脚本。
  - 删除位置：`backend/scripts/archive/e2e_assessment_phase3.py`
  - 风险：低。
- `backend/scripts/seed_demo_data.py`
  - 原因：写入展示型模拟数据，和“真实库 + 真实链路”方向相反。
  - 删除位置：`backend/scripts/archive/seed_demo_data.py`
  - 风险：低。
- `backend/scripts/seed_mock_agent_data.py`
  - 原因：批量生成 mock 智能体/用户数据，且脚本内含运行时安装依赖逻辑，不适合继续作为正式入口。
  - 删除位置：`backend/scripts/archive/seed_mock_agent_data.py`
  - 风险：低到中。
- `backend/scripts/smoke_ai_agent_key_management.py`
  - 原因：专项接口验证，未接入当前主测试链。
  - 删除位置：`backend/scripts/archive/smoke_ai_agent_key_management.py`
  - 风险：低。
- `backend/scripts/xbk_verify.py`
  - 原因：旧版 XBK 验证脚本，已被 `scripts/xbk/` 体系替代。
  - 删除位置：`backend/scripts/archive/xbk_verify.py`
  - 风险：低。
- `scripts/api-smoke-local.sh`
  - 原因：面向旧本地环境的简易探针，已被 `prod-smoke` 替代。
  - 删除位置：`scripts/archive/api-smoke-local.sh`
  - 风险：低。
- `scripts/debug_group_visibility.py`
  - 原因：群聊可见性问题的临时排障脚本。
  - 删除位置：`scripts/archive/debug_group_visibility.py`
  - 风险：低。
- `scripts/debug_public_config.py`
  - 原因：公开配置切换的临时排障脚本。
  - 删除位置：`scripts/archive/debug_public_config.py`
  - 风险：低。
- `scripts/load60_p0.py`
  - 原因：PythonLab 压测型脚本，不在当前门禁链路内。
  - 删除位置：`scripts/archive/load60_p0.py`
  - 风险：中，已完成归档观察后删除。
- `scripts/reproduce_update_400.py`
  - 原因：AI 智能体更新 400 的问题复现脚本，明显为一次性排障产物。
  - 删除位置：`scripts/archive/reproduce_update_400.py`
  - 风险：低。
- `scripts/smoke_test_all.py`
  - 原因：历史“全量 smoke”入口，已被 `scripts/prod-smoke/run.py` 替代。
  - 删除位置：`scripts/archive/smoke_test_all.py`
  - 风险：低。
- `frontend/scripts/capture_pythonlab_task12_screenshots.cjs`
  - 原因：只在归档文档里留下痕迹，属于截图采集脚本，不是当前治理入口。
  - 删除位置：`frontend/scripts/archive/capture_pythonlab_task12_screenshots.cjs`
  - 风险：低。

- `frontend/public/stream-test.html`
  - 原因：未被前端路由、npm、CI 或文档引用的手工 SSE 测试页。
  - 删除位置：`frontend/public/stream-test.html`
  - 风险：低。

- `backend/scripts/__pycache__/smoke_pythonlab_print_visibility_probe.cpython-313.pyc`
  - 原因：Python 缓存产物，可自动重建。
  - 删除位置：`backend/scripts/__pycache__/smoke_pythonlab_print_visibility_probe.cpython-313.pyc`
  - 风险：极低。

- `scripts/prod-smoke/__pycache__/run.cpython-313.pyc`
  - 原因：Python 缓存产物，可自动重建。
  - 删除位置：`scripts/prod-smoke/__pycache__/run.cpython-313.pyc`
  - 风险：极低。

## 可删除

### 1. 生产烟测生成产物

- `test-results/prod-smoke/` 下所有输出文件
  - 原因：全部为可重建产物，包括报告、截图、服务日志、步骤日志。
  - 引用：无脚本对历史产物做反向依赖；`scripts/prod-smoke/run.py` 和 `frontend/scripts/prod-smoke-ui.mjs` 会自动重建目录。
  - 风险：极低。

### 1.1 前端构建产物

- `frontend/build/` 下所有输出文件
  - 原因：Vite 生产构建产物，包含 hash 资源、静态复制文件和过期残留页面，全部可通过 `npm run build` 重建。
  - 引用：无源码反向依赖；当前仓库以源码、Docker 构建和 Vite 构建流程为主。
  - 风险：低。删除后若需要静态产物，只需重新构建。

### 2. 前端测试文件清理边界

- 不允许直接按 `frontend/src/**/*.test.*` 做一刀切删除。
- 尤其是 `frontend/src/pages/Admin/ITTechnology/pythonLab/**/*.test.*`
  - 原因：这批文件虽然当前没有接入 CI 主链，但承担的是 PythonLab 核心算法、流程图教学示范、布局美化、调试映射、DAP 行为、存储兼容的回归规范作用。
  - 范围：已恢复 46 个 PythonLab 相关测试文件，以及 `frontend/src/jest-globals.d.ts`。
  - 结论：按“保留的规格测试”处理，不再归入“死测试源码”。
- 其他前端测试文件如果要继续清理，必须逐类核对它们是不是源码契约测试、教学样例测试或功能回归测试，不能仅凭“未接入 npm test”删除。

本轮已执行：

- 清空 `test-results/prod-smoke/` 现有输出。
- 清空 `frontend/build/` 现有输出。
- 删除已完成归档观察的老旧测试脚本。
- 删除重复前端测试入口别名 `ui:page:audit`，统一回 `ui:audit`。
- 删除未引用的手工测试页和 Python 缓存产物。
- 恢复 PythonLab 相关规格测试和 `jest` 全局声明。

## 暂不建议动

- `frontend/scripts/ui-page-workflow.mjs`
  - 虽然不在 CI 中，但仍挂在 `frontend/package.json`，此轮不建议直接删。
- `frontend/scripts/ui-migration-metrics.mjs`
  - 仍被 npm 脚本和治理文档引用，此轮不建议直接删。
- 所有 `docs/docker/archive/` 中的历史 Markdown
  - 它们已经进入归档层，除非下一轮做“文档瘦身”，否则本轮不动。

## 本轮验证

- 验证 `frontend` UI 审计脚本仍可执行。
- 验证 `scripts/prod-smoke/run.py` 在删除历史产物后仍可被 Python 正常加载。
- 验证收缩后的前端审计入口仍统一为 `npm run ui:audit -- --route ...`。

## 下一轮建议

1. 继续只清理未接入 CI/npm/prod-smoke 的一次性测试脚本。
2. 对每次删除同步维护索引，避免 README 和实际文件状态脱节。
3. 保留 `backend/tests/`、当前 `smoke_*`、`frontend/scripts/*.mjs` 等现行链路文件不动。
4. PythonLab、流程图、调试映射、算法美化相关测试默认按“保留”处理，除非先完成逐文件角色审计。
5. 如果还要继续收缩，下一轮只建议清理 `data/` 下明确可重建的本地运行残留，不建议再动后端 pytest 或当前文档模板。
