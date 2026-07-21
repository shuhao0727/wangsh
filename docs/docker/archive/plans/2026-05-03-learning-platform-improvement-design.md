# 学习平台改进设计归档

> 状态：archived
> Owner：learning
> 最近复核：2026-07-18
> 替代文档：[LEARNING.md](../../../features/LEARNING.md)

本文保留 2026-05-03 学习平台改造中仍有长期价值的设计取舍，不再作为实施步骤。

## 目标与边界

- ML、AI、Agents 的现有课程内容是正式内置资产，不是演示数据。
- 使用轻量通用内容层，不建设独立完整 CMS，也不为每种内容形态创建专用表。
- `module_key + section_key + item_key` 负责内容命名空间，结构化 JSON 允许 roadmap、
  knowledge、experiments、tools、resources 等模块保持差异。
- 现有进度 API 和用户数据必须兼容，内容治理不能顺带重置学习进度。

## 内容来源

- 前端内置内容先提供完整、即时、离线可用的 fallback。
- 后端内容按 section 合并或覆盖；缺少后端数据时不能显示空白页。
- 单个 section 结构无效时只忽略该 section，不能让整页崩溃。
- API 失败应给出非阻断提示；进度保存失败仍需要明确错误提示。
- 删除内置副本前，必须先证明版本化资源、幂等 seed 和空库内容完整性恢复可用。

## 进度兼容

历史设计建议的进度结构包括：

- `stageStatus`
- `completedItems`
- `favoriteItems`
- `notesByItem`
- `moduleNotes`
- `updatedAt`

读取旧记录时必须先归一化，再增加新字段；不得因为前端结构升级让已有用户进度失效。

## 前端性能

- 只渲染活动 Tab，除非隐藏内容必须保持挂载状态。
- Mermaid、图表和其他重型模块只在对应 Tab 激活后加载。
- 搜索和筛选状态留在各自模块，避免触发无关区域重渲染。
- 共享数据请求、进度归一化和过滤逻辑可以复用，但三类课程的视觉布局不应被强行统一。

## 分阶段实施

1. 先拆分超长页面中的类型、数据和纯函数，保持行为不变。
2. 再增加后端内容模型、迁移和读取接口。
3. 然后接入前端 fallback/覆盖链路和进度兼容。
4. 最后验证空库恢复、页面交互和性能，再考虑删除重复内容源。

## 验证要求

- 后端：模型导入、Alembic、内容 API、进度兼容和异常 rollback。
- 前端：ML/AI/Agents 页面加载、Tab 切换、筛选、保存和 fallback。
- 运行时：后端不可用、无效 section、旧进度形状和重型 Tab 懒加载。

完整当前实现见 [LEARNING.md](../../../features/LEARNING.md)。
