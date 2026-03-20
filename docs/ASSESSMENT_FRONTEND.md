# 前端设计

> 隶属于 [ASSESSMENT_DESIGN.md](./ASSESSMENT_DESIGN.md)

---

## 1. 学生端 — 自主检测浮动窗口

### 1.1 基本信息

- **组件路径：** `frontend/src/pages/AIAgents/AssessmentPanel.tsx`
- **入口位置：** 与小组讨论并列，在 AI 智能体页面左侧，独立浮动按钮
- **技术方案：** 复用 GroupDiscussionPanel 的浮动窗口模式（ReactDOM.createPortal + 拖拽 + 固定）
- **localStorage 键：** `assessment_floating_pos`、`assessment_floating_size`、`assessment_floating_pinned`

### 1.2 视图流程（4 个视图）

```
列表视图              答题视图              结果视图              画像视图
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 可用检测列表  │    │ 第 3/10 题    │    │ 总分: 85/100  │    │ 本次检测画像  │
│              │    │              │    │              │    │              │
│ ▸ Python检测  │ →  │ 以下哪个是    │ →  │ 知识点掌握:   │    │ ## 知识掌握   │
│   100分 30min│    │ Python循环？  │    │ ■■■■□ 循环    │    │ 循环基础扎实  │
│              │    │ ○ A. for     │    │ ■■■□□ 函数    │    │ ...          │
│ ▸ 算法基础   │    │ ● B. while   │    │              │    │ ## 学习建议   │
│   100分 不限时│    │ ○ C. if      │    │ [本次画像]     │    │ 1. 加强...   │
│              │    │ ○ D. def     │    │ [三维画像]     │    │              │
│ ▸ 已完成(85分)│    │              │    │              │    │ [返回结果]    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### 1.3 列表视图

- 调用 `GET /api/v1/assessment/available` 获取可用测评
- 每项显示：标题、总分、时限、状态（未开始/进行中/已完成+得分）
- 已完成的测评显示得分，点击可查看结果
- 进行中的测评显示"继续答题"按钮

### 1.4 答题视图

- 顶部：进度条（第 N/M 题）+ 倒计时（如有时限）
- 中间：题目内容（Markdown 渲染）
- 底部：答题区域（根据题型不同）

**答题交互：**
- 选择题：Radio 选项，选中后即时判分
  - 正确：选项变绿 + 显示 ✓
  - 错误：选项变红 + 正确答案变绿 + 显示解析
- 填空题：Input 输入框 + "提交"按钮，AI 评分后显示反馈
- 简答题：TextArea 输入框，输入后自动保存，提交整卷时统一评分

**导航：** 上一题/下一题按钮 + 题号导航条（已答/未答/当前 三种状态色）

**提交：** 所有题目答完后显示"提交检测"按钮，确认弹窗后提交

### 1.5 结果视图

- 顶部：总分（大字）+ 得分率环形图
- 中间：各知识点得分条形图
- 底部：两个按钮
  - **「查看本次画像」** → 切换到画像视图，显示初级画像
  - **「查看三维画像」** → 切换到画像视图，显示高级画像（如果教师已生成）
- 可展开查看每道题的详情（题目、我的答案、正确答案、AI 评语）

### 1.6 画像视图

- 顶部：Tab 切换「本次画像」/「三维画像」
- 内容：Markdown 渲染画像内容
- 底部：「返回结果」按钮

**本次画像（初级）：**
- 数据来源：`GET /api/v1/assessment/sessions/{sid}/basic-profile`
- 内容：总分、各知识点得分可视化、错题知识点、AI 简短评语

**三维画像（高级）：**
- 数据来源：`GET /api/v1/assessment/my-profiles`（筛选与当前测评相关的）
- 内容：完整的 Markdown 分析报告
- 如果教师尚未生成，显示提示："三维画像尚未生成，请等待教师分析。"

---

## 2. 管理端 — 测评管理

### 2.1 路由结构

```
/admin/assessment                       测评配置列表
/admin/assessment/editor/new            新建测评
/admin/assessment/editor/{id}           编辑测评
/admin/assessment/{id}/questions        题库管理
/admin/assessment/{id}/statistics       答题统计
/admin/assessment/profiles              画像中心
```

### 2.2 侧边栏菜单

在 AdminLayout.tsx 的 `adminMenuItems` 中新增：

```typescript
{
  key: "/admin/assessment",
  icon: <FormOutlined />,
  label: "自主检测",
  children: [
    {
      key: "/admin/assessment",
      icon: <FileTextOutlined />,
      label: "测评管理",
    },
    {
      key: "/admin/assessment/profiles",
      icon: <UserOutlined />,
      label: "画像中心",
    },
  ],
}
```

### 2.3 测评配置列表页 `/admin/assessment`

**组件：** `frontend/src/pages/Admin/Assessment/index.tsx`

**布局：** AdminPage + AdminTablePanel 模式

**功能：**
- 表格列：标题、学科、年级、总分、题目数、答题人数、状态开关、操作
- 操作按钮：编辑、题库、统计、删除
- 顶部：搜索框 + "新建测评"按钮
- 状态开关：Switch 组件，调用 toggle API

### 2.4 测评编辑页 `/admin/assessment/editor/{id}`

**组件：** `frontend/src/pages/Admin/Assessment/EditorPage.tsx`

**布局：** AdminPage，表单布局

**表单字段：**
- 基本信息区：标题（Input）、学科（Input）、年级（Select）、时限（InputNumber，0=不限时）、总分（InputNumber）
- 教学目标区：TextArea（支持 Markdown）
- 知识点区：Tag 标签式输入（可添加/删除，回车添加）
- 题型配置区：三行，每行 = 题型名 + 数量（InputNumber）+ 每题分值（InputNumber）
  - 选择题：数量 × 分值
  - 填空题：数量 × 分值
  - 简答题：数量 × 分值
  - 底部显示：总分自动计算 = Σ(数量 × 分值)，与总分字段对比校验
- 出题 Prompt 区：TextArea（教师自定义提示词）
- 关联智能体区：
  - 出题/评分智能体：Select 单选（agent_id）
  - 课堂智能体：Select 多选（用于跨系统分析时拉取学生 AI 对话数据）

### 2.5 题库管理页 `/admin/assessment/{id}/questions`

**组件：** `frontend/src/pages/Admin/Assessment/QuestionsPage.tsx`

**布局：** AdminPage + AdminTablePanel

**功能：**
- 顶部：筛选（题型 Select + 难度 Select）+ "AI 生成题目"按钮 + "手动添加"按钮
- AI 生成：点击后调用 API，显示 loading，生成完成后刷新列表
- 表格列：序号、题型 Tag、题目内容（截断）、难度 Tag、分值、知识点、来源、操作
- 操作：编辑（弹窗）、删除（确认）、预览（弹窗，完整渲染题目）
- 手动添加：弹窗表单（题型、内容、选项、答案、分值、难度、知识点、解析）

### 2.6 答题统计页 `/admin/assessment/{id}/statistics`

**组件：** `frontend/src/pages/Admin/Assessment/StatisticsPage.tsx`

**布局：** AdminPage

**内容：**
- 顶部统计卡片：参与人数、平均分、最高分、最低分、通过率（≥60分）
- 知识点掌握率：横向条形图（每个知识点的平均得分率）
- 学生列表：表格（姓名、得分、用时、状态、操作→查看详情/查看初级画像）
- 点击学生姓名：弹窗显示该学生的逐题答题详情

### 2.7 画像中心页 `/admin/assessment/profiles`

**组件：** `frontend/src/pages/Admin/Assessment/ProfilesPage.tsx`

**布局：** AdminPage，左右分栏

**左侧 — 生成画像：**
- 画像类型：Radio（个人/小组/群体）
- 根据类型动态显示：
  - 个人：选择学生（Select 搜索）
  - 小组：选择小组讨论会话（Select）
  - 群体：输入班级名称（Input）
- 数据源选择：
  - 测评配置：Select（可选，拉取测评数据）
  - 小组讨论会话：Select（可选，拉取讨论数据）
  - 课堂智能体：Select 多选（可选，拉取 AI 对话数据）
- 生成用智能体：Select 单选
- "生成画像"按钮 / "批量生成"按钮（个人画像时可选多个学生）

**右侧 — 画像列表与详情：**
- 画像列表：按时间倒序，显示类型 Tag + 目标名称 + 数据源 Tags + 时间
- 点击画像：右侧展示 Markdown 渲染的画像内容 + 结构化评分雷达图
- 操作：删除

---

## 3. 浮动按钮排列

AI 智能体页面左侧的浮动按钮排列（从上到下）：

```
┌─────┐
│ 💬  │  ← 小组讨论（已有）
│ 讨论 │
└─────┘
   ↕ 间距 12px
┌─────┐
│ 📝  │  ← 自主检测（新增）
│ 检测 │
└─────┘
```

两个浮动窗口独立管理各自的位置和大小，互不干扰。同时只能打开一个窗口（打开检测时自动收起讨论，反之亦然），避免屏幕拥挤。
