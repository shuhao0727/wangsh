> 状态：archived
> Owner：docs
> 最近复核：2026-10-03
> 原归档条件：本计划两项任务完成并验证
> 归档整理：2026-10-19（仅索引和历史边界复核）
> 当前入口：[项目整理台账](../plans/project-consolidation.md)；UI 视觉以[嵌入式规范](../frontend/EMBEDDED_UI_STYLE_GUIDE.md)为准。

> 历史说明：本文不再是当前计划或唯一问题台账。正文中的完成、待办、版本和验证标记均保留为当时快照；未复核事项不能因归档自动关闭。

# 计划 2 号 + 3 号：双项修复

本计划只做两件事，均已用代码核实过现状。

---

## 1 号：后端视图迁移（阻塞所有新环境）

### 现状（已核实）

`backend/app/core/startup.py:_ensure_views` 用 `CREATE OR REPLACE VIEW` 维护 `v_conversations_with_deleted`：

```python
try:
    await conn.execute(text("""CREATE OR REPLACE VIEW v_conversations_with_deleted AS ..."""))
    logger.info("视图 v_conversations_with_deleted 已创建/更新")
except Exception:
    logger.warning("创建视图失败，跳过")     # ← 错误被吞
```

### 根因（已复现）

PostgreSQL 的 `CREATE OR REPLACE VIEW` **只能追加列，不能改动已有列的顺序或名称**。

- 视图最早定义在迁移 `20260211_0004`（**确在链上**：`20260211_0003 → 0004 → 0005`）
- 之后迁移 `4a85c94b5c4c` 给底表加了 `is_archived` / `archived_at`，**但没有任何迁移同步更新视图定义**
- 于是旧库上视图列序与新定义不符，`CREATE OR REPLACE` 报错：
  `cannot change name of view column "is_user_deleted" to "is_archived"`
- 该错误被 `except Exception` 降级为 warning → **静默跳过，视图永远修不好**
- 查询使用 `is_archived`，视图里没有 → 接口 500

**实际发生过**：`/api/v1/ai-agents/usage`、`/ai-agents/usage/statistics` 两个接口 500，
前端「智能体数据」页整页报错。

### 当前状态

- **开发库**：已手工 `DROP VIEW` + 重建，两个接口已恢复 200
- **代码层**：**缺陷未修**。任何新环境首次启动、或列序不同的旧库，仍会静默失败

### 要做的事

1. **新增一条 Alembic 迁移**（在 `2de7995a8f24` 之后，它是当前 head）：
   - `DROP VIEW IF EXISTS v_conversations_with_deleted;`
   - 按 `startup.py` 的列序重建视图
   - 迁移必须**幂等**（用 `DROP VIEW IF EXISTS`，不要裸 `CREATE OR REPLACE`）
   - 注明：本迁移的存在理由是「`CREATE OR REPLACE` 无法改列序」，避免后人又改回去

2. **修正错误处理**：`except Exception` 至少升为 `logger.error`，并保留 exc_info；
   视图是查询依赖的硬前提，静默跳过等于把问题推到运行时。若担心阻碍启动，
   可改为「记录 error + 抛出明确异常」，让问题在启动阶段暴露而非在用户请求时。

3. **消除双写来源**（可选但推荐）：视图定义同时存在于 `startup.py` 与迁移里，
   未来必然再次漂移。建议 `startup.py` 只做「存在性检查」，定义权完全交给迁移。

### 验收

- [ ] 新库 `alembic upgrade head` 后，视图列序与 `startup.py` 一致
- [ ] 已有库（列序不同）执行迁移后，`CREATE OR REPLACE` 不再报错
- [ ] 故意制造错误时，启动日志出现 error 级记录（而非 warning）
- [ ] `/ai-agents/usage`、`/ai-agents/usage/statistics` 返回 200

---

## 2 号：PythonLab 调试按钮 `type`（**已核实为伪问题**）

### 结论：不需要修

审核与旧计划均声称「14 个调试按钮仅 1 个声明 `type="button"`，存在表单提交风险」。
**这是误判**，两个前提都不成立：

**前提一不成立：`Button` 组件已默认注入 `type="button"`**

`frontend/src/components/ui/button.tsx:18`：

```tsx
{...(!asChild ? { type: props.type ?? "button" } : {})}
```

组件层已经兜底，调用方不写 `type` 也是 `button` 而非 `submit`。
审核只看了 JSX 属性、没读组件实现。

**前提二不成立：PythonLab 整个模块没有 `<form>`**

```
rg "<form|</form>" frontend/src/pages/Admin/ITTechnology/pythonLab/ -g '*.tsx'
→ 无命中
```

即使真有 `submit` 类型，也没有表单可提交。

### 要做的事

**无**。保留本条作为结论记录，避免后续再被重复提出。

### 顺带确认（可选）

`AGENTS.md` 对 PythonLab 调试按钮的约束（只用原生 `title`/`aria-label`、
不引入 Radix Tooltip 弹层）仍然有效，与本条无关。实测这些按钮**未**违规。

---

## 执行顺序

| 顺序 | 任务 | 说明 |
|---|---|---|
| 1 | 1 号-第 1 步：新增迁移 | 核心，解除新环境阻塞 |
| 2 | 1 号-第 2 步：修正错误处理 | 防止再次静默 |
| 3 | 1 号验收 | 造库验证 + 接口 200 |
| — | 2 号 | **无需执行** |

---

## 影响面与风险

| 项 | 评估 |
|---|---|
| 改动文件 | 1 个新增迁移 + `startup.py` 局部 |
| 生产数据风险 | 低。`DROP VIEW` 只删视图不删数据；视图可由迁移重建 |
| 回滚 | 迁移 downgrade 恢复旧视图定义（需同时提供） |
| 依赖 | 无。不涉及前端 |
| 验证环境 | 当前开发栈（docker compose dev） |

---

## 相关文档

- `AGENTS.md` — 数据库和迁移规则（"生产结构变更必须走 Alembic migration"）
- `docs/development/API.md` — 若接口行为变化需同步
- `backend/scripts/README.md` — 若有脚本引用视图
