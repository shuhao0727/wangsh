import dayjs from "dayjs";

/**
 * 统一的日期时间格式化工具
 *
 * @param timestamp - ISO 8601 格式的时间戳字符串或 Date 对象
 * @param format - 格式化模板，默认 "YYYY-MM-DD HH:mm:ss"
 * @returns 格式化后的日期时间字符串
 *
 * @example
 * formatDateTime("2024-10-10T12:30:00Z") // "2024-10-10 12:30:00"
 * formatDateTime("2024-10-10T12:30:00Z", "YYYY-MM-DD") // "2024-10-10"
 * formatDateTime("2024-10-10T12:30:00Z", "HH:mm") // "12:30"
 */
export function formatDateTime(
  timestamp: string | Date,
  format = "YYYY-MM-DD HH:mm:ss"
): string {
  return dayjs(timestamp).format(format);
}

/**
 * 格式化日期（不含时间）
 *
 * @param timestamp - ISO 8601 格式的时间戳字符串或 Date 对象
 * @param format - 格式化模板，默认 "YYYY-MM-DD"
 * @returns 格式化后的日期字符串
 *
 * @example
 * formatDate("2024-10-10T12:30:00Z") // "2024-10-10"
 * formatDate("2024-10-10T12:30:00Z", "YYYY/MM/DD") // "2024/10/10"
 */
export function formatDate(
  timestamp: string | Date,
  format = "YYYY-MM-DD"
): string {
  return dayjs(timestamp).format(format);
}

/**
 * 将秒数格式化为 mm:ss 格式
 *
 * @param seconds - 秒数
 * @returns 格式化后的时间字符串
 *
 * @example
 * formatDuration(65) // "01:05"
 * formatDuration(3600) // "60:00"
 * formatDuration(0) // "00:00"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
