/**
 * 从错误对象中提取可读的错误消息
 *
 * @param error - 错误对象（可以是 Error、字符串或其他类型）
 * @returns 格式化后的错误消息
 *
 * @example
 * getErrorMessage(new Error("Network error")) // "Network error"
 * getErrorMessage({ response: { data: { detail: "Not found" } } }) // "Not found"
 * getErrorMessage("Something went wrong") // "Something went wrong"
 * getErrorMessage(null) // "未知错误"
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return "未知错误";

  // 标准 Error 对象
  if (error instanceof Error) {
    return error.message;
  }

  // Axios 错误格式
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null
  ) {
    const data = error.response.data as Record<string, unknown>;
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (typeof data.message === "string") {
      return data.message;
    }
  }

  // 字符串错误
  if (typeof error === "string") {
    return error;
  }

  // 其他情况
  return "未知错误";
}
