# S1 ~ S7 分级修复与验证执行计划（v1，已废止）

> 状态：superseded
> Owner：project-governance
> 被取代：[2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md](2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md)
> 废止日期：2026-10-27

本文件是 S1~S7 验证的第一版计划，已由 v3 取代，保留此页仅为路径引用连续。

废止原因：

- 检查项清单未在验证前冻结，验证深度取决于执行 Agent 的自由发挥；
- 复核 Agent 的结论缺少最小复现步骤约束；
- S1-7 / S2-2 / S3-5 存在循环引用，S2-2 无法在本级内完成；
- 未提交改动只列了 6 个文件，实际有 17 个且存在链式依赖；
- S5「当前模型无法读图」是过时结论。

v3 在上述各点均已修正，实际执行与证据见
[TEST_STATUS.md](../testing/TEST_STATUS.md)。
