# WangSh

## 本地开发

**开发配置**：请使用 `.env.dev`（可从 `.env.example` 复制）。`start-dev.sh` 会自动优先加载它。

```bash
cp .env.example .env.dev
bash start-dev.sh
```

停止：

```bash
bash stop-dev.sh
```

## 生产部署（Docker Compose）

**生产配置**：请使用 `.env` (复制自 `.env.example`)。`scripts/deploy.sh` 默认使用它。

看文档： [DEPLOY.md](./DEPLOY.md)

最常用的一键部署命令（服务器上）：

```bash
cp .env.example .env
# 修改 .env 中的密钥和配置
bash scripts/deploy.sh deploy
```

登录过期配置（短时登录）：

```env
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
```

说明：
- `ACCESS_TOKEN_EXPIRE_MINUTES`：访问令牌有效期（到期后会走刷新流程）
- `REFRESH_TOKEN_EXPIRE_DAYS`：刷新令牌有效期（到期后需要重新登录）

## CI 并发调试回归

并发互斥回归脚本：

```bash
python backend/scripts/smoke_pythonlab_ws_owner_concurrency.py
```

常用 CI 运行方式：

```bash
# 单次自动探测 + 严格复跑断言（推荐）
OWNER_MODE=matrix python backend/scripts/smoke_pythonlab_ws_owner_concurrency.py

# 指定目标策略做强约束（当前环境预期为 steal）
OWNER_MODE=matrix EXPECT_OWNER_BEHAVIOR=steal python backend/scripts/smoke_pythonlab_ws_owner_concurrency.py
```

Phase C 最小可见性探针：

```bash
PYTHONLAB_SANDBOX_IMAGE=pythonlab-sandbox:py311-local TIMEOUT_SECONDS=20 python backend/scripts/smoke_pythonlab_print_visibility_probe.py
```

探针判定口径：
- 成功：输出 `phase c probe passed`，且 summary 显示 markers 全可见且有序
- 失败：返回 `category=network/detect/assert`，用于定位“未进入 DAP 响应 / 事件丢失 / 顺序异常”
- 若出现 `session failed: debugpy readiness timeout after 30s`：优先检查 sandbox 容器日志（`docker logs pythonlab_u33`）与镜像架构兼容性，再继续排查 DAP 链路
- 可进一步查看容器内 debugpy 诊断日志：`/tmp/debugpy/debugpy.adapter-*.log`、`/tmp/debugpy/debugpy.server-*.log`、`/tmp/debugpy/debugpy.pydevd.*.log`

Phase C 长时巡检（推荐先预热探针再跑门禁）：

```bash
TIMEOUT_SECONDS=20 python backend/scripts/smoke_pythonlab_print_visibility_probe.py
API_URL=http://localhost:8000 ROUNDS=50 TIMEOUT_SECONDS=20 python backend/scripts/soak_pythonlab_phasec.py
```

巡检产物：
- 逐轮日志：`/tmp/phasec_soak/run_*.log`
- 汇总结果：`/tmp/phasec_soak/summary.json`

GitHub Actions（手动触发）：
- 工作流：`pythonlab-owner-concurrency`
- 必要 secrets：`PYTHONLAB_SMOKE_USERNAME`、`PYTHONLAB_SMOKE_PASSWORD`
- 已启用定时巡检：每天 UTC `02:30`
- 可选 vars（用于 schedule 默认值）：`PYTHONLAB_API_URL`、`PYTHONLAB_OWNER_MODE`、`PYTHONLAB_EXPECT_OWNER_BEHAVIOR`、`PYTHONLAB_TIMEOUT_SECONDS`、`PYTHONLAB_ISSUE_DEDUPE_WINDOW`、`PYTHONLAB_ISSUE_DEDUPE_DIMENSION`
- 建议分支保护必选检查项：`owner-concurrency-smoke`

GitHub Actions（Phase C 可见性门禁）：
- 工作流：`pythonlab-phasec-gate`
- PR 门禁包装：`pr-pythonlab-phasec-gate`
- 必要 secrets：`PYTHONLAB_SMOKE_USERNAME`、`PYTHONLAB_SMOKE_PASSWORD`
- 可选 vars：`PYTHONLAB_API_URL`、`PYTHONLAB_PHASEC_ROUNDS`、`PYTHONLAB_TIMEOUT_SECONDS`
- 建议分支保护必选检查项：`phasec-visibility-gate`

GitHub Actions（可复用调用）：

```yaml
jobs:
  pythonlab-owner-gate:
    uses: ./.github/workflows/pythonlab-owner-concurrency.yml
    with:
      api_url: https://your-api.example.com
      owner_mode: matrix
      expect_owner_behavior: steal
      timeout_seconds: "8"
      dedupe_window: day
      dedupe_dimension: category_api
    secrets:
      PYTHONLAB_SMOKE_USERNAME: ${{ secrets.PYTHONLAB_SMOKE_USERNAME }}
      PYTHONLAB_SMOKE_PASSWORD: ${{ secrets.PYTHONLAB_SMOKE_PASSWORD }}
```

PR 门禁工作流（已落地）：
- 文件：`.github/workflows/pr-pythonlab-owner-gate.yml`
- 触发：`pull_request`（仅当改动调试互斥相关路径）和 `workflow_dispatch`
- fork PR 保护：来自 fork 的 PR 自动跳过门禁执行，避免 secrets 暴露

门禁接入建议（分支保护）：
- 必选检查：`owner-concurrency-pr-gate / owner-concurrency-smoke`
- 允许跳过场景：fork PR（工作流自动跳过）

失败提单模板：
- 文件：`.github/ISSUE_TEMPLATE/pythonlab-owner-concurrency-failure.yml`
- 使用方式：在失败运行页复制 `GITHUB_STEP_SUMMARY` 与关键日志，按模板提交 issue
- 最低字段：`category`、`exit_code`、`workflow_run_url`、`api_url`、`owner_mode`
- 自动建单：`pythonlab-owner-concurrency` 在 `assert/detect` 失败时自动创建 issue（仅非 fork 场景）
- 去重策略：支持 `dedupe_window=day|week` 与 `dedupe_dimension=category|category_api`，命中同聚合键时追加评论而非重复建单
- 自动关闭：后续门禁成功时，按同聚合键为 `assert/detect` 历史 open issue 追加恢复评论并自动关闭
- 统计摘要：每次运行在 `GITHUB_STEP_SUMMARY` 输出 `issue_created/issue_appended/issue_closed/resolve_comment_added`

退出码约定：
- `0`：成功
- `2`：参数错误
- `3`：网络错误
- `4`：行为探测失败
- `5`：断言失败
- `10`：未知异常

## 文档索引

- 接口清单：[docs/API.md](./docs/API.md)
- CI/CD 说明：[docs/CICD.md](./docs/CICD.md)
- 自主检测总览：[docs/ASSESSMENT_DESIGN.md](./docs/ASSESSMENT_DESIGN.md)
- 自主检测 API：[docs/ASSESSMENT_API.md](./docs/ASSESSMENT_API.md)
- 自主检测前端：[docs/ASSESSMENT_FRONTEND.md](./docs/ASSESSMENT_FRONTEND.md)
