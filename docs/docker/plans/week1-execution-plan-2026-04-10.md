# 第一周执行计划（2026-04-10 至 2026-04-17）

## 本周目标
完成 `group_discussion.py` 的拆分，建立前端测试基础设施，开始数据库性能分析。

## 具体任务

### 任务1：为 group_discussion 模块补最小回归测试

**前置条件：**
- 后端测试环境已配置：`cd backend && pytest -q` 可运行
- 现有测试目录：`backend/tests/group_discussion/`

**执行步骤：**
1. [ ] 检查现有测试覆盖情况
   ```bash
   cd /Users/wsh/wangsh/backend
   pytest tests/group_discussion/ -v
   ```

2. [ ] 识别关键API端点，补充缺失测试
   - 会话创建：`POST /api/v1/group-discussion/sessions`
   - 消息添加：`POST /api/v1/group-discussion/sessions/{id}/messages`
   - 分析执行：`POST /api/v1/group-discussion/sessions/{id}/analyze`

3. [ ] 编写最小回归测试
   ```python
   # tests/group_discussion/test_session_crud.py
   async def test_create_group_discussion_session():
       """测试创建小组讨论会话"""
       # 使用测试工厂创建数据
       # 调用API
       # 验证响应
       pass
   ```

**验收标准：**
- [ ] `pytest tests/group_discussion/` 通过率 > 90%
- [ ] 关键API端点都有至少一个测试用例
- [ ] 测试执行时间 < 30秒

### 任务2：拆分 group_discussion.py

**前置条件：**
- 任务1的回归测试已通过
- 已备份原文件

**执行步骤：**
1. [ ] 创建目录结构
   ```bash
   mkdir -p backend/app/services/agents/group_discussion
   ```

2. [ ] 使用拆分脚本（或手动拆分）
   ```bash
   # 先备份
   cp backend/app/services/agents/group_discussion.py backend/app/services/agents/group_discussion.py.backup
   
   # 运行拆分脚本
   python scripts/split_group_discussion.py
   ```

3. [ ] 验证拆分结果
   ```bash
   # 检查新文件结构
   tree backend/app/services/agents/group_discussion/
   
   # 运行测试
   cd backend && pytest tests/group_discussion/ -v
   ```

4. [ ] 更新导入语句
   - 查找所有导入 `group_discussion` 的文件
   - 更新为新的模块导入方式

**验收标准：**
- [ ] 原功能测试全部通过
- [ ] 新文件结构清晰，单个文件 < 500行
- [ ] 无循环依赖警告
- [ ] API端点手动冒烟测试通过

### 任务3：搭建前端测试基础设施

**前置条件：**
- 前端开发环境正常：`npm run dev` 可启动
- `package.json` 中 `test` 脚本当前为占位状态

**执行步骤：**
1. [ ] 安装测试依赖
   ```bash
   cd frontend
   npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
   ```

2. [ ] 配置 Vitest
   ```json
   // vitest.config.ts
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       setupFiles: ['./src/test/setup.ts'],
       include: ['**/*.{test,spec}.{ts,tsx}'],
     },
   })
   ```

3. [ ] 创建测试工具文件
   ```typescript
   // src/test/setup.ts
   import '@testing-library/jest-dom'
   import { afterEach } from 'vitest'
   import { cleanup } from '@testing-library/react'

   afterEach(() => {
     cleanup()
   })
   ```

4. [ ] 更新 package.json
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

5. [ ] 编写首个组件测试
   ```typescript
   // src/components/ui/button.test.tsx
   import { render, screen } from '@testing-library/react'
   import { Button } from './button'

   describe('Button', () => {
     it('renders with children', () => {
       render(<Button>Click me</Button>)
       expect(screen.getByRole('button')).toHaveTextContent('Click me')
     })
   })
   ```

**验收标准：**
- [ ] `npm run test` 可执行并显示测试结果
- [ ] Button 组件测试通过
- [ ] 测试覆盖率报告可生成

### 任务4：数据库性能分析

**前置条件：**
- PostgreSQL 运行正常
- 有生产或测试环境查询样本

**执行步骤：**
1. [ ] 启用慢查询日志（测试环境）
   ```sql
   -- 临时启用（重启后失效）
   ALTER SYSTEM SET log_min_duration_statement = '1000';
   SELECT pg_reload_conf();
   ```

2. [ ] 收集查询样本
   ```bash
   # 查看慢查询日志
   tail -f /var/lib/postgresql/data/log/postgresql-*.log | grep "duration:"
   
   # 或使用 pg_stat_statements
   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY total_time DESC
   LIMIT 10;
   ```

3. [ ] 分析关键查询
   ```sql
   -- 对慢查询执行 EXPLAIN ANALYZE
   EXPLAIN ANALYZE
   SELECT * FROM znt_group_discussion_sessions
   WHERE session_date = '2024-01-01'
     AND class_name = '测试班'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

4. [ ] 检查现有索引
   ```sql
   -- 查看 group_discussion 相关表的索引
   SELECT
     tablename,
     indexname,
     indexdef
   FROM pg_indexes
   WHERE tablename LIKE 'znt_group_discussion%'
   ORDER BY tablename, indexname;
   ```

**验收标准：**
- [ ] 输出慢查询Top 10清单
- [ ] 关键查询有执行计划分析
- [ ] 识别出至少2个索引优化机会
- [ ] 生成数据库性能分析报告

### 任务5：无障碍访问基础改进

**前置条件：**
- Home 页面可正常访问
- 通用组件（Button、Input）已存在

**执行步骤：**
1. [ ] 检查 Home 页面无障碍问题
   ```bash
   # 使用 Lighthouse CLI（如果已安装）
   lighthouse http://localhost:6608 --view --output-path=report.html
   
   # 或使用 Chrome DevTools 手动检查
   ```

2. [ ] 修复 Button 组件
   ```typescript
   // src/components/ui/button.tsx
   // 确保：
   // 1. 支持 aria-label
   // 2. 支持 aria-disabled
   // 3. 焦点样式可见
   ```

3. [ ] 修复 Input 组件
   ```typescript
   // src/components/ui/input.tsx
   // 确保：
   // 1. 支持 aria-describedby
   // 2. 支持 aria-invalid
   // 3. 与 label 正确关联
   ```

4. [ ] 添加跳过导航链接
   ```tsx
   // 在布局组件中添加
   <a href="#main-content" className="sr-only focus:not-sr-only">
     跳转到主要内容
   </a>
   ```

**验收标准：**
- [ ] Lighthouse 无障碍评分 > 85
- [ ] WAVE 扫描无严重错误
- [ ] 键盘 Tab 顺序合理
- [ ] 屏幕阅读器可正确朗读关键内容

## 每日检查点

### 第一天（4月10日）
- [ ] 任务1：完成 group_discussion 测试现状分析
- [ ] 任务3：安装前端测试依赖

### 第二天（4月11日）
- [ ] 任务1：编写关键API测试用例
- [ ] 任务3：配置 Vitest 并运行首个测试

### 第三天（4月12日）
- [ ] 任务2：备份并开始拆分 group_discussion.py
- [ ] 任务4：配置数据库慢查询日志

### 第四天（4月13日）
- [ ] 任务2：完成拆分并验证功能
- [ ] 任务4：收集查询样本

### 第五天（4月14日）
- [ ] 任务5：检查并修复 Home 页面无障碍问题
- [ ] 任务4：分析执行计划

### 第六天（4月15日）
- [ ] 任务5：修复通用组件无障碍问题
- [ ] 所有任务验收标准检查

### 第七天（4月16日）
- [ ] 本周任务总结
- [ ] 生成进度报告
- [ ] 规划下周任务

## 风险与应对

### 技术风险
1. **文件拆分引入bug**
   - 应对：充分测试，保留备份，逐步迁移

2. **前端测试配置复杂**
   - 应对：使用成熟方案（Vitest + RTL），参考官方文档

3. **数据库分析影响性能**
   - 应对：在测试环境进行，避开业务高峰

### 资源风险
1. **时间不足**
   - 应对：优先完成核心任务（任务1、2、3）
   - 数据库分析和无障碍改进可适当延后

2. **环境问题**
   - 应对：提前验证环境可用性

### 沟通风险
1. **团队协作**
   - 应对：每日站会同步进度，及时沟通问题

## 交付物

### 代码交付
1. 拆分后的 `group_discussion` 模块
2. 前端测试配置和示例测试
3. 数据库性能分析报告
4. 无障碍改进代码

### 文档交付
1. 本周执行总结报告
2. 遇到的问题和解决方案
3. 下周计划建议

### 质量指标
1. 测试通过率：> 95%
2. 代码覆盖率：新增代码 > 80%
3. 性能提升：关键查询响应时间下降
4. 无障碍评分：Lighthouse > 85

## 工具和资源

### 开发工具
1. **测试运行**：`pytest`, `vitest`
2. **代码检查**：`eslint`, `pylint`
3. **性能分析**：`EXPLAIN ANALYZE`, `pg_stat_statements`
4. **无障碍检查**：Lighthouse, WAVE, axe DevTools

### 参考文档
1. [Vitest 官方文档](https://vitest.dev/)
2. [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
3. [PostgreSQL 性能优化](https://www.postgresql.org/docs/current/performance-tips.html)
4. [WCAG 2.1 指南](https://www.w3.org/TR/WCAG21/)

### 团队成员
- 后端开发：负责任务1、2、4
- 前端开发：负责任务3、5
- 测试人员：协助验收测试
- 项目经理：跟踪进度，协调资源

---

**更新记录：**
- 2026-04-10: 创建第一周执行计划
- 下次评审：2026-04-17

**状态跟踪：**
使用每日检查点跟踪进度，每日站会同步状态。