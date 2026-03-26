# 数据库迁移问题深度分析和修复方案

## 问题根源

### 1. 启动时自动创建表的问题

**文件**: `backend/main.py` 第46-50行

```python
if settings.DEBUG or settings.AUTO_CREATE_TABLES:
    logger.info("创建数据库表（仅开发环境/首次部署可选，生产请使用 Alembic 迁移）...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_dev_schema(conn)
```

**问题**:
- `DEBUG=True` 时自动调用 `create_all()` 创建所有表
- 绕过 Alembic，不更新 `alembic_version` 表
- 导致迁移状态不一致

### 2. _ensure_dev_schema 的问题

**文件**: `backend/main.py` 第138-158行

这个函数手动执行 DDL，应该通过 Alembic 迁移管理：
- 添加 `group_name` 列
- 创建索引
- 添加 `compare_session_ids` 列

**问题**: 这些 schema 变更应该在迁移文件中，而不是启动代码中

### 3. 视图创建逻辑

**文件**: `backend/alembic/versions/20260211_0004_move_startup_ddl_to_migrations.py`

视图 `v_conversations_with_deleted` 的创建有条件检查，但当表通过 `create_all()` 创建时，迁移从未执行，导致视图缺失。

## 最终修复方案（已实施）

### 修改文件: `backend/main.py`

**新增两个函数**:

1. `_ensure_views(conn)` - 自动创建视图
2. `_sync_alembic_version(conn)` - 自动同步迁移版本

**修改启动逻辑**:
```python
if settings.DEBUG or settings.AUTO_CREATE_TABLES:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_dev_schema(conn)
        await _ensure_views(conn)  # 新增
        await _sync_alembic_version(conn)  # 新增
```

### 效果

✅ 后端启动时自动：
1. 创建所有表（如果不存在）
2. 创建/更新视图
3. 同步 Alembic 版本到最新

✅ 解决的问题：
- 不再出现 `DuplicateTableError`
- 视图自动创建，会话API正常工作
- `alembic current` 正确显示版本
- 开发环境快速启动，迁移状态一致

## 验证

```bash
# 检查迁移版本
docker exec wangsh-backend alembic current

# 检查视图
docker exec wangsh-postgres psql -U admin -d wangsh_db -c "\dv v_conversations_with_deleted"

# 测试会话API
curl "http://localhost:8000/api/v1/ai-agents/conversations?agent_id=1&limit=5"
```

## 修复日期

2026-03-25

