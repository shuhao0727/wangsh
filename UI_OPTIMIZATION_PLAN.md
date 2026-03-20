# WangSh UI 全面优化方案

> 保存时间：2026-03-17
> 状态：已批准，待实施

---

## 设计方向

- 风格：现代简约，提升质感（更精致的阴影、渐变、毛玻璃、微动画）
- 主题色：`#6366F1`（Indigo 500）— 优雅紫蓝色
- 辅助色：`#8B5CF6`（Violet 500）— 渐变点缀
- 成功色：`#10B981`（Emerald 500）
- 警告色：`#F59E0B`（Amber 500）
- 错误色：`#EF4444`（Red 500）
- 背景层次：`#FFFFFF` → `#F8FAFC` → `#F1F5F9`
- 卡片：毛玻璃效果 + 微妙边框 + 精致阴影
- 头部：backdrop-blur 毛玻璃 + 底部渐变线

---

## 阶段 1：全局主题与变量系统

### 1.1 antdTheme.ts
- colorPrimary: `#6366F1`
- colorSuccess: `#10B981`
- colorWarning: `#F59E0B`
- colorError: `#EF4444`
- Card 圆角 12px、Button 圆角 8px、Input 圆角 8px
- 更精致的组件阴影

### 1.2 index.css
- 更新所有 `--ws-color-*` 变量
- 新增渐变：`--ws-gradient-primary: linear-gradient(135deg, #6366F1, #8B5CF6)`
- 优化阴影系统（带色彩倾向）
- 新增毛玻璃变量
- 新增动画变量

### 1.3 ui-polish.css
- 移除 `box-shadow: none !important` 全局覆盖
- 改为有层次的阴影

### 1.4 responsive-audit.css
- 统一断点
- 新增工具栏响应式类

---

## 阶段 2：布局组件

### 2.1 BasicLayout
- 头部毛玻璃 + 底部渐变线
- 导航项精致 hover/active
- 移动端 Drawer 优化

### 2.2 AdminLayout
- 侧边栏渐变背景 + 毛玻璃
- 菜单 pill 形 active 指示器
- 头部 backdrop-blur
- 消除硬编码颜色

### 2.3 公共组件
- PanelCard 毛玻璃变体
- SplitPanePage 优化
- 新建 AdminToolbar 统一组件

---

## 阶段 3：公开页面

### 3.1 首页
- Hero 渐变背景 + 图案
- 模块卡片统一 hover
- stagger 入场动画

### 3.2 登录页
- 居中毛玻璃卡片
- 渐变背景
- 渐变主色按钮

### 3.3 AI 智能体
- 聊天气泡精致化
- 侧边栏卡片优化

### 3.4 文章系统
- 列表卡片优化
- 详情阅读体验提升

### 3.5 信息学阅读器
- 文档树样式优化
- PDF 区域优化

---

## 阶段 4：管理后台

### 4.1 Dashboard
- 统计卡片渐变背景
- 健康状态视觉指示

### 4.2 表格页面统一
- AdminToolbar 组件
- 统一表格高度/分页/空状态

### 4.3 XBK
- 筛选面板优化
- 表格体验统一

---

## 阶段 5：微交互与动画

- 页面入场 fade-in-up
- 卡片 hover 提升 + 阴影
- 按钮 press scale
- 骨架屏 shimmer
- 侧边栏/Modal/Drawer 过渡

---

## 阶段 6：Markdown 样式

- 代码块精致化
- 引用块渐变边框
- 表格斑马纹
- 图片圆角 + 阴影

---

## 关键文件清单

```
src/styles/antdTheme.ts
src/styles/index.css
src/styles/ui-polish.css
src/styles/responsive-audit.css
src/styles/markdown.css
src/layouts/BasicLayout.tsx + .css
src/layouts/AdminLayout.tsx + .css
src/pages/Home/index.tsx + Home.css
src/pages/Auth/Login.tsx
src/components/Auth/LoginForm.tsx
src/pages/AIAgents/index.tsx + AIAgents.css
src/pages/Articles/index.tsx + Detail.tsx + Detail.css
src/pages/Informatics/Reader.tsx + Informatics.css
src/pages/Admin/Dashboard/index.tsx + index.css
src/pages/Admin/Users/index.tsx + index.css
src/pages/Admin/AIAgents/index.tsx
src/pages/Admin/Articles/index.tsx
src/pages/Xbk/index.tsx + Xbk.css
src/components/Layout/PanelCard.tsx
src/components/Layout/SplitPanePage.tsx
src/components/Admin/AdminPage.tsx
src/components/Admin/AdminCard.tsx
```
