# WangSh项目无障碍访问改进指南

> 最后更新：2026-04-11

## 概述

本文档提供无障碍访问（Accessibility，简称a11y）改进的具体实施方案，帮助项目达到WCAG 2.1 AA标准。

## 当前状态评估

### 优势
1. 语义化HTML结构基本良好
2. 色彩对比度符合标准
3. 响应式设计支持多种设备

### 待改进点
1. ARIA属性使用不足
2. 键盘导航支持不完整
3. 屏幕阅读器兼容性需要测试
4. 焦点管理需要优化

## 改进目标

### 量化目标
1. Lighthouse无障碍评分 > 90
2. WAVE工具错误数为0
3. 键盘导航完整覆盖
4. 屏幕阅读器测试通过

### 质化目标
1. 所有交互元素都有明确的标签
2. 表单有清晰的错误提示
3. 导航结构清晰
4. 内容层次分明

## 具体改进方案

### 1. ARIA属性改进

#### 1.1 按钮和链接
**问题：** 图标按钮缺少文本标签
**解决方案：**
```tsx
// 之前
<button onClick={handleClick}>
  <SearchIcon />
</button>

// 之后
<button 
  onClick={handleClick}
  aria-label="搜索"
>
  <SearchIcon aria-hidden="true" />
</button>
```

**需要修改的文件：**
- `frontend/src/pages/Home/index.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/Header.tsx`

#### 1.2 表单元素
**问题：** 表单字段缺少关联标签和错误提示
**解决方案：**
```tsx
// 之前
<input 
  type="text" 
  value={value}
  onChange={handleChange}
/>

// 之后
<div>
  <label htmlFor="username" id="username-label">
    用户名
  </label>
  <input
    id="username"
    type="text"
    value={value}
    onChange={handleChange}
    aria-labelledby="username-label"
    aria-describedby={error ? "username-error" : undefined}
    aria-invalid={!!error}
  />
  {error && (
    <div id="username-error" role="alert">
      {error}
    </div>
  )}
</div>
```

**需要修改的文件：**
- `frontend/src/pages/Login/index.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/form.tsx`

#### 1.3 模态框
**问题：** 模态框缺少标签和描述
**解决方案：**
```tsx
// 之前
<div className="modal">
  <h2>确认删除</h2>
  {/* 内容 */}
</div>

// 之后
<div
  className="modal"
  role="dialog"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">确认删除</h2>
  <p id="modal-description">
    确定要删除这个项目吗？此操作不可撤销。
  </p>
  {/* 内容 */}
</div>
```

### 2. 键盘导航改进

#### 2.1 焦点管理
**问题：** 焦点顺序不合理，缺少焦点样式
**解决方案：**

1. **添加焦点样式：**
```css
/* 在 index.css 中添加 */
:focus-visible {
  outline: 2px solid var(--ws-color-primary);
  outline-offset: 2px;
}

/* 自定义组件焦点样式 */
.button:focus-visible {
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.3);
}
```

2. **管理焦点顺序：**
```tsx
// 使用 tabindex 管理焦点
<div tabIndex={0} role="region" aria-label="主要内容">
  {/* 内容 */}
</div>

// 跳过导航链接
<a href="#main-content" className="skip-link">
  跳转到主要内容
</a>
```

#### 2.2 键盘事件处理
**问题：** 自定义组件不支持键盘操作
**解决方案：**
```tsx
// 自定义下拉菜单示例
const Dropdown = ({ items, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0) {
          onSelect(items[focusedIndex]);
          setIsOpen(false);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div 
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      onKeyDown={handleKeyDown}
    >
      {/* 下拉菜单实现 */}
    </div>
  );
};
```

### 3. 屏幕阅读器优化

#### 3.1 实时内容更新
**问题：** 动态内容更新时屏幕阅读器不提示
**解决方案：**
```tsx
// 使用 aria-live 区域
<div 
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {message && <p>{message}</p>}
</div>

// 重要通知使用 assertive
<div 
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
>
  {error && <p className="error">{error}</p>}
</div>
```

#### 3.2 图片和图标
**问题：** 装饰性图片干扰屏幕阅读器
**解决方案：**
```tsx
// 装饰性图标
<SearchIcon aria-hidden="true" />

// 有意义的图标
<div>
  <SearchIcon aria-hidden="true" />
  <span className="sr-only">搜索</span>
</div>

// 图片
<img
  src="/logo.png"
  alt="WangSh 平台 logo"
  width="120"
  height="40"
/>
```

**添加屏幕阅读器专用样式：**
```css
/* 在 index.css 中添加 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### 4. 色彩和对比度

#### 4.1 色彩对比度检查
**需要检查的元素：**
1. 文字与背景对比度
2. 交互状态对比度
3. 错误状态对比度

**工具：**
- Chrome DevTools 色彩对比度检查器
- WebAIM 色彩对比度检查器
- axe DevTools 扩展

#### 4.2 改进方案
```css
/* 确保足够的对比度 */
.text-primary {
  color: var(--ws-color-text);
  /* 确保与背景对比度 > 4.5:1 */
}

.button {
  background-color: var(--ws-color-primary);
  color: white;
  /* 对比度 > 4.5:1 */
}

.button:disabled {
  background-color: var(--ws-color-text-tertiary);
  color: var(--ws-color-text-secondary);
  /* 对比度 > 4.5:1 */
}
```

### 5. 测试方案

#### 5.1 自动化测试
**工具配置：**
```json
// package.json
{
  "scripts": {
    "test:a11y": "jest --config jest-a11y.config.js",
    "lint:a11y": "eslint --rule 'jsx-a11y/*: error' src/"
  },
  "devDependencies": {
    "eslint-plugin-jsx-a11y": "^6.8.0",
    "jest-axe": "^7.0.0",
    "@testing-library/jest-dom": "^6.4.2"
  }
}
```

**测试用例示例：**
```typescript
// a11y.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import HomePage from './HomePage';

test('HomePage should have no accessibility violations', async () => {
  const { container } = render(<HomePage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('buttons should have accessible labels', () => {
  render(<HomePage />);
  const buttons = screen.getAllByRole('button');
  buttons.forEach(button => {
    expect(button).toHaveAccessibleName();
  });
});
```

#### 5.2 手动测试
**测试清单：**
1. **键盘导航测试**
   - [ ] Tab 键可以访问所有交互元素
   - [ ] Enter/Space 键可以激活按钮
   - [ ] 箭头键可以操作下拉菜单
   - [ ] Escape 键可以关闭模态框

2. **屏幕阅读器测试**
   - [ ] NVDA (Windows) 测试通过
   - [ ] VoiceOver (macOS) 测试通过
   - [ ] 朗读顺序正确
   - [ ] 表单标签清晰

3. **色彩对比度测试**
   - [ ] 文字对比度 > 4.5:1
   - [ ] 大文字对比度 > 3:1
   - [ ] 交互状态对比度足够

#### 5.3 工具测试
**使用工具：**
1. **Lighthouse** - 综合无障碍评分
2. **WAVE** - 详细错误报告
3. **axe DevTools** - 实时检查
4. **Color Contrast Analyzer** - 色彩对比度

### 6. 实施计划

#### 第一阶段：基础改进（1周）
1. **ARIA属性添加**
   - 为所有按钮添加 `aria-label`
   - 为表单添加关联标签
   - 为图标添加 `aria-hidden`

2. **焦点管理**
   - 添加焦点样式
   - 管理焦点顺序
   - 添加跳过导航链接

#### 第二阶段：组件优化（1周）
1. **自定义组件无障碍**
   - 下拉菜单键盘支持
   - 模态框焦点管理
   - 标签页键盘导航

2. **屏幕阅读器优化**
   - 实时内容更新提示
   - 图片alt文本优化
   - 语义化HTML结构

#### 第三阶段：测试验证（1周）
1. **自动化测试**
   - 配置无障碍测试
   - 编写测试用例
   - 集成到CI/CD

2. **手动测试**
   - 键盘导航测试
   - 屏幕阅读器测试
   - 工具扫描测试

### 7. 维护指南

#### 7.1 开发规范
1. **代码审查清单**
   - [ ] 所有交互元素都有可访问标签
   - [ ] 表单字段有关联标签
   - [ ] 图片有alt文本
   - [ ] 自定义组件支持键盘操作
   - [ ] 色彩对比度符合标准

2. **组件开发指南**
```typescript
// 无障碍友好的组件模板
interface AccessibleComponentProps {
  /** 可访问标签 */
  ariaLabel?: string;
  /** 关联标签ID */
  ariaLabelledBy?: string;
  /** 关联描述ID */
  ariaDescribedBy?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 键盘事件处理 */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const AccessibleComponent: React.FC<AccessibleComponentProps> = ({
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  disabled,
  onKeyDown,
  children,
}) => {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
};
```

#### 7.2 监控和反馈
1. **用户反馈收集**
   - 无障碍问题反馈渠道
   - 定期用户测试
   - 屏幕阅读器用户访谈

2. **持续监控**
   - Lighthouse评分监控
   - 错误率监控
   - 用户行为分析

### 8. 资源链接

#### 8.1 文档和标准
- [WCAG 2.1 标准](https://www.w3.org/TR/WCAG21/)
- [ARIA 实践指南](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM 检查清单](https://webaim.org/standards/wcag/checklist)

#### 8.2 测试工具
- [WAVE 无障碍工具](https://wave.webaim.org/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Color Contrast Analyzer](https://developer.paciellogroup.com/resources/contrastanalyser/)

#### 8.3 开发工具
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- [jest-axe](https://github.com/nickcolley/jest-axe)
- [React A11y](https://github.com/reactjs/react-a11y)

---

**文档维护：**
- 更新时间：2026-04-10
- 负责人：前端开发团队
- 评审周期：每月一次

**变更记录：**
- 2026-04-10: 创建初始版本