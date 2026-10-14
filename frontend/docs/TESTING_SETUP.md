# 前端测试指南

> 状态：active
> Owner：frontend
> 最近复核：2026-07-22

本文只说明 WangSh 当前真实的前端测试配置。全项目最新测试数字、证据和待执行门禁见
[TEST_STATUS.md](../../docs/docker/testing/TEST_STATUS.md)。

## 当前配置

- 测试框架：Vitest、React Testing Library、jsdom。
- 配置文件：`frontend/vitest.config.ts`。
- 全局 setup：`frontend/src/test/setup.ts`。
- 默认命令：`npm test` 执行一次 `vitest run`，`npm run test:watch` 进入监听模式。
- Node 脚本测试：`npm run test:scripts`。

默认 Vitest 门禁覆盖：

```text
src/components/**/*.test.{ts,tsx}
src/pages/AIAgents/**/*.test.{ts,tsx}
src/pages/Admin/ITTechnology/pythonLab/**/*.test.{ts,tsx}
src/hooks/queries/**/*.test.{ts,tsx}
src/lib/**/*.test.{ts,tsx}
src/services/**/*.test.{ts,tsx}
```

新增测试应放入对应 owner 目录。扩大默认范围时，必须同步更新
`frontend/vitest.config.ts`、本文件和
[CI/CD 文档](../../docs/docker/deploy/CICD.md)。

## 常用命令

```bash
cd frontend
npm test
npm run test:watch
npm run test:scripts
npm run type-check
npm run lint
npm run token:check:ci
npm run ui:audit:ci
npm run build:check
```

提交前按改动范围选择最小可靠组合；前端 TypeScript 或样式变更至少运行
`npm run type-check`，路由、懒加载、构建配置或重型模块变更应补跑
`npm run build:check`。

## 编写约定

- 文件名使用 `*.test.ts` 或 `*.test.tsx`。
- 优先通过角色、可访问名称和用户事件断言行为，不依赖脆弱 DOM 层级。
- 每个测试自行准备数据并在结束后恢复 mock、timer 和全局对象。
- Query 测试复用项目 `queryKeys`，不要在测试中发明另一套缓存键。
- 异步 UI 使用可观察状态等待，不用无依据的固定 sleep。
- 测试失败时先确认是环境、合同变化还是产品回归，不通过放宽断言掩盖问题。

## 必测回归

认证和角色路由变更至少覆盖：

- super_admin/admin 登录后进入 `/admin/dashboard`。
- teacher 登录后进入 `/admin/classroom-interaction`。
- student 登录后进入 `/home`，且后台路由被守卫拒绝。
- 登录提交回调和认证状态 effect 使用同一跳转决策。
- React StrictMode 首次认证探测被 cleanup 取消后能够重新探测并结束 loading。

PythonLab 变更按
[PYTHONLAB.md](../../docs/features/PYTHONLAB.md)执行专项验证。涉及
Run、Debug、Pause、Continue、Step、tooltip、hover、pointer 或 focus 时，单元测试
不能替代真实浏览器点击和多断点连续 Continue 验证。

## 相关文档

- [测试状态](../../docs/docker/testing/TEST_STATUS.md)
- [测试与验证入口](../../docs/docker/testing/README.md)
- [前端脚本](../scripts/README.md)
- [CI/CD](../../docs/docker/deploy/CICD.md)
- [前端 UI 文档](../../docs/docker/frontend/README.md)

## Three.js 依赖升级验证（未发布）

`three` 与 `@types/three` 的依赖区间分别同步为 `^0.186.1` 与
`^0.186.0`，类型包作为构建依赖与锁文件同批维护。依赖升级不代表应用版本发布；
版本字段由最终封版批同步。AI Partner 改用受支持的 `PCFShadowMap`，
避免新版运行时移除 `PCFSoftShadowMap` 后触发警告与隐式回退。验证从实际提交候选执行 `npm ci`、`type-check`、
直接游戏回归及 `build:check`，不能借当前工作区其他未提交代码证明兼容。
安装脚本必须在无业务凭据的隔离副本执行；局测与真实浏览器/WebGL验收分开，
当前动态结果与未验范围见 [TEST_STATUS](../../docs/docker/testing/TEST_STATUS.md)。

## 共享工具与 hooks 直接回归

默认组件门禁中的 `sharedUtilitiesHooks.test.tsx` 直接验证日期格式、未知错误
对象的兜底、分页边界与分页读取、总量缩小后的上一页、独立预览返回及批量
操作部分失败，含同步校验抛错时仍逐项结算。查询失效复用既有 `queryKeys`，不靠页面混合测试借后续实现。
错误响应 `data` 为空或不为对象时返回未知错误，避免处理异常时再次抛错；分页
状态与有效显示页同步，上一页/下一页从当前显示页导航。独立页关闭被拒时
返回所属页面，成功关闭或卸载时不迟到导航。

执行 `npm test -- src/components/sharedUtilitiesHooks.test.tsx`、`npm run type-check`
和适用静态门禁。组件内存替身不等于真实浏览器关页或业务 API/数据库验收，
动态证据与限制仍见 [TEST_STATUS](../../docs/docker/testing/TEST_STATUS.md)。
