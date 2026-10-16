# WangSh 全面深度审核报告

> 状态：reference
> Owner：project-governance
> 最近复核：2026-10-16
> 归档条件：长期结论沉淀到 owner 文档（含 docs/docker/2026-10-15-project-audit.md）后移入 archive

**审核时间**: 2026-10-09
**审核范围**: 全部 47 个问题 + 代码冗余分析 + 简化方案设计
**方法**: 5 个并行 Agent + 主 Session 独立验证

---

## 执行摘要

（等待 Agent 完成后填写）

---

## 第一部分：问题验证

### 1.1 P0 级问题（7 项）

#### ✅ 已验证实锤

**P0-3: 质量门禁红灯**
- **验证方法**: 实际运行 `npm run ui:spacing:ci`
- **证据**: EXIT=1, numeric_spacing_uses: 1386 > 1382 (+4)
- **位置**: [报告链接]

**P0-4: 权限测试不同步**
- **验证方法**: `pytest test_metrics_router_has_admin_auth`
- **证据**: FAILED
- **位置**: [报告链接]

**P0-6: CDN 脚本无 SRI**
- **验证方法**: `grep` 统计 index.html
- **证据**: 9 个 CDN 引用, 0 个 integrity
- **位置**: [报告链接]

**P0-7: 占位值入库**
- **验证方法**: 代码走读
- **证据**:
  - 路径1: chat_blocking.py:67 返回 `debug_stub:`
  - 路径2: analysis_service.py:62 返回 `fallback_analysis`
  - 入库点: analysis_service.py:74-77
- **新发现**: 有**两条**占位路径，不是一条
- **位置**: [报告链接]

**C-5: Celery Beat 未启动**
- **验证方法**: docker compose ps + 配置文件检查
- **证据**:
  - docker ps 无 beat 服务
  - compose 文件 0 处 beat 定义
  - celery_app.py 定义 4 个周期任务但永不触发
- **影响**: P2-2（归档任务）、孤儿清理、僵尸会话清理全部失效
- **位置**: [报告链接]

#### 🔄 等待 Agent 验证

- P0-1: PythonLab 调试不可用（孤儿容器）
- P0-2: AI 密钥解密失败
- P0-5: 生产缺少文档级 CSP

---

### 1.2 P1 级问题（9 项）

（等待 Agent 完成后填写）

---

### 1.3 P2 级问题（7 项）

（等待 Agent 完成后填写）

---

### 1.4 C 类问题（链式衍生，6 项）

（等待 Agent 完成后填写）

---

### 1.5 U 类问题（UI 专项，14 项）

（等待 Agent 完成后填写）

---

### 1.6 X 类问题（复核新增，4 项）

（等待 Agent 完成后填写）

---

## 第二部分：代码冗余分析

（等待 Agent 完成后填写）

### 2.1 重复代码统计

### 2.2 死代码统计

### 2.3 临时文件清理

### 2.4 冗余依赖分析

---

## 第三部分：简化方案

（等待 Agent 完成后填写）

### 3.1 高优先级简化（P0/C-5）

### 3.2 中优先级简化（门禁/UI）

### 3.3 低优先级简化（重构）

---

## 第四部分：修正与新发现

### 4.1 文档需要修正的内容

1. **探针脚本已清理**: 文档称 20+ 个，实际只剩 1 个配置文件
2. **P0-7 双路径**: 不只是 `debug_stub`，还有 `fallback_analysis`

### 4.2 新发现的风险

（等待 Agent 完成后填写）

---

## 附录

### A. 验证命令清单

```bash
# P0-3
cd frontend && npm run ui:spacing:ci

# P0-4
cd backend && python -m pytest tests/system/test_metrics.py::test_metrics_router_has_admin_auth

# P0-6
grep -c "https://cdn" frontend/index.html
grep -c "integrity=" frontend/index.html

# C-5
docker compose ps
grep -n "beat" docker-compose*.yml
```

### B. Agent 任务分配

1. P0 问题验证 Agent (7 项)
2. P1/P2 问题验证 Agent (16 项)
3. C/U/X 问题验证 Agent (24 项)
4. 代码冗余分析 Agent
5. 简化方案设计 Agent

### C. 关键代码位置索引

- chat_blocking.py:67 — debug_stub 返回
- analysis_service.py:62-66 — fallback_analysis 返回
- analysis_service.py:74-77 — 入库点
- celery_app.py:63-79 — beat_schedule 定义
- docker-compose.yml — 缺少 beat 服务

---

**报告状态**: 🚧 施工中，等待 5 个 Agent 完成
