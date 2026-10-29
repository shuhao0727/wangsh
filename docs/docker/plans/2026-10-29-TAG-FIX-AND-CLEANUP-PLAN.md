# 2.2.2 标签修正与收口执行计划

> 状态：active
> Owner：release-ops
> 制定日期：2026-10-29
> 依据：所有「现状」均为 2026-10-29 对本地、GitHub、生产的实测，附命令与输出。
> 未实测项标「待确认」，不写推断。

---

## 零、核心事实（实测）

### 镜像内容 = `7973dc2`

用代码特征在容器内逐项核对：

```bash
$ docker exec wangsh-backend sh -c "grep -c 严格性要求 /app/app/services/ai_partner_evaluation.py"
1
$ docker exec wangsh-backend sh -c "grep -c MODEL_ATTEMPTS /app/app/services/ai_partner_evaluation.py"
4
$ docker exec wangsh-backend sh -c "grep -c _salvage_sections /app/app/services/ai_partner_evaluation.py"
0
```

`7973dc2` 的内容比对：

```bash
$ git show 7973dc2:backend/app/services/ai_partner_evaluation.py | grep -c "严格性要求\|MODEL_ATTEMPTS"
5
$ git show 7973dc2:...ai_partner_evaluation.py | grep -c "_salvage_sections"
0
```

**结论：生产镜像的源码内容精确等于 `7973dc2`。**

### 标签偏差

```bash
$ git rev-list -n1 2.2.2      # 4d774ec
$ git rev-parse HEAD          # 8f144d2
$ git rev-list --count 4d774ec..8f144d2   # 6
```

| 对象 | 指向 | 与镜像的关系 |
|---|---|---|
| 镜像 `wangsh-*:2.2.2` | 内容 = `7973dc2` | —— |
| git tag `2.2.2` | `4d774ec` | **比镜像旧 2 个提交**（缺缓存修复、缺重试） |
| `origin/main` | `8f144d2` | 比镜像新 3 个提交（含未部署的 salvage） |

**标签既不代表镜像，也不代表 main —— 两头都不准。**

这与 2.2.1 是**同类问题第二次出现**（2.2.1 时镜像比标签旧 5 个提交）。

### 其它状态

- 生产：8 容器运行，7 个为 2.2.2、sandbox 2.2.1（Dockerfile 无改动，正确）
- 数据：433 用户 / 55 表 / head `20261026_0001`，零损失
- 本地：`HEAD = origin/main = 8f144d2`，工作区干净，0 未推送
- 主仓库 `/Users/wsh/wangsh` 的 main：`c2b1742`，落后 48 个提交
- 服务器源码 vs main：运行代码仅差 1 个文件（`ai_partner_evaluation.py`，即未部署的 salvage）
- 近 1 小时：0 次 `DetachedInstanceError`、0 次评分请求（无人使用）

---

## 一、标签修正建议（需老大拍板）

### 三个方案

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A（推荐）** | `2.2.2` 重指到 `7973dc2`（实际镜像内容） | 标签准确代表「生产在跑什么」，符合发布标签的本义 | 需强推标签；main 上 3 个提交（含 salvage）不在该标签下 |
| B | 保持 `2.2.2` 在 `4d774ec`，另建 `2.2.2-hotfix` 指向 `7973dc2` | 不动已有标签 | 生产跑的不是 `2.2.2`，语义仍错；标签变多 |
| C | 让 `2.2.2` 指向当前 main `8f144d2` | 标签与 main 一致 | **最错**：镜像里没有 salvage，标签却说有 |

### 我推荐 A，理由

发布标签的语义是「这一版构建用了哪份源码」。生产镜像内容精确等于 `7973dc2`，
所以标签就该指向它。main 上的 salvage（`9a21880`）是**尚未部署的下一版内容**，
本来就不该进 2.2.2 的标签。

后续等 salvage 部署时，再打 `2.2.3`。

### 方案 A 的具体操作（老大执行）

```bash
cd /Users/wsh/wangsh

# 先确认要指向的提交内容（应为 7973dc2）
git log --oneline -1 7973dc2

# 删除旧的附注标签，重建到 7973dc2
git tag -d 2.2.2
git tag -a 2.2.2 7973dc2 -F /tmp/tag-2.2.2-corrected.txt

# 强推（远端标签被移动，需要 --force）
git push origin refs/tags/2.2.2 --force

# 核对
git ls-remote --tags origin | grep "2.2.2$"
git rev-list -n1 2.2.2
```

`/tmp/tag-2.2.2-corrected.txt` 的内容我会准备好（见第三节）。

**注意**：GitHub Release `2.2.2` 会跟着标签走。重指后 Release 页指向的
commit 会变为 `7973dc2`，这才是真实部署的内容。

---

## 二、服务器垃圾文件清理（老大执行）

### 待清理清单（均为实测）

| 路径 | 大小 | 性质 | 建议 |
|---|---|---|---|
| `/home/shuhao/wangsh-sync-84c086e` | 22M | 我 clone 的临时同步目录 | 删除 |
| `/home/shuhao/wangsh-compare` | 22M | 我 clone 的比对目录 | 删除 |
| `/tmp/cmp-8f144d2` | 61M | 本次比对解包 | 删除 |
| `/tmp/main-8f144d2.tgz` | 18M | 本次传输包 | 删除 |
| `/tmp/*.py`（诊断脚本） | <1M | p6/pd/ps/prp/pep/pe/pj/pf/rd/rs/rcd 等 | 删除 |
| `/tmp/fail-sample-*.txt`、`/tmp/fs5.txt` | <1M | 失败样本（已存入仓库 fixture） | 删除 |
| `/tmp/build-*.log`、`/tmp/b4.log`~`b7.log` | <1M | 构建日志 | 删除 |
| `/tmp/bak-*`、`/tmp/env-example-bak-*` | <1M | 我改文件前的小备份 | 删除 |
| `/tmp/tag-2.2.2-corrected.txt` | 极小 | 本次要写的标签说明 | **保留到标签操作完成** |

### 必须保留

| 路径 | 理由 |
|---|---|
| `/home/shuhao/source-backup-before-222-20261029-0859.tgz`（3.4M） | 2.2.2 部署前的源码备份 |
| `/home/shuhao/wangsh-releases/2.2.0/source/backups/*.dump` | 数据库备份 |
| `/home/shuhao/wangsh-releases/2.2.0/source/data/` | 生产数据 |
| `docker-compose.production.yml`、`.env`、`.env.bak-*` | 生产配置与历史备份 |
| `release-set-2.2.1.txt` | 发布记录 |

### 清理命令（老大执行，先 dry-run）

```bash
ssh shuhao@wangsh.cn

# 1) 先看清楚要删什么（不做删除）
ls -ld /home/shuhao/wangsh-sync-84c086e /home/shuhao/wangsh-compare /tmp/cmp-8f144d2
du -sh /home/shuhao/wangsh-sync-84c086e /home/shuhao/wangsh-compare /tmp/cmp-8f144d2

# 2) 删除临时克隆与解包目录
rm -rf /home/shuhao/wangsh-sync-84c086e /home/shuhao/wangsh-compare /tmp/cmp-8f144d2
rm -f /tmp/main-8f144d2.tgz

# 3) 删除诊断脚本与样本（保留 tag 说明文件）
rm -f /tmp/p6.py /tmp/pd.py /tmp/ps.py /tmp/prp.py /tmp/pep.py /tmp/pe.py \
      /tmp/pj.py /tmp/pf.py /tmp/rd.py /tmp/rs.py /tmp/rcd.py /tmp/v.py \
      /tmp/verify-score-live.py /tmp/probe-*.py /tmp/repro-*.py /tmp/check-*.py
rm -f /tmp/fail-sample-*.txt /tmp/fs5.txt /tmp/clean-fail-*.txt /tmp/raw-fail-*.txt
rm -f /tmp/build-*.log /tmp/b4.log /tmp/b5.log /tmp/b6.log /tmp/b7.log
rm -f /tmp/bak-* /tmp/env-example-bak-* /tmp/ape*.py /tmp/aiagent.py /tmp/caddy3 /tmp/aip3.ts

# 4) 确认磁盘
df -h /home/shuhao | tail -1
```

**注意**：容器内的 `/tmp`（`docker exec wangsh-backend ls /tmp/*.py`）也留了脚本，
但容器重建就没了，不必单独处理；若想立即清可 `docker exec wangsh-backend rm -f /tmp/*.py`。

---

## 三、本地成功率测试（我执行，不碰服务器）

### 目标

在本地验证「分块抢救」能否真正提升成功率，**用真实模型调用**而非 mock。

### 做法（我执行）

写一个本地压测脚本，直接调用 `svc.call_model` + `svc.parse_evaluation`，
连续跑 N 次，统计：

| 指标 | 含义 |
|---|---|
| 首次成功率 | 不做任何补救，直接 parse 成功 |
| 抢救成功率 | 抢救后 parse 成功 |
| 最终成功率 | 两者之和 |
| 耗时分布 | min/median/max |

### 关键约束（已实测）

**本地无法连 Dify**：

```bash
$ curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://docker-api-1:5001/v1
000
```

`docker-api-1` 是服务器内网的容器名，本地解析到的是本机地址，HTTP 请求失败。
因此**本地无法做端到端成功率测试**，只能做「样本回放」。

### 实际做法（样本回放）

1. **从生产日志/容器内抓取所有历史失败样本**
   （只读操作：`docker logs` + 在容器内跑一次收集脚本，把原始 `raw` 输出存下来）
2. 在本地对这些样本逐条跑 `parse_evaluation`，统计：
   - 原始成功率（不抢救）
   - 抢救后成功率（含 `_salvage_sections`）
   - 仍然失败的样本形态分类
3. 产出报告：**salvage 对真实失败样本的实际挽回率**

这比端到端压测更可靠——端到端受模型随机性影响，样本回放是确定性的。

**若样本量不足**（比如只有 2-3 条），则：
- 如实说明「样本不足以给出统计结论」
- 改为逐条分析每个样本的失败形态，判断 salvage 的覆盖范围
- 不编造成功率数字

---

## 四、主仓库 main 同步（老大执行）

```bash
cd /Users/wsh/wangsh
git status              # 先看有无本地改动
git pull --ff-only
git log --oneline -1    # 应显示 8f144d2
```

若仍报冲突，先 `git stash push -u -m "local-wip-$(date +%s)"` 再 pull。

---

## 五、多 Agent 分工（可并行）

### Agent A：失败样本收集与回放

**职责**：从生产收集真实失败样本，在本地回放，量化 salvage 的实际挽回率。

**边界**：
- 服务器侧**只读**：只用 `docker logs` 和容器内一次性收集脚本，不重启不重建
- 本地只跑 `parse_evaluation`，不改业务逻辑
- 抓到的样本存入 `backend/tests/ai_partner/fixtures/`，脱敏（去掉学生具体姓名）

**交付**：
- 样本数量与形态分布
- 抢救前/后成功率对照
- 若样本不足，明确说明并改为逐条形态分析（不编造统计）

**预估**：40 分钟

### Agent B：标签与发布一致性核查

**职责**：核查历史标签（`2.2.0`/`2.2.1`/`2.2.2`）与对应镜像/dev 的一致性，
找出是否还有同类偏差。

**边界**：只读，不修改标签（标签由老大执行）

**交付**：每个标签与镜像内容的对照表 + 修正建议

**预估**：30 分钟

### Agent C：文档与代码一致性核查

**职责**：全仓扫描「文档声称 vs 代码实际」，重点：
- 文档里的函数名/文件名是否存在
- 文档里的阈值/超时值是否与代码一致
- 刚改的 `AI_AGENTS.md` 新章节是否准确

**边界**：只读为主，可改文档但需列出改动清单

**交付**：失真清单 + 建议订正

**预估**：40 分钟

### 依赖关系

```
A、B、C 三者互不依赖，可完全并行
        ↓
     我汇总结果
        ↓
   交给老大决策/执行
```

---

## 六、执行顺序

| 顺序 | 事项 | 执行人 | 依赖 |
|---|---|---|---|
| 1 | 准备标签说明文件 | 我 | 无 |
| 2 | 标签修正（方案 A） | **老大** | 1 |
| 3 | 服务器垃圾清理 | **老大** | 无 |
| 4 | 主仓库 main 同步 | **老大** | 无 |
| 5 | 本地成功率测试（Agent A） | 我+Agent | 无 |
| 6 | 标签一致性核查（Agent B） | Agent | 无 |
| 7 | 文档一致性核查（Agent C） | Agent | 无 |
| 8 | 汇总报告 | 我 | 5、6、7 |
| 9 | 部署 salvage（下次窗口） | 待定 | 8 |

---

## 七、明确不做

- **不部署**任何东西到生产（老大已定）
- **不动** 2.2.1 标签（它指向 `a3a5a54`，而 2.2.1 镜像实际是 `c0b44b6`——
  同样是偏差，但 2.2.1 已被 2.2.2 取代，修正历史标签收益低、风险高，
  建议只在文档里记录事实，不移动）
- **不删** 任何远端分支（已清理过）
- **不改** 数据库结构
