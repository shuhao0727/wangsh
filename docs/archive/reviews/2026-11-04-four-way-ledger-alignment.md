# WangSh 四方台账对齐与会话复盘

> 状态：archived（2026-11-05 归档：执行结果已回填台账与运维文档，本页仅作追溯；当前入口见[唯一台账](../../plans/project-consolidation.md)）
> Owner：release-ops + project-governance
> 盘点日期：2026-11-04
> 范围：本地仓库 / GitHub / DockerHub / 生产服务器
> 方法：本轮实测 + 两个独立只读审计 Agent 交叉复核；冲突处以实测复核结论为准

## 一、对齐结论总表

| # | 对齐关系 | 结论 | 关键依据 |
|---|---|---|---|
| 1 | 本地 tag ↔ 远端 tag（2.2.x） | 一致 | 8 个 2.2.x tag 对象 SHA 本地与 `ls-remote` 完全相同 |
| 2 | tag → workflow headSha | 4 个中 3 个一致 | 2.2.6/2.2.7/2.2.8 完全匹配；2.2.0 差 3 个提交（仅 docs/test/scripts，无源码） |
| 3 | workflow artifact → DockerHub digest | 一致 | 2.2.6/2.2.7/2.2.8 六镜像逐条相同，并用 registry `docker-content-digest` 独立复验 |
| 4 | DockerHub digest → 服务器镜像 | 一致 | 六镜像 2.2.8 digest 完全相同 |
| 5 | 服务器运行实例 → 发布目录 | 一致 | 六容器 `.Image` = 2.2.8 digest；`current -> 2.2.8/source`；`/api/health` 返回 2.2.8 |
| 6 | 本地 main ↔ origin/main | **不一致** | 落后 5 个提交、领先 0；HEAD 仍是 2.2.6 的 `c45ad0e`，**生产 2.2.8 的 `2d9dda0` 不在本地历史里** |
| 7 | 分支卫生 | 一致 | 三个远端分支均已合入 main，无未合并分支 |
| 8 | GitHub Release ↔ DockerHub | **缺环** | GitHub Releases 只到 2.2.3，2.2.5–2.2.8 无 Release 记录 |

**结论：发布链路本身（tag→构建→镜像→部署）是自洽的。问题全部集中在"本地仓库落后"和"历史版本留痕不全"两类，不影响当前生产。**

## 二、需要在意的差异（按严重程度）

### A. 本地仓库落后生产两个版本 —— 最需要处理

- `git rev-list --left-right --count origin/main...HEAD` = `5 0`：本地落后 5 个提交。
- `git merge-base --is-ancestor 2d9dda0 HEAD` 为假：**生产正在跑的代码，本地 main 里没有**。
- 影响：在这个仓库直接构建、验证或打标签，得到的是 2.2.6 的旧代码，与生产差两个发布版本。
- 附带风险：工作区有 40 个未提交改动（28 M + 12 ??），一旦快进前处理不当会冲突。
- 处置：需要先决定未提交改动怎么落（提交/丢弃/另存），再 `git merge --ff-only origin/main`。**这一步必须你定，我不擅自处理。**

### B. 2.2.5 缺完整发布链路

- 六个 DockerHub 仓库都**没有** `2.2.5-build-<run>` staging tag，`dockerhub-amd64` 历史上无对应 run，无 `release-set-*` artifact。
- 同提交的 `ci-quality` run 41592108696 是 **failure**。
- 影响：2.2.5 镜像的源码 commit 无法自证。已被 2.2.6 取代且从未部署，不阻塞当前。
- 处置：建议在发布记录里标注"2.2.5 镜像来源不可审计"，不补推（补推等于伪造发布）。

### C. DockerHub 缺 2.2.2 / 2.2.3 镜像

- git 有 tag，DockerHub 全 404。但服务器上有完整的 2.2.2 六镜像（本地构建后装载）。
- 影响：2.2.2 无法从仓库复现，**回滚只能依赖服务器本地镜像**——清理 2.2.2 镜像会直接摧毁唯一回滚路径。
- 处置：写入红线；不补推。

### D. 2.2.1 镜像构建源 ≠ tag

- tag message 自述构建自 `c0b44b6`，tag 指向 `a3a5a54`；前者是后者祖先（镜像比标签旧）。
- 处置：保留 + 文档标注，不强推重写已发布 tag。

### E. 2.2.7 / 2.2.8 的 tag message 缺审计信息

- 2.2.6 的 tag 写明了构建提交、run id、release-set SHA256；2.2.7/2.2.8 只有一行标题。
- 处置：后续发版沿用 2.2.6 格式。

### F. 服务器 `docker compose ls` 显示 wangsh 项目有两个 config file

```
wangsh  running(8)  .../2.2.8/source/docker-compose.production.json,
                    .../2.2.0/source/docker-compose.yml
```

- 实测：postgres/redis 的 compose label 指向 `2.2.0/source/docker-compose.yml`，其余六容器指向 `2.2.8/source/docker-compose.production.json`。
- 这是刻意保留原基础设施（发布证据写明 `original_pg_redis_ids_starttimes_mounts_preserved: true`）。
- **风险**：任何人执行 `docker compose up` 时若把 `2.2.0/source/docker-compose.yml` 当 override 一并传入，该文件里 postgres/redis 的 `./data/...` 相对路径会解析到 `2.2.0/source/data/`（恰好正确），但同时会尝试重建全部八个服务到 2.2.0 的配置。
- 处置：**排障时禁止对该项目执行 `docker compose up/down`**，只能用固定 image ID 的 rollback compose。写进运维记录。

### G. 服务器残留未启用 swap 与桌面环境

- `/swapfile_extra` 16G，未启用、无 fstab 条目、创建于 2026-02-25。
- `/swap.img` 20G 在 fstab 中且已启用，**保留**（17G RAM 的机器需要）。
- 处置：`/swapfile_extra` 可删（回收 16G），但需你授权。

## 三、需要你判断的安全事项

### S1. `/etc/systemd/system/log.service` —— 疑似异常残留

```ini
[Unit]
Description=log Plugin Service
[Service]
ExecStart=/usr/bin/log -sshd
Restart=always
User=root
WorkingDirectory=/usr/bin
```

- 实测：`/usr/bin/log` **不存在**；unit 为 `disabled` + `inactive`；`*.wants/` 无链接；文件 owner root:root、644、mtime 2026-05-18。
- 判断：当前**无法执行**（目标文件不存在），且从未启用。但 `ExecStart=/usr/bin/log -sshd` + `User=root` + 文件名伪装成系统日志服务的组合，形态可疑。
- 我无法判断是入侵痕迹还是某次误操作。建议：保留文件不要删（删了就没证据），单独核查 SSH 配置、sudoers、authorized_keys、历史登录。
- **这条我不擅自处理，需要你决定是否深入排查。**

### S2. `/home/shuhao/桌面/.env` 权限过宽

- 权限 `664`（同组可写）、50558 字节，与 `dify/docker/.env`（50645 字节）大小接近。
- 对比 `/home/shuhao/wangsh/.env` 是 `600`。
- 处置建议：若确认是 Dify/WangSh 生产配置副本，收紧到 `600`，并考虑是否需要轮换其中的凭据。**不改内容，只谈权限。**

### S3. backend 接入 Dify 网络（已澄清，非问题）

- `docker-compose.yml:202`/`:448-449` 明确声明 `dify_network` 为 external，注释写明"仅在部署了 Dify 时需要"。
- 实测 backend → `docker-api-1:5001` 可达。
- 这是既有架构选择，不是意外耦合。但意味着 Dify 若被攻破可横向到 backend。记录为已知边界，本轮不改。

## 四、服务器可回收清单（收益 / 风险）

| 项 | 大小 | 风险 | 说明 |
|---|---|---|---|
| `/swapfile_extra` | **16G** | 低 | 未启用、无 fstab；删前再确认 `swapon --show` 只有 `/swap.img` |
| `.vscode-server` 旧版本（4/5） | 约 2.2G | 低 | 无运行进程，重连会重下 |
| `2.2.7/incoming/*.oci.tar` | 412M | 低 | 镜像已在本地 + DockerHub 有 tag，已复验 |
| `.npm/_cacache` | 310M | 低 | `npm cache clean --force` |
| `/home/shuhao/dify` | 132M | 低 | 2026-06-15 旧源码，`compose ls` 证实当前栈用 `dify-releases` |
| `2.2.8/incoming/*.oci.tar` | 101M | 低 | 同上，建议等下次发布成功后再删 |
| `/tmp` 一次性产物 | 约 40M | 低 | `cmp-cur`、`main-current.tgz`、`q*.sql`、260 个 `wangsh-*-contract-*` |
| `/var/log/btmp.1` | 45.7M | 低 | 已轮转失败登录记录，`truncate` 即可 |
| 匿名孤儿卷（4a4e943e…） | 115M | 中 | LINKS=0，但匿名卷无法确认归属 |
| `wangsh_postgres_data`/`wangsh_redis_data` | 162M | **中高** | 2026-02-15 旧卷，现已被 bind mount 取代；可能含迁移前数据，删前需确认 |
| 旧发布目录 2.1.6–2.2.1 | 约 88M | 中 | 历史源码 GitHub 有，但 2.2.0 目录**混着活数据**，只能逐项判断 |
| alpine:latest 镜像 | 3.86M | 低 | 无容器引用，2026-10-21 创建 |

**可安全回收合计（不含需判断项）：约 19.2G**，其中 16G 来自 swap 文件。

## 五、绝不可动（红线）

| 对象 | 位置 | 理由 |
|---|---|---|
| PG / Redis 活数据 | `2.2.0/source/data/{postgres,redis}` | 生产数据库 bind mount，139.8M + 13M |
| `2.2.0/source/docker-compose.yml` | 同上 | 是 pg/redis 容器的 compose label 来源 |
| PG/Redis 运行镜像 | `16bc17c64a57`、`6ab0b6e73817`（`<none>`） | 运行中；`dangling=true` 会误报，实际被引用 |
| `2.2.8/source` + `current` | 当前发布 | 六个容器的 working_dir |
| `2.2.8/backups/paired-20261104-153933` | 54M | 唯一回滚数据依据 |
| 2.2.2 六镜像 + rollback compose | Docker + `2.2.8/backups/` | DockerHub 无 2.2.2，唯一回滚路径 |
| `wangsh/data/pythonlab/workspaces` | 3.6M，100+ 用户目录 | 活数据 |
| `wangsh_typst_pdfs` / `wangsh_uploads_data` | 32.7M / 0B | 活数据 |
| `2.2.7/evidence` + `incoming/dap-repair-overlay` | 584K + 4 文件 | 唯一正式候选失败证据 |
| 各 `production.env` | `2.2.6/2.2.7/2.2.8` | 回滚与重建必需（差异仅 5 个版本字段） |
| `dify-releases/1.18.0-clean-20261027` | 318M | 活 Dify 栈 compose 来源 |
| `education-policy-archive/data` | 44M | 活容器 bind mount |

## 六、本轮实测纠正的审计偏差

| 审计 Agent 结论 | 实测复核 |
|---|---|
| "审计中拉取了 alpine:latest" | **不成立**。该镜像 `Created=2026-10-21T22:37:22Z`，是 13 天前创建的，非本次审计产生 |
| "`docker system df` 镜像数 43→44" | 计数波动来自其他因素，alpine 非新增 |
| "`2.2.0/source/docker-compose.yml` 作为 override 参与当前 run" | **部分成立**。仅是 pg/redis 两个容器的 compose label，不是整体 override |

## 七、会话复盘（本次发布过程）

### 做得好的

1. **多重门禁没有一次被绕过**：镜像 digest、官方 registry、源码 hash、配对备份、隔离恢复，每道都真实执行并留证。
2. **失败证据全部保留**：2.2.6 双浏览器失败、2.2.7 DAP 阻断、本次两次浏览器失败（缺 node_modules、未跑 AUTH 迁移），都没有靠放宽门限刷绿。
3. **合成数据与真实数据严格分离**：`wangsh_sim` 项目、`wangsh_restore228_network`、tmpfs、无端口发布。
4. **回滚路径事先固定**：rollback compose 用 image ID 而非 tag，不受 DockerHub 缺 2.2.2 影响。
5. **部署后真实验收**：不是只看 health 200，而是真实浏览器跑完四个 PythonLab 场景。

### 值得改进的

1. **临时检出缺 `node_modules` 浪费了两轮浏览器时间**。以后建临时检出时先 `ln -s` 主仓库依赖。
2. **隔离栈漏跑 AUTH 受控迁移**，导致登录 503 才发现。`serve_server_simulation.py` 里本来就有这一步，我没先读它就自己写了一遍启动流程。提前读现有脚本能省这一轮。
3. **本机 DNS 被代理劫持**，导致 `wangsh.cn:6607` 误判。以后本机验证域名一律用 `--resolve` 指定真实地址。
4. **文档里 6607 口径是错的**，实际入口是 6608。已订正。
5. **本地 main 一直没同步**，现在落后生产两个版本——这是本次盘点暴露的最大工程技术债。

### 流程层面的建议

- 每次发布后立刻把 `origin/main` 快进到本地，避免落后累积。
- tag message 沿用 2.2.6 的完整格式（构建源 + run id + release-set SHA256）。
- 发布目录 `incoming/` 在下次发布成功后即可清理，不必长期保留 OCI 归档。

## 八、建议的整理执行顺序

**第一批（零风险，需授权）**
1. `/swapfile_extra` 16G
2. `.vscode-server` 旧版本 2.2G
3. `.npm` 缓存 310M + `/tmp` 一次性产物 40M
4. `2.2.7/incoming` 412M + `2.2.8/incoming` 101M

**第二批（中风险，逐项确认）**
5. `/home/shuhao/dify` 132M
6. 匿名孤儿卷 115M
7. `wangsh_postgres_data`/`wangsh_redis_data` 162M（需先确认无迁移前数据价值）
8. 旧发布目录 2.1.6–2.2.1（2.2.0 除外）

**第三批（需要你决策）**
9. 本地仓库快进与 40 个未提交改动的处置
10. `log.service` 是否深入排查
11. 桌面 `.env` 权限收紧与凭据轮换评估

## 九、草稿「待确认」项的后续核实（2026-11-05）

当时草稿留下 5 个待确认项，整理时经外网 `wangsh.cn` 只读核验：

- 两个独立审计 Agent 结果：已完成并合入本页与台账，不再悬挂。
- `/home/shuhao/wangsh/data/` 下除 pythonlab 外：**仅 `pythonlab`**。
- 2.2.6/2.2.7/2.2.8 三份 production env 是否相同：**这三个 source 目录均不存在 `.env`**（运行时环境变量另有来源），问题前提不成立。
- `candidate-simulation.env` 是否只含合成凭据：候选栈已清理，材料不再存在，无法也不需复核。
- Dify 栈与 WangSh 资源交叠：`docker_default` 网络上有 1 个 wangsh 容器（backend），即本页 §二 F 记录的 Dify 网络边界；无其他交叠。
