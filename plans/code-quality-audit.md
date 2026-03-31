# 代码质量审查报告 — 安全清理清单

> 审查日期：2026-03-31
> 原则：只清理确定安全的冗余代码，不删除任何可能有用的逻辑

---

## 一、安全可清理项（低风险）

### 1.1 后端：pub/sub 函数从 classroom.py 提取到独立模块

**问题**：`publish/subscribe/unsubscribe` 定义在 `classroom.py` 中，但被 8 个不相关的模块导入（users、articles、agents、assessment 等），导致所有模块都依赖 classroom 服务。

**修复**：提取 `publish/subscribe/unsubscribe` 到 `app/core/pubsub.py`，各模块改为 `from app.core.pubsub import publish`。

**影响的文件**：
- `backend/app/services/classroom.py` — 移出 pub/sub 函数
- `backend/app/core/pubsub.py` — 新建
- `backend/app/api/endpoints/management/users/users.py`
- `backend/app/api/endpoints/agents/ai_agents/crud.py`
- `backend/app/api/endpoints/content/articles/articles.py`
- `backend/app/api/endpoints/assessment/admin.py`
- `backend/app/api/endpoints/agents/ai_agents/group_discussion.py`
- `backend/app/api/endpoints/classroom/admin.py`
- `backend/app/api/endpoints/classroom/student.py`
- `backend/app/api/endpoints/admin_stream.py`

**风险**：低 — 纯重构，不改变任何逻辑

### 1.2 前端：znt/index.ts 中的空实现 API

**问题**：`zntUsersApi` 和 `studentAuthApi` 是空实现（返回模拟数据），注释写着"功能已简化"。

**处理**：暂不删除 — 可能有其他地方引用。标记为 deprecated 即可。

**风险**：需要确认是否有页面使用

### 1.3 后端：旧版 full_init_v3.sql

**问题**：`backend/db/init.sql/full_init_v3.sql` 和 `full_init_v4.sql` 同时存在。

**处理**：暂不删除 — v3 可能作为历史参考。

---

## 二、需要谨慎处理的项

### 2.1 大量 `except Exception: pass`

**统计**：后端约 161 处 `pass` 语句，其中大部分是 `except Exception: pass`。

**分析**：
- `classroom.py` 中的 `QueueFull: pass` — 合理，SSE 队列满时丢弃事件
- `classroom_plan.py` 中的 `except Exception: pass` — 合理，结束活动失败不应阻塞计划推进
- `typst_notes.py` 中的大量 `except: pass` — 需要审查，可能隐藏了编译错误
- `debug/flow.py` 中的 `except: pass` — 需要审查，可能隐藏了 AST 解析错误
- `sandbox/base.py` 中的 `pass` — 合理，抽象基类方法

**处理**：不批量修改。逐个审查后，对确实需要日志的地方添加 `logger.debug`。

### 2.2 后端大文件

| 文件 | 行数 | 建议 |
|------|------|------|
| `services/classroom.py` | 607 | 提取 pub/sub 后会减少，暂不拆分 |
| `api/endpoints/xbk/data.py` | 646 | 建议拆分为 students.py + courses.py + selections.py |
| `api/endpoints/debug/flow.py` | ~1276 | 复杂但内聚，暂不拆分 |
| `services/assessment/session_service.py` | ~1249 | 复杂但内聚，暂不拆分 |
| `api/endpoints/debug/ws.py` | ~963 | WebSocket 处理，复杂但内聚 |

---

## 三、本轮安全执行的清理

优先执行 1.1（pub/sub 提取），这是最有价值且最安全的重构。

### 执行步骤

1. 创建 `backend/app/core/pubsub.py`，从 classroom.py 移出 publish/subscribe/unsubscribe
2. 修改 classroom.py，改为从 pubsub 导入
3. 修改 8 个 API 文件，改为从 pubsub 导入
4. 运行测试验证
