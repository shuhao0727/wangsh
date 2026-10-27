# 遗留待办（2026-10-27）

> 状态：active
> Owner：release-ops
> 最近复核：2026-10-27
> 用途：2.2.0 发布后**已知但暂不处理**的问题。不是缺陷清单的全部，只记录已确认、需要后续跟进的事项。

## 一、`deploy.sh backup-db` 产出空文件（**已修复**）

> 2026-10-27 修复：去掉 `-f -`，并补上非空、归档可读、`pg_dump` 失败清理三道校验。
> 三种模式实测产出 383K / 240K / 145K，端到端恢复验证 55 张表一致。
> 以下保留原始分析与根因，供追溯。

### 现象

```bash
bash scripts/deploy.sh backup-db        # 输出文件名，退出码 0
ls -l backups/wangsh_db_*.dump          # 实际是 0 字节
```

### 根因（已实测确认）

脚本用 `pg_dump -Fc -f -`。自定义格式下 `-f -` 会把数据写进**容器内名为 `-` 的文件**，
stdout 为空，外层重定向到宿主的文件因此是 0 字节。

三个模式全部受影响：`full` / `schema` / `data`（`scripts/deploy.sh:905-909`）。

### 为什么严重

`scripts/rollback.sh:231` 的回滚流程是：

```bash
if backup_db; then : else handle_pre_downgrade_failure ... fi
```

设计意图是"回滚前先备份，备份失败就中止"。但 `backup-db` **每次都返回 0**，
这道保护完全失效——回滚（有破坏性）会在没有任何有效备份的情况下继续执行。

另外 `restore-db` 遇到空文件时，`pg_restore` 只报 `input file is too short`，
退出码本身是正确的（1），但错误信息看不出是备份文件本身坏了。
2026-10-27 已补前置校验：空文件直接报 `${dump_path} is empty` 并以 1 退出。

### 临时替代方案

**不要用 `backup-db`。** 手动执行：

```bash
docker exec wangsh-postgres pg_dump -U admin -d wangsh_db -Fc > 备份名.dump
# 必须校验大小与内容
ls -lh 备份名.dump
docker exec -i wangsh-postgres pg_restore --list < 备份名.dump | grep -c 'TABLE DATA'
```

### 修复要点（已完成）

1. ✅ 去掉 `-f -`，让 pg_dump 直接输出到 stdout
2. ✅ 备份后校验文件非空 + `pg_restore --list` 可读，失败则删文件并非零退出
3. ✅ `pg_dump` 失败时清理残留文件并透传退出码；`restore-db` 增加空文件前置校验

## 二、本次部署使用的备份（有效）

位置在生产机：

```
/home/shuhao/wangsh-releases/2.1.8/source/backups/wangsh_db_20261026_203528.dump
```

- 20 MB，54 个 TABLE DATA 条目，关键表（`sys_users` / `xbk_students` / `znt_classroom_plan_items`）齐备
- 是部署前 2.1.8 状态的快照，可用于回滚
- **注意**：另一个 0 字节文件 `wangsh_db_20261026_203440.dump` 是 bug 产物，应删除或忽略

## 三、热点归类的语义准确度未验收

- 本地验证用的是 mock LLM，只验了机制（分批、投票、计数、前端展示）
- **真实课堂数据下的归类准确度尚未验证**
- 需要：老师在 `/task-analysis/new` 生成分析时填写"教师提问标记"，再用真实记录抽查标签是否合理

## 四、生产数据前提不成立

2026-10-25 查询生产库：**271 条学生问题中教师提问为 0 条**。

归类体系以教师提问 T1…Tn 为锚点。若教师仍不填提问标记，热点归类会退化为普通分类，
"回应型 / 生成性"的区分失去意义。这是产品使用层面的问题，不是代码缺陷。

## 五、可以往后放的技术项

| 项 | 原因 |
|---|---|
| Monaco / Graphviz / Typst 等懒加载模块的静默降级排查 | 与 echarts 同类风险面，但未发现实际问题 |
| `lib/echarts.ts` 三项注册的结构性加固 | 已有注释说明 + 运行时兜底 |
| 剩余大前端文件拆分（`QuestionsPage` 等） | 方法已验证，不影响功能 |
| 其余 14 处缺索引外键 | 当前无查询使用，加了无收益 |
