# AI伙伴前端开发与验证

本目录维护独立课堂页面的源码。功能说明以 [AI 智能体文档](../../docs/features/AI_AGENTS.md#ai伙伴临时共享榜单未发布) 为准，接口以 [API 合同](../../docs/development/API.md#ai伙伴临时共享榜单未发布) 为准；此处只维护本模块的开发、测试与构建使用方法，不记录临时交接和当前验收数字。

## 入口与来源

- 页面入口：`/games/ai-partner/index.html`；源码入口为 `index.html` → `./src/main.ts`。
- 教学原源与复制前 SHA-256 见 [SOURCE_PROVENANCE.json](SOURCE_PROVENANCE.json)。维护本目录可读源码，不修改教学原源，不用历史压缩产物替代源码。
- favicon 复用 `frontend/public/games/ai-partner/favicon.svg`，HTML 使用 `./favicon.svg`；不要新增重复的 `ai-partner/public/`。
- 浮动榜样式依赖 `virtual:wangsh-theme-tokens.css`。使用已注册主题插件的 Vite 入口开发，不单独用静态文件服务运行 TypeScript 源码。

## 开发与构建

在仓库的 `frontend/` 目录执行：

```bash
npm run dev
# 或只启动 AI伙伴开发入口：
npm run dev:ai-partner

npm run type-check
npm run build:ai-partner
# 验证完整接线：主站构建后，再生成 AI伙伴独立产物
npm run build
```

开发时使用上述两个入口之一即可，不必为验证另行启动重复服务。登录、身份切换和提交验证应使用已配置 API 代理的同一站点，不能用静态资源可访问代替认证联调。

构建完成后检查：

- 主站入口：`frontend/build/index.html`，引用主站 `assets/`。
- AI伙伴入口：`frontend/build/games/ai-partner/index.html`，JS/CSS 引用以 `/games/ai-partner/assets/` 开头，favicon 与该入口同目录。
- 检查两份 HTML 引用的本地资源均存在；从构建根目录提供静态文件时，各资源应返回正确类型，而不是 SPA fallback HTML。
- 不直接编辑构建产物，不以仅运行主站 Vite 构建替代 `npm run build` 的完整链路。

构建配置、资源边界和 npm 入口的维护说明见 [前端脚本 README](../scripts/README.md#ai伙伴独立源码入口未发布)。

## 定点测试

```bash
# 在 frontend/ 下执行
npm run test:ai-partner
```

专项配置 `frontend/vitest.ai-partner.config.ts` 使用 jsdom，仅收集 `ai-partner/src/**/*.test.ts`。新增模块测试沿用该范围，不把一次性 Node 脚本混入 Vitest 扫描路径。

- `src/ai-partner-service.test.ts`：平台认证边界、用户 ID 与请求合同。
- `src/leaderboard-controller.test.ts`：身份竞态、轮询可见性、显式提交和错误处理。
- `src/leaderboard-view.test.ts`：文本安全输出、榜单展示、关闭与焦点行为。
- `src/selection-platform.test.ts`：实际 catalog 下的课堂检查、服务端评分交互、记录门槛和账号草稿隔离。

### 桌面交互与评分联调边界

- 本轮桌面优先，验收左上角“榜单”入口、浮窗开关、刷新、焦点恢复和 Three 交互；不将手机布局作为本轮测试范围，也不宣称移动端已验收。
- 评分经共享认证客户端请求后端 `POST /ai-partner/evaluate`，展示返回的总分、等级、分项理由和建议。榜单提交使用服务器 `evaluation_id` 与 `round_id`，不传 `score`；请求与错误码以 API owner 为准。
- 覆盖方案修改使旧评分失效、评分中修改方案或切换账号、迟到响应不能覆盖新方案，以及课堂检查、核心测试与课堂记录未完成时不可提交的行为。
- 分开验证模型已配置、模型未配置、模型调用失败和 Redis 不可用的路径。未配置可用 AI 必须显示不可评分；不得通过规则分数或固定返回伪装成功。
- jsdom 与 mock 响应仅验证交互和合同，不能证明真实供应商模型已调用。真实模型验收须另行记录实际请求、响应与失败边界，证据需脱敏；不在截图或报告中暴露凭据。
- jsdom 不替代真实 Chrome 双账号、Three 交互或 Redis/后端轮次联调。当前测试与构建结果统一记录在 [TEST_STATUS](../../docs/docker/testing/TEST_STATUS.md)，发布结论由 [RELEASE_NOTES](../../docs/docker/RELEASE_NOTES.md) 维护。
