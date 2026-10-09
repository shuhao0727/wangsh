# WangSh 间距规范

间距有两套来源，职责不同，不要混用：

| 体系 | 定义位置 | 单位 | 是否随视口缩放 |
|------|---------|------|--------------|
| 语义间距 token（Tailwind） | `frontend/tailwind.config.js` → `theme.extend.spacing` | 固定 px | 否 |
| 尺寸间距变量（CSS） | `frontend/src/styles/index.css` → `:root` | `clamp()` | 是 |

## 一、语义间距 token（Tailwind，固定 px）

基于 8px 基准，映射为 `p-* / px-* / py-* / gap-* / m*-* / space-*-*` 等 class。

| Class 片段 | 数值 | 使用场景 |
|-----------|------|---------|
| `section-gap` | `32px` | 页面级大区块之间（区块 → 区块） |
| `panel-padding` | `var(--ws-panel-padding)` → `--ws-space-3`（流体 12→20px） | 面板/卡片容器内边距（`AdminTablePanel`、大块内容区） |
| `panel-padding-sm` | `var(--ws-panel-padding-sm)` → `--ws-space-2`（流体 8→14px） | 紧凑面板：表格工具条、内嵌卡片 |
| `panel-padding-lg` | `var(--ws-panel-padding-lg)` → `--ws-space-4`（流体 14→26px） | 宽松面板：详情页主容器 |
| `card-padding` | `24px` | 单个卡片内边距，与 panel-padding **不再同值**（见 §1.1） |
| `form-field-gap` | `24px` | 表单字段之间的纵向间距 |
| `item-gap` | `16px` | 列表/表格行、卡片网格中相邻项之间的间距 |
| `content-gap` | `16px` | 内容区内标题与正文、图文之间的常规间距 |
| `button-gap` | `12px` | 按钮组、工具条内按钮之间的间距 |
| `2xs` | `0.25rem`（**== Tailwind 的 `1`**，非 4px） | 微间距（图标↔文字、紧凑元素） |
| `xs` | `0.5rem`（**== Tailwind 的 `2`**，非 8px） | 紧凑间距（标签组、密集列表项） |

> 🔴 **单位陷阱（2026-10-04 B5 实测，务必阅读）**：本项目 `html` 根字号是**流体**的
> （`--ws-font-size-base: clamp(14px, 0.12vw + 13px, 15px)`），所以 **`1rem = 14.23px(1024) ~ 15px(1920+)，不是 16px`**。
> 而 Tailwind 数字间距类是 rem 制（`p-4 = 1rem`）。因此：
>
> | 类 | 真实值 @1440 | 标称 | 语义 token | 差值 |
> |---|---|---|---|---|
> | `p-1` | 3.68px | 4px | `p-2xs`(0.25rem) | 0 ✓ |
> | `p-2` | 7.36px | 8px | `p-xs`(0.5rem) | 0 ✓ |
> | `p-3` | 11.05px | 12px | `p-button-gap`(12px) | **+0.95px** |
> | `p-4` | 14.73px | 16px | `p-item-gap`(16px) | **+1.27px** |
> | `p-6` | 22.09px | 24px | `p-card-padding`(24px) | **+1.91px** |
> | `p-8` | 29.46px | 32px | `p-section-gap`(32px) | **+2.54px** |
>
> **只有 `2xs`/`xs`（rem 制）与数字类逐位相等**；其余语义 token 是固定 px，与同档数字类**永远不等**
> （在 1024 下差 12.5%、1920+ 下差 6.7%）。所以：
>
> - 迁移 `p-1`/`p-2` 到 `p-2xs`/`p-xs`：**零视觉变化**（B5-C 正在做的事）。
> - 迁移 `p-3/4/6/8` 到 `button-gap/item-gap/card-padding/section-gap`：**会真实改变间距**，
>   需先与设计确认是否接受 6.7%~12.5% 的增大，并做 L4 四视口复核。
> - 不要给 `2xs`/`xs` 写成固定 `4px`/`8px`——那是 +8.7%（1440）的真实改动（已实测）。

> ⚠️ 面板族（`panel-padding` / `-sm` / `-lg`）**只有 3 个 token，但它们不是固定 px**——
> 它们直接引用 §二的 CSS 变量，因此是**流体**的（见 §1.1）。这是本文件唯一一处
> "语义 token = CSS 变量"的映射，其余 5 个 token 仍是固定 px。

用法示例：

```tsx
<div className="p-panel-padding gap-item-gap">      {/* 面板内边距 + 列表项间距 */}
<form className="flex flex-col gap-form-field-gap"> {/* 表单字段纵向间距 */}
<div className="mb-section-gap">                    {/* 大区块分隔 */}
```

### 1.1 面板间距统一（2026-10-04，计划 B3；对应计划 §2.3 裁决）

历史上"面板内边距"有**两个源且数值永远不等**（下列为计划 §2.3 的实测）：

| 源 | 定义 | 1024px | 1366px | 1920px | 2560px |
|---|---|---|---|---|---|
| Tailwind `p-panel-padding`（旧） | 硬编码 `24px` | 24px | 24px | 24px | 24px |
| CSS `var(--ws-panel-padding)` | `var(--ws-space-3)` = `clamp(12px, 0.38vw + 9.6px, 20px)` | 13.49px | 14.79px | 16.90px | 19.33px |
| **差值** | | **+10.51px** | **+9.21px** | **+7.10px** | **+4.67px** |

同页并存（`AdminPage.tsx` 用 Tailwind 类，`BasicLayout.css` 用 CSS 变量），最大差 10.5px，视觉上明显。

**裁决：统一到 CSS 变量侧（流体 clamp），删除 Tailwind 的固定 24px。** 理由：

1. 固定侧是**未提交的新增**（Tailwind `spacing` 整块在 HEAD 不存在），无历史包袱；
   `--ws-panel-padding` 在 HEAD 早已存在。
2. 流体侧**已与断点系统耦合**：`BasicLayout.css` 的 `.main-content` 用
   `--ws-panel-padding-lg`；`responsive-audit.css` 在 768px 档切 `-sm`。钉死 24px 等于废掉这套逻辑。
3. 固定 24px **在任何视口都与变量侧并存**（`--ws-space-3` 上限只有 20px），无法靠调视口回避。
4. 移动端更合理：430px 下 24px 占屏宽 5.6%，且与 768 档的 `-sm` 直接打架。

落地：`tailwind.config.js` 的 `panel-padding` / `panel-padding-sm` / `panel-padding-lg`
改为引用同名 CSS 变量（见 §一表格）。使用面 `p-panel-padding` 22 处、
`var(--ws-panel-padding)` 9 处，改后两侧同源，**任何视口恒等**。

**代价（已知并接受）**：22 处 `p-panel-padding` 的实际留白从固定 24px 变为 12~20px，
面板在大屏上会**更紧凑**。这是"用响应式换固定值"的有意取舍。

> 若确需大屏大留白，正确做法是调 `index.css` 里 `--ws-space-3` 的 clamp **上限**
> （改 1 处、全站一致），**不要**在 Tailwind 侧重新写死 px——那会重新制造本节的同屏不一致。

**本批未动**：`card-padding` / `item-gap` / `content-gap` / `button-gap` / `section-gap`
仍是固定 px。原因是它们**没有对应的 CSS 变量**，不属"同名不同值"冲突，
本轮不在范围内（改动它们会连带缩小 item-gap 等无关语义）。
因此 `panel-padding` 与 `card-padding` 至此**不再同值**，保留两个名字仍是为区分
「容器」与「卡片」两种语义。

## 二、尺寸间距变量（index.css，随视口缩放）

`--ws-space-1..5` 用 `clamp()` 定义，随视口宽度线性放大，用于需要跟随
整体密度（`--ws-density-scale`）变化的布局。它们**没有**映射到 Tailwind，
通过 `var()` 或任意值语法使用。

| 变量 | clamp 区间 |
|------|-----------|
| `--ws-space-1` | `4px → 10px` |
| `--ws-space-2` | `8px → 14px` |
| `--ws-space-3` | `12px → 20px` |
| `--ws-space-4` | `14px → 26px` |
| `--ws-space-5` | `18px → 34px` |

面板内边距是一组别名，供布局层直接引用：

| 变量 | 指向 | 说明 |
|------|------|------|
| `--ws-panel-padding` | `--ws-space-3` | 面板标准内边距 |
| `--ws-panel-padding-sm` | `--ws-space-2` | 紧凑面板（表格工具条、内嵌卡片） |
| `--ws-panel-padding-lg` | `--ws-space-4` | 宽松面板（详情页主容器） |
| `--ws-layout-gap` | `--ws-space-3` | 栅格/区块之间的统一间距 |

用法示例：

```tsx
<div className="p-[var(--ws-panel-padding)] gap-[var(--ws-layout-gap)]">
```

```css
.card { padding: var(--ws-space-2) var(--ws-space-3); }
```

两套体系的关系与选择原则：

- 语义 token 是**默认选择**：写布局、卡片、表单、列表时直接用 Tailwind class，
  可读性最好。**其中面板族（`panel-padding`/`-sm`/`-lg`）本身已是流体**，
  由 Tailwind 映射到 CSS 变量，两侧同源、不随写法跳变（见 §1.1）；
  其余语义 token 仍是固定 px。
- CSS 变量用于**必须跟随密度缩放**的场景：全局布局外壳、`.css` 文件内样式、
  第三方组件覆盖，以及需要把间距值同时喂给 JS/ECharts 的情况。
- 不要为同一个语义同时引入两套写法；新增间距优先走语义 token，只有确实需要
  响应式缩放时才用 `--ws-space-*`。
- **禁止给已有 CSS 变量的语义再开一个硬编码 Tailwind 值**（§1.1 的教训）：
  要么映射变量，要么只留一处定义。


## 三、迁移现状

旧的数字间距类（`p-6`、`gap-4`、`mb-4` 等）正在分批迁移到语义 token。

**口径（2026-10-04 复现，以复现值为准）**：

```bash
rg -o 'gap-(item-gap|content-gap|button-gap|section-gap)|p-(panel-padding|card-padding)' frontend/src | wc -l
```

| 项目 | 实测 | 旧值（已弃用） |
|------|------|----------------|
| 已使用语义 token 的 class 出现次数 | **82** | ~~121~~ / ~~129~~ |
| 仍在使用数字间距类的出现次数 | **2737** | ~~2655~~ / ~~2649~~ |
| → 迁移率 | **2.9%** | ~~4.3%~~ / ~~4.6%~~ |

> ⚠️ **三处口径曾互不相同**（本文 121/2655、执行计划 129/2649、复核 82/2737）。
> 2026-10-04 用**同一命令**复现三次，结果均为 **82 / 2737**，故以本表为准。
> 迁移率是**个位数百分比**——旧文档声称的"95%+"是数量级级别的失真。

### 3.1 per-class 分布（决定迁移顺序）

**口径**：2026-10-04 对 `frontend/src/**/*.{ts,tsx,css}` 实测，
命令 `rg -o --pcre2 "(?<![a-z0-9-])<class>(?![0-9])"`。
下表**以实测值为准**；括号内是被替代的旧报告数字，**已证不可信**（见下）。

| Gap 类 | 实测 | 旧报告 | Tailwind 值 |
|--------|------|--------|-------------|
| `gap-2` | **311** | 309 | 8px |
| `gap-1` | **182** | 173 | 4px |
| `gap-3` | **124** | 122 | 12px |
| `gap-6` | **9** | 8 | 24px |
| `gap-4` | **6** | ~~38~~ | 16px |

| Space 类 | 实测 | 旧报告 | Tailwind 值 |
|----------|------|--------|-------------|
| `space-y-1` | **59** | 55 | 4px |
| `space-y-3` | **30** | 35 | 12px |
| `space-y-2` | **28** | 27 | 8px |
| `space-y-4` | **1** | ~~26~~ | 16px |

> ⚠️ **旧报告数字不可信**：`gap-4`（旧 38 / 实测 6）与 `space-y-4`（旧 26 / 实测 1）
> 偏差达 6–26 倍，说明该报告的计数方法有系统性缺陷。**本表不采用旧报告的占比与结论**，
> 仅保留其"gap-1/2/3 是绝对主力"这一方向性判断（该判断经实测成立）。

**结论**：`gap-2`/`gap-1`/`gap-3` 三类合计 **617/632 ≈ 97.6%** 的 gap 类用法。
优先迁移这三类即可覆盖绝大部分收益，**不必按文件顺序平推**。

按 token 归并的等价候选：

| 旧类数值 | 对应语义 token | 出现次数 |
|---------|--------------|---------|
| `-4`（16px） | `item-gap` / `content-gap` | 209 |
| `-6`（24px） | `panel-padding` / `card-padding` / `form-field-gap` | 86 |
| `-8`（32px） | `section-gap` | 33 |
| `-3`（12px） | `button-gap` | 570 |

迁移原则：

1. 按 token 归并时的命中数不等于实际改动数。同一个 `p-6` 在不同语义下可能应
   改成 `p-panel-padding`、`p-card-padding` 或 `p-form-field-gap`，必须看上下文，
   不能全局替换。
2. `gap-4` 之类的网格间距若应随视口缩放，保留 `gap-4` 或改用
   `gap-[var(--ws-layout-gap)]`，不要机械替换成 `gap-item-gap`。
3. 一次迁移一个页面或一个组件目录，迁移后目视核对间距是否变化，避免整片视觉抖动。
4. 新增代码一律使用语义 token，不要再引入新的数字间距类。



## 四、字号、圆角与阴影（index.css，随视口缩放）

> 本节由 2026-10-04 抢救自已删除的 `UI_DESIGN_ANALYSIS.md` §3.2/§3.4，
> **数值已逐条与 `index.css` 核对一致**。此前项目虽有这些 token，但无任何文档记录。

### 4.1 字号体系

| 变量 | 值 | 用途 |
|------|-----|------|
| `--ws-text-xs` | `clamp(12px, calc(0.08vw + 11.6px), 13px)` | 小标签 |
| `--ws-text-sm` | `clamp(13px, calc(0.1vw + 12.4px), 15px)` | 正文辅助 |
| `--ws-text-md` | `clamp(14px, calc(0.14vw + 12.8px), 16px)` | 正文主体 |
| `--ws-text-lg` | `clamp(15px, calc(0.2vw + 14px), 19px)` | 标题 |
| `--ws-text-xl` | `clamp(18px, calc(0.34vw + 16px), 24px)` | 页面标题 |
| `--ws-text-2xl` | `clamp(22px, calc(0.40vw + 19px), 32px)` | Hero |
| `--ws-text-nav` | `clamp(14px, calc(0.12vw + 13.4px), 16px)` | 导航项 |
| `--ws-text-nav-brand` | `clamp(17px, calc(0.16vw + 16.2px), 20.5px)` | 品牌名 |

语义别名：`--ws-text-body` → `--ws-text-md`；`--ws-text-title` → `--ws-text-lg`；
`--ws-text-caption` → `--ws-text-sm`。另有基准 `--ws-font-size-base`。

字体栈：`--ws-font-family`（系统字体 + Inter + Noto Sans SC + PingFang SC 等）、
`--ws-font-mono`（SFMono-Regular / JetBrains Mono / Fira Code 等）。

**待办**：项目**尚无字号 Tailwind token**，仍有 `text-[Npx]` 硬编码（见新计划 B2）；
行高约定为正文 1.6、标题 1.35。

### 4.2 圆角

| 变量 | 值 | 用途 |
|------|-----|------|
| `--ws-radius-sm` | `clamp(6px, calc(0.12vw + 5px), 8px)` | 按钮、输入框 |
| `--ws-radius-md` | `clamp(10px, calc(0.2vw + 8px), 14px)` | 卡片 |
| `--ws-radius-lg` | `clamp(14px, calc(0.3vw + 12px), 20px)` | 大卡片（`--radius` 指向它） |
| `--ws-radius-xl` | `24px` | Hero |

### 4.3 阴影

| 变量 | 值 |
|------|-----|
| `--ws-shadow-sm` | `0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)` |
| `--ws-shadow-lg` | `0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)` |
| `--ws-shadow-xl` | `0 4px 12px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.08)` |
| `--ws-shadow-floating` | `0 6px 16px rgba(15, 23, 42, 0.22)` |

### 4.4 语义标题 / 文本 class（已于 2026-10-05 删除）

> ⚠️ **这 5 个 class 已删除。** 它们定义在 `index.css` 后**全站 0 引用**——
> `docs/docker/archive/2026-08-06-multi-agent-diagnosis-report.md` 早已点名为「死定义」，
> 但因为没有门禁看着**布局/排版类**（`dead-classes` 只查颜色类），两个月无人处理。
> 2026-10-05 一并清理，并新增 `npm run ui:dead-layout:ci` 门禁防止复发。
>
> 删除清单：`.ws-heading-page` / `.ws-heading-section` / `.ws-heading-card` /
> `.ws-text-body` / `.ws-text-meta`。
>
> **注意区分**：`--ws-text-body` 是 **CSS 变量**（不是上面的 class），它**仍然存在且在用**；
> 被删的是同名 **class** `.ws-text-body`。
>
> 页面需要标题/正文排版时，请直接用排版 token（`var(--ws-text-*)` + Tailwind `text-*`/`font-*`）
> 或现有组件（`<Card>` 等），**不要再新增语义标题 class**。

---
