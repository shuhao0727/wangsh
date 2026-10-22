/**
 * XBK 年级枚举（前端唯一来源）
 *
 * 后端 `grade` 字段本身是 ≤20 字符的自由文本（见
 * backend/app/schemas/xbk/validation.py），导出排序已支持高三
 * （backend/app/services/xbk/course_selection_workbook.py）。
 * 前端下拉只提供这三个标准值，避免“导入高三后筛选不到、编辑保存失败”。
 *
 * 历史数据可能含枚举外的旧值（如“中一”）。这类值不进入下拉候选，
 * 但在编辑弹窗中会作为“旧值”原样保留，见 XbkEditModal 的兼容处理。
 */
export const XBK_GRADES = ["高一", "高二", "高三"] as const;

export type XbkGrade = (typeof XBK_GRADES)[number];

/** 是否为标准年级枚举值 */
export const isXbkGrade = (value?: string | null): value is XbkGrade =>
  XBK_GRADES.includes(value as XbkGrade);
