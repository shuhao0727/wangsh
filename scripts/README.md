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
- `workflow-contracts.test.mjs` - GitHub Actions、发布和日志脱敏合同测试
- `check-markdown-contracts.mjs` - Markdown 链接、生命周期、归档和派生数字检查
- `markdown-contracts.test.mjs` - Markdown 合同与独立 workflow 回归测试

## 常用入口

```bash
# 隔离生产模拟中的全链路烟测（推荐）
SIM_RUN_PROD_SMOKE=true SIM_CLEANUP=true bash scripts/deploy.sh simulate

# 直接对已确认的专用环境运行状态型 smoke；生产目标必须显式授权
PROD_SMOKE_ALLOW_LIVE=true ./scripts/prod-smoke/run.sh

# PythonLab smoke 子脚本统一凭据（不要写入命令行参数）
PROD_SMOKE_ALLOW_LIVE=true \
PYTHONLAB_SMOKE_USERNAME=admin \
PYTHONLAB_SMOKE_PASSWORD='从 secret 注入' \
./scripts/prod-smoke/run.sh

# 部署后健康检查；默认访问网关 6608，并要求 frontend、gateway、数据库、Redis 和两个 worker 健康
./scripts/health-check-detailed.sh

# 生产镜像构建、推送与部署
bash scripts/deploy.sh build
bash scripts/deploy.sh push
bash scripts/deploy.sh verify-release-set release-set.txt
# 只拉六个业务镜像，校验 digest，以 --pull never 启动并等待全部服务健康
bash scripts/deploy.sh deploy

# 迁移前只读检查 + Alembic 升级
bash scripts/migrate-db.sh upgrade

# 先停止业务服务，默认备份，再用一次性 backend 容器回退一个 revision；
# 执行后保持停止，直到旧 release-set 部署并通过健康检查
bash scripts/rollback.sh rollback -1

# 恢复数据库必须显式确认目标库
bash scripts/deploy.sh restore-db ./backups/your-backup.dump --yes

# 使用当前 .env 版本镜像做本地生产模拟（端口 16608）
bash scripts/deploy.sh simulate

# 运行完整生产 smoke，并在成功或失败后清理隔离模拟栈
SIM_RUN_PROD_SMOKE=true SIM_CLEANUP=true bash scripts/deploy.sh simulate

# 验证远端 release-set，并确认本地镜像 RepoDigest 完全一致后启动，不拉取、不构建；
# PostgreSQL/Redis 也不会被隐式拉取
bash scripts/deploy.sh up-no-build

# XBK 增量种子 + 样例导入 + 冒烟；默认不清空已有数据
python scripts/xbk/run_all.py

# 只有明确需要重建本地 XBK 数据时才清空
python scripts/xbk/run_all.py --reset

# Markdown 文档合同
node --test scripts/markdown-contracts.test.mjs
```

生产模拟隔离、release-set、日志脱敏、证据权限和失败清理合同由
[`docs/docker/deploy/DEPLOY.md`](../docs/docker/deploy/DEPLOY.md)与
[`docs/docker/testing/README.md`](../docs/docker/testing/README.md)维护，本页不复制
实现细节。
