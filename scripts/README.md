# 根层脚本说明

> 详细文档请参考：`docs/scripts/ARCHIVE_INDEX.md`

仓库根层 `scripts/` 只保留跨模块、运维级和统一入口级脚本。

## 当前结构

- `prod-smoke/` - 生产环境全链路烟测入口
- `xbk/` - XBK 重建、导入样例、冒烟脚本
- `deploy.sh` - 部署入口
- `rollback.sh` - 回滚入口
- `migrate-db.sh` - 数据库迁移
- `verify-deployment.sh` - 部署后核验
- `health-check-detailed.sh` - 细粒度健康检查
- `optimize_host_for_pythonlab.sh` - PythonLab 主机调优

## 常用入口

```bash
# 生产环境全链路烟测
./scripts/prod-smoke/run.sh

# XBK 一键重建 + 样例导入 + 冒烟
python scripts/xbk/run_all.py
```
