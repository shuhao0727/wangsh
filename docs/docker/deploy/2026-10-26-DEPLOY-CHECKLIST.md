# 部署准备清单（2026-10-26）

> 状态：active
> Owner：release-ops
> 最近复核：2026-10-26
> 用途：本次待部署改动的部署前检查项。通用流程见 [DEPLOY.md](DEPLOY.md)，本文只列本次特有的风险点。
> **当前状态：已推送，尚未部署。** 部署需人工执行。

## 一、本次改动概况

分支 `claude/affectionate-shirley-640fd1`，基于 `origin/main`（`b0f6202`），5 个提交：

| 提交 | 内容 |
|---|---|
| `cd868f8` | 代码审查与瘦身（死代码、复杂度、拆分、性能、回归修复） |
| `448aa98` | CI 增加 `TEST_DATABASE_URL` |
| `4ea3d69` | 热点问题按教师提问逐条归类 |
| `02805bc` | 使用记录详情 + 首页/信息技术入口嵌入式样式 |
| `76cb9c3` | 信息技术骨架屏改用 Tailwind 刻度（修 ui-audit 门禁） |

## 二、部署前必做

### 1. 执行数据库迁移（**最高优先级**）

```bash
# 只读预检
docker compose exec -T backend python /app/scripts/check_migration_state.py
bash scripts/migrate-db.sh current
```

本次新增迁移 `20261026_0001`，为 `znt_classroom_plan_items.activity_id` 建索引。

> **风险**：这是外键列，走的是 `ON DELETE CASCADE` 级联删除路径，**不是**业务查询路径。
> 漏跑 `alembic upgrade head` 不会产生任何报错，也不影响功能，只是删除课堂活动时
> 会退化成全表扫描（60k 行基准 1.722ms → 0.662ms）。属于静默的性能损失。
>
> 建索引会给 `znt_classroom_plan_items` 加短暂的写锁。数据量小时可忽略，
> 若该表较大，建议放在低峰期。

### 2. 版本号

当前 `package.json` 为 `2.1.8`，而 2.1.8 已发布过。本次若要作为新版本发布，
需按 [版本管理](DEPLOY.md#版本管理) 同步以下位置后重新构建：

```bash
APP_VERSION、IMAGE_TAG、REACT_APP_VERSION、IMAGE_REPOSITORY_PREFIX
```

`check-version-consistency.mjs` 会校验 `.env.example`、`frontend/package.json`、
`frontend/package-lock.json`、`docker-compose.yml`、`dockerhub-amd64.yml`、
`deploy.sh` 六处一致。**若沿用 2.1.8 而不升版本，镜像标签会与已发布版本冲突**，
需确认是否接受覆盖。

### 3. CI 行为变化

`448aa98` 让 CI 开始实际执行 118 个此前一直 skip 的并发/迁移测试。
推送后**首次 CI 运行可能暴露此前从未跑过的问题**，属预期。若 CI 失败，
先判断是环境差异还是真实缺陷，不要直接回退这个提交。

## 三、部署后验证

### 1. 热点归类（需教师实际参与）

进入 `/task-analysis/new` 生成一次热点分析，确认：

- 生成页能填写"教师提问标记"
- 结果页出现按类别堆叠的时间图与"按教师提问分阶段"
- 未配置分析智能体时显示降级提示

> **重要**：LLM 归类的**语义准确度尚未用真实课堂数据验收**，本地验证用的是 mock。
> 上线后需用真实课堂记录抽查标签是否合理。

> **数据前提**：2026-10-25 查询生产库时，271 条问题中**教师提问为 0 条**。
> 归类体系以教师提问为锚点，若教师仍不填写提问标记，该功能会退化为普通分类。

### 2. 使用记录详情

进入 `/admin/agent-data?tab=usage`：

- 生产构建下**不应**出现"开发预览记录"横幅（该逻辑由 `import.meta.env.DEV` 门控）
- 有真实记录时点操作列眼睛图标，确认弹窗中问题/回答分段、Markdown 正常

### 3. 首页与信息技术入口

- 首页五个模块入口同一行、无胶囊底色
- `/it-technology` 桌面两列、窄屏单列、无横向滚动条

## 四、回滚

按提交反向回退：

```bash
git revert --no-commit 76cb9c3 02805bc 4ea3d69 448aa98 cd868f8
```

迁移 `20261026_0001` 的 downgrade 只会删除索引，不影响数据。若只回退迁移：

```bash
bash scripts/migrate-db.sh downgrade 20261020_0001
```

热点归类无数据库结构变更，回退代码即可。

## 五、已验证 / 未验证

| 项 | 状态 |
|---|---|
| 后端全量 3646 passed / 0 failed | 已验证（专用测试库） |
| 前端 779 passed、tsc、lint 0 error | 已验证 |
| 每个提交独立可编译 | 已验证（隔离 worktree 逐个检出） |
| ui-audit 门禁 872 ≤ 基线 | 已验证 |
| 版本一致性 2.1.8 | 已验证 |
| 迁移 upgrade/downgrade/EXPLAIN | 已验证 |
| 浏览器实测首页 / 信息技术 / 使用记录详情（1440px + 390px） | 已验证（Playwright） |
| **热点归类 LLM 语义准确度** | **未验证**（本地为 mock） |
| **迁移应用到生产库** | **未执行** |
| **推送后首次 CI** | **未运行** |
