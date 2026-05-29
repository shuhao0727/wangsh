# 根层脚本说明

> 详细文档请参考：`docs/scripts/ARCHIVE_INDEX.md`

仓库根层 `scripts/` 只保留跨模块、运维级和统一入口级脚本。

## 当前结构

- `prod-smoke/` - 生产环境全链路烟测入口
- `xbk/` - XBK 重建、导入样例、冒烟脚本
- `deploy.sh` - 部署入口
- `rollback.sh` - 回滚入口
- `migrate-db.sh` - 数据库迁移
- `health-check-detailed.sh` - 细粒度健康检查
- `check-version-consistency.mjs` - CI 版本一致性检查

## 常用入口

```bash
# 生产环境全链路烟测
./scripts/prod-smoke/run.sh

# 部署后健康检查
./scripts/health-check-detailed.sh

# 生产镜像构建、推送与部署
bash scripts/deploy.sh build
bash scripts/deploy.sh push
bash scripts/deploy.sh deploy

# 迁移前只读检查 + Alembic 升级
bash scripts/migrate-db.sh upgrade

# 使用 shuhao07/*:1.5.16 镜像做本地生产模拟（端口 16608）
bash scripts/deploy.sh simulate

# 使用当前 .env 中的本地镜像启动，不拉取、不构建
bash scripts/deploy.sh up-no-build

# XBK 一键重建 + 样例导入 + 冒烟
python scripts/xbk/run_all.py
```
