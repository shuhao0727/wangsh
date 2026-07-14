# 测试脚本清理清单

> 状态：redirect
> Owner：testing
> 最近复核：2026-07-13
> 替代文档：[README.md](README.md)

本页原有正文已拆分到对应 owner，避免同时维护“当前脚本”和“历史删除记录”：

- 当前测试策略、证据和重跑入口：[README.md](README.md)
- 当前测试结果：[TEST_STATUS.md](TEST_STATUS.md)
- 当前脚本入口：
  [scripts/README.md](../../../scripts/README.md)、
  [backend/scripts/README.md](../../../backend/scripts/README.md)、
  [frontend/scripts/README.md](../../../frontend/scripts/README.md)
- 已删除脚本及原因：[docs/scripts/ARCHIVE_INDEX.md](../../scripts/ARCHIVE_INDEX.md)

测试脚本删除前仍须检查 `package.json`、GitHub workflows、生产 smoke 编排和 README
引用；PythonLab smoke/soak、Alembic、部署恢复和当前发布证据默认保留。
