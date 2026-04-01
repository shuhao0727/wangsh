# 课堂互动系统文档

> 最后更新：2026-03-26

## 概述

课堂互动系统支持教师在课堂上发起实时互动活动，学生通过 Web 界面参与响应。系统包含课堂活动和课堂计划两大功能模块。

### 核心功能

- **课堂活动**：实时互动、学生响应、统计分析
- **课堂计划**：课堂流程管理、拖拽排序、进度控制
- **SSE 推送**：实时推送活动状态变化
- **4步 Steps Modal**：创建活动的引导式流程

---

## 架构设计

### 数据模型

**核心表**：
- `znt_classroom_activities` - 课堂活动
- `znt_classroom_responses` - 学生响应
- `znt_classroom_plans` - 课堂计划
- `znt_classroom_plan_items` - 课堂计划项

**课堂活动字段**：
- `title` - 活动标题
- `description` - 活动描述
- `activity_type` - 活动类型（question、poll、discussion 等）
- `status` - 状态（draft、active、ended）
- `class_name` - 班级名称
- `created_by` - 创建者
- `started_at` - 开始时间
- `ended_at` - 结束时间

**课堂计划字段**：
- `title` - 计划标题
- `class_name` - 班级名称
- `status` - 状态（draft、active、completed）
- `current_item_index` - 当前进行到第几项
- `items` - 计划项列表（JSON）

---

## 课堂活动

### 活动类型

- **question** - 问答题
- **poll** - 投票
- **discussion** - 讨论
- **quiz** - 测验
- **fill_blank** - 填空题（支持 AI 分析）

### 填空题 AI 分析（2026-03-26 新增）

**功能**：活动结束后，AI 自动分析学生答题情况

**提示词配置**：
- **默认提示词**：200字简洁分析（总体结论 + 易错分析 + 教学建议）
- **自定义提示词**：前端填写则完全替换默认提示词，可自由控制格式和长度

**分析报告格式**：
1. 总体结论（1-2句话）
2. 易错分析（逐空位列出）
3. 教学建议（3条）
4. JSON 代码块（risk_slots、common_mistakes、teaching_actions）

**配置位置**：创建/编辑活动时，"AI 分析提示词"字段

### 活动生命周期

1. **创建（draft）**：教师创建活动，设置标题、描述、选项
2. **开始（active）**：教师启动活动，学生可以响应
3. **结束（ended）**：教师结束活动，查看统计结果

### 4步 Steps Modal

创建活动的引导式流程：

**Step 1 - 基本信息**：
- 活动标题
- 活动描述
- 班级选择

**Step 2 - 活动类型**：
- 选择活动类型（question、poll、discussion、quiz）

**Step 3 - 选项配置**：
- 添加选项（针对 poll、quiz 类型）
- 设置正确答案（针对 quiz 类型）

**Step 4 - 确认发布**：
- 预览活动信息
- 确认并创建

### SSE 实时推送

**管理端**：`GET /classroom/admin/stream`
- 推送活动状态变化
- 推送学生响应统计

**学生端**：`GET /classroom/stream`
- 推送当前活动
- 推送活动结束通知

---

## 课堂计划

### 功能特性

- **拖拽排序**：使用 @dnd-kit 实现计划项拖拽排序
- **进度控制**：教师可控制当前进行到哪一项
- **自动推进**：可设置自动推进到下一项
- **实时同步**：学生端实时显示当前计划项

### 计划项结构

```json
{
  "id": "item-1",
  "title": "课前签到",
  "description": "学生签到",
  "duration": 5,
  "type": "activity",
  "activity_id": 123,
  "order": 0
}
```

### 拖拽实现

使用 `@dnd-kit` 库：
- `DndContext` - 拖拽上下文
- `SortableContext` - 排序上下文
- `useSortable` - 可排序项 Hook

**关键代码**：
```typescript
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor)
);

function handleDragEnd(event) {
  const {active, over} = event;
  if (active.id !== over.id) {
    // 更新排序
  }
}
```

---

## API 端点

详见 [API.md](../development/API.md) 第十四章节：课堂互动（/classroom）

### 管理端核心端点

- `POST /classroom/admin/` - 创建活动
- `POST /classroom/admin/{activity_id}/start` - 开始活动
- `POST /classroom/admin/{activity_id}/end` - 结束活动
- `GET /classroom/admin/{activity_id}/statistics` - 活动统计
- `GET /classroom/admin/stream` - SSE 活动流

### 学生端核心端点

- `GET /classroom/active` - 当前活动
- `POST /classroom/{activity_id}/respond` - 提交响应
- `GET /classroom/stream` - SSE 活动流

### 课堂计划端点

- `POST /classroom/plans/admin` - 创建计划
- `POST /classroom/plans/admin/{plan_id}/start` - 启动计划
- `POST /classroom/plans/admin/{plan_id}/next` - 下一项
- `GET /classroom/plans/active-plan` - 当前生效计划

---

## 前端实现

### 核心组件

**位置**：`/Users/wsh/wangsh/frontend/src/pages/Admin/Classroom/`

**主要文件**：
- `ClassroomActivities.tsx` - 活动管理
- `CreateActivityModal.tsx` - 4步创建流程
- `ClassroomPlans.tsx` - 计划管理
- `PlanEditor.tsx` - 计划编辑器（拖拽排序）

### UI 优化

- 标题栏使用主色 `bg-primary`
- 卡片背景 `bg-surface-2`
- hover 效果统一
- 全 Tailwind CSS 实现

---

## 使用场景

### 场景 1：课堂问答

1. 教师创建问答活动，设置问题
2. 教师启动活动
3. 学生看到问题，提交答案
4. 教师查看统计，结束活动

### 场景 2：课堂投票

1. 教师创建投票活动，设置选项
2. 教师启动活动
3. 学生选择选项，提交投票
4. 教师查看实时统计

### 场景 3：课堂计划

1. 教师创建课堂计划，添加多个计划项
2. 教师拖拽调整顺序
3. 教师启动计划
4. 教师逐项推进，学生端同步显示

---

## 故障排查

### SSE 连接失败

1. 检查后端 `/classroom/stream` 端点是否正常
2. 检查 Cookie 或 query token 是否有效
3. 查看浏览器控制台错误信息

### 拖拽不工作

1. 检查 `@dnd-kit` 依赖是否安装
2. 检查 `DndContext` 是否正确配置
3. 检查 `sensors` 是否正确初始化

### 学生看不到活动

1. 检查活动状态是否为 `active`
2. 检查学生班级是否匹配
3. 检查 SSE 推送是否正常

---

## 相关文件

### 后端

- `/Users/wsh/wangsh/backend/app/api/endpoints/classroom/admin.py` - 管理端 API
- `/Users/wsh/wangsh/backend/app/api/endpoints/classroom/student.py` - 学生端 API
- `/Users/wsh/wangsh/backend/app/api/endpoints/classroom/plan.py` - 计划 API
- `/Users/wsh/wangsh/backend/app/models/classroom/` - 数据模型

### 前端

- `/Users/wsh/wangsh/frontend/src/pages/Admin/Classroom/` - 管理端页面
- `/Users/wsh/wangsh/frontend/src/pages/Classroom/` - 学生端页面

---

## 最佳实践

1. **活动命名**：使用清晰的标题，便于学生理解
2. **班级匹配**：确保活动班级与学生班级一致
3. **及时结束**：活动结束后及时关闭，避免学生误操作
4. **计划预演**：正式上课前预演计划流程
5. **SSE 鉴权**：支持 query token 与 Cookie 双通道
