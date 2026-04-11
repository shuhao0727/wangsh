# 前端测试配置指南

## 概述

本文档指导如何为 WangSh 前端项目配置测试环境，使用 Vitest + React Testing Library。

## 当前状态

- 项目使用 Vite + React 19 + TypeScript
- `package.json` 中的 `test` 脚本当前为占位状态
- 需要建立完整的测试基础设施

## 配置步骤

### 步骤1：安装依赖

```bash
cd frontend
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/testing-library__jest-dom
```

### 步骤2：创建 Vitest 配置文件

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.setup.*',
      ],
    },
  },
})
```

### 步骤3：创建测试工具文件

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 全局清理
afterEach(() => {
  cleanup()
})

// 扩展 expect
import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)
```

### 步骤4：更新 package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

### 步骤5：创建 TypeScript 配置扩展

```json
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.spec.ts",
    "src/**/*.spec.tsx",
    "src/test/setup.ts"
  ]
}
```

## 测试示例

### 组件测试示例

```typescript
// src/components/ui/button.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  })

  it('supports aria-label', () => {
    render(<Button aria-label="Submit form">Submit</Button>)
    expect(screen.getByRole('button')).toHaveAccessibleName('Submit form')
  })
})
```

### Hook 测试示例

```typescript
// src/hooks/useCounter.test.ts
import { renderHook, act } from '@testing-library/react'
import { useCounter } from './useCounter'

describe('useCounter', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter())
    expect(result.current.count).toBe(0)
  })

  it('should increment count', () => {
    const { result } = renderHook(() => useCounter())
    
    act(() => {
      result.current.increment()
    })
    
    expect(result.current.count).toBe(1)
  })

  it('should reset count', () => {
    const { result } = renderHook(() => useCounter(5))
    
    act(() => {
      result.current.increment()
      result.current.reset()
    })
    
    expect(result.current.count).toBe(5)
  })
})
```

### API 服务测试示例

```typescript
// src/services/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './api'

// Mock fetch
global.fetch = vi.fn()

describe('API Service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should make GET request', async () => {
    const mockResponse = { data: 'test' }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })
    global.fetch = mockFetch

    const result = await api.get('/test')
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'GET',
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('should handle errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })
    global.fetch = mockFetch

    await expect(api.get('/not-found')).rejects.toThrow('404 Not Found')
  })
})
```

## 测试最佳实践

### 1. 测试命名规范
- 文件命名：`ComponentName.test.tsx` 或 `ComponentName.spec.tsx`
- 测试描述：使用 `describe` 和 `it` 清晰描述测试场景
- 用例命名：`should [expected behavior] when [condition]`

### 2. 测试结构
```typescript
describe('ComponentName', () => {
  // 准备阶段
  const defaultProps = { ... }
  
  // 渲染测试
  describe('rendering', () => {
    it('should render correctly', () => { ... })
    it('should render with props', () => { ... })
  })
  
  // 交互测试
  describe('interactions', () => {
    it('should handle click', () => { ... })
    it('should handle keyboard events', () => { ... })
  })
  
  // 状态测试
  describe('state', () => {
    it('should update state correctly', () => { ... })
  })
})
```

### 3. 可访问性测试
```typescript
it('should be accessible', () => {
  render(<Component />)
  
  // 检查角色
  expect(screen.getByRole('button')).toBeInTheDocument()
  
  // 检查标签
  expect(screen.getByLabelText('Username')).toBeInTheDocument()
  
  // 检查焦点顺序
  expect(screen.getByTestId('first-input')).toHaveAttribute('tabindex', '0')
})
```

### 4. Mock 策略
```typescript
// 模块 Mock
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  }
}))

// 函数 Mock
const mockHandler = vi.fn()
render(<Component onClick={mockHandler} />)

// 定时器 Mock
vi.useFakeTimers()
// ... 测试代码
vi.useRealTimers()
```

## CI/CD 集成

### GitHub Actions 配置
```yaml
# .github/workflows/frontend-tests.yml
name: Frontend Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    
    - name: Install dependencies
      run: npm ci
      working-directory: frontend
    
    - name: Run tests
      run: npm run test:run
      working-directory: frontend
    
    - name: Run coverage
      run: npm run test:coverage
      working-directory: frontend
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        directory: frontend/coverage
```

## 常见问题解决

### 1. 模块解析错误
```typescript
// 在 vitest.config.ts 中添加别名
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // ... 其他配置
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 2. CSS 模块问题
```typescript
// 安装 css 预处理器
npm install -D @vanilla-extract/vite-plugin

// 更新 vitest.config.ts
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'

export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  // ... 其他配置
})
```

### 3. 环境变量问题
```typescript
// 创建测试环境变量文件
// .env.test
VITE_API_URL=http://localhost:3000

// 在测试中访问环境变量
import { describe, it, expect, vi } from 'vitest'

describe('Component with env vars', () => {
  it('should use env var', () => {
    // Mock 环境变量
    vi.stubEnv('VITE_API_URL', 'http://test.api')
    
    // 测试代码
    expect(import.meta.env.VITE_API_URL).toBe('http://test.api')
  })
})
```

## 测试覆盖率目标

### 初始目标
- 组件测试覆盖率：> 60%
- 工具函数覆盖率：> 80%
- 关键业务逻辑覆盖率：> 90%

### 覆盖率报告
```bash
# 生成覆盖率报告
npm run test:coverage

# 查看 HTML 报告
open coverage/index.html
```

## 下一步计划

### 第一阶段（本周）
1. [ ] 完成测试基础设施配置
2. [ ] 编写 Button、Input 等基础组件测试
3. [ ] 建立 CI 测试流水线

### 第二阶段（下周）
1. [ ] 编写关键页面测试（Home、Login）
2. [ ] 增加 Hook 和工具函数测试
3. [ ] 达到 60% 总体覆盖率

### 第三阶段（下下周）
1. [ ] 编写复杂组件测试
2. [ ] 增加集成测试
3. [ ] 达到 80% 总体覆盖率

## 资源链接

- [Vitest 官方文档](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Jest DOM](https://github.com/testing-library/jest-dom)
- [Vite 测试指南](https://vitejs.dev/guide/features.html#testing)