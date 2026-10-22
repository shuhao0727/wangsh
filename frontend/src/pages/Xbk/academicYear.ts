export const formatAcademicYear = (startYear: number): string =>
  `${startYear}-${startYear + 1}`;

/** 完整学年格式 YYYY-YYYY：用于判断输入框是否已写完，可立即提交 */
export const FULL_ACADEMIC_YEAR_RE = /^\d{4}-\d{4}$/;

export const getCurrentAcademicYear = (date = new Date()): string => {
  const calendarYear = date.getFullYear();
  const startYear = date.getMonth() < 7 ? calendarYear - 1 : calendarYear;
  return formatAcademicYear(startYear);
};

/**
 * 把用户输入的学年规范化成 YYYY-YYYY。
 * 与后端 `backend/app/utils/academic_year.py` 保持一致：
 * 接受纯 4 位起始年份并自动补全（2026 → 2026-2027）。
 * 非法或空值返回 undefined。
 */
export const normalizeAcademicYear = (value: string): string | undefined => {
  const text = value.trim();
  if (!text) return undefined;

  // 纯 4 位年份：按起始年份自动补全
  const singleYear = /^(\d{4})$/.exec(text);
  if (singleYear) {
    const start = Number(singleYear[1]);
    if (start < 2000 || start > 2099) return undefined;
    return formatAcademicYear(start);
  }

  const match = /^(\d{4})-(\d{4})$/.exec(text);
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start < 2000 || start > 2099 || end !== start + 1) return undefined;
  return `${start}-${end}`;
};

export const isValidAcademicYear = (value: string): boolean =>
  normalizeAcademicYear(value) !== undefined;
