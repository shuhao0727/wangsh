# 文档维护规范

> 最后更新：2026-04-11

## 核心原则

**每次代码变更必须同步更新相关文档，确保文档与代码保持一致。**

---

## 文档分层与落位

- `docs/`：稳定、长期维护的项目文档，例如 API、功能设计、全局文档规则。
- `docs/docker/`：Docker 部署、发布记录、测试治理、阶段计划、前端专项文档和历史归档。
- 模块专用说明优先就近放置，例如 `backend/tests/README.md`、`scripts/xbk/README.md`。
- 新增文档前先查看 `docs/README.md`，不要把临时分析和正式文档混放。
- 统计项目文档时应排除 `venv`、`node_modules`、构建产物目录中的第三方 Markdown 文件。

---

## 文档更新规则

### 规则 1：修改前先读文档

在进行任何代码修改前，必须：
1. 读取相关的文档文件
2. 了解现有的设计和实现
3. 确认修改不会与现有设计冲突

**示例**：
- 修改 API 端点 → 先读 `docs/development/API.md`
- 修改数据库模型 → 先读 `docs/features/assessment/ASSESSMENT_DATABASE.md`（如果是 assessment 模块）
- 修改部署配置 → 先读 `docs/docker/deploy/DEPLOY.md`

### 规则 2：修改后立即更新文档

代码修改完成后，立即更新对应文档：

| 代码变更类型 | 需要更新的文档 |
|-------------|---------------|
| 新增/修改 API 端点 | `docs/development/API.md` |
| 新增/修改数据库表 | 对应模块的 DATABASE.md |
| 修改部署配置 | `docs/docker/deploy/DEPLOY.md` |
| 修改 CI/CD 工作流 | `docs/docker/deploy/CICD.md` |
| 调整测试脚本/烟测入口/测试治理规则 | `docs/docker/testing/README.md` 或对应测试治理文档 |
| 新增功能模块 | 创建对应的模块文档 |
| 修改环境变量 | `docs/docker/deploy/DEPLOY.md` + `.env.example` |
| 修复重要 Bug | `docs/docker/RELEASE_NOTES.md` |
| 修改 Docker 配置 | `docs/docker/deploy/DEPLOY.md` |

### 规则 3：文档更新检查清单

每次提交代码前，检查：
- [ ] 是否读取了相关文档？
- [ ] 文档是否已更新？
- [ ] 文档中的示例代码是否正确？
- [ ] 文档中的文件路径是否准确？
- [ ] 是否需要更新 `README.md` 或 `docs/README.md` 的文档索引？

---

## 具体场景

### 场景 1：新增 API 端点

**步骤**：
1. 读取 `docs/development/API.md`，了解现有 API 结构
2. 编写新的 API 端点代码
3. 在 `docs/development/API.md` 对应章节添加新端点
4. 更新 `docs/development/API.md` 顶部的"最后更新"时间

**示例**：
```markdown
## 七、AI 智能体（/ai-agents）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/ai-agents/new-endpoint` | 新功能说明 | 是 |
```

### 场景 2：修改数据库模型

**步骤**：
1. 读取对应模块的 DATABASE.md（如 `docs/features/assessment/ASSESSMENT_DATABASE.md`）
2. 修改数据库模型代码
3. 创建 Alembic 迁移文件
4. 更新 DATABASE.md 中的表结构说明
5. 更新字段说明和关系图

### 场景 3：新增功能模块

**步骤**：
1. 创建模块文档（如 `docs/features/NEW_MODULE.md`）
2. 编写模块代码
3. 在 `docs/README.md` 的"功能模块"章节添加链接
4. 在 `README.md` 的"文档索引"中补充入口（如有必要）
5. 在 `docs/development/API.md` 中添加对应的 API 章节

### 场景 4：修改配置

**步骤**：
1. 读取 `docs/docker/deploy/DEPLOY.md`
2. 修改配置文件（`.env.example`、`docker-compose.yml` 等）
3. 更新 `docs/docker/deploy/DEPLOY.md` 中的配置说明
4. 如果是新增环境变量，在"环境变量配置"章节添加说明

### 场景 5：修复重要 Bug

**步骤**：
1. 修复 Bug
2. 在 `docs/docker/RELEASE_NOTES.md` 顶部添加新版本记录
3. 说明修复的问题、根因、影响范围
4. 如果涉及配置变更，同步更新 `docs/docker/deploy/DEPLOY.md`

---

## 文档模板

### API 端点模板

```markdown
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET/POST/PUT/DELETE | `/path/to/endpoint` | 端点功能说明 | 是/否/管理员 |
```

### 数据库表模板

```markdown
### 表名：znt_table_name

**用途**：表的用途说明

**关键字段**：
- `id` - 主键
- `field_name` - 字段说明
- `created_at` - 创建时间
- `updated_at` - 更新时间

**关系**：
- 外键：`foreign_table_id` → `znt_foreign_table.id`
```

### 配置说明模板

```markdown
### 配置项名称

```bash
CONFIG_KEY=default_value
```

**说明**：配置项的用途和影响

**可选值**：
- `value1` - 说明
- `value2` - 说明

**注意事项**：特殊说明
```

---

## Claude AI 协作规范

### Claude 的职责

1. **修改前检查**：
   - 自动读取相关文档
   - 提醒可能的冲突
   - 建议最佳实践

2. **修改后更新**：
   - 自动更新相关文档
   - 保持文档格式一致
   - 更新"最后更新"时间

3. **文档质量**：
   - 确保文档准确性
   - 保持文档完整性
   - 及时同步变更

### 开发者的职责

1. **明确告知变更**：
   - 清楚说明要做什么修改
   - 提供必要的上下文
   - 确认文档更新范围

2. **审查文档更新**：
   - 检查 Claude 更新的文档
   - 确认内容准确
   - 补充遗漏信息

3. **提交前检查**：
   - 确认所有相关文档已更新
   - 运行测试验证
   - 提交时注明文档变更

---

## 文档审查流程

### 定期审查（每月）

1. 检查所有文档的"最后更新"时间
2. 对比代码变更，确认文档同步
3. 修正发现的不一致
4. 更新过时的示例代码

### PR 审查

1. 检查 PR 是否包含文档更新
2. 验证文档更新的准确性
3. 确认文档格式符合规范
4. 要求补充缺失的文档

---

## 常见问题

### Q: 小改动也要更新文档吗？

A: 是的。即使是小改动，如果影响到：
- API 接口
- 配置项
- 数据库结构
- 部署流程

都必须更新文档。

### Q: 文档更新太麻烦怎么办？

A:
1. 使用 Claude AI 自动更新
2. 遵循文档模板，减少思考时间
3. 修改时立即更新，避免积累

### Q: 如何确保文档不过时？

A:
1. 每次代码变更必须同步文档
2. 定期审查文档（每月）
3. PR 审查时检查文档
4. 使用 Claude 记忆系统辅助

---

## 工具支持

### Claude AI 自动化

Claude 会自动：
- 读取相关文档
- 提醒需要更新的文档
- 生成文档更新内容
- 保持格式一致

### Git Hooks（可选）

可以配置 Git Hooks 检查：
- 代码变更是否包含文档更新
- 文档格式是否正确
- 文档路径是否有效

---

## 附录：文档清单

### 核心文档
- `docs/README.md` - 总索引
- `README.md` - 项目入口
- `docs/development/API.md` - API 接口清单
- `docs/docker/deploy/DEPLOY.md` - 部署指南
- `docs/docker/deploy/CICD.md` - CI/CD 说明
- `docs/docker/testing/README.md` - 测试与验证入口
- `docs/docker/RELEASE_NOTES.md` - 版本记录
- `docs/DATABASE_PERFORMANCE_GUIDE.md` - 数据库性能优化指南（整合版）

### 功能模块文档
- `docs/features/AI_AGENTS.md` - AI 智能体
- `docs/features/CLASSROOM.md` - 课堂互动
- `docs/features/INFORMATICS.md` - 信息学笔记
- `docs/features/PYTHONLAB.md` - 调试环境
- `docs/features/assessment/` - 自主检测系统（6 个文件）

### 其他文档
- `docs/development/CLAUDE_GUIDE.md` - Claude 使用指南
- `docs/IMPROVEMENT_CHECKLIST.md` - 当前改进检查清单（主计划文档）
- `docs/ACCESSIBILITY_GUIDE.md` - 无障碍访问改进指南
- `docs/docker/archive/deploy/database-migration-fix.md` - 数据库迁移
- `docs/docker/archive/deploy/migration_analysis.md` - 迁移链分析
- `docs/docker/plans/README.md` - 计划与分析索引
- `docs/docker/testing/README.md` - 测试与验证索引
- `docs/docker/frontend/README.md` - 前端 UI 文档索引
- `backend/tests/README.md` - 后端测试说明
- `backend/scripts/README.md` - 后端 smoke/soak 脚本说明
- `scripts/README.md` - 根层脚本说明
- `frontend/scripts/README.md` - 前端脚本说明
- `scripts/xbk/README.md` - 脚本使用说明
