# KNN Interactive Teaching Board -- Implementation Plan

## Overview

Add a fully interactive KNN algorithm teaching board at `/it-technology/knn`. The board lets users place new data points on a 2D ECharts scatter chart, see KNN classification happen in real time with a K-value slider, and understand the algorithm visually.

---

## File Manifest (5 files total: 3 new + 2 modified)

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/pages/ITTechnology/KNNBoard.tsx` | NEW | The interactive board component (ECharts + state machine + UI) |
| `frontend/src/pages/ITTechnology/KNNPage.tsx` | NEW | Content page wrapping the board with educational explanation |
| `frontend/src/pages/ITTechnology/KNNFullPage.tsx` | NEW | Full-screen `h-screen` route container (mirrors `MLFullPage`) |
| `frontend/src/App.tsx` | MODIFY | Add lazy route + `PageErrorBoundary` wrapper |
| `frontend/src/pages/ITTechnology/index.tsx` | MODIFY | Add `knn` entry to APPS array + feature flag + navigation handler |

---

## Step-by-Step Implementation Details

### Step 1: Create `KNNFullPage.tsx`

**Pattern to follow:** `MLFullPage.tsx` (3 lines of JSX)

```tsx
// frontend/src/pages/ITTechnology/KNNFullPage.tsx
import React from "react";
import KNNPage from "./KNNPage";

const KNNFullPage: React.FC = () => (
  <div className="h-screen flex flex-col overflow-hidden">
    <KNNPage />
  </div>
);

export default KNNFullPage;
```

This is the thinnest possible wrapper -- just a full-height container. No layout (no BasicLayout) so it occupies the entire viewport for the chart.

---

### Step 2: Create `KNNPage.tsx`

**Pattern to follow:** mix of `MLPage.tsx` (layout structure) and the educational content from `math-foundations.md` (Chinese-language explanations).

This component is the content page. It has two sections side by side on desktop, stacked on mobile:

```
+----------------------------------------------------------+
|  KNN 算法交互演示板                        [重置] [预设]  |
+----------------------------------------------------------+
|                     |                                      |
|   <KNNBoard />      |  Educational Sidebar                 |
|   (chart + slider)  |  - Why this classification?         |
|                     |  - Distance table                   |
|                     |  - Vote counts per class            |
|                     |  - Explanation text                 |
+----------------------------------------------------------+
```

**Key details:**
- Uses `useDocumentDarkMode()` to detect dark/light mode
- Passes theme `isDark` to KNNBoard so it can re-initialize ECharts on theme change
- The sidebar shows dynamic content based on the current classification result (received via a callback from KNNBoard)
- Imports from `lucide-react`: `ArrowLeft`, `RotateCcw`, `Target`, `SlidersHorizontal`
- Has a back button linking to `/it-technology`
- Includes preset scenario buttons: "默认数据集" (8 students with game/movement hours from the markdown), "新场景1" (a different student position)
- Shows Chinese educational text like "为什么判断它是X类型？因为最近的K个邻居里有N个是X类型，所以采用多数投票原则"

**Data flow:**
- KNNPage holds high-level state: `selectedPreset`, `resetCounter`
- KNNBoard receives these as props and emits `onClassificationChange(result)` callback
- KNNPage renders the sidebar from the latest classification result

**Type definitions** (defined in KNNPage.tsx or a shared types file):

```typescript
interface DataPoint {
  id: number;
  label: string;       // "同学A", "同学B", ...
  gameHours: number;   // x-axis: weekly gaming hours
  movementHours: number; // y-axis: weekly movement hours
  club: '电竞社' | '篮球社' | '自习社';
}

interface ClassificationResult {
  point: { gameHours: number; movementHours: number };
  distances: Array<{ point: DataPoint; distance: number }>;
  neighbors: Array<{ point: DataPoint; distance: number }>;  // top K
  votes: Record<string, number>;  // e.g. { "电竞社": 2, "篮球社": 1 }
  prediction: string;
  k: number;
}
```

---

### Step 3: Create `KNNBoard.tsx` -- The Core Component

This is the most complex piece. It follows the `StudentBeamChart` pattern closely: `useRef` for chart instance + `echarts.init()` imperatively + cleanup in useEffect.

**3a. Default Training Data (from `math-foundations.md`):**

```typescript
const DEFAULT_TRAINING_DATA: DataPoint[] = [
  { id: 1,  label: "A", gameHours: 20, movementHours: 1,  club: "电竞社" },
  { id: 2,  label: "B", gameHours: 18, movementHours: 3,  club: "电竞社" },
  { id: 3,  label: "C", gameHours: 15, movementHours: 5,  club: "篮球社" },
  { id: 4,  label: "D", gameHours: 5,  movementHours: 18, club: "篮球社" },
  { id: 5,  label: "E", gameHours: 3,  movementHours: 20, club: "篮球社" },
  { id: 6,  label: "F", gameHours: 2,  movementHours: 3,  club: "自习社" },
  { id: 7,  label: "G", gameHours: 5,  movementHours: 2,  club: "自习社" },
  { id: 8,  label: "H", gameHours: 1,  movementHours: 1,  club: "自习社" },
];
```

**3b. Component State:**

```typescript
interface KNNBoardState {
  k: number;                              // current K value (1-8)
  trainingData: DataPoint[];              // the 8 known students
  newPoint: { x: number; y: number } | null;  // user-placed unknown point
  result: ClassificationResult | null;    // computed KNN result
}
```

**3c. ECharts Configuration:**

This is the heart of the visual design. The chart has:

**Axes:**
- X-axis: `每周游戏(小时)` range 0-22
- Y-axis: `每周运动(小时)` range 0-22
- Both with grid lines for readability

**Visual Map (color coding):**
- Use ECharts `visualMap` with `piecewise` type to assign colors:
  - `电竞社` -> `--ws-color-primary` (teal)
  - `篮球社` -> `--ws-color-warning` (amber)
  - `自习社` -> `--ws-color-purple` (violet)

**Series:**
1. **Training points scatter** - colored circles with labels (A, B, C...) using `seriesLayoutBy` and `label.show`
   - `symbolSize: 18` with `itemStyle.borderColor` matching theme surface color
   - Rich tooltip showing name + club + coordinates
2. **New point scatter** (only when placed) - larger star/diamond symbol with distinct color (`--ws-color-danger`)
   - `symbol: 'pin'` or `'diamond'`, `symbolSize: 24`
   - Tooltip: "新同学 (?, ?)"
3. **Distance lines** (line series) - from new point to each of K nearest neighbors
   - One line series per neighbor, or a single `lines` series
   - Using ECharts `markLine` on the new point, OR a separate `line` series with `coords: [[newX, newY], [neighborX, neighborY]]`
   - Style: dashed, semi-transparent, color matching the neighbor's club color
   - Only shown when new point exists
4. **Result annotation** - `graphic` element showing prediction text
   - Positioned near the new point
   - Format: "→ 电竞社" with the predicted club's color

**Theme handling:**
- Read CSS custom properties via `getComputedStyle(document.documentElement)` (same as `chartTheme.ts`)
- On `isDark` prop change, `chartRef.current?.dispose()` and re-init

**Grid / misc:**
- `grid: { left: 60, right: 30, top: 30, bottom: 60 }`
- `tooltip: { trigger: 'item' }` with rich HTML formatting
- No `dataZoom` needed (fixed range)
- Custom `graphic` elements for chart title area

**3d. Click Interaction:**

```typescript
chartRef.current.on("click", (params: any) => {
  // Only respond to clicks on empty chart area (not on existing data points)
  // ECharts passes clicked coordinates. For clicks on blank area, use:
  //   chartRef.current.convertFromPixel({ seriesIndex: 0 }, [params.event.offsetX, params.event.offsetY])
  // Or simpler: get the x/y values directly from the click event
  
  const pointInPixel = [params.event?.offsetX, params.event?.offsetY];
  const pointInGrid = chartRef.current.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, pointInPixel);
  
  // Clamp to reasonable range
  const gameHours = Math.max(0, Math.min(22, Math.round(pointInGrid[0] * 10) / 10));
  const movementHours = Math.max(0, Math.min(22, Math.round(pointInGrid[1] * 10) / 10));
  
  // Only place if click is within grid area
  if (gameHours >= 0 && movementHours >= 0) {
    setNewPoint({ x: gameHours, y: movementHours });
  }
});
```

A click on an existing training point should be ignored (only blank area clicks place new points). Use `params.componentType === 'xAxis' || params.componentType === 'yAxis'` or just check if `params.seriesName` is undefined.

**3e. KNN Distance Computation (pure JS, no library):**

```typescript
function euclideanDistance(a: [number, number], b: [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function computeKNN(
  trainingData: DataPoint[],
  newPoint: { x: number; y: number },
  k: number
): ClassificationResult {
  // 1. Compute distances
  const distances = trainingData.map(point => ({
    point,
    distance: euclideanDistance([point.gameHours, point.movementHours], [newPoint.x, newPoint.y]),
  }));
  
  // 2. Sort by distance ascending
  distances.sort((a, b) => a.distance - b.distance);
  
  // 3. Take top K neighbors
  const neighbors = distances.slice(0, k);
  
  // 4. Count votes
  const votes: Record<string, number> = {};
  neighbors.forEach(({ point }) => {
    votes[point.club] = (votes[point.club] || 0) + 1;
  });
  
  // 5. Find winner (handle ties: pick the one with smallest average distance)
  const sortedVotes = Object.entries(votes).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // more votes first
    // Tiebreaker: smallest avg distance among tied classes
    const avgDistA = neighbors.filter(n => n.point.club === a[0]).reduce((s, n) => s + n.distance, 0) / a[1];
    const avgDistB = neighbors.filter(n => n.point.club === b[0]).reduce((s, n) => s + n.distance, 0) / b[1];
    return avgDistA - avgDistB;
  });
  
  return {
    point: newPoint,
    distances,
    neighbors,
    votes,
    prediction: sortedVotes[0][0],
    k,
  };
}
```

**3f. Chart Update Trigger:**
- `useEffect` that watches `[newPoint, k, trainingData, isDark]`
- When any of these change, recompute chart options and call `chartRef.current.setOption(opts, true)` (not `true` for replace, use `false` for merge or rebuild completely for simplicity)
- Actually: since we need to add/remove distance line series dynamically, we should rebuild the full option object each time

**3g. K-Value Slider:**

Native `<input type="range">` styled with Tailwind:

```tsx
<div className="flex items-center gap-3 px-4 py-3">
  <label className="text-sm font-medium whitespace-nowrap">K = {k}</label>
  <input
    type="range"
    min={1}
    max={8}
    value={k}
    onChange={(e) => setK(Number(e.target.value))}
    className="flex-1 h-2 rounded-full appearance-none bg-surface-2 cursor-pointer
      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 
      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary 
      [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
    style={{
      accentColor: 'var(--ws-color-primary)',
    }}
  />
  <div className="flex gap-1">
    {[1, 3, 5, 7].map(v => (
      <button
        key={v}
        onClick={() => setK(v)}
        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
          k === v ? 'bg-primary text-white border-primary' : 'bg-surface-2 text-text-secondary border-border hover:border-primary/40'
        }`}
      >
        {v}
      </button>
    ))}
  </div>
</div>
```

**3h. Nearby Training Points Highlight:**

When a new point is placed and K neighbors are computed, we need to visually distinguish the K nearest neighbors from other training points:

- Use `symbolSize` callback in the scatter series that checks if a point is in the neighbors array
- Or use TWO scatter series: one for "regular" training points (smaller, muted) and one for "neighbor" training points (larger, highlighted, with glowing effect)
- Option B (two series) is cleaner and used in existing chart patterns

**3i. Component Props:**

```typescript
interface KNNBoardProps {
  height?: number;                          // default 520
  isDark: boolean;
  presetData?: DataPoint[];                 // allows parent to pass different datasets
  presetNewPoint?: { x: number; y: number }; // allows parent to set initial new point
  onClassificationChange?: (result: ClassificationResult | null) => void;
  resetCounter?: number;                    // increment to trigger reset
}
```

---

### Step 4: Modify `App.tsx`

**Add the lazy import** (near line 29, after `AgentsFullPage`):

```tsx
const KNNFullPage = lazy(() => import("./pages/ITTechnology/KNNFullPage"));
```

**Add the route** (after the `/it-technology/agents` route, line 124):

```tsx
<Route path="/it-technology/knn" element={<PageErrorBoundary pageName="knn"><KNNFullPage /></PageErrorBoundary>} />
```

---

### Step 5: Modify `ITTechnology/index.tsx`

**5a. Add to APPS array** (after the agents entry, around line 87):

```tsx
{
  key: 'it_knn_interactive_enabled',
  title: 'KNN 算法交互演示',
  description: '可交互散点图 · K值调节 · 实时分类反馈',
  icon: <Target className="h-5 w-5" />,
  color: 'var(--ws-color-success)',
  bg: 'color-mix(in srgb, var(--ws-color-success) 8%, transparent)',
  ring: 'color-mix(in srgb, var(--ws-color-success) 22%, transparent)',
  action: 'knn',
  available: true,
},
```

Add `Target` to the lucide-react imports on line 9.

**5b. Add to feature flag fetch** (line 103, in the `keys` array):

```tsx
'it_knn_interactive_enabled',
```

**5c. Add navigation handler** (in `renderCard` onClick, line 269):

```tsx
if (app.action === 'knn') window.open('/it-technology/knn', '_blank');
```

---

## Component Tree

```
App.tsx (Route: /it-technology/knn)
  └── KNNFullPage.tsx          [h-screen flex flex-col overflow-hidden]
        └── KNNPage.tsx         [flex layout, holds state]
              ├── Header        [title, back button, reset, presets]
              ├── KNNBoard.tsx  [left/main: ECharts + K slider]
              │     ├── <div ref>       (echarts.init target)
              │     └── <input range>   (K slider + quick-select buttons)
              └── Sidebar       [right: dynamic explanation panel]
                    ├── Classification result
                    ├── Vote breakdown table
                    ├── Distance table (sorted)
                    └── Educational text
```

## Data Flow

```
KNNPage (owner of all state)
  │
  ├── state: preset ("default" | "scenario1")
  ├── state: resetCounter (number, incremented on reset)
  ├── state: classificationResult (ClassificationResult | null)
  │
  ├── passes to KNNBoard:
  │     presetData: DataPoint[]
  │     presetNewPoint: { x, y } | null
  │     isDark: boolean
  │     resetCounter: number
  │     onClassificationChange: (result) => void
  │
  └── KNNBoard internally manages:
        k: number (1-8, default 3)
        newPoint: { x, y } | null
        Computes classification on every (newPoint, k) change
        Calls onClassificationChange(result) for sidebar
        Updates ECharts imperatively on every state change
```

## State Machine (KNNBoard internal)

```
States:
  INITIAL     -> training data shown, no new point, no classification
  POINT_ADDED -> new point placed by user click, classification computed
  K_CHANGED   -> user drags slider, recompute same point with new K

Transitions:
  INITIAL --[chart click on blank area]--> POINT_ADDED
  POINT_ADDED --[chart click on blank area]--> POINT_ADDED (move point)
  POINT_ADDED --[K slider change]--> K_CHANGED (same point, new K)
  POINT_ADDED --[reset]--> INITIAL
  any --[dark mode toggle]--> same state (just re-render chart theme)
```

## ECharts Option Structure (pseudocode)

```typescript
const option: EChartsOption = {
  animationDuration: 400,
  tooltip: { trigger: 'item', confine: true, /* themed */ },
  legend: { show: false },
  grid: { left: 60, right: 30, top: 30, bottom: 50 },
  xAxis: {
    type: 'value', name: '每周游戏(小时)', min: 0, max: 22,
    nameLocation: 'middle', nameGap: 30, axisLine: { show: false },
    splitLine: { lineStyle: { color: theme.grid } },
  },
  yAxis: {
    type: 'value', name: '每周运动(小时)', min: 0, max: 22,
    nameLocation: 'middle', nameGap: 40, axisLine: { show: false },
    splitLine: { lineStyle: { color: theme.grid } },
  },
  visualMap: {
    show: true, orient: 'horizontal', left: 'center', bottom: 5,
    pieces: [
      { label: '电竞社', color: theme.esports },   // teal/primary
      { label: '篮球社', color: theme.basketball }, // amber/warning
      { label: '自习社', color: theme.study },      // violet/purple
    ],
  },
  series: [
    // Series 1: Non-neighbor training points (smaller, muted)
    {
      type: 'scatter', name: '训练数据',
      data: nonNeighborData,  // { value: [game, move, label, club], symbolSize: 14, itemStyle: { opacity: 0.4 } }
      symbolSize: 14,
    },
    // Series 2: K nearest neighbors (larger, highlighted, glow)
    {
      type: 'scatter', name: 'K近邻',
      data: neighborData,  // { value: [game, move, label, club], symbolSize: 22, itemStyle: { shadowBlur: 12 } }
      symbolSize: 22,
      label: { show: true, formatter: '{@[2]}', position: 'top', distance: 8 },
    },
    // Series 3: Distance lines (one per neighbor, dashed)
    ...distanceLines.map(({ from, to, color }) => ({
      type: 'line',
      data: [from, to],
      coordinateSystem: 'cartesian2d',
      lineStyle: { color, type: 'dashed', width: 1.5, opacity: 0.7 },
      symbol: 'none',
      silent: true,
    })),
    // Series 4: New point (if placed)
    ...(newPoint ? [{
      type: 'scatter', name: '新数据点',
      data: [{ value: [newPoint.x, newPoint.y, '新同学', '?'], symbolSize: 26 }],
      symbol: 'diamond',
      symbolSize: 26,
      itemStyle: { color: theme.danger, shadowBlur: 16, shadowColor: theme.danger },
      label: { show: true, formatter: '新同学', position: 'right', distance: 10, color: theme.danger },
    }] : []),
  ],
  graphic: predictionText ? [{ /* positioned text showing prediction */ }] : [],
};
```

## Club Color Mapping

```typescript
const CLUB_COLORS = {
  '电竞社': { color: 'var(--ws-color-primary)', fallback: '#0D9488' },
  '篮球社': { color: 'var(--ws-color-warning)', fallback: '#D97706' },
  '自习社': { color: 'var(--ws-color-purple)', fallback: '#7C3AED' },
};
```

## KNNPage Sidebar Content

The sidebar updates dynamically based on `classificationResult`. When null:

"点击图表空白区域放置一个新数据点，KNN算法将自动判断它属于哪个社团。"

When a result exists, show structured sections:

1. **分类结果卡片** (prominent, colored background):
   ```
   🎯 预测结果: 篮球社
   基于 K=3 个最近邻居的投票
   ```

2. **投票详情表**:
   ```
   | 社团   | 票数 | 占比  |
   |--------|------|-------|
   | 篮球社 | 2    | 66.7% |
   | 电竞社 | 1    | 33.3% |
   ```

3. **K个最近邻居表**:
   ```
   | 排名 | 同学 | 距离  | 游戏 | 运动 | 社团   |
   |------|------|-------|------|------|--------|
   | 1    | C    | 3.61  | 15   | 5    | 篮球社 |
   | 2    | A    | 8.60  | 20   | 1    | 电竞社 |
   | 3    | B    | 6.71  | 18   | 3    | 电竞社 |
   ```

4. **解释文本** (educational):
   "为什么判断为 篮球社？因为在最近的 3 个邻居中，有 2 个属于篮球社（C, ?），只有 1 个属于电竞社。根据少数服从多数的投票原则，KNN判断这位新同学适合加入篮球社。"

## Reset Behavior

Reset button clears `newPoint` (sets to null), resets `k` to 3, clears classification result. The chart returns to showing only the 8 original training points.

## Preset Scenarios

Two presets defined in KNNPage:

1. **"默认"** -- original dataset, no preset new point. User must click to place one.
2. **"场景：新同学X"** -- same dataset, but pre-places a new point at `(12, 6)` (the example from the markdown). This shows the classification immediately.

## Edge Cases

1. **Click on existing training point**: Ignore (detect via `params.seriesIndex` belonging to scatter series)
2. **Click outside grid area**: Ignore (clamp + range check)
3. **K=8 (all points)**: All training points become neighbors; classification is simply the majority class in the full dataset; visually, all 8 points get the "neighbor" highlight
4. **Tie votes (e.g., K=4 with 2-2 split)**: Tiebreaker uses smallest average distance among tied classes; sidebar shows "平局" note
5. **Dark mode toggle while chart is active**: Chart is disposed and re-initialized with new theme colors (same pattern as StudentBeamChart)
6. **Window resize**: `window.addEventListener("resize", () => chartRef.current?.resize())` in useEffect cleanup
7. **Component unmount**: Dispose chart instance, remove event listeners

## Feature Flag Registration

The backend must have a feature flag `it_knn_interactive_enabled` with value `{ "enabled": true }` in the `/system/public/feature-flags/it_knn_interactive_enabled` endpoint. The frontend already fetches this in ITTechnologyPage's `loadFlags` function (step 5b above).
