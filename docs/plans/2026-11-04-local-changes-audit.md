# 本地 41 项未提交改动审核（2026-11-04）

> 状态：archived（2026-11-04 已执行：stash → ff-only → pop → 仅提交 8 个文档；审核结论作为处置依据保留）
> Owner：project-governance
> 审核方法：逐文件取工作区 SHA256 与 `origin/main`(2.2.8) 对比

## 一、结论先行

**41 项里，34 项（83%）的内容与已发布的 2.2.8 逐字节相同。** 它们不是"新改动"，是本地 HEAD 停在 2.2.6 造成的假象——这些开发成果早已通过 PR #17 合入 main 并部署上线。

| 分组 | 数量 | 性质 | 处置 |
|---|---|---|---|
| A. 与 2.2.8 逐字节相同 | 34 | 已发布的代码 | **丢弃**（内容已在 main，丢弃零损失） |
| B. 2.2.8 里没有的新文档 | 2 | 本轮新增证据 | **保留** |
| C. 五个文档，两端都改过 | 5 | 需逐份判断 | 见下 |

## 二、逐组详细审核

### A 组：34 项，内容 = 已发布的 2.2.8

| 类别 | 文件 | 说明 |
|---|---|---|
| 版本号（4） | `.env.dev.example`、`.env.example`、`docker-compose.yml`、`.github/workflows/dockerhub-amd64.yml`、`frontend/package.json`、`frontend/package-lock.json`、`scripts/deploy.sh` | 2.2.6→2.2.8 版本号提升，已在 main |
| 后端修复（4 M + 3 ??） | `bridge.py`、`connection_auth.py`、`handlers.py`、`docker.py` | DAP 通道 + TTY 附着修复，已在 main |
| 后端新模块（3 ??） | `dap_transport.py`、`docker_dap.py`、`docker_terminal.py` | 同上 |
| 后端测试（3 ??） | `test_docker_dap_transport.py`、`test_docker_terminal_attach.py`、`test_terminal_readiness_protocol.py` | 同上 |
| 前端修复（9 M） | `PythonLabStudio.tsx`、`XtermTerminal.tsx`、`RightPanelView.tsx`、`terminalRenderer.ts`、`debugSessionBootstrap.ts`、`useDapRunner.ts`、`useDebugSession.ts`、`RunnerActionsContext.ts` + 2 个 test | 终端就绪门控，已在 main |
| 前端新测试/模块（5 ??） | `terminalReadiness.ts`、`XtermTerminal.readiness.test.tsx`、`debugSessionBootstrap.terminal.test.ts`、`terminalReadiness.test.ts` | 同上 |
| 文档（3 M + 1 ??） | `backend/tests/README.md`、`docs/features/PYTHONLAB.md`、`docs/archive/testing/2026-11-04-release-226.md` | 已在 main |

**验证证据**：`docker.py` 工作区 SHA256 `fe0dd7d6…` 与 `origin/main` 完全相同；HEAD 版本是 `5f2ca112…`（不同）。

**风险**：丢弃零风险——内容在 GitHub main 上，生产跑的也是它。

### B 组：2 项，2.2.8 里没有

| 文件 | 内容 | 价值 |
|---|---|---|
| `docs/archive/testing/2026-11-04-release-228.md` | 2.2.8 发布与部署的完整批次证据 | **高**，唯一记录 |
| `docs/plans/2026-11-04-four-way-ledger-alignment.md` | 四方台账对齐盘点 | **高**，本轮成果 |

处置：**保留，提交**。

### C 组：5 项文档，两端都改过

这五个文件的情况是：HEAD 有一份 2.2.6 时期的版本，origin/main 有一份 2.2.8 时期的版本，工作区又叠了本轮新内容。

| 文件 | 工作区比 origin/main 多什么 | 判断 |
|---|---|---|
| `docs/archive/README.md` | +1 行：2.2.8 批次记录索引 | 新增，保留 |
| `docs/operations/RELEASE_NOTES.md` | +20 行：v2.2.8 已部署段落 | 新增，保留 |
| `docs/testing/TEST_STATUS.md` | +11 行：2.2.8 部署结果、四方对齐计数 | 新增，保留 |
| `docs/plans/project-consolidation.md` | +17 行：RELEASE-01 关闭、六条新未结项 | 新增，保留 |
| `docs/plans/2026-11-02-verification-and-backlog.md` | +11 行：状态改 superseded + 变更日志 | 新增，保留 |

**关键点**：这五个文件工作区版本 = origin/main 版本 + 本轮新增行，其中被替换掉的旧行**全部是已过时的状态描述**。

逐份核实被替换内容（`<` 为 origin/main 独有）：

| 文件 | 被替换的旧行 | 性质 |
|---|---|---|
| `archive/README.md` | 无 | 纯新增 |
| `RELEASE_NOTES.md` | 「最近整理 2026-10-31」「近期版本指向 2.2.2」「v2.2.8…发布准备，未部署」 | 时效性更新 |
| `TEST_STATUS.md` | 「共享main/HEAD仍c45ad0e…准备2.2.8」「仅用 6607」「部署仍阻断」「文档门禁 110/713」 | 时效性更新（6607 还是错的） |
| `project-consolidation.md` | 「2.2.6已发布…尚未部署」「6607 入口」「生产仍运行2.2.2」「RELEASE-01 未结」 | 时效性更新 |
| `2026-11-02-verification-and-backlog.md` | 「状态：active」「最近复核：接力续验与生产预检」「范围：2.2.6构建源」+ 整段旧「当前状态」 | 状态迁移 |

**重要**：`2026-11-02-verification-and-backlog.md` 虽然「当前状态」段被整体重写，但 `## 阶段 B 推进记录`、`## 阶段 D 修复记录`、`## 变更日志` 等**历史过程全部保留**（工作区 216 行 vs origin/main 218 行，仅少 2 行更新说明）。没有丢失历史记录。

**结论**：C 组 5 个文档的工作区版本是 origin/main 的**正确后继版本**，替换掉的是过期状态，不是有价值信息。

## 三、为什么会出现这个局面

1. 本轮所有开发都在**临时独立检出**（`/tmp/wangsh-release-228-e33k40jo/checkout`）里做，提交后合入 main。
2. 但**共享主仓库 `/Users/wsh/wangsh` 的 HEAD 一直停在 `c45ad0e`**（2.2.6 发布提交），从未快进。
3. 与此同时，共享仓库的**工作区被同步写入了这批改动**（可能是文件被直接编辑，或从临时检出复制回来）。
4. 结果就是：HEAD 是 2.2.6，工作区是 2.2.8，git 把两者的差异全部报成"未提交改动"。

这不是有人乱改代码，是**工作区被当作发布产物的中转站**，而 HEAD 没跟着走。

## 四、建议的处置

### 推荐方案：保留文档、丢弃代码改动、快进 main

```bash
# 1. 先备份工作区（保险）
git stash push -u -m "backup-before-ff-2026-11-04"

# 2. 快进 main 到 2.2.8
git merge --ff-only origin/main

# 3. 恢复 stash
git stash pop
```

预期结果：A 组 34 项**自动消失**（因为 main 里已经是这个内容），B 组 2 项和 C 组 5 项的文档改动**保留为新的未提交改动**。

然后只提交这 7 个文档文件。

### 为什么不直接 checkout 丢弃 A 组

因为 A 组是"未跟踪 + 已修改"混合，直接 `git checkout .` 会连 B/C 组的文档一起丢。

### 风险点

- `git stash push -u` 会把未跟踪文件也收进去，恢复时如果与 main 冲突需要处理。
- 预期不会冲突：A 组内容 = main 内容，stash pop 时等于"无变化"。
- 实际执行前我会先用 `git stash show -p` 确认内容，再 pop。

### 备选方案（更保守）

不动 main，先把当前工作区完整打成 tar 包存到仓库外，再做上面的操作。多一层保险，成本几乎为零。

## 五、需要你决定

1. **采用推荐方案**（stash → ff → pop → 提交 7 个文档）？
2. 还是**先备份到 tar 包**再操作？
3. 或者你有其他想法？

我不会在没有你确认前执行任何 git 写操作。
