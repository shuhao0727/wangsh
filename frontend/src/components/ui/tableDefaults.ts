/**
 * Admin 列表列宽预设 — 用语义化 preset 替代页面内硬编码 w-[260px] 等。
 * 使用方式：在 ColumnDef.meta.sizePreset 中指定预设名。
 *
 * 注意：columnSizePresets 和 getColumnSizeClass 尚未被 DataTable 自动读取，
 * 当前作为参考常量供页面手动使用。后续 DataTable 升级可直接按 meta.sizePreset 映射。
 */
const columnSizePresets = {
  xs: "w-[60px] min-w-[60px]",
  sm: "w-[90px] min-w-[90px]",
  md: "w-[120px] min-w-[120px]",
  lg: "w-[180px] min-w-[180px]",
  xl: "w-[260px] min-w-[260px]",
  status: "w-[100px] min-w-[100px]",
  date: "w-[160px] min-w-[160px]",
  title: "w-[280px] min-w-[200px]",
  action: "w-[120px] min-w-[80px]",
  actionLg: "w-[180px] min-w-[120px]",
} as const;

type ColumnSizePreset = keyof typeof columnSizePresets;

const TABLE_MIN_WIDTH_PRESETS = {
  sm: "min-w-[640px]",
  md: "min-w-[900px]",
  lg: "min-w-[1100px]",
  xl: "min-w-[1300px]",
} as const;

type TableDensity = "compact" | "default" | "comfortable";

const densityStyles: Record<TableDensity, string> = {
  compact: "[&_tbody_td]:py-1.5 [&_thead_th]:h-8",
  default: "[&_tbody_td]:py-2.5 [&_thead_th]:h-[var(--ws-control-height)]",
  comfortable: "[&_tbody_td]:py-3.5 [&_thead_th]:h-12",
};

export {
  columnSizePresets,
  TABLE_MIN_WIDTH_PRESETS,
  densityStyles,
  type ColumnSizePreset,
  type TableDensity,
};
