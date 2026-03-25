/**
 * XBK 表格工具函数
 */

/**
 * 计算字符串的字节长度（中文算2个字节）
 */
export const cnLen = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const s = String(value);
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
};

/**
 * 限制数值在指定范围内
 */
export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

/**
 * 根据数据内容计算列宽
 */
export const calcColumnWidth = (
  rows: Array<Record<string, unknown>>,
  key: string,
  title: string,
  min: number,
  max: number,
  sampleSize = 200,
): number => {
  const sample = rows.slice(0, Math.max(0, sampleSize));
  let maxLen = cnLen(title);
  for (const r of sample) maxLen = Math.max(maxLen, cnLen(r?.[key]));
  return clamp(maxLen * 8 + 24, min, max);
};

/**
 * 计算表格滚动区域高度
 */
export const getScrollY = (root: HTMLDivElement | null): number => {
  if (!root) return 360;
  const holder = root.querySelector(".ant-tabs-content-holder") as HTMLElement | null;
  const nav = root.querySelector(".ant-tabs-nav") as HTMLElement | null;
  const pagination = root.querySelector(".ant-table-pagination") as HTMLElement | null;
  if (!holder) return 360;
  const holderH = holder.offsetHeight;
  const navH = nav?.offsetHeight || 0;
  const paginationH = pagination?.offsetHeight || 0;
  return Math.max(360, holderH - navH - paginationH - 16);
};
