# Alembic 迁移链分析报告

## 问题概述

服务器 backend 启动失败，错误信息：
```
Can't locate revision identified by '20260325_xbk_idx'
```

## 迁移链结构

### 主链（20260211 → 20260325）

```
20260211_0001 (root)
  ↓
20260211_0002
  ↓
20260211_0003
  ↓
20260211_0004
  ↓
20260213_0005
  ↓
20260223_0006
  ↓
20260225_0007
```

### 分支1：XBK 功能（从 20260223_0006 分叉）

```
20260223_0006
  ↓
1655cf329617 (add_xxjs_dianming)
  ↓
36b22173a652 (add_sys_feature_flags)
  ↓
04afffb306ed (add_grade_to_xbk)
```

### 合并点（20260225_0008）

```
20260225_0008 (merge_heads)
  ← 04afffb306ed
  ← 20260225_0007
  ↓
20260225_0009
  ↓
20260225_0010
  ↓
20260311_0001
  ↓
20260318_0001
```

### 分支2：课堂互动（从 20260318_0001 分叉）

```
20260318_0001
  ↓
78ef5c1ccb1d (add_classroom_interaction_tables)
  ↓
20260320_0002
  ↓
20260320_0003
  ↓
20260320_0004
  ↓
20260320_0005
  ↓
20260323_0006
  ↓
20260325_xbk_idx ← **当前HEAD（本地最新）**
```

## 问题根因

**服务器数据库的 `alembic_version` 表中记录了 `20260325_xbk_idx`，但服务器上的代码仓库可能：**

1. **未拉取最新代码**：缺少 `20260325_add_xbk_indexes.py` 文件
2. **迁移文件未提交**：该文件在本地但未推送到远程仓库
3. **数据库版本超前**：之前手动执行了迁移但代码回滚了

## 解决方案

### 方案1：推送最新迁移文件到服务器（推荐）

```bash
# 本地
git add backend/alembic/versions/20260325_add_xbk_indexes.py
git commit -m "feat: 添加 XBK 索引迁移"
git push

# 服务器
git pull
docker compose restart backend
```

### 方案2：回滚数据库到已知版本

```bash
# 服务器上
docker compose exec backend alembic downgrade 20260323_0006
docker compose restart backend
```

### 方案3：手动修复 alembic_version 表

```sql
-- 连接到数据库
UPDATE alembic_version SET version_num = '20260323_0006';
```

## 迁移文件清单（22个）

1. 20260211_0001 → 20260211_0004 (Informatics/Typst 基础)
2. 20260213_0005 (AI Agent 加密)
3. 20260223_0006 (AI Agent 描述)
4. 1655cf329617 → 04afffb306ed (XBK 分支)
5. 20260225_0007 → 20260225_0010 (文章样式)
6. 20260311_0001 (GitHub 同步)
7. 20260318_0001 (评估表)
8. 78ef5c1ccb1d → 20260325_xbk_idx (课堂互动分支)

## 当前HEAD

- **本地**: `20260325_xbk_idx`
- **服务器**: 未知（需检查）

## 建议操作

1. 检查 `20260325_add_xbk_indexes.py` 是否已提交到 git
2. 如果未提交，立即提交并推送
3. 服务器执行 `git pull` 获取最新迁移文件
4. 重启 backend 容器
